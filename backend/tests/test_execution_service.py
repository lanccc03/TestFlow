import asyncio

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.api import execution_websocket_endpoint
from app.core.config import Settings
from app.main import create_app
from app.modules.executions.events import ExecutionEventBus
from app.modules.executions.runner import _framework_request
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
from app.modules.scripts import (
    ScriptStep,
    save_script,
)
from app.modules.scripts import (
    TestScript as CatalogTestScript,
)
from autotest.contracts import CancellationToken, FrameworkEvent


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
    settings = Settings(data_dir=tmp_path)
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
                ),
                ScriptStep(
                    id="step-2",
                    keyword="wait",
                    description="No-op wait",
                    params={"seconds": 0},
                ),
            ],
        ),
    )
    service = ExecutionService(settings)

    await service.start()
    try:
        task = await service.create_task(
            ExecutionTaskCreate(
                script_id="smoke-cockpit",
                environment="local",
                target_device="bench-1",
            )
        )
        final_task = await service.wait_for_task(task.id, timeout=2)
    finally:
        await service.stop()

    assert final_task.status == "passed"
    assert [step.status for step in final_task.steps] == ["passed", "passed"]
    assert final_task.steps[0].output == {"message": "startup ok"}
    assert final_task.log_path
    log_path = tmp_path / "logs" / "executions" / f"{task.id}.log"
    assert log_path.is_file()
    assert "startup ok" in log_path.read_text(encoding="utf-8")


@pytest.mark.anyio
async def test_execution_service_marks_failed_step_as_failed(tmp_path) -> None:
    settings = Settings(data_dir=tmp_path)
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
        task = await service.create_task(ExecutionTaskCreate(script_id="smoke-cockpit"))
        final_task = await service.wait_for_task(task.id, timeout=2)
    finally:
        await service.stop()

    assert final_task.status == "failed"
    assert final_task.steps[0].status == "failed"
    assert (
        final_task.steps[0].error_message
        == "wait.seconds must be greater than or equal to 0"
    )


@pytest.mark.anyio
async def test_execution_service_can_cancel_running_task(tmp_path) -> None:
    settings = Settings(data_dir=tmp_path)
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
                    description="Long wait",
                    params={"seconds": 2},
                )
            ],
        ),
    )
    service = ExecutionService(settings)

    await service.start()
    try:
        task = await service.create_task(ExecutionTaskCreate(script_id="smoke-cockpit"))
        await asyncio.sleep(0.01)
        await service.cancel_task(task.id)
        final_task = await service.wait_for_task(task.id, timeout=2)
    finally:
        await service.stop()

    assert final_task.status == "canceled"


def test_task_api_creates_and_reads_execution_task(tmp_path) -> None:
    settings = Settings(data_dir=tmp_path)
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

    with TestClient(create_app(settings)) as client:
        create_response = client.post(
            "/api/tasks",
            json={
                "script_id": "smoke-cockpit",
                "environment": "local",
                "target_device": "bench-1",
            },
        )
        created = create_response.json()

        read_response = client.get(f"/api/tasks/{created['id']}")
        list_response = client.get("/api/tasks")

    assert create_response.status_code == 201
    assert created["script_id"] == "smoke-cockpit"
    assert read_response.status_code == 200
    assert read_response.json()["id"] == created["id"]
    assert list_response.status_code == 200
    assert created["id"] in [task["id"] for task in list_response.json()["items"]]


def test_task_api_returns_404_for_missing_script(tmp_path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.post("/api/tasks", json={"script_id": "missing"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_task_api_cancels_running_task(tmp_path) -> None:
    settings = Settings(data_dir=tmp_path)
    save_script(
        settings,
        CatalogTestScript(
            id="long-wait",
            name="Long Wait",
            status="published",
            steps=[
                ScriptStep(
                    id="step-1",
                    keyword="wait",
                    description="Long wait",
                    params={"seconds": 2},
                )
            ],
        ),
    )

    with TestClient(create_app(settings)) as client:
        create_response = client.post("/api/tasks", json={"script_id": "long-wait"})
        created = create_response.json()
        cancel_response = client.post(f"/api/tasks/{created['id']}/cancel")

    assert create_response.status_code == 201
    assert cancel_response.status_code == 200
    assert cancel_response.json()["id"] == created["id"]


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
    settings = Settings(data_dir=tmp_path)
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
                    description="Long wait",
                    params={"seconds": 2},
                )
            ],
        ),
    )
    service = ExecutionService(settings)

    await service.start()
    task = await service.create_task(ExecutionTaskCreate(script_id="smoke-cockpit"))
    await asyncio.sleep(0.01)
    await service.stop()

    stopped_task = service.get_task(task.id)
    assert stopped_task is not None
    assert stopped_task.status == "canceled"
    assert stopped_task.steps[0].status == "canceled"


@pytest.mark.anyio
async def test_execution_service_cancel_task_errors_for_missing_task(tmp_path) -> None:
    service = ExecutionService(Settings(data_dir=tmp_path))

    with pytest.raises(TaskNotFoundError):
        await service.cancel_task("missing-task")


