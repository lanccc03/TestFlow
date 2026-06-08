import asyncio

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.api import execution_websocket_endpoint
from app.core.config import Settings
from app.main import create_app
from app.modules.executions.events import ExecutionEventBus
from app.modules.executions.schemas import (
    ExecutionEventMessage,
    ExecutionTask,
    ExecutionTaskCreate,
)
from app.modules.executions.service import (
    ExecutionService,
    TaskAlreadyFinishedError,
    TaskNotFoundError,
)
from autotest import registry
from autotest.contracts import (
    FrameworkCaseSummary,
    FrameworkEvent,
)


class CaseExecutionRuntime:
    """Fake runtime for testing: runs framework cases without YAML scripts."""

    def list_cases(self) -> list[FrameworkCaseSummary]:
        return [
            FrameworkCaseSummary(
                id="case.smoke_cockpit",
                name="座舱冒烟测试",
                description="基础稳定性巡检",
                steps=("启动系统", "确认首页加载"),
            )
        ]

    def get_case(self, case_id: str) -> FrameworkCaseSummary:
        if case_id not in ("case.smoke_cockpit", "case.long_wait"):
            raise FileNotFoundError(case_id)
        if case_id == "case.long_wait":
            return FrameworkCaseSummary(
                id="case.long_wait",
                name="Long Wait",
                description="等待取消",
                steps=("等待中",),
            )
        return self.list_cases()[0]

    def read_config(self):
        return {}

    def write_config(self, config):
        return config

    async def run_script(self, request):
        yield FrameworkEvent(type="run_started", task_id=request.task_id)

        if request.script_id == "case.long_wait":
            while not request.cancellation_token.is_canceled:
                await asyncio.sleep(0.01)
            yield FrameworkEvent(
                type="run_finished",
                task_id=request.task_id,
                status="canceled",
            )
            return

        yield FrameworkEvent(
            type="log",
            task_id=request.task_id,
            message="framework case log",
            level="info",
        )
        yield FrameworkEvent(
            type="run_finished",
            task_id=request.task_id,
            status="passed",
        )


@pytest.mark.anyio
async def test_execution_event_bus_broadcasts_to_subscribers() -> None:
    bus = ExecutionEventBus()
    message = ExecutionEventMessage(
        type="task_status",
        task_id="task-1",
        status="running",
        message="Task is running",
    )

    async with bus.subscribe() as subscriber:
        await bus.publish(message)

        assert await subscriber.get() == message


@pytest.mark.anyio
async def test_execution_event_bus_snapshots_nested_task_messages() -> None:
    bus = ExecutionEventBus()
    task = ExecutionTask(
        id="task-1",
        script_id="script-1",
        script_name="Smoke Test",
        script_revision=1,
        status="pending",
    )
    message = ExecutionEventMessage(
        type="task_status",
        task_id=task.id,
        status=task.status,
        task=task,
    )

    async with bus.subscribe() as subscriber:
        await bus.publish(message)
        task.status = "running"

        queued_message = await subscriber.get()

    assert queued_message.task is not None
    assert queued_message.task.status == "pending"


@pytest.mark.anyio
async def test_execution_service_runs_script_to_passed(tmp_path) -> None:
    registry.set_runtime_for_testing(CaseExecutionRuntime())
    settings = Settings(data_dir=tmp_path)
    service = ExecutionService(settings)

    await service.start()
    try:
        task = await service.create_task(
            ExecutionTaskCreate(
                script_id="case.smoke_cockpit",
                environment="local",
                target_device="bench-1",
            )
        )
        final_task = await service.wait_for_task(task.id, timeout=2)
    finally:
        await service.stop()
        registry.reset_runtime_for_testing()

    assert final_task.status == "passed"
    assert final_task.steps == []
    assert final_task.log_path
    log_path = tmp_path / "logs" / "executions" / f"{task.id}.log"
    assert log_path.is_file()
    assert "framework case log" in log_path.read_text(encoding="utf-8")


