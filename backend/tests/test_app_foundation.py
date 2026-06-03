from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.api import websocket_endpoint
from app.core.config import Settings
from app.main import create_app


def test_startup_creates_data_directories_database_and_log_files(
    tmp_path: Path,
) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert settings.scripts_dir == tmp_path / "scripts"
    assert settings.reports_dir == tmp_path / "reports"
    assert settings.database_path == tmp_path / "testflow.sqlite3"
    assert settings.app_log_path == tmp_path / "logs" / "app.log"
    assert settings.execution_log_path == tmp_path / "logs" / "execution.log"
    assert settings.scripts_dir.is_dir()
    assert settings.reports_dir.is_dir()
    assert settings.database_path.is_file()
    assert settings.app_log_path.is_file()
    assert settings.execution_log_path.is_file()


def test_api_route_groups_are_registered(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        endpoints = [
            "/api/keywords",
            "/api/scripts",
            "/api/tasks",
            "/api/reports",
            "/api/commands",
        ]
        responses = [client.get(endpoint) for endpoint in endpoints]

    assert [response.status_code for response in responses] == [200] * len(endpoints)
    assert responses[0].json()["items"][0]["name"] == "wait"
    assert responses[1].json() == {"items": []}
    assert [response.json() for response in responses[2:]] == [
        {"items": []},
        {"items": []},
        {"items": []},
    ]


def test_websocket_route_is_registered(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        with client.websocket_connect("/ws") as websocket:
            assert websocket.receive_json() == {
                "type": "connection",
                "status": "connected",
            }


@pytest.mark.anyio
async def test_websocket_endpoint_ignores_client_disconnect() -> None:
    class DisconnectingWebSocket:
        async def accept(self) -> None:
            return None

        async def send_json(self, _message: dict[str, str]) -> None:
            raise WebSocketDisconnect(code=1006)

        async def close(self) -> None:
            return None

    await websocket_endpoint(DisconnectingWebSocket())  # type: ignore[arg-type]


@pytest.mark.anyio
async def test_websocket_endpoint_stays_open_until_client_disconnect() -> None:
    class TrackingWebSocket:
        def __init__(self) -> None:
            self.closed = False
            self.messages: list[dict[str, str]] = []
            self.receive_calls = 0

        async def accept(self) -> None:
            return None

        async def send_json(self, message: dict[str, str]) -> None:
            self.messages.append(message)

        async def receive_text(self) -> str:
            self.receive_calls += 1
            raise WebSocketDisconnect(code=1000)

        async def close(self) -> None:
            self.closed = True

    websocket = TrackingWebSocket()

    await websocket_endpoint(websocket)  # type: ignore[arg-type]

    assert websocket.messages == [{"type": "connection", "status": "connected"}]
    assert websocket.receive_calls == 1
    assert websocket.closed is False


def test_http_errors_use_common_error_response_format(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.get("/missing")

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "not_found",
            "message": "Not Found",
            "details": {},
        }
    }


def test_api_route_modules_keep_expected_prefixes() -> None:
    from app.api.routes import (
        commands,
        executions,
        health,
        keywords,
        reports,
        scripts,
        terminal,
        websockets,
    )

    assert health.router.prefix == ""
    assert reports.router.prefix == ""
    assert keywords.router.prefix == ""
    assert scripts.router.prefix == ""
    assert executions.router.prefix == ""
    assert commands.router.prefix == ""
    assert websockets.router.prefix == ""
    assert terminal.router.prefix == ""


def test_api_package_exports_compatibility_endpoints() -> None:
    from app.api import (
        api_router,
        execution_websocket_endpoint,
        ssh_websocket_endpoint,
        websocket_endpoint,
        websocket_router,
    )

    assert api_router.prefix == "/api"
    assert websocket_router.prefix == ""
    assert websocket_endpoint.__name__ == "websocket_endpoint"
    assert execution_websocket_endpoint.__name__ == "execution_websocket_endpoint"
    assert ssh_websocket_endpoint.__name__ == "ssh_websocket_endpoint"


def test_local_vite_origin_is_allowed_for_browser_api_calls(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.options(
            "/health",
            headers={
                "Access-Control-Request-Method": "GET",
                "Origin": "http://127.0.0.1:5174",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5174"


def test_legacy_backend_shims_have_been_removed() -> None:
    backend_root = Path(__file__).resolve().parents[1]
    legacy_paths = [
        backend_root / "app/command_library.py",
        backend_root / "app/config.py",
        backend_root / "app/errors.py",
        backend_root / "app/execution",
        backend_root / "app/logging.py",
        backend_root / "app/script_catalog.py",
        backend_root / "app/ssh_terminal.py",
    ]

    existing_paths = [
        path.relative_to(backend_root).as_posix()
        for path in legacy_paths
        if path.exists()
    ]
    assert existing_paths == []
