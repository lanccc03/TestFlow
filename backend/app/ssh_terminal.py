import asyncio
from collections.abc import Callable
from typing import Any

import asyncssh
from fastapi import WebSocket
from pydantic import BaseModel, Field
from starlette.websockets import WebSocketDisconnect

SshConnector = Callable[..., Any]


class SshConnectMessage(BaseModel):
    type: str
    host: str = Field(min_length=1)
    port: int = Field(default=22, ge=1, le=65535)
    username: str = Field(min_length=1)
    password: str = ""
    cols: int = Field(default=80, ge=1)
    rows: int = Field(default=24, ge=1)
    skip_host_key_check: bool = False


async def handle_ssh_terminal_websocket(
    websocket: WebSocket,
    connector: SshConnector = asyncssh.connect,
) -> None:
    await websocket.accept()
    secrets: list[str] = []
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

                connect_kwargs: dict[str, Any] = {
                    "port": request.port,
                    "username": request.username,
                    "password": request.password,
                }
                if request.skip_host_key_check:
                    connect_kwargs["known_hosts"] = None

                connection_context = connector(request.host, **connect_kwargs)
                connection = await connection_context.__aenter__()
                process_context = connection.create_process(
                    term_type="xterm-256color",
                    term_size=(request.cols, request.rows),
                )
                process = await process_context.__aenter__()
                output_task = asyncio.create_task(
                    _relay_output(websocket, process, secrets)
                )
                await _send_json(websocket, {"type": "status", "status": "connected"})
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
            {"type": "status", "status": "error", "message": message}
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
            }
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