@pytest.mark.anyio
async def test_execution_service_finishes_framework_case_as_passed(tmp_path) -> None:
    registry.set_runtime_for_testing(CaseExecutionRuntime())
    settings = Settings(data_dir=tmp_path)
    service = ExecutionService(settings)

    await service.start()
    try:
        task = await service.create_task(
            ExecutionTaskCreate(script_id="case.smoke_cockpit")
        )
        final_task = await service.wait_for_task(task.id, timeout=2)
    finally:
        await service.stop()
        registry.reset_runtime_for_testing()

    assert final_task.status == "passed"
    assert final_task.steps == []


@pytest.mark.anyio
async def test_execution_service_can_cancel_running_task(tmp_path) -> None:
    registry.set_runtime_for_testing(CaseExecutionRuntime())
    settings = Settings(data_dir=tmp_path)
    service = ExecutionService(settings)

    await service.start()
    try:
        task = await service.create_task(
            ExecutionTaskCreate(script_id="case.long_wait")
        )
        await asyncio.sleep(0.01)
        await service.cancel_task(task.id)
        final_task = await service.wait_for_task(task.id, timeout=2)
    finally:
        await service.stop()
        registry.reset_runtime_for_testing()

    assert final_task.status == "canceled"
    assert final_task.steps == []


def test_task_api_creates_and_reads_execution_task(tmp_path) -> None:
    registry.set_runtime_for_testing(CaseExecutionRuntime())
    try:
        settings = Settings(data_dir=tmp_path)

        with TestClient(create_app(settings)) as client:
            create_response = client.post(
                "/api/tasks",
                json={
                    "script_id": "case.smoke_cockpit",
                    "environment": "local",
                    "target_device": "bench-1",
                },
            )
            created = create_response.json()

            read_response = client.get(f"/api/tasks/{created['id']}")
            list_response = client.get("/api/tasks")

        assert create_response.status_code == 201
        assert created["script_id"] == "case.smoke_cockpit"
        assert read_response.status_code == 200
        assert read_response.json()["id"] == created["id"]
        assert list_response.status_code == 200
        assert created["id"] in [task["id"] for task in list_response.json()["items"]]
    finally:
        registry.reset_runtime_for_testing()