@pytest.mark.anyio
async def test_execution_service_cancel_task_errors_for_finished_task(tmp_path) -> None:
    settings = Settings(data_dir=tmp_path)
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
                    description="No-op wait",
                    params={"seconds": 0},
                )
            ],
        ),
    )
    service = ExecutionService(settings)

    await service.start()
    try:
        task = await service.create_task(ExecutionTaskCreate(script_id="smoke-cockpit"))
        final_task = await service.wait_for_task(task.id, timeout=2)
        with pytest.raises(TaskAlreadyFinishedError):
            await service.cancel_task(final_task.id)
    finally:
        await service.stop()


@pytest.mark.anyio
async def test_execution_service_cancel_task_logs_request(tmp_path) -> None:
    settings = Settings(data_dir=tmp_path)
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
                    description="Long wait",
                    params={"seconds": 2},
                )
            ],
        ),
    )
    service = ExecutionService(settings)

    await service.start()
    try:
        task = await service.create_task(ExecutionTaskCreate(script_id="smoke-cockpit"))
        await service.cancel_task(task.id)
        final_task = await service.wait_for_task(task.id, timeout=2)
    finally:
        await service.stop()

    assert final_task.status == "canceled"
    assert any(log.message == "Cancellation requested" for log in final_task.logs)


@pytest.mark.anyio
async def test_execution_service_cancel_task_marks_queued_task_canceled(
    tmp_path,
) -> None:
    settings = Settings(data_dir=tmp_path)
    save_script(
        settings,
        CatalogTestScript(
            id="long-wait",
            name="Long Wait",
            status="published",
            steps=[
                ScriptStep(
                    id="step-1",
                    keyword="wait",
                    description="Long wait",
                    params={"seconds": 2},
                )
            ],
        ),
    )
    save_script(
        settings,
        CatalogTestScript(
            id="queued-wait",
            name="Queued Wait",
            status="published",
            steps=[
                ScriptStep(
                    id="step-1",
                    keyword="wait",
                    description="Queued wait",
                    params={"seconds": 0},
                )
            ],
        ),
    )
    service = ExecutionService(settings)

    await service.start()
    try:
        running_task = await service.create_task(
            ExecutionTaskCreate(script_id="long-wait")
        )
        queued_task = await service.create_task(
            ExecutionTaskCreate(script_id="queued-wait")
        )
        await asyncio.sleep(0.01)

        canceled_task = await service.cancel_task(queued_task.id)
        final_queued_task = await service.wait_for_task(queued_task.id, timeout=0.1)
    finally:
        await service.cancel_task(running_task.id)
        await service.stop()

    assert canceled_task.status == "canceled"
    assert final_queued_task.status == "canceled"
    assert [step.status for step in final_queued_task.steps] == ["canceled"]
    assert final_queued_task.steps[0].error_message == "Execution canceled"


@pytest.mark.anyio
async def test_execution_service_cooperative_cancel_marks_unstarted_steps_canceled(
    tmp_path,
) -> None:
    settings = Settings(data_dir=tmp_path)
    save_script(
        settings,
        CatalogTestScript(
            id="multi-step",
            name="Multi Step",
            status="published",
            steps=[
                ScriptStep(
                    id="step-1",
                    keyword="wait",
                    description="Long wait",
                    params={"seconds": 2},
                ),
                ScriptStep(
                    id="step-2",
                    keyword="wait",
                    description="Unstarted wait",
                    params={"seconds": 0},
                ),
            ],
        ),
    )
    service = ExecutionService(settings)

    await service.start()
    try:
        task = await service.create_task(ExecutionTaskCreate(script_id="multi-step"))
        await asyncio.sleep(0.01)
        await service.cancel_task(task.id)
        final_task = await service.wait_for_task(task.id, timeout=2)
    finally:
        await service.stop()

    assert final_task.status == "canceled"
    assert [step.status for step in final_task.steps] == ["canceled", "canceled"]
    assert final_task.steps[1].error_message == "Execution canceled"


@pytest.mark.anyio
async def test_execution_service_copies_mutable_inputs(tmp_path) -> None:
    settings = Settings(data_dir=tmp_path)
    script = CatalogTestScript(
        id="smoke-cockpit",
        name="Smoke Cockpit",
        status="published",
        steps=[
            ScriptStep(
                id="step-1",
                keyword="log.message",
                params={"message": "startup ok", "meta": {"phase": 1}},
            )
        ],
    )
    save_script(settings, script)
    payload = ExecutionTaskCreate(
        script_id="smoke-cockpit",
        variables={"device": {"name": "bench-1"}},
    )
    service = ExecutionService(settings)

    task = await service.create_task(payload)
    payload.variables["device"]["name"] = "mutated"
    task.steps[0].input["meta"]["phase"] = 2
    request = _framework_request(task, CancellationToken())
    request.variables["device"]["name"] = "request-mutated"
    request.steps[0].params["meta"]["phase"] = 3

    stored_task = service.get_task(task.id)
    assert stored_task is not None
    assert stored_task.variables == {"device": {"name": "bench-1"}}
    assert stored_task.steps[0].input["meta"] == {"phase": 1}


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
                "keyword": "log.message",
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
