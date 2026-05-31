from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_lists_default_keyword_metadata(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.get("/api/keywords")

    assert response.status_code == 200
    assert response.json()["items"][0] == {
        "name": "wait",
        "description": "等待指定秒数",
        "module": "flow",
        "parameters": [
            {
                "name": "seconds",
                "description": "等待时长，单位秒",
                "type": "integer",
                "default": 1,
                "required": True,
                "example": 5,
            }
        ],
        "example": {"seconds": 5},
        "enabled": True,
    }


def test_creates_saves_and_reads_structured_yaml_script(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    payload = {
        "id": "smoke-cockpit",
        "name": "座舱冒烟测试",
        "description": "基础稳定性巡检",
        "variables": [
            {
                "name": "device_ip",
                "description": "目标设备 IP",
                "type": "string",
                "default": "127.0.0.1",
                "required": True,
            }
        ],
        "steps": [
            {
                "id": "step-1",
                "keyword": "wait",
                "description": "等待系统稳定",
                "enabled": True,
                "params": {"seconds": 3},
            }
        ],
    }

    with TestClient(create_app(settings)) as client:
        create_response = client.post("/api/scripts", json=payload)
        detail_response = client.get("/api/scripts/smoke-cockpit")
        list_response = client.get("/api/scripts")

    assert create_response.status_code == 201
    assert create_response.json()["version"]["revision"] == 1
    assert detail_response.status_code == 200
    assert detail_response.json() == create_response.json()
    assert list_response.json()["items"] == [
        {
            "id": "smoke-cockpit",
            "name": "座舱冒烟测试",
            "description": "基础稳定性巡检",
            "step_count": 1,
            "enabled_step_count": 1,
            "revision": 1,
            "updated_at": create_response.json()["version"]["updated_at"],
        }
    ]
    assert (settings.scripts_dir / "smoke-cockpit.yaml").is_file()


def test_increments_script_revision_when_saving_existing_script(
    tmp_path: Path,
) -> None:
    settings = Settings(data_dir=tmp_path)
    payload = {
        "id": "repeatable",
        "name": "可重复保存脚本",
        "description": "",
        "variables": [],
        "steps": [
            {
                "id": "step-1",
                "keyword": "wait",
                "description": "",
                "enabled": True,
                "params": {"seconds": 1},
            }
        ],
    }

    with TestClient(create_app(settings)) as client:
        first_response = client.post("/api/scripts", json=payload)
        payload["description"] = "第二版"
        second_response = client.post("/api/scripts", json=payload)

    assert first_response.status_code == 201
    assert second_response.status_code == 200
    assert second_response.json()["version"]["revision"] == 2
    assert second_response.json()["description"] == "第二版"


def test_rejects_script_with_missing_required_keyword_parameter(
    tmp_path: Path,
) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/api/scripts",
            json={
                "id": "missing-param",
                "name": "缺少参数",
                "steps": [
                    {
                        "id": "step-1",
                        "keyword": "wait",
                        "params": {},
                    }
                ],
            },
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "script_validation_error"
    assert response.json()["error"]["details"] == [
        {
            "field": "steps[0].params.seconds",
            "message": "Missing required parameter",
        }
    ]


def test_rejects_script_with_unknown_keyword(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/api/scripts",
            json={
                "id": "unknown-keyword",
                "name": "未知关键字",
                "steps": [
                    {
                        "id": "step-1",
                        "keyword": "device.reboot",
                        "params": {},
                    }
                ],
            },
        )

    assert response.status_code == 422
    assert response.json()["error"]["details"] == [
        {
            "field": "steps[0].keyword",
            "message": "Unknown keyword: device.reboot",
        }
    ]


def test_rejects_script_with_wrong_parameter_type(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/api/scripts",
            json={
                "id": "wrong-type",
                "name": "参数类型错误",
                "steps": [
                    {
                        "id": "step-1",
                        "keyword": "wait",
                        "params": {"seconds": "fast"},
                    }
                ],
            },
        )

    assert response.status_code == 422
    assert response.json()["error"]["details"] == [
        {
            "field": "steps[0].params.seconds",
            "message": "Expected integer",
        }
    ]
