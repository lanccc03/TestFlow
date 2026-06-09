from __future__ import annotations

import asyncio
from contextlib import suppress
from datetime import datetime
from pathlib import Path

from app.core.config import Settings
from app.modules.executions.events import ExecutionEventBus
from app.modules.executions.repository import save_execution_report
from app.modules.executions.schemas import (
    ExecutionEventMessage,
    ExecutionLogEntry,
    ExecutionTask,
    ExecutionTaskSummary,
    utc_now,
)
from autotest.contracts import (
    CancellationToken,
    FrameworkCaseSummary,
    FrameworkEvent,
    FrameworkRunRequest,
)
from autotest.entry import run_case

TERMINAL_STATUSES = {"passed", "failed", "canceled", "error"}


class ExecutionRunner:
    def __init__(
        self,
        settings: Settings,
        events: ExecutionEventBus,
        tasks: dict[str, ExecutionTask],
        tokens: dict[str, CancellationToken],
    ) -> None:
        self.settings = settings
        self.events = events
        self.tasks = tasks
        self.tokens = tokens
        self.queue: asyncio.Queue[str] = asyncio.Queue()
        self.worker: asyncio.Task[None] | None = None
        self.active_task_id: str | None = None

    async def start(self) -> None:
        if self.worker is None or self.worker.done():
            self.worker = asyncio.create_task(self._worker_loop())

    async def stop(self) -> None:
        if self.worker is None:
            return

        if self.active_task_id is not None:
            token = self.tokens.get(self.active_task_id)
            if token is not None:
                token.cancel()

        self.worker.cancel()
        with suppress(asyncio.CancelledError):
            await self.worker
        self.worker = None

    async def enqueue(self, task_id: str) -> None:
        await self.queue.put(task_id)

    async def append_log(
        self,
        task: ExecutionTask,
        message: str,
        *,
        level: str = "info",
        timestamp: str | None = None,
    ) -> None:
        entry = ExecutionLogEntry(
            timestamp=timestamp or utc_now(),
            level=level,
            message=message,
        )
        task.logs.append(entry)

        log_path = Path(task.log_path)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("a", encoding="utf-8") as log_file:
            log_file.write(f"{entry.timestamp} {entry.level} {message}\n")

        await self.events.publish(
            ExecutionEventMessage(
                type="task_status",
                task_id=task.id,
                level=level,
                message=message,
            )
        )

    async def finish_task(self, task: ExecutionTask) -> None:
        task.finished_at = task.finished_at or utc_now()
        task.duration_ms = _duration_ms(task.started_at, task.finished_at)
        if task.status in TERMINAL_STATUSES:
            await self._persist_finished_task(task)
        await self.events.publish(
            ExecutionEventMessage(
                type="task_status",
                task_id=task.id,
                status=task.status,
                task=task,
            )
        )
        await self.events.publish(
            ExecutionEventMessage(
                type="task_finished",
                task_id=task.id,
                status=task.status,
                task=task,
            )
        )

    async def _persist_finished_task(self, task: ExecutionTask) -> None:
        try:
            save_execution_report(self.settings, task)
        except Exception as error:  # noqa: BLE001
            await self.append_log(
                task,
                f"Report persistence failed: {error}",
                level="error",
            )

    async def handle_framework_event(
        self,
        task: ExecutionTask,
        event: FrameworkEvent,
    ) -> None:
        if event.type == "log":
            await self.append_log(
                task,
                event.message or "",
                level=event.level or "info",
                timestamp=event.timestamp.isoformat(),
            )
            return

        if event.type == "framework_report":
            if event.message:
                await self.append_log(
                    task,
                    event.message,
                    level="info",
                    timestamp=event.timestamp.isoformat(),
                )
            return

        if event.type == "run_error":
            task.status = "error"
            task.error_message = event.error_message or "Execution failed"
            await self.append_log(
                task,
                task.error_message,
                level="error",
                timestamp=event.timestamp.isoformat(),
            )
            return

        if event.type == "run_finished":
            if task.status in TERMINAL_STATUSES:
                return
            if event.status == "canceled":
                _mark_task_canceled(task)
                return
            task.status = event.status or "error"

    async def _worker_loop(self) -> None:
        while True:
            task_id = await self.queue.get()
            self.active_task_id = task_id
            try:
                await self._run_task(task_id)
            finally:
                self.active_task_id = None
                self.queue.task_done()

    async def _run_task(self, task_id: str) -> None:
        task = self.tasks[task_id]
        if task.status in TERMINAL_STATUSES:
            self.tokens.pop(task.id, None)
            return

        token = self.tokens[task_id]

        try:
            _mark_task_started(task)
            await self.events.publish(
                ExecutionEventMessage(
                    type="task_status",
                    task_id=task.id,
                    status=task.status,
                    task=task,
                )
            )

            request = _framework_request(task, token)
            async for event in run_case(request):
                await self.handle_framework_event(task, event)
        except asyncio.CancelledError:
            token.cancel()
            _mark_task_canceled(task)
            await self.append_log(task, "Execution canceled during shutdown")
            raise
        except Exception as error:  # noqa: BLE001
            task.status = "error"
            task.error_message = str(error)
            await self.append_log(task, str(error), level="error")
        finally:
            if task.status not in TERMINAL_STATUSES:
                task.status = "error"
            await self.finish_task(task)
            self.tokens.pop(task.id, None)


def task_from_case(
    case: FrameworkCaseSummary,
    task_id: str,
    log_path: Path,
    report_dir: Path,
) -> ExecutionTask:
    return ExecutionTask(
        id=task_id,
        case_id=case.id,
        case_name=case.name,
        log_path=str(log_path),
        report_dir=str(report_dir),
    )


def task_summary(task: ExecutionTask) -> ExecutionTaskSummary:
    return ExecutionTaskSummary(
        id=task.id,
        case_id=task.case_id,
        case_name=task.case_name,
        status=task.status,
        created_at=task.created_at,
        started_at=task.started_at,
        finished_at=task.finished_at,
        duration_ms=task.duration_ms,
    )


def _framework_request(
    task: ExecutionTask,
    cancellation_token: CancellationToken,
) -> FrameworkRunRequest:
    report_dir = Path(task.report_dir)
    return FrameworkRunRequest(
        task_id=task.id,
        case_id=task.case_id,
        report_dir=report_dir,
        cancellation_token=cancellation_token,
    )


def _mark_task_started(task: ExecutionTask) -> None:
    task.status = "running"
    task.started_at = task.started_at or utc_now()


def _mark_task_canceled(task: ExecutionTask) -> None:
    task.status = "canceled"


def _duration_ms(started_at: str | None, finished_at: str | None) -> int | None:
    if started_at is None or finished_at is None:
        return None
    started = datetime.fromisoformat(started_at)
    finished = datetime.fromisoformat(finished_at)
    return int((finished - started).total_seconds() * 1000)
