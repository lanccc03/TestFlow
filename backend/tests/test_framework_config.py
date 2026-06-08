from collections.abc import AsyncIterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from autotest.contracts import (
    FrameworkConfigError,
    FrameworkEvent,
    FrameworkRunRequest,
    JsonValue,
)
from autotest.registry import reset_runtime_for_testing, set_runtime_for_testing


@pytest.fixture(autouse=True)
def reset_runtime() -> None:
    reset_runtime_for_testing()
    yield
    reset_runtime_for_testing()


def test_framework_config_defaults_to_empty_object_for_mock_runtime(
    tmp_path,
) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.get("/api/framework/config")

    assert response.status_code == 200
    assert response.json() == {}


def test_framework_config_can_be_replaced_with_nested_json(tmp_path) -> None:
    settings = Settings(data_dir=tmp_path)
    config = {
        "environment": {"name": "dev", "base_url": "http://127.0.0.1"},
        "devices": [{"name": "bench-1", "host": "192.168.1.10"}],
        "variables": {"retries": 2, "dry_run": False},
    }

    with TestClient(create_app(settings)) as client:
        update_response = client.put("/api/framework/config", json=config)
        read_response = client.get("/api/framework/config")

    assert update_response.status_code == 200
    assert update_response.json() == config
    assert read_response.status_code == 200
    assert read_response.json() == config


@pytest.mark.parametrize("config", [["dev"], "dev", 3, 1.5, True, None])
def test_framework_config_accepts_any_json_root_value(
    tmp_path,
    config: JsonValue,
) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        if config is None:
            update_response = client.put(
                "/api/framework/config",
                content="null",
                headers={"content-type": "application/json"},
            )
        else:
            update_response = client.put("/api/framework/config", json=config)
        read_response = client.get("/api/framework/config")

    assert update_response.status_code == 200
    assert update_response.json() == config
    assert read_response.status_code == 200
    assert read_response.json() == config


def test_framework_config_runtime_errors_use_common_error_response(
    tmp_path,
) -> None:
    class BrokenConfigRuntime:
        def run_script(
            self,
            _request: FrameworkRunRequest,
        ) -> AsyncIterator[FrameworkEvent]:
            raise NotImplementedError

        def read_config(self) -> JsonValue:
            raise FrameworkConfigError(
                code="framework_config_unavailable",
                message="Framework config is unavailable",
                status_code=501,
                details={"runtime": "broken"},
            )

        def write_config(self, _config: JsonValue) -> JsonValue:
            raise FrameworkConfigError(
                code="framework_config_unavailable",
                message="Framework config is unavailable",
                status_code=501,
                details={"runtime": "broken"},
            )

    settings = Settings(data_dir=tmp_path)
    set_runtime_for_testing(BrokenConfigRuntime())  # type: ignore[arg-type]

    with TestClient(create_app(settings)) as client:
        read_response = client.get("/api/framework/config")
        write_response = client.put("/api/framework/config", json={"env": "dev"})

    expected = {
        "error": {
            "code": "framework_config_unavailable",
            "message": "Framework config is unavailable",
            "details": {"runtime": "broken"},
        }
    }
    assert read_response.status_code == 501
    assert read_response.json() == expected
    assert write_response.status_code == 501
    assert write_response.json() == expected
