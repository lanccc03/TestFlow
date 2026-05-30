from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
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
    assert [response.json() for response in responses] == [
        {"items": []},
        {"items": []},
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
