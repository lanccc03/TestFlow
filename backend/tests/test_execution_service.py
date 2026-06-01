import pytest

from app.execution.events import ExecutionEventBus
from app.execution.models import ExecutionEventMessage, ExecutionTask


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
