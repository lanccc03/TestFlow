from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.api import websocket_endpoint
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


def test_script_and_keyword_modules_export_compatible_catalog_api() -> None:
    from app.modules.keywords.schemas import KeywordMetadata, KeywordParameter
    from app.modules.keywords.service import load_keywords
    from app.modules.scripts.schemas import ScriptStep, TestScript
    from app.modules.scripts.service import read_script, save_script
    from app.script_catalog import KeywordMetadata as LegacyKeywordMetadata
    from app.script_catalog import KeywordParameter as LegacyKeywordParameter
    from app.script_catalog import ScriptStep as LegacyScriptStep
    from app.script_catalog import TestScript as LegacyTestScript
    from app.script_catalog import load_keywords as legacy_load_keywords
    from app.script_catalog import read_script as legacy_read_script
    from app.script_catalog import save_script as legacy_save_script

    assert LegacyKeywordMetadata is KeywordMetadata
    assert LegacyKeywordParameter is KeywordParameter
    assert LegacyScriptStep is ScriptStep
    assert LegacyTestScript is TestScript
    assert legacy_load_keywords is load_keywords
    assert legacy_read_script is read_script
    assert legacy_save_script is save_script


def test_core_and_db_imports_remain_compatible() -> None:
    from app.config import Settings as LegacySettings
    from app.config import get_settings as legacy_get_settings
    from app.core.config import Settings, get_settings
    from app.core.errors import error_response
    from app.core.logging import configure_logging
    from app.db import create_db_engine, ensure_database, run_migrations
    from app.db.session import create_db_engine as canonical_create_db_engine
    from app.errors import error_response as legacy_error_response
    from app.logging import configure_logging as legacy_configure_logging

    assert LegacySettings is Settings
    assert legacy_get_settings is get_settings
    assert legacy_error_response is error_response
    assert legacy_configure_logging is configure_logging
    assert create_db_engine is canonical_create_db_engine
    assert ensure_database.__name__ == "ensure_database"
    assert run_migrations.__name__ == "run_migrations"


def test_command_module_exports_compatible_library_api() -> None:
    from app.command_library import CommandTemplatePayload as LegacyPayload
    from app.command_library import CommandTemplateRecord as LegacyRecord
    from app.command_library import CommandTemplateResponse as LegacyResponse
    from app.command_library import create_command_template as legacy_create
    from app.command_library import delete_command_template as legacy_delete
    from app.command_library import list_command_templates as legacy_list
    from app.command_library import update_command_template as legacy_update
    from app.modules.commands import (
        CommandTemplatePayload,
        CommandTemplateRecord,
        CommandTemplateResponse,
        create_command_template,
        delete_command_template,
        list_command_templates,
        update_command_template,
    )

    assert LegacyPayload is CommandTemplatePayload
    assert LegacyRecord is CommandTemplateRecord
    assert LegacyResponse is CommandTemplateResponse
    assert legacy_create is create_command_template
    assert legacy_delete is delete_command_template
    assert legacy_list is list_command_templates
    assert legacy_update is update_command_template


def test_execution_modules_export_compatible_api() -> None:
    from app.execution.events import ExecutionEventBus as LegacyEventBus
    from app.execution.models import ExecutionTask as LegacyExecutionTask
    from app.execution.models import ExecutionTaskCreate as LegacyExecutionTaskCreate
    from app.execution.service import ExecutionService as LegacyExecutionService
    from app.execution.service import TaskAlreadyFinishedError as LegacyFinishedError
    from app.execution.service import TaskNotFoundError as LegacyNotFoundError
    from app.execution.service import _framework_request as legacy_framework_request
    from app.modules.executions.events import ExecutionEventBus
    from app.modules.executions.runner import _framework_request
    from app.modules.executions.schemas import ExecutionTask, ExecutionTaskCreate
    from app.modules.executions.service import (
        ExecutionService,
        TaskAlreadyFinishedError,
        TaskNotFoundError,
    )

    assert LegacyEventBus is ExecutionEventBus
    assert LegacyExecutionTask is ExecutionTask
    assert LegacyExecutionTaskCreate is ExecutionTaskCreate
    assert LegacyExecutionService is ExecutionService
    assert LegacyFinishedError is TaskAlreadyFinishedError
    assert LegacyNotFoundError is TaskNotFoundError
    assert legacy_framework_request is _framework_request


def test_terminal_modules_export_compatible_ssh_api() -> None:
    from app.integrations.ssh.client import SshConnector
    from app.modules.terminal.schemas import SshConnectMessage
    from app.modules.terminal.websocket import (
        _relay_output,
        _sanitize_message,
        _send_json,
        handle_ssh_terminal_websocket,
    )
    from app.ssh_terminal import SshConnectMessage as LegacySshConnectMessage
    from app.ssh_terminal import SshConnector as LegacySshConnector
    from app.ssh_terminal import _relay_output as legacy_relay_output
    from app.ssh_terminal import _sanitize_message as legacy_sanitize_message
    from app.ssh_terminal import _send_json as legacy_send_json
    from app.ssh_terminal import (
        handle_ssh_terminal_websocket as legacy_handle_ssh_terminal_websocket,
    )

    assert LegacySshConnectMessage is SshConnectMessage
    assert LegacySshConnector is SshConnector
    assert legacy_handle_ssh_terminal_websocket is handle_ssh_terminal_websocket
    assert legacy_relay_output is _relay_output
    assert legacy_sanitize_message is _sanitize_message
    assert legacy_send_json is _send_json
