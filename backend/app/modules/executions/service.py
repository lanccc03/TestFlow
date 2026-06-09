from __future__ import annotations

from uuid import uuid4

from app.core.config import Settings
from app.modules.executions.events import ExecutionEventBus
from app.modules.executions.repository import (
    get_execution_report,
    get_execution_task,
    list_execution_task_summaries,
)
from app.modules.executions.runner import (
    TERMINAL_STATUSES,
    ExecutionRunner,
    _mark_task_canceled,
    task_from_case,
    task_summary,
)
from app.modules.executions.schemas import (
    ExecutionEventMessage,
    ExecutionTask,
    ExecutionTaskCreate,
    ExecutionTaskFilters,
    ExecutionTaskSummary,
    TaskStatus,
)
from autotest.contracts import CancellationToken, FrameworkEvent
from autotest.entry import get_case


class TaskNotFoundError(Exception):
    def __init__(self, task_id: str) -> None:
        super().__init__(f"Execution task not found: {task_id}")
        self.task_id = task_id


class TaskAlreadyFinishedError(Exception):
    def __init__(self, task_id: str, status: TaskStatus) -> None:
        super().__init__(f"Execution task already finished: {task_id} ({status})")
        self.task_id = task_id
        self.status = status


class ExecutionService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.events = ExecutionEventBus()
        self._tasks: dict[str, ExecutionTask] = {}
        self._tokens: dict[str, CancellationToken] = {}
        self._runner = ExecutionRunner(
            settings=self.settings,
            events=self.events,
            tasks=self._tasks,
            tokens=self._tokens,
        )

    async def start(self) -> None:
        await self._runner.start()

    async def stop(self) -> None:
        await self._runner.stop()

    async def create_task(self, payload: ExecutionTaskCreate) -> ExecutionTask:
        case = get_case(payload.case_id)
        task_id = f"exec-{uuid4().hex}"
        log_path = self.settings.logs_dir / "executions" / f"{task_id}.log"
        report_dir = self.settings.reports_dir / task_id
        report_dir.mkdir(parents=True, exist_ok=True)
        task = task_from_case(case, task_id, log_path, report_dir)

        self._tasks[task.id] = task
        self._tokens[task.id] = CancellationToken()
        await self.events.publish(
            ExecutionEventMessage(
                type="task_status",
                task_id=task.id,
                status=task.status,
                task=task,
            )
        )
        await self._runner.enqueue(task.id)
        return task.model_copy(deep=True)

    def list_tasks(
        self,
        filters: ExecutionTaskFilters | None = None,
    ) -> list[ExecutionTaskSummary]:
        filters = filters or ExecutionTaskFilters()
        summaries_by_id: dict[str, ExecutionTaskSummary] = {
            summary.id: summary
            for summary in list_execution_task_summaries(self.settings, filters)
        }
        for task in self._tasks.values():
            if _task_matches_filters(task, filters):
                summaries_by_id[task.id] = task_summary(task)
        return sorted(
            summaries_by_id.values(),
            key=lambda summary: summary.created_at,
            reverse=True,
        )

    def get_task(self, task_id: str) -> ExecutionTask | None:
        task = self._tasks.get(task_id)
        if task is not None:
            return task.model_copy(deep=True)
        return get_execution_task(self.settings, task_id)

    def get_report(self, task_id: str) -> ExecutionTask | None:
        stored = get_execution_report(self.settings, task_id)
        if stored is not None:
            return stored
        task = self._tasks.get(task_id)
        if task is not None:
            return task.model_copy(deep=True)
        return None

    async def cancel_task(self, task_id: str) -> ExecutionTask:
        task = self._tasks.get(task_id)
        if task is None:
            raise TaskNotFoundError(task_id)
        if task.status in TERMINAL_STATUSES:
            raise TaskAlreadyFinishedError(task_id, task.status)

        token = self._tokens.get(task_id)
        if token is not None:
            token.cancel()
        await self._runner.append_log(task, "Cancellation requested")
        if task.status == "pending":
            _mark_task_canceled(task)
            await self._runner.finish_task(task)
        return task.model_copy(deep=True)

    async def wait_for_task(
        self,
        task_id: str,
        timeout: float | None = None,
    ) -> ExecutionTask:
        import asyncio

        async def wait() -> ExecutionTask:
            while True:
                task = self._tasks[task_id]
                if task.status in TERMINAL_STATUSES:
                    return task.model_copy(deep=True)
                await asyncio.sleep(0.01)

        if timeout is None:
            return await wait()
        return await asyncio.wait_for(wait(), timeout=timeout)

    async def _handle_framework_event(
        self,
        task: ExecutionTask,
        event: FrameworkEvent,
    ) -> None:
        await self._runner.handle_framework_event(task, event)


def _task_matches_filters(
    task: ExecutionTask,
    filters: ExecutionTaskFilters,
) -> bool:
    if filters.case_id and task.case_id != filters.case_id:
        return False
    if filters.status and task.status != filters.status:
        return False
    if filters.created_from and task.created_at < filters.created_from:
        return False
    if filters.created_to and task.created_at > filters.created_to:
        return False
    return True
