import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_startup_creates_command_template_table(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.get("/health")

    assert response.status_code == 200
    with sqlite3.connect(settings.database_path) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }

    assert "command_templates" in tables


def test_creates_searches_updates_and_deletes_command_template(
    tmp_path: Path,
) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        create_response = client.post(
            "/api/commands",
            json={
                "name": "查看系统日志",
                "command": "tail -f /var/log/syslog",
                "description": "打开系统日志流",
                "group": "diagnostics",
                "tags": ["linux", "logs"],
            },
        )
        created = create_response.json()
        list_response = client.get("/api/commands", params={"search": "tail"})
        update_response = client.put(
            f"/api/commands/{created['id']}",
            json={
                "name": "查看内核日志",
                "command": "dmesg -w",
                "description": "跟随内核日志",
                "group": "diagnostics",
                "tags": ["linux", "kernel"],
            },
        )
        delete_response = client.delete(f"/api/commands/{created['id']}")
        empty_response = client.get("/api/commands")

    assert create_response.status_code == 201
    assert created["id"]
    assert created["name"] == "查看系统日志"
    assert created["command"] == "tail -f /var/log/syslog"
    assert created["tags"] == ["linux", "logs"]
    assert created["created_at"]
    assert created["updated_at"] == created["created_at"]
    assert list_response.json()["items"] == [created]
    assert update_response.status_code == 200
    assert update_response.json()["id"] == created["id"]
    assert update_response.json()["name"] == "查看内核日志"
    assert update_response.json()["command"] == "dmesg -w"
    assert update_response.json()["tags"] == ["linux", "kernel"]
    assert update_response.json()["created_at"] == created["created_at"]
    assert update_response.json()["updated_at"] != created["updated_at"]
    assert delete_response.status_code == 204
    assert empty_response.json() == {"items": []}


def test_rejects_blank_command_template_fields(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/api/commands",
            json={
                "name": " ",
                "command": "",
                "description": "",
                "group": "",
                "tags": [],
            },
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_returns_404_for_missing_command_template(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        update_response = client.put(
            "/api/commands/missing",
            json={
                "name": "不存在",
                "command": "pwd",
                "description": "",
                "group": "",
                "tags": [],
            },
        )
        delete_response = client.delete("/api/commands/missing")

    assert update_response.status_code == 404
    assert update_response.json()["error"]["code"] == "not_found"
    assert delete_response.status_code == 404
    assert delete_response.json()["error"]["code"] == "not_found"
