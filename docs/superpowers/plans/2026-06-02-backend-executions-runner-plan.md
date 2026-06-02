# Backend Executions Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine execution architecture by moving execution schemas, event bus, and runner responsibilities into `app.modules.executions` while preserving the current execution API and compatibility imports.

**Architecture:** This is Phase 5 of the approved modular layered backend architecture. The canonical execution package becomes `app.modules.executions`; `ExecutionService` remains the API-facing use-case object, while `ExecutionRunner` owns queue processing, framework adapter calls, status transitions, log writing, and framework event handling.

**Tech Stack:** FastAPI, asyncio, Pydantic, pytest, autotest adapter contracts, pnpm backend scripts.

---

## Scope

This plan refines execution structure without changing execution behavior.

It intentionally does not add:

- SQLite execution history.
- Report persistence.
- Parallel execution.
- New public API fields.
- New WebSocket message types.
- Real automation framework integration beyond the existing `autotest.entry`
  adapter boundary.

Public behavior must remain unchanged for:

- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/{task_id}`
- `POST /api/tasks/{task_id}/cancel`
- `WS /ws/executions`
- Execution service lifecycle start/stop.
- Task cancellation semantics.
- Log writing to `data/logs/executions/{task_id}.log`.

Compatibility imports must remain available from:

- `app.execution.models`
- `app.execution.events`
- `app.execution.service`

## File Structure

Create:

- `backend/app/modules/executions/__init__.py`
  - Re-exports execution schemas, event bus, service, errors, and helper
    functions.
- `backend/app/modules/executions/schemas.py`
  - Canonical home for current execution Pydantic models.
- `backend/app/modules/executions/events.py`
  - Canonical home for `ExecutionEventBus`.
- `backend/app/modules/executions/runner.py`
  - Owns worker loop, task running, framework event handling, log writing,
    task finishing, and execution helper functions.
- `backend/app/modules/executions/service.py`
  - Owns public execution use cases and delegates queue/run behavior to
    `ExecutionRunner`.

Modify:

- `backend/app/execution/models.py`
  - Replace with compatibility exports from `app.modules.executions.schemas`.
- `backend/app/execution/events.py`
  - Replace with compatibility exports from `app.modules.executions.events`.
- `backend/app/execution/service.py`
  - Replace with compatibility exports from `app.modules.executions.service`
    and `app.modules.executions.runner`.
- `backend/app/api/routes/executions.py`
  - Import from canonical execution modules.
- `backend/app/api/dependencies.py`
  - Import `ExecutionService` from canonical execution service.
- `backend/app/main.py`
  - Import `ExecutionService` from canonical execution service.
- `backend/tests/test_app_foundation.py`
  - Add canonical and compatibility import regression test.

Do not modify:

- `backend/autotest/*`
- `backend/app/modules/scripts/*`
- `backend/app/modules/keywords/*`
- `backend/app/modules/commands/*`

## Task 1: Add Execution Module Import Regression Test

**Files:**

- Modify: `backend/tests/test_app_foundation.py`

- [ ] **Step 1: Add execution module compatibility test**

Append this test to `backend/tests/test_app_foundation.py`:

```python
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
```

- [ ] **Step 2: Run the new test and verify it fails before implementation**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py::test_execution_modules_export_compatible_api -v
```

Expected result:

```text
ModuleNotFoundError: No module named 'app.modules.executions'
```

- [ ] **Step 3: Keep the failing test uncommitted until Task 5**

Do not commit `backend/tests/test_app_foundation.py` yet. Task 5 makes this
test pass and commits it with compatibility shims.

Confirm the uncommitted test change:

```powershell
git status --short
```

Expected output includes:

```text
 M backend/tests/test_app_foundation.py
```

## Task 2: Create Canonical Execution Schemas and Events

**Files:**

- Create: `backend/app/modules/executions/__init__.py`
- Create: `backend/app/modules/executions/schemas.py`
- Create: `backend/app/modules/executions/events.py`

- [ ] **Step 1: Create temporary executions package exports**

Create `backend/app/modules/executions/__init__.py` with:

```python
from app.modules.executions.events import ExecutionEventBus
from app.modules.executions.schemas import (
    ExecutionEventMessage,
    ExecutionEventType,
    ExecutionLogEntry,
    ExecutionStepResult,
    ExecutionTask,
    ExecutionTaskCreate,
    ExecutionTaskSummary,
    StepStatus,
    TaskStatus,
    utc_now,
)

__all__ = [
    "ExecutionEventBus",
    "ExecutionEventMessage",
    "ExecutionEventType",
    "ExecutionLogEntry",
    "ExecutionStepResult",
    "ExecutionTask",
    "ExecutionTaskCreate",
    "ExecutionTaskSummary",
    "StepStatus",
    "TaskStatus",
    "utc_now",
]
```

- [ ] **Step 2: Create canonical execution schemas**

Create `backend/app/modules/executions/schemas.py` with the current contents of
`backend/app/execution/models.py`:

```python
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

TaskStatus = Literal["pending", "running", "passed", "failed", "canceled", "error"]
StepStatus = Literal[
    "pending",
    "running",
    "passed",
    "failed",
    "canceled",
    "error",
    "skipped",
]
ExecutionEventType = Literal["task_status", "step_status", "log", "task_finished"]


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


class ExecutionTaskCreate(BaseModel):
    script_id: str
    environment: str = "local"
    target_device: str = ""
    variables: dict[str, Any] = Field(default_factory=dict)
    executor: str = "local"


class ExecutionLogEntry(BaseModel):
    timestamp: str
    level: str = "info"
    message: str
    step_id: str | None = None


class ExecutionStepResult(BaseModel):
    id: str
    index: int
    keyword: str
    description: str = ""
    status: StepStatus = "pending"
    started_at: str | None = None
    finished_at: str | None = None
    duration_ms: int | None = None
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    error_message: str = ""
    error_detail: str = ""
    attachments: list[str] = Field(default_factory=list)


class ExecutionTask(BaseModel):
    id: str
    script_id: str
    script_name: str
    script_revision: int
    status: TaskStatus = "pending"
    environment: str = "local"
    target_device: str = ""
    variables: dict[str, Any] = Field(default_factory=dict)
    executor: str = "local"
    created_at: str = Field(default_factory=utc_now)
    started_at: str | None = None
    finished_at: str | None = None
    duration_ms: int | None = None
    log_path: str = ""
    report_dir: str = ""
    steps: list[ExecutionStepResult] = Field(default_factory=list)
    logs: list[ExecutionLogEntry] = Field(default_factory=list)
    error_message: str = ""


class ExecutionTaskSummary(BaseModel):
    id: str
    script_id: str
    script_name: str
    script_revision: int
    status: TaskStatus
    environment: str
    target_device: str
    executor: str
    created_at: str
    started_at: str | None
    finished_at: str | None
    duration_ms: int | None
    step_count: int
    passed_step_count: int
    failed_step_count: int


class ExecutionEventMessage(BaseModel):
    type: ExecutionEventType
    task_id: str
    status: TaskStatus | StepStatus | None = None
    step_id: str | None = None
    message: str = ""
    level: str = "info"
    timestamp: str = Field(default_factory=utc_now)
    task: ExecutionTask | None = None
    step: ExecutionStepResult | None = None
```

- [ ] **Step 3: Create canonical execution events**

Create `backend/app/modules/executions/events.py` with the current contents of
`backend/app/execution/events.py`, using canonical schema imports:

```python
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from app.modules.executions.schemas import ExecutionEventMessage


class ExecutionEventBus:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[ExecutionEventMessage]] = set()

    @asynccontextmanager
    async def subscribe(self) -> AsyncIterator[asyncio.Queue[ExecutionEventMessage]]:
        queue: asyncio.Queue[ExecutionEventMessage] = asyncio.Queue()
        self._subscribers.add(queue)
        try:
            yield queue
        finally:
            self._subscribers.discard(queue)

    async def publish(self, message: ExecutionEventMessage) -> None:
        for subscriber in list(self._subscribers):
            await subscriber.put(message.model_copy(deep=True))
```

- [ ] **Step 4: Run schema/event smoke checks**

Run:

```powershell
cd backend
uv run python -c "from app.modules.executions.schemas import ExecutionTask; print(ExecutionTask(id='t1', script_id='s1', script_name='Smoke', script_revision=1).status)"
uv run python -c "from app.modules.executions.events import ExecutionEventBus; print(ExecutionEventBus.__name__)"
```

Expected output:

```text
pending
ExecutionEventBus
```

- [ ] **Step 5: Commit execution schemas and events**

Run:

```powershell
git add backend/app/modules/executions/__init__.py backend/app/modules/executions/schemas.py backend/app/modules/executions/events.py
git commit -m "add execution schemas events"
```

## Task 3: Create Execution Runner

**Files:**

- Create: `backend/app/modules/executions/runner.py`

- [ ] **Step 1: Create runner module**

Create `backend/app/modules/executions/runner.py` with:

```python
from __future__ import annotations

import asyncio
from contextlib import suppress
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any

from app.core.config import Settings
from app.modules.executions.events import ExecutionEventBus
from app.modules.executions.schemas import (
    ExecutionEventMessage,
    ExecutionLogEntry,
    ExecutionStepResult,
    ExecutionTask,
    ExecutionTaskCreate,
    ExecutionTaskSummary,
    TaskStatus,
    utc_now,
)
from app.modules.scripts import TestScript
from autotest.contracts import (
    CancellationToken,
    FrameworkEvent,
    FrameworkRunRequest,
    FrameworkStep,
)
from autotest.entry import run_script

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

    async def finish_task(self, task: ExecutionTask) -> None:
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

    async def handle_framework_event(
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
            await self.append_log(
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
            task.status = event.status or _final_status_from_steps(task)

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
            async for event in run_script(request):
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
                task.status = _final_status_from_steps(task)
            await self.finish_task(task)
            self.tokens.pop(task.id, None)


def task_from_script(
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


def task_summary(task: ExecutionTask) -> ExecutionTaskSummary:
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
```

- [ ] **Step 2: Run runner import smoke checks**

Run:

```powershell
cd backend
uv run python -c "from app.modules.executions.runner import ExecutionRunner, TERMINAL_STATUSES; print(ExecutionRunner.__name__, 'passed' in TERMINAL_STATUSES)"
```

Expected output:

```text
ExecutionRunner True
```

- [ ] **Step 3: Commit execution runner**

Run:

```powershell
git add backend/app/modules/executions/runner.py
git commit -m "add execution runner"
```

## Task 4: Create Canonical Execution Service

**Files:**

- Create: `backend/app/modules/executions/service.py`
- Modify: `backend/app/modules/executions/__init__.py`

- [ ] **Step 1: Create canonical execution service**

Create `backend/app/modules/executions/service.py` with:

```python
from __future__ import annotations

from uuid import uuid4

from app.core.config import Settings
from app.modules.executions.events import ExecutionEventBus
from app.modules.executions.runner import (
    ExecutionRunner,
    TERMINAL_STATUSES,
    _mark_task_canceled,
    task_from_script,
    task_summary,
)
from app.modules.executions.schemas import (
    ExecutionEventMessage,
    ExecutionTask,
    ExecutionTaskCreate,
    ExecutionTaskSummary,
    TaskStatus,
)
from app.modules.scripts import read_script
from autotest.contracts import CancellationToken, FrameworkEvent


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
        script = read_script(self.settings, payload.script_id)
        task_id = f"exec-{uuid4().hex}"
        log_path = self.settings.logs_dir / "executions" / f"{task_id}.log"
        report_dir = self.settings.reports_dir / task_id
        report_dir.mkdir(parents=True, exist_ok=True)
        task = task_from_script(script, payload, task_id, log_path, report_dir)

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

    def list_tasks(self) -> list[ExecutionTaskSummary]:
        return [task_summary(task) for task in self._tasks.values()]

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
```

- [ ] **Step 2: Update execution package exports**

Replace `backend/app/modules/executions/__init__.py` with:

```python
from app.modules.executions.events import ExecutionEventBus
from app.modules.executions.runner import (
    TERMINAL_STATUSES,
    _framework_request,
    _mark_task_canceled,
    task_from_script,
    task_summary,
)
from app.modules.executions.schemas import (
    ExecutionEventMessage,
    ExecutionEventType,
    ExecutionLogEntry,
    ExecutionStepResult,
    ExecutionTask,
    ExecutionTaskCreate,
    ExecutionTaskSummary,
    StepStatus,
    TaskStatus,
    utc_now,
)
from app.modules.executions.service import (
    ExecutionService,
    TaskAlreadyFinishedError,
    TaskNotFoundError,
)

__all__ = [
    "ExecutionEventBus",
    "ExecutionEventMessage",
    "ExecutionEventType",
    "ExecutionLogEntry",
    "ExecutionService",
    "ExecutionStepResult",
    "ExecutionTask",
    "ExecutionTaskCreate",
    "ExecutionTaskSummary",
    "StepStatus",
    "TERMINAL_STATUSES",
    "TaskAlreadyFinishedError",
    "TaskNotFoundError",
    "TaskStatus",
    "_framework_request",
    "_mark_task_canceled",
    "task_from_script",
    "task_summary",
    "utc_now",
]
```

- [ ] **Step 3: Run canonical execution service tests by importing directly**

Run:

```powershell
cd backend
uv run python -c "from app.modules.executions import ExecutionService, ExecutionTaskCreate; print(ExecutionService.__name__, ExecutionTaskCreate(script_id='s').script_id)"
```

Expected output:

```text
ExecutionService s
```

- [ ] **Step 4: Commit canonical execution service**

Run:

```powershell
git add backend/app/modules/executions/__init__.py backend/app/modules/executions/service.py
git commit -m "add canonical execution service"
```

## Task 5: Replace Legacy Execution Package With Compatibility Shims

**Files:**

- Modify: `backend/app/execution/models.py`
- Modify: `backend/app/execution/events.py`
- Modify: `backend/app/execution/service.py`
- Modify: `backend/tests/test_app_foundation.py`

- [ ] **Step 1: Replace legacy models with schema exports**

Replace the full contents of `backend/app/execution/models.py` with:

```python
from app.modules.executions.schemas import (
    ExecutionEventMessage,
    ExecutionEventType,
    ExecutionLogEntry,
    ExecutionStepResult,
    ExecutionTask,
    ExecutionTaskCreate,
    ExecutionTaskSummary,
    StepStatus,
    TaskStatus,
    utc_now,
)

__all__ = [
    "ExecutionEventMessage",
    "ExecutionEventType",
    "ExecutionLogEntry",
    "ExecutionStepResult",
    "ExecutionTask",
    "ExecutionTaskCreate",
    "ExecutionTaskSummary",
    "StepStatus",
    "TaskStatus",
    "utc_now",
]
```

- [ ] **Step 2: Replace legacy events with event bus export**

Replace the full contents of `backend/app/execution/events.py` with:

```python
from app.modules.executions.events import ExecutionEventBus

__all__ = ["ExecutionEventBus"]
```

- [ ] **Step 3: Replace legacy service with service and runner exports**

Replace the full contents of `backend/app/execution/service.py` with:

```python
from app.modules.executions.runner import (
    TERMINAL_STATUSES,
    _duration_ms,
    _final_status_from_steps,
    _find_step,
    _framework_request,
    _mark_task_canceled,
    _mark_task_started,
    _stringify_error_detail,
    task_from_script as _task_from_script,
    task_summary as _summary,
)
from app.modules.executions.service import (
    ExecutionService,
    TaskAlreadyFinishedError,
    TaskNotFoundError,
)

__all__ = [
    "ExecutionService",
    "TERMINAL_STATUSES",
    "TaskAlreadyFinishedError",
    "TaskNotFoundError",
    "_duration_ms",
    "_final_status_from_steps",
    "_find_step",
    "_framework_request",
    "_mark_task_canceled",
    "_mark_task_started",
    "_stringify_error_detail",
    "_summary",
    "_task_from_script",
]
```

- [ ] **Step 4: Run compatibility and execution tests**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py::test_execution_modules_export_compatible_api tests/test_execution_service.py -v
```

Expected result:

```text
passed
```

- [ ] **Step 5: Commit execution compatibility shims and test**

Run:

```powershell
git add backend/app/execution/models.py backend/app/execution/events.py backend/app/execution/service.py backend/tests/test_app_foundation.py
git commit -m "add execution compatibility shims"
```

## Task 6: Update App Code to Canonical Execution Imports

**Files:**

- Modify: `backend/app/api/dependencies.py`
- Modify: `backend/app/api/routes/executions.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Update API dependency import**

In `backend/app/api/dependencies.py`, replace:

```python
from app.execution.service import ExecutionService
```

with:

```python
from app.modules.executions.service import ExecutionService
```

- [ ] **Step 2: Update execution route imports**

In `backend/app/api/routes/executions.py`, replace:

```python
from app.execution.models import ExecutionTaskCreate
from app.execution.service import TaskAlreadyFinishedError, TaskNotFoundError
```

with:

```python
from app.modules.executions.schemas import ExecutionTaskCreate
from app.modules.executions.service import (
    TaskAlreadyFinishedError,
    TaskNotFoundError,
)
```

- [ ] **Step 3: Update main import**

In `backend/app/main.py`, replace:

```python
from app.execution.service import ExecutionService
```

with:

```python
from app.modules.executions.service import ExecutionService
```

- [ ] **Step 4: Verify app code no longer imports legacy execution package**

Run:

```powershell
rg "from app\.execution|import app\.execution" backend/app
```

Expected result:

```text
No matches.
```

Tests may continue importing `app.execution` to verify compatibility.

- [ ] **Step 5: Run affected API and execution tests**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py tests/test_execution_service.py -v
```

Expected result:

```text
passed
```

- [ ] **Step 6: Commit canonical execution imports**

Run:

```powershell
git add backend/app/api/dependencies.py backend/app/api/routes/executions.py backend/app/main.py
git commit -m "use canonical execution imports"
```

## Task 7: Run Full Backend Verification

**Files:**

- No source edits expected.

- [ ] **Step 1: Run all backend tests**

Run:

```powershell
pnpm test:backend
```

Expected result:

```text
All collected backend tests pass.
```

- [ ] **Step 2: Run backend lint check**

Run:

```powershell
pnpm check:backend
```

Expected result:

```text
All checks passed!
```

- [ ] **Step 3: Inspect final status**

Run:

```powershell
git status --short
git diff --stat HEAD
```

Expected result:

```text
No uncommitted source changes after the final verification commit, or only the current task changes ready to commit.
```

- [ ] **Step 4: Commit verification-only edits only if files changed**

If no files changed, do not commit. If formatting or import order changed files,
commit them with:

```powershell
git add backend/app backend/tests
git commit -m "verify execution runner split"
```

## Self-Review

Spec coverage:

- Canonical schemas and event bus are covered by Task 2.
- Runner extraction is covered by Task 3.
- Service use-case boundary is covered by Task 4.
- Legacy import compatibility is covered by Task 5.
- App code canonical imports are covered by Task 6.
- Full backend verification is covered by Task 7.

Completion wording scan:

- No steps contain unspecified implementation work.
- Every source edit step includes concrete file paths and code.

Type consistency:

- `ExecutionService` keeps public methods `start`, `stop`, `create_task`,
  `list_tasks`, `get_task`, `cancel_task`, and `wait_for_task`.
- `ExecutionService._handle_framework_event` remains available for existing
  tests and delegates to `ExecutionRunner.handle_framework_event`.
- `_framework_request` remains importable from `app.execution.service` through
  the compatibility shim.
- `TERMINAL_STATUSES` remains the same set.
- `ExecutionEventBus.publish` continues deep-copying messages for subscribers.

## Execution Handoff

Plan complete and saved to
`docs/superpowers/plans/2026-06-02-backend-executions-runner-plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task,
   review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using
   executing-plans, batch execution with checkpoints.
