import asyncio

import pytest

from app.config import Settings
from app.execution.events import ExecutionEventBus
from app.execution.models import (
    ExecutionEventMessage,
    ExecutionTask,
    ExecutionTaskCreate,
)
from app.execution.service import ExecutionService
from app.script_catalog import (
    ScriptStep,
    save_script,
)
from app.script_catalog import (
    TestScript as CatalogTestScript,
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
    task = await service.create_task(
        ExecutionTaskCreate(
            script_id="smoke-cockpit",
            environment="local",
            target_device="bench-1",
        )
    )
    final_task = await service.wait_for_task(task.id, timeout=2)
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
    task = await service.create_task(ExecutionTaskCreate(script_id="smoke-cockpit"))
    final_task = await service.wait_for_task(task.id, timeout=2)
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
    task = await service.create_task(ExecutionTaskCreate(script_id="smoke-cockpit"))
    await asyncio.sleep(0.01)
    await service.cancel_task(task.id)
    final_task = await service.wait_for_task(task.id, timeout=2)
    await service.stop()

    assert final_task.status == "canceled"