def test_task_api_returns_404_for_missing_script(tmp_path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.post("/api/tasks", json={"script_id": "missing"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_task_api_cancels_running_task(tmp_path) -> None:
    registry.set_runtime_for_testing(CaseExecutionRuntime())
    try:
        settings = Settings(data_dir=tmp_path)

        with TestClient(create_app(settings)) as client:
            create_response = client.post(
                "/api/tasks", json={"script_id": "case.long_wait"}
            )
            created = create_response.json()
            cancel_response = client.post(
                f"/api/tasks/{created['id']}/cancel"
            )

        assert create_response.status_code == 201
        assert cancel_response.status_code == 200
        assert cancel_response.json()["id"] == created["id"]
    finally:
        registry.reset_runtime_for_testing()


@pytest.mark.anyio
async def test_execution_websocket_disconnect_cleans_up_idle_subscriber(
    tmp_path,
) -> None:
    class IdleDisconnectingWebSocket:
        def __init__(self, app) -> None:
            self.app = app
            self.disconnect_requested = asyncio.Event()
            self.sent_messages: asyncio.Queue[dict[str, str]] = asyncio.Queue()

        async def accept(self) -> None:
            return None

        async def send_json(self, message: dict[str, str]) -> None:
            await self.sent_messages.put(message)

        async def receive(self) -> dict[str, str]:
            await self.disconnect_requested.wait()
            raise WebSocketDisconnect(code=1000)

    settings = Settings(data_dir=tmp_path)
    app = create_app(settings)

    with TestClient(app) as client:
        websocket = IdleDisconnectingWebSocket(client.app)
        endpoint_task = asyncio.create_task(
            execution_websocket_endpoint(websocket)  # type: ignore[arg-type]
        )
        try:
            assert await websocket.sent_messages.get() == {
                "type": "connection",
                "status": "connected",
            }
            assert len(app.state.execution_service.events._subscribers) == 1

            websocket.disconnect_requested.set()
            await asyncio.wait_for(endpoint_task, timeout=0.1)
        finally:
            if not endpoint_task.done():
                endpoint_task.cancel()
                with pytest.raises(asyncio.CancelledError):
                    await endpoint_task

        assert len(app.state.execution_service.events._subscribers) == 0


@pytest.mark.anyio
async def test_execution_service_marks_running_task_canceled_on_stop(tmp_path) -> None:
    registry.set_runtime_for_testing(CaseExecutionRuntime())
    settings = Settings(data_dir=tmp_path)
    service = ExecutionService(settings)

    await service.start()
    task = await service.create_task(
        ExecutionTaskCreate(script_id="case.long_wait")
    )
    await asyncio.sleep(0.01)
    await service.stop()
    registry.reset_runtime_for_testing()

    stopped_task = service.get_task(task.id)
    assert stopped_task is not None
    assert stopped_task.status == "canceled"
    assert stopped_task.steps == []


@pytest.mark.anyio
async def test_execution_service_cancel_task_errors_for_missing_task(tmp_path) -> None:
    service = ExecutionService(Settings(data_dir=tmp_path))

    with pytest.raises(TaskNotFoundError):
        await service.cancel_task("missing-task")


@pytest.mark.anyio
async def test_execution_service_cancel_task_errors_for_finished_task(tmp_path) -> None:
    registry.set_runtime_for_testing(CaseExecutionRuntime())
    settings = Settings(data_dir=tmp_path)
    service = ExecutionService(settings)

    await service.start()
    try:
        task = await service.create_task(
            ExecutionTaskCreate(script_id="case.smoke_cockpit")
        )
        final_task = await service.wait_for_task(task.id, timeout=2)
        with pytest.raises(TaskAlreadyFinishedError):
            await service.cancel_task(final_task.id)
    finally:
        await service.stop()
        registry.reset_runtime_for_testing()


@pytest.mark.anyio
async def test_execution_service_cancel_task_logs_request(tmp_path) -> None:
    registry.set_runtime_for_testing(CaseExecutionRuntime())
    settings = Settings(data_dir=tmp_path)
    service = ExecutionService(settings)

    await service.start()
    try:
        task = await service.create_task(
            ExecutionTaskCreate(script_id="case.long_wait")
        )
        await service.cancel_task(task.id)
        final_task = await service.wait_for_task(task.id, timeout=2)
    finally:
        await service.stop()
        registry.reset_runtime_for_testing()

    assert final_task.status == "canceled"
    assert any(log.message == "Cancellation requested" for log in final_task.logs)


@pytest.mark.anyio
async def test_execution_service_cancel_task_marks_queued_task_canceled(
    tmp_path,
) -> None:
    registry.set_runtime_for_testing(CaseExecutionRuntime())
    settings = Settings(data_dir=tmp_path)
    service = ExecutionService(settings)

    await service.start()
    try:
        running_task = await service.create_task(
            ExecutionTaskCreate(script_id="case.long_wait")
        )
        queued_task = await service.create_task(
            ExecutionTaskCreate(script_id="case.smoke_cockpit")
        )
        await asyncio.sleep(0.01)

        canceled_task = await service.cancel_task(queued_task.id)
        final_queued_task = await service.wait_for_task(queued_task.id, timeout=0.1)
    finally:
        await service.cancel_task(running_task.id)
        await service.stop()
        registry.reset_runtime_for_testing()

    assert canceled_task.status == "canceled"
    assert final_queued_task.status == "canceled"
    assert final_queued_task.steps == []


@pytest.mark.anyio
async def test_execution_service_cooperatively_cancels_framework_case(
    tmp_path,
) -> None:
    registry.set_runtime_for_testing(CaseExecutionRuntime())
    settings = Settings(data_dir=tmp_path)
    service = ExecutionService(settings)

    await service.start()
    try:
        task = await service.create_task(
            ExecutionTaskCreate(script_id="case.long_wait")
        )
        await asyncio.sleep(0.01)
        await service.cancel_task(task.id)
        final_task = await service.wait_for_task(task.id, timeout=2)
    finally:
        await service.stop()
        registry.reset_runtime_for_testing()

    assert final_task.status == "canceled"
    assert final_task.steps == []


@pytest.mark.anyio
async def test_execution_service_copies_mutable_inputs(tmp_path) -> None:
    registry.set_runtime_for_testing(CaseExecutionRuntime())
    settings = Settings(data_dir=tmp_path)
    payload = ExecutionTaskCreate(
        script_id="case.smoke_cockpit",
        variables={"device": {"name": "bench-1"}},
    )
    service = ExecutionService(settings)

    task = await service.create_task(payload)
    payload.variables["device"]["name"] = "mutated"

    stored_task = service.get_task(task.id)
    assert stored_task is not None
    assert stored_task.variables == {"device": {"name": "bench-1"}}
    assert stored_task.steps == []
    registry.reset_runtime_for_testing()


@pytest.mark.anyio
async def test_execution_service_copies_framework_step_output(tmp_path) -> None:
    task = ExecutionTask(
        id="task-1",
        script_id="script-1",
        script_name="Smoke Test",
        script_revision=1,
        steps=[
            {
                "id": "step-1",
                "index": 0,
                "input": {},
            }
        ],
    )
    service = ExecutionService(Settings(data_dir=tmp_path))
    output = {"nested": {"value": "original"}}

    await service._handle_framework_event(
        task,
        FrameworkEvent(
            type="step_finished",
            task_id=task.id,
            step_id="step-1",
            status="passed",
            output=output,
        ),
    )
    output["nested"]["value"] = "mutated"

    assert task.steps[0].output == {"nested": {"value": "original"}}


@pytest.mark.anyio
async def test_execution_service_run_error_not_overwritten_by_run_finished(
    tmp_path,
) -> None:
    task = ExecutionTask(
        id="task-1",
        script_id="script-1",
        script_name="Smoke Test",
        script_revision=1,
        log_path=str(tmp_path / "task-1.log"),
    )
    service = ExecutionService(Settings(data_dir=tmp_path))

    await service._handle_framework_event(
        task,
        FrameworkEvent(
            type="run_error",
            task_id=task.id,
            status="error",
            error_message="adapter exploded",
        ),
    )
    await service._handle_framework_event(
        task,
        FrameworkEvent(type="run_finished", task_id=task.id, status="passed"),
    )

    assert task.status == "error"
    assert task.error_message == "adapter exploded"


@pytest.mark.anyio
async def test_execution_service_records_framework_html_report_event(tmp_path) -> None:
    task = ExecutionTask(
        id="task-1",
        script_id="script-1",
        script_name="Smoke Test",
        script_revision=1,
        log_path=str(tmp_path / "task-1.log"),
    )
    service = ExecutionService(Settings(data_dir=tmp_path))
    framework_root = tmp_path / "framework-output"
    framework_entry = framework_root / "index.html"

    await service._handle_framework_event(
        task,
        FrameworkEvent(
            type="framework_report",
            task_id=task.id,
            report_kind="html",
            report_source="file",
            report_root_dir=framework_root,
            report_entry=framework_entry,
            report_title="自动化框架报告",
        ),
    )

    assert task.framework_report is not None
    assert task.framework_report.kind == "html"
    assert task.framework_report.source == "file"
    assert task.framework_report.root_dir == str(framework_root)
    assert task.framework_report.entry == str(framework_entry)
    assert task.framework_report.title == "自动化框架报告"


@pytest.mark.anyio
async def test_execution_service_runs_framework_case_no_yaml(tmp_path) -> None:
    registry.set_runtime_for_testing(CaseExecutionRuntime())
    service = ExecutionService(Settings(data_dir=tmp_path))

    await service.start()
    try:
        task = await service.create_task(
            ExecutionTaskCreate(
                script_id="case.smoke_cockpit",
                environment="local",
                target_device="bench-1",
            )
        )
        final_task = await service.wait_for_task(task.id, timeout=2)
    finally:
        await service.stop()
        registry.reset_runtime_for_testing()

    assert final_task.status == "passed"
    assert final_task.script_id == "case.smoke_cockpit"
    assert final_task.script_name == "座舱冒烟测试"
    assert final_task.script_revision == 1
    assert final_task.steps == []
    assert any(log.message == "framework case log" for log in final_task.logs)
    assert not (tmp_path / "scripts" / "case.smoke_cockpit.yaml").exists()


@pytest.mark.anyio
async def test_execution_service_returns_missing_framework_case(tmp_path) -> None:
    registry.set_runtime_for_testing(CaseExecutionRuntime())
    service = ExecutionService(Settings(data_dir=tmp_path))

    try:
        with pytest.raises(FileNotFoundError):
            await service.create_task(
                ExecutionTaskCreate(script_id="missing")
            )
    finally:
        registry.reset_runtime_for_testing()
