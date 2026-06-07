from collections.abc import Iterator
from typing import Any

import pytest
from starlette.websockets import WebSocketDisconnect

from app.modules.terminal.sessions import SshSessionRegistry
from app.modules.terminal.websocket import handle_ssh_terminal_websocket


@pytest.mark.anyio
async def test_ssh_websocket_forwards_terminal_messages_and_uses_known_hosts_by_default(
) -> None:
    connector = FakeSshConnector()
    registry = SshSessionRegistry()
    websocket = FakeWebSocket(
        [
            {
                "type": "connect",
                "host": "127.0.0.1",
                "port": 2222,
                "username": "tester",
                "password": "secret-password",
                "cols": 100,
                "rows": 40,
                "skip_host_key_check": False,
            },
            {"type": "input", "data": "pwd\n"},
            {"type": "resize", "cols": 120, "rows": 32},
            {"type": "disconnect"},
        ]
    )

    await handle_ssh_terminal_websocket(
        websocket,
        connector=connector,
        session_registry=registry,
    )

    assert websocket.accepted is True
    assert connector.calls[0] == {
        "host": "127.0.0.1",
        "port": 2222,
        "username": "tester",
        "password": "secret-password",
    }
    assert connector.connection.process.term_type == "xterm-256color"
    assert connector.connection.process.term_size == (100, 40)
    assert connector.connection.process.stdin.writes == ["pwd\n"]
    assert connector.connection.process.resizes == [(120, 32)]
    assert connector.connection.process.closed is True
    assert connector.connection.closed is True
    assert {"type": "status", "status": "connecting"} in websocket.sent
    connected_message = next(
        message
        for message in websocket.sent
        if message.get("type") == "status" and message.get("status") == "connected"
    )
    assert isinstance(connected_message["session_id"], str)
    assert {"type": "output", "data": "ready\r\n"} in websocket.sent
    assert {"type": "status", "status": "disconnected"} in websocket.sent
    assert registry.get(connected_message["session_id"]) is None


@pytest.mark.anyio
async def test_ssh_websocket_can_skip_host_key_check_for_single_connection() -> None:
    connector = FakeSshConnector()
    websocket = FakeWebSocket(
        [
            {
                "type": "connect",
                "host": "10.0.0.2",
                "port": 22,
                "username": "root",
                "password": "secret-password",
                "cols": 80,
                "rows": 24,
                "skip_host_key_check": True,
            },
            {"type": "disconnect"},
        ]
    )

    await handle_ssh_terminal_websocket(websocket, connector=connector)

    assert connector.calls[0]["known_hosts"] is None


@pytest.mark.anyio
async def test_ssh_websocket_sanitizes_password_from_errors() -> None:
    connector = FakeSshConnector(error=OSError("failed secret-password auth"))
    websocket = FakeWebSocket(
        [
            {
                "type": "connect",
                "host": "10.0.0.2",
                "port": 22,
                "username": "root",
                "password": "secret-password",
                "cols": 80,
                "rows": 24,
                "skip_host_key_check": False,
            }
        ]
    )

    await handle_ssh_terminal_websocket(websocket, connector=connector)

    assert {
        "type": "status",
        "status": "error",
        "message": "failed [redacted] auth",
    } in websocket.sent
    assert {
        "type": "error",
        "message": "failed [redacted] auth",
    } in websocket.sent
    assert "secret-password" not in str(websocket.sent)


@pytest.mark.anyio
async def test_ssh_websocket_ignores_disconnect_during_cleanup() -> None:
    websocket = DisconnectingWebSocket()

    await handle_ssh_terminal_websocket(websocket, connector=FakeSshConnector())

    assert websocket.accepted is True


class FakeWebSocket:
    def __init__(self, messages: list[dict[str, Any]]) -> None:
        self.accepted = False
        self.messages: Iterator[dict[str, Any]] = iter(messages)
        self.sent: list[dict[str, Any]] = []

    async def accept(self) -> None:
        self.accepted = True

    async def receive_json(self) -> dict[str, Any]:
        try:
            return next(self.messages)
        except StopIteration as exc:
            raise WebSocketDisconnect(code=1000) from exc

    async def send_json(self, message: dict[str, Any]) -> None:
        self.sent.append(message)


class DisconnectingWebSocket:
    def __init__(self) -> None:
        self.accepted = False

    async def accept(self) -> None:
        self.accepted = True

    async def receive_json(self) -> dict[str, Any]:
        raise WebSocketDisconnect(code=1006)

    async def send_json(self, _message: dict[str, Any]) -> None:
        raise WebSocketDisconnect(code=1006)


class FakeSshConnector:
    def __init__(self, error: Exception | None = None) -> None:
        self.calls: list[dict[str, Any]] = []
        self.connection = FakeConnection()
        self.error = error

    def __call__(self, host: str, **kwargs: Any) -> "FakeConnectionContext":
        self.calls.append({"host": host, **kwargs})
        return FakeConnectionContext(self.connection, self.error)


class FakeConnectionContext:
    def __init__(
        self,
        connection: "FakeConnection",
        error: Exception | None,
    ) -> None:
        self.connection = connection
        self.error = error

    async def __aenter__(self) -> "FakeConnection":
        if self.error:
            raise self.error
        return self.connection

    async def __aexit__(self, *_args: Any) -> None:
        self.connection.closed = True


class FakeConnection:
    def __init__(self) -> None:
        self.closed = False
        self.process = FakeProcess()

    def create_process(self, **kwargs: Any) -> "FakeProcessContext":
        self.process.term_type = kwargs["term_type"]
        self.process.term_size = kwargs["term_size"]
        return FakeProcessContext(self.process)


class FakeProcessContext:
    def __init__(self, process: "FakeProcess") -> None:
        self.process = process

    async def __aenter__(self) -> "FakeProcess":
        return self.process

    async def __aexit__(self, *_args: Any) -> None:
        self.process.closed = True


class FakeProcess:
    def __init__(self) -> None:
        self.closed = False
        self.stdin = FakeStdin()
        self.stdout = FakeStdout(["ready\r\n", ""])
        self.resizes: list[tuple[int, int]] = []
        self.term_size: tuple[int, int] | None = None
        self.term_type = ""

    def change_terminal_size(self, cols: int, rows: int) -> None:
        self.resizes.append((cols, rows))


class FakeStdin:
    def __init__(self) -> None:
        self.writes: list[str] = []

    def write(self, data: str) -> None:
        self.writes.append(data)


class FakeStdout:
    def __init__(self, chunks: list[str]) -> None:
        self.chunks: Iterator[str] = iter(chunks)

    async def read(self, _size: int) -> str:
        return next(self.chunks, "")
