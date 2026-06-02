from __future__ import annotations

import asyncio
from contextlib import suppress
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.core.config import Settings
from app.execution.events import ExecutionEventBus
from app.execution.models import (
    ExecutionEventMessage,
    ExecutionLogEntry,
    ExecutionStepResult,
    ExecutionTask,
    ExecutionTaskCreate,
    ExecutionTaskSummary,
    TaskStatus,
    utc_now,
)
from app.modules.scripts import TestScript, read_script
from autotest.contracts import (
    CancellationToken,
    FrameworkEvent,
    FrameworkRunRequest,
    FrameworkStep,
)
from autotest.entry import run_script

TERMINAL_STATUSES = {"passed", "failed", "canceled", "error"}


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
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._worker: asyncio.Task[None] | None = None
        self._active_task_id: str | None = None

    async def start(self) -> None:
        if self._worker is None or self._worker.done():
            self._worker = asyncio.create_task(self._worker_loop())

    async def stop(self) -> None:
        if self._worker is None:
            return

        if self._active_task_id is not None:
            token = self._tokens.get(self._active_task_id)
            if token is not None:
                token.cancel()

        self._worker.cancel()
        with suppress(asyncio.CancelledError):
            await self._worker
        self._worker = None

    async def create_task(self, payload: ExecutionTaskCreate) -> ExecutionTask:
        script = read_script(self.settings, payload.script_id)
        task_id = f"exec-{uuid4().hex}"
        log_path = self.settings.logs_dir / "executions" / f"{task_id}.log"
        report_dir = self.settings.reports_dir / task_id
        report_dir.mkdir(parents=True, exist_ok=True)
        task = _task_from_script(script, payload, task_id, log_path, report_dir)

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
        await self._queue.put(task.id)
        return task.model_copy(deep=True)

    def list_tasks(self) -> list[ExecutionTaskSummary]:
        return [_summary(task) for task in self._tasks.values()]

    def get_task(self, task_id: str) -> ExecutionTask | None:
        task = self._tasks.get(task_id)
        return task.model_copy(deep=True) if task is not None else None

    async def cancel_task(self, task_id: str) -> ExecutionTask:
        task = self._tasks.get(task_id)
        if task is None:
            raise TaskNotFoundError(task_id)
        if task.status in TERMINAL_STATUSES:
            raise TaskAlreadyFinishedError(task_id, task.status)

        token = self._tokens.get(task_id)
        if token is not None:
            token.cancel()
        await self._append_log(task, "Cancellation requested")
        if task.status == "pending":
            _mark_task_canceled(task)
            await self._finish_task(task)
        return task.model_copy(deep=True)

    async def wait_for_task(
        self,
        task_id: str,
        timeout: float | None = None,
    ) -> ExecutionTask:
        async def wait() -> ExecutionTask:
            while True:
                task = self._tasks[task_id]
                if task.status in TERMINAL_STATUSES:
                    return task.model_copy(deep=True)
                await asyncio.sleep(0.01)

        if timeout is None:
            return await wait()
        return await asyncio.wait_for(wait(), timeout=timeout)

    async def _worker_loop(self) -> None:
        while True:
            task_id = await self._queue.get()
            self._active_task_id = task_id
            try:
                await self._run_task(task_id)
            finally:
                self._active_task_id = None
                self._queue.task_done()

    async def _run_task(self, task_id: str) -> None:
        task = self._tasks[task_id]
        if task.status in TERMINAL_STATUSES:
            self._tokens.pop(task.id, None)
            return

        token = self._tokens[task_id]

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
            async for event in run_script(request):
                await self._handle_framework_event(task, event)
        except asyncio.CancelledError:
            token.cancel()
            _mark_task_canceled(task)
            await self._append_log(task, "Execution canceled during shutdown")
            raise
        except Exception as error:  # noqa: BLE001
            task.status = "error"
            task.error_message = str(error)
            await self._append_log(task, str(error), level="error")
        finally:
            if task.status not in TERMINAL_STATUSES:
                task.status = _final_status_from_steps(task)
            await self._finish_task(task)
            self._tokens.pop(task.id, None)

    async def _handle_framework_event(
        self,
        task: ExecutionTask,
        event: FrameworkEvent,
    ) -> None:
        if event.type == "run_started":
            return

        if event.type == "step_started":
            step = _find_step(task, event.step_id)
            if step is None:
                return
            step.status = "running"
            step.started_at = event.timestamp.isoformat()
            await self.events.publish(
                ExecutionEventMessage(
                    type="step_status",
                    task_id=task.id,
                    step_id=step.id,
                    status=step.status,
                    step=step,
                )
            )
            return

        if event.type == "log":
            await self._append_log(
                task,
                event.message or "",
                level=event.level or "info",
                step_id=event.step_id,
                timestamp=event.timestamp.isoformat(),
            )
            return

        if event.type == "step_finished":
            step = _find_step(task, event.step_id)
            if step is None:
                return
            step.status = event.status or _final_status_from_steps(task)
            step.finished_at = event.timestamp.isoformat()
            step.duration_ms = _duration_ms(step.started_at, step.finished_at)
            step.output = deepcopy(event.output) if event.output is not None else {}
            step.error_message = event.error_message or ""
            step.error_detail = _stringify_error_detail(event.error_detail)
            await self.events.publish(
                ExecutionEventMessage(
                    type="step_status",
                    task_id=task.id,
                    step_id=step.id,
                    status=step.status,
                    step=step,
                )
            )
            return

        if event.type == "attachment":
            step = _find_step(task, event.step_id)
            if step is not None and event.attachment_path is not None:
                step.attachments.append(str(event.attachment_path))
            return

        if event.type == "run_error":
            task.status = "error"
            task.error_message = event.error_message or "Execution failed"
            await self._append_log(
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
            task.status = event.status or _final_status_from_steps(task)

    async def _append_log(
        self,
        task: ExecutionTask,
        message: str,
        *,
        level: str = "info",
        step_id: str | None = None,
        timestamp: str | None = None,
    ) -> None:
        entry = ExecutionLogEntry(
            timestamp=timestamp or utc_now(),
            level=level,
            message=message,
            step_id=step_id,
        )
        task.logs.append(entry)

        log_path = Path(task.log_path)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("a", encoding="utf-8") as log_file:
            step_label = f" [{step_id}]" if step_id else ""
            log_file.write(f"{entry.timestamp} {entry.level}{step_label} {message}\n")

        await self.events.publish(
            ExecutionEventMessage(
                type="log",
                task_id=task.id,
                step_id=step_id,
                level=level,
                message=message,
            )
        )

    async def _finish_task(self, task: ExecutionTask) -> None:
        task.finished_at = task.finished_at or utc_now()
        task.duration_ms = _duration_ms(task.started_at, task.finished_at)
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


def _task_from_script(
    script: TestScript,
    payload: ExecutionTaskCreate,
    task_id: str,
    log_path: Path,
    report_dir: Path,
) -> ExecutionTask:
    version = script.version
    steps = [
        ExecutionStepResult(
            id=step.id,
            index=index,
            keyword=step.keyword,
            description=step.description,
            input=deepcopy(step.params),
        )
        for index, step in enumerate(step for step in script.steps if step.enabled)
    ]
    return ExecutionTask(
        id=task_id,
        script_id=script.id,
        script_name=script.name,
        script_revision=version.revision if version else 1,
        environment=payload.environment,
        target_device=payload.target_device,
        variables=deepcopy(payload.variables),
        executor=payload.executor,
        log_path=str(log_path),
        report_dir=str(report_dir),
        steps=steps,
    )


def _framework_request(
    task: ExecutionTask,
    cancellation_token: CancellationToken,
) -> FrameworkRunRequest:
    report_dir = Path(task.report_dir)
    return FrameworkRunRequest(
        task_id=task.id,
        script_id=task.script_id,
        script_name=task.script_name,
        script_revision=task.script_revision,
        steps=[
            FrameworkStep(
                id=step.id,
                index=step.index,
                keyword=step.keyword,
                description=step.description,
                enabled=True,
                params=deepcopy(step.input),
            )
            for step in task.steps
        ],
        variables=deepcopy(task.variables),
        environment={"name": task.environment} if task.environment else {},
        target_device={"id": task.target_device} if task.target_device else None,
        log_path=Path(task.log_path),
        report_dir=report_dir,
        artifact_dir=report_dir / "artifacts",
        cancellation_token=cancellation_token,
    )


def _summary(task: ExecutionTask) -> ExecutionTaskSummary:
    return ExecutionTaskSummary(
        id=task.id,
        script_id=task.script_id,
        script_name=task.script_name,
        script_revision=task.script_revision,
        status=task.status,
        environment=task.environment,
        target_device=task.target_device,
        executor=task.executor,
        created_at=task.created_at,
        started_at=task.started_at,
        finished_at=task.finished_at,
        duration_ms=task.duration_ms,
        step_count=len(task.steps),
        passed_step_count=sum(1 for step in task.steps if step.status == "passed"),
        failed_step_count=sum(1 for step in task.steps if step.status == "failed"),
    )


def _mark_task_started(task: ExecutionTask) -> None:
    task.status = "running"
    task.started_at = task.started_at or utc_now()


def _mark_task_canceled(task: ExecutionTask) -> None:
    task.status = "canceled"
    for step in task.steps:
        if step.status in {"pending", "running"}:
            step.status = "canceled"
            step.error_message = step.error_message or "Execution canceled"
            step.finished_at = step.finished_at or utc_now()
            step.duration_ms = _duration_ms(step.started_at, step.finished_at)


def _find_step(task: ExecutionTask, step_id: str | None) -> ExecutionStepResult | None:
    if step_id is None:
        return None
    return next((step for step in task.steps if step.id == step_id), None)


def _final_status_from_steps(task: ExecutionTask) -> TaskStatus:
    if any(step.status == "error" for step in task.steps):
        return "error"
    if any(step.status == "failed" for step in task.steps):
        return "failed"
    if any(step.status == "canceled" for step in task.steps):
        return "canceled"
    if all(step.status == "passed" for step in task.steps):
        return "passed"
    return "failed"


def _duration_ms(started_at: str | None, finished_at: str | None) -> int | None:
    if started_at is None or finished_at is None:
        return None
    started = datetime.fromisoformat(started_at)
    finished = datetime.fromisoformat(finished_at)
    return int((finished - started).total_seconds() * 1000)


def _stringify_error_detail(error_detail: dict[str, Any] | str | None) -> str:
    if error_detail is None:
        return ""
    if isinstance(error_detail, str):
        return error_detail
    return str(error_detail)
