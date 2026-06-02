import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.db.session import ensure_database
from app.main import create_app
from app.modules.executions.repository import (
    get_execution_report,
    get_execution_task,
    list_execution_task_summaries,
    save_execution_report,
)
from app.modules.executions.schemas import (
    ExecutionLogEntry,
    ExecutionStepResult,
    ExecutionTask,
    ExecutionTaskCreate,
    ExecutionTaskFilters,
)
from app.modules.executions.service import ExecutionService
from app.modules.scripts import (
    ScriptStep,
    save_script,
)
from app.modules.scripts import (
    TestScript as CatalogTestScript,
)


def test_startup_creates_execution_history_tables(tmp_path: Path) -> None:
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

    assert "execution_tasks" in tables
    assert "execution_reports" in tables


def test_repository_saves_and_reads_execution_report(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    with TestClient(create_app(settings)):
        task = ExecutionTask(
            id="exec-1",
            script_id="smoke-cockpit",
            script_name="Smoke Cockpit",
            script_revision=3,
            status="failed",
            environment="local",
            target_device="bench-1",
            variables={"mode": "smoke"},
            executor="alice",
            created_at="2026-06-01T00:00:00+00:00",
            started_at="2026-06-01T00:00:01+00:00",
            finished_at="2026-06-01T00:00:02+00:00",
            duration_ms=1000,
            log_path=str(tmp_path / "logs" / "executions" / "exec-1.log"),
            report_dir=str(tmp_path / "reports" / "exec-1"),
            steps=[
                ExecutionStepResult(
                    id="step-1",
                    index=0,
                    keyword="wait",
                    description="Bad wait",
                    status="failed",
                    input={"seconds": -1},
                    error_message="wait.seconds must be greater than or equal to 0",
                    attachments=[str(tmp_path / "reports" / "exec-1" / "failure.txt")],
                )
            ],
            logs=[
                ExecutionLogEntry(
                    timestamp="2026-06-01T00:00:01+00:00",
                    level="error",
                    message="wait.seconds must be greater than or equal to 0",
                    step_id="step-1",
                )
            ],
            error_message="",
        )

        save_execution_report(settings, task)

    stored_task = get_execution_task(settings, "exec-1")
    report = get_execution_report(settings, "exec-1")
    report_json = tmp_path / "reports" / "exec-1" / "testflow-report.json"

    assert stored_task is not None
    assert stored_task.id == "exec-1"
    assert stored_task.status == "failed"
    assert stored_task.steps[0].error_message == (
        "wait.seconds must be greater than or equal to 0"
    )
    assert report is not None
    assert report.task.id == "exec-1"
    assert report.attachments[0].name == "failure.txt"
    assert report.attachments[0].step_id == "step-1"
    assert report.raw_framework_report is None
    assert report_json.is_file()


def test_repository_filters_history_summaries(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    with TestClient(create_app(settings)):
        first = ExecutionTask(
            id="exec-1",
            script_id="smoke-cockpit",
            script_name="Smoke Cockpit",
            script_revision=1,
            status="passed",
            executor="alice",
            created_at="2026-06-01T00:00:00+00:00",
            steps=[
                ExecutionStepResult(
                    id="step-1",
                    index=0,
                    keyword="log.message",
                    status="passed",
                )
            ],
            report_dir=str(tmp_path / "reports" / "exec-1"),
        )
        second = ExecutionTask(
            id="exec-2",
            script_id="regression-cockpit",
            script_name="Regression Cockpit",
            script_revision=1,
            status="failed",
            executor="bob",
            created_at="2026-06-02T00:00:00+00:00",
            steps=[
                ExecutionStepResult(
                    id="step-1",
                    index=0,
                    keyword="wait",
                    status="failed",
                )
            ],
            report_dir=str(tmp_path / "reports" / "exec-2"),
        )
        save_execution_report(settings, first)
        save_execution_report(settings, second)

    by_script = list_execution_task_summaries(
        settings,
        ExecutionTaskFilters(script_id="smoke-cockpit"),
    )
    by_status = list_execution_task_summaries(
        settings,
        ExecutionTaskFilters(status="failed"),
    )
    by_time_and_executor = list_execution_task_summaries(
        settings,
        ExecutionTaskFilters(
            created_from="2026-06-02T00:00:00+00:00",
            created_to="2026-06-02T23:59:59+00:00",
            executor="bob",
        ),
    )

    assert [task.id for task in by_script] == ["exec-1"]
    assert [task.id for task in by_status] == ["exec-2"]
    assert [task.id for task in by_time_and_executor] == ["exec-2"]


def test_repository_upsert_preserves_first_persisted_at(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    with TestClient(create_app(settings)):
        task = ExecutionTask(
            id="exec-1",
            script_id="smoke-cockpit",
            script_name="Smoke Cockpit",
            script_revision=1,
            status="passed",
            executor="alice",
            created_at="2026-06-01T00:00:00+00:00",
            report_dir=str(tmp_path / "reports" / "exec-1"),
        )
        save_execution_report(settings, task)

        task.status = "failed"
        save_execution_report(settings, task)

    stored = get_execution_task(settings, "exec-1")
    assert stored is not None
    assert stored.status == "failed"


def test_repository_returns_none_for_missing_task(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    with TestClient(create_app(settings)):
        pass

    assert get_execution_task(settings, "no-such-task") is None
    assert get_execution_report(settings, "no-such-task") is None


def test_repository_empty_filter_returns_nothing(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    with TestClient(create_app(settings)):
        pass

    result = list_execution_task_summaries(
        settings,
        ExecutionTaskFilters(script_id="no-match"),
    )
    assert result == []


@pytest.mark.anyio
async def test_execution_service_persists_finished_task_history(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    ensure_database(settings)
    save_script(
        settings,
        CatalogTestScript(
            id="smoke-cockpit",
            name="Smoke Cockpit",
            status="published",
            steps=[
                ScriptStep(
                    id="step-1",
                    keyword="log.message",
                    description="Startup log",
                    params={"message": "startup ok"},
                )
            ],
        ),
    )
    service = ExecutionService(settings)

    await service.start()
    try:
        created = await service.create_task(
            ExecutionTaskCreate(
                script_id="smoke-cockpit",
                environment="local",
                target_device="bench-1",
                executor="alice",
            )
        )
        final_task = await service.wait_for_task(created.id, timeout=2)
    finally:
        await service.stop()

    restarted_service = ExecutionService(settings)
    stored_task = restarted_service.get_task(final_task.id)
    summaries = restarted_service.list_tasks(ExecutionTaskFilters(executor="alice"))

    assert final_task.status == "passed"
    assert stored_task is not None
    assert stored_task.id == final_task.id
    assert stored_task.logs[0].message == "startup ok"
    assert [summary.id for summary in summaries] == [final_task.id]


@pytest.mark.anyio
async def test_execution_service_persists_failed_task_report(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    ensure_database(settings)
    save_script(
        settings,
        CatalogTestScript(
            id="smoke-cockpit",
            name="Smoke Cockpit",
            status="published",
            steps=[
                ScriptStep(
                    id="step-1",
                    keyword="wait",
                    description="Bad wait",
                    params={"seconds": -1},
                )
            ],
        ),
    )
    service = ExecutionService(settings)

    await service.start()
    try:
        create_payload = ExecutionTaskCreate(script_id="smoke-cockpit")
        created = await service.create_task(create_payload)
        final_task = await service.wait_for_task(created.id, timeout=2)
    finally:
        await service.stop()

    report = ExecutionService(settings).get_report(final_task.id)

    assert final_task.status == "failed"
    assert report is not None
    assert report.task.steps[0].status == "failed"
    assert report.task.steps[0].error_message == (
        "wait.seconds must be greater than or equal to 0"
    )


def test_task_api_lists_persisted_history_with_filters(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)):
        task = ExecutionTask(
            id="exec-1",
            script_id="smoke-cockpit",
            script_name="Smoke Cockpit",
            script_revision=1,
            status="passed",
            executor="alice",
            created_at="2026-06-01T00:00:00+00:00",
            report_dir=str(tmp_path / "reports" / "exec-1"),
        )
        save_execution_report(settings, task)

    with TestClient(create_app(settings)) as client:
        response = client.get(
            "/api/tasks",
            params={
                "script_id": "smoke-cockpit",
                "status": "passed",
                "executor": "alice",
                "created_from": "2026-06-01T00:00:00+00:00",
                "created_to": "2026-06-01T23:59:59+00:00",
            },
        )

    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == "exec-1"


def test_report_api_reads_persisted_report_detail(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)):
        task = ExecutionTask(
            id="exec-1",
            script_id="smoke-cockpit",
            script_name="Smoke Cockpit",
            script_revision=1,
            status="failed",
            created_at="2026-06-01T00:00:00+00:00",
            report_dir=str(tmp_path / "reports" / "exec-1"),
            steps=[
                ExecutionStepResult(
                    id="step-1",
                    index=0,
                    keyword="wait",
                    status="failed",
                    error_message="wait.seconds must be greater than or equal to 0",
                )
            ],
            logs=[
                ExecutionLogEntry(
                    timestamp="2026-06-01T00:00:01+00:00",
                    level="error",
                    message="wait.seconds must be greater than or equal to 0",
                    step_id="step-1",
                )
            ],
        )
        save_execution_report(settings, task)

    with TestClient(create_app(settings)) as client:
        list_response = client.get("/api/reports")
        detail_response = client.get("/api/reports/exec-1")
        missing_response = client.get("/api/reports/missing")

    assert list_response.status_code == 200
    assert list_response.json()["items"][0]["id"] == "exec-1"
    assert detail_response.status_code == 200
    assert detail_response.json()["task"]["id"] == "exec-1"
    assert detail_response.json()["task"]["steps"][0]["error_message"] == (
        "wait.seconds must be greater than or equal to 0"
    )
    assert detail_response.json()["task"]["logs"][0]["message"] == (
        "wait.seconds must be greater than or equal to 0"
    )
    assert missing_response.status_code == 404
    assert missing_response.json()["error"]["code"] == "not_found"
