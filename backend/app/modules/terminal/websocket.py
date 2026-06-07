import asyncio
from typing import Any

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

from app.integrations.ssh.client import (
    SshConnector,
    default_ssh_connector,
    open_connection_context,
    open_process_context,
)
from app.modules.terminal.schemas import SshConnectMessage
from app.modules.terminal.sessions import SshSessionRegistry


async def handle_ssh_terminal_websocket(
    websocket: WebSocket,
    connector: SshConnector | None = None,
    session_registry: SshSessionRegistry | None = None,
) -> None:
    resolved_connector = connector or default_ssh_connector()
    registry = session_registry or SshSessionRegistry()
    await websocket.accept()
    secrets: list[str] = []
    session_id: str | None = None
    connection_context: Any | None = None
    process_context: Any | None = None
    process: Any | None = None
    output_task: asyncio.Task[None] | None = None

    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")

            if message_type == "connect":
                request = SshConnectMessage.model_validate(message)
                secrets = [request.password]
                await _send_json(
                    websocket,
                    {"type": "status", "status": "connecting"},
                )

                connection_context = open_connection_context(
                    request,
                    resolved_connector,
                )
                connection = await connection_context.__aenter__()
                session_id = registry.register(
                    connection=connection,
                    host=request.host,
                    username=request.username,
                    secrets=secrets,
                )
                process_context = open_process_context(connection, request)
                process = await process_context.__aenter__()
                output_task = asyncio.create_task(
                    _relay_output(websocket, process, secrets)
                )
                await _send_json(
                    websocket,
                    {
                        "type": "status",
                        "status": "connected",
                        "session_id": session_id,
                    },
                )
                await asyncio.sleep(0)
            elif message_type == "input" and process is not None:
                data = message.get("data", "")
                if isinstance(data, str):
                    process.stdin.write(data)
            elif message_type == "resize" and process is not None:
                cols = message.get("cols")
                rows = message.get("rows")
                if isinstance(cols, int) and isinstance(rows, int):
                    process.change_terminal_size(cols, rows)
            elif message_type == "disconnect":
                break
    except WebSocketDisconnect:
        return
    except Exception as exc:
        message = _sanitize_message(str(exc), secrets)
        await _send_json(
            websocket,
            {"type": "status", "status": "error", "message": message},
        )
        await _send_json(websocket, {"type": "error", "message": message})
    finally:
        if output_task is not None:
            output_task.cancel()
            try:
                await output_task
            except asyncio.CancelledError:
                pass

        if process_context is not None:
            await process_context.__aexit__(None, None, None)
        registry.unregister(session_id)
        if connection_context is not None:
            await connection_context.__aexit__(None, None, None)

        await _send_json(websocket, {"type": "status", "status": "disconnected"})


async def _relay_output(
    websocket: WebSocket,
    process: Any,
    secrets: list[str],
) -> None:
    while True:
        data = await process.stdout.read(4096)
        if not data:
            return
        await _send_json(
            websocket,
            {
                "type": "output",
                "data": _sanitize_message(str(data), secrets),
            },
        )


async def _send_json(websocket: WebSocket, message: dict[str, Any]) -> None:
    try:
        await websocket.send_json(message)
    except (RuntimeError, WebSocketDisconnect):
        return


def _sanitize_message(message: str, secrets: list[str]) -> str:
    sanitized = message
    for secret in secrets:
        if secret:
            sanitized = sanitized.replace(secret, "[redacted]")
    return sanitized
