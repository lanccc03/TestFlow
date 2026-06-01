# Phase 6 Executor Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 6 execution loop so a saved TestFlow script can be run through `backend/autotest/entry.py`, streamed to the frontend, canceled, and represented with step-level results.

**Architecture:** TestFlow keeps task lifecycle, WebSocket messages, API models, and active task state in `backend/app/execution`. The automation framework boundary lives in `backend/autotest`; the Phase 6 implementation uses a mock runtime behind the same `run_script()` event stream contract that the real framework will satisfy. Active task records stay in process for Phase 6; Phase 7 will persist history and reports using the same normalized models.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, asyncio, pytest, React 19, TypeScript, TanStack Query, Vite, Vitest.

---

## Scope

This plan implements Phase 6 only:

- Backend adapter contracts and mock runtime.
- Backend execution service, serial runner, cancellation, log writing, and WebSocket event broadcast.
- Backend task APIs.
- Frontend execution page to start one script, watch status/logs, and cancel a running task.
- Focused tests for backend and frontend behavior.

Phase 7 gets a separate plan for SQLite execution history, report detail models, history filters, and report pages.

## File Structure

Create these backend files:

- `backend/autotest/__init__.py`: package marker for the framework adapter boundary.
- `backend/autotest/contracts.py`: dataclass contracts shared by mock and real framework adapters.
- `backend/autotest/entry.py`: stable TestFlow-to-framework entry point.
- `backend/autotest/mock_runtime.py`: mock keyword execution that emits framework events.
- `backend/app/execution/__init__.py`: package marker for platform execution.
- `backend/app/execution/events.py`: in-process event bus for WebSocket subscribers.
- `backend/app/execution/models.py`: Pydantic request, response, task, step, log, and event models.
- `backend/app/execution/service.py`: task creation, queueing, serial execution, cancellation, event conversion, and log writing.
- `backend/tests/test_autotest_adapter.py`: adapter contract tests.
- `backend/tests/test_execution_service.py`: service and API tests.

Modify these backend files:

- `backend/app/api/__init__.py`: replace task placeholder routes and add execution WebSocket route.
- `backend/app/main.py`: create and start the execution service during app lifespan.

Create these frontend files:

- `apps/web/src/features/execution/TaskPage.tsx`: execution task page.
- `apps/web/src/features/execution/TaskPage.test.tsx`: execution page component tests.

Modify these frontend files:

- `apps/web/src/lib/api.ts`: add execution task types and client methods.
- `apps/web/src/lib/api.test.ts`: cover execution task API methods.
- `apps/web/src/app/routes.tsx`: replace `/tasks` placeholder with `TaskPage`.
- `apps/web/src/index.css`: add focused execution page styles.

## Task 1: Add Adapter Contracts And Mock Runtime

**Files:**
- Create: `backend/autotest/__init__.py`
- Create: `backend/autotest/contracts.py`
- Create: `backend/autotest/entry.py`
- Create: `backend/autotest/mock_runtime.py`
- Test: `backend/tests/test_autotest_adapter.py`

- [ ] **Step 1: Write adapter contract tests**

Create `backend/tests/test_autotest_adapter.py` with:

```python
from pathlib import Path

import pytest

from autotest.contracts import CancellationToken, FrameworkRunRequest, FrameworkStep
from autotest.entry import run_script


def make_request(
    tmp_path: Path,
    steps: list[FrameworkStep],
    token: CancellationToken | None = None,
) -> FrameworkRunRequest:
    return FrameworkRunRequest(
        task_id="task-1",
        script_id="smoke-cockpit",
        script_name="Smoke cockpit",
        script_revision=1,
        steps=steps,
        variables={},
        environment="local",
        target_device="bench-1",
        log_path=tmp_path / "task-1.log",
        report_dir=tmp_path / "reports" / "task-1",
        artifact_dir=tmp_path / "reports" / "task-1" / "artifacts",
        cancellation_token=token or CancellationToken(),
    )


@pytest.mark.anyio
async def test_mock_runtime_emits_successful_step_events(tmp_path: Path) -> None:
    request = make_request(
        tmp_path,
        [
            FrameworkStep(
                id="step-1",
                index=0,
                keyword="log.message",
                description="Say hello",
                enabled=True,
                params={"message": "hello"},
            )
        ],
    )

    events = [event async for event in run_script(request)]

    assert [event.type for event in events] == [
        "run_started",
        "step_started",
        "log",
        "step_finished",
        "run_finished",
    ]
    assert events[2].message == "hello"
    assert events[3].status == "passed"
    assert events[3].output == {"message": "hello"}
    assert events[-1].status == "passed"


@pytest.mark.anyio
async def test_mock_runtime_fails_negative_wait_without_crashing(
    tmp_path: Path,
) -> None:
    request = make_request(
        tmp_path,
        [
            FrameworkStep(
                id="step-1",
                index=0,
                keyword="wait",
                description="Invalid wait",
                enabled=True,
                params={"seconds": -1},
            )
        ],
    )

    events = [event async for event in run_script(request)]

    assert events[-2].type == "step_finished"
    assert events[-2].status == "failed"
    assert events[-2].error_message == "wait.seconds must be greater than or equal to 0"
    assert events[-1].type == "run_finished"
    assert events[-1].status == "failed"


@pytest.mark.anyio
async def test_mock_runtime_honors_cancellation_before_next_step(
    tmp_path: Path,
) -> None:
    token = CancellationToken()
    token.cancel()
    request = make_request(
        tmp_path,
        [
            FrameworkStep(
                id="step-1",
                index=0,
                keyword="log.message",
                description="Skipped",
                enabled=True,
                params={"message": "should not run"},
            )
        ],
        token,
    )

    events = [event async for event in run_script(request)]

    assert [event.type for event in events] == ["run_started", "run_finished"]
    assert events[-1].status == "canceled"
```

- [ ] **Step 2: Run the adapter tests and verify they fail**

Run:

```powershell
cd backend
uv run pytest tests/test_autotest_adapter.py -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'autotest'`.

- [ ] **Step 3: Create adapter contracts**

Create `backend/autotest/__init__.py`:

```python
"""Automation framework adapter boundary."""
```

Create `backend/autotest/contracts.py`:

```python
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

FrameworkEventType = Literal[
    "run_started",
    "step_started",
    "log",
    "step_finished",
    "attachment",
    "run_finished",
    "run_error",
]
FrameworkRunStatus = Literal["passed", "failed", "canceled", "error"]
FrameworkStepStatus = Literal["passed", "failed", "canceled", "error"]


@dataclass
class CancellationToken:
    is_canceled: bool = False

    def cancel(self) -> None:
        self.is_canceled = True


@dataclass(frozen=True)
class FrameworkStep:
    id: str
    index: int
    keyword: str
    description: str
    enabled: bool
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class FrameworkRunRequest:
    task_id: str
    script_id: str
    script_name: str
    script_revision: int
    steps: list[FrameworkStep]
    variables: dict[str, Any]
    environment: str
    target_device: str
    log_path: Path
    report_dir: Path
    artifact_dir: Path
    cancellation_token: CancellationToken


@dataclass(frozen=True)
class FrameworkEvent:
    type: FrameworkEventType
    task_id: str
    timestamp: str
    step_id: str | None = None
    step_index: int | None = None
    keyword: str | None = None
    message: str = ""
    level: str = "info"
    status: FrameworkRunStatus | FrameworkStepStatus | None = None
    output: dict[str, Any] = field(default_factory=dict)
    error_message: str = ""
    error_detail: str = ""
    attachment_path: str = ""
    attachment_name: str = ""
```

- [ ] **Step 4: Create mock runtime implementation**

Create `backend/autotest/mock_runtime.py`:

```python
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

from autotest.contracts import FrameworkEvent, FrameworkRunRequest, FrameworkStep


class MockKeywordError(Exception):
    pass


async def run_script(
    request: FrameworkRunRequest,
) -> AsyncIterator[FrameworkEvent]:
    yield _event("run_started", request)

    for step in request.steps:
        if not step.enabled:
            continue
        if request.cancellation_token.is_canceled:
            yield _event("run_finished", request, status="canceled")
            return

        yield _event(
            "step_started",
            request,
            step=step,
            message=f"Starting {step.keyword}",
        )
        try:
            output = await _run_step(request, step)
        except MockKeywordError as exc:
            yield _event(
                "log",
                request,
                step=step,
                level="error",
                message=str(exc),
            )
            yield _event(
                "step_finished",
                request,
                step=step,
                status="failed",
                error_message=str(exc),
            )
            yield _event("run_finished", request, status="failed")
            return

        if request.cancellation_token.is_canceled:
            yield _event(
                "step_finished",
                request,
                step=step,
                status="canceled",
                error_message="Execution canceled",
            )
            yield _event("run_finished", request, status="canceled")
            return

        yield _event(
            "step_finished",
            request,
            step=step,
            status="passed",
            output=output,
        )

    yield _event("run_finished", request, status="passed")


async def _run_step(
    request: FrameworkRunRequest,
    step: FrameworkStep,
) -> dict[str, Any]:
    if step.keyword == "wait":
        seconds = step.params.get("seconds", 1)
        if not isinstance(seconds, int | float):
            raise MockKeywordError("wait.seconds must be a number")
        if seconds < 0:
            raise MockKeywordError("wait.seconds must be greater than or equal to 0")

        sleep_remaining = min(float(seconds), 2.0)
        while sleep_remaining > 0:
            if request.cancellation_token.is_canceled:
                return {"canceled": True}
            interval = min(0.05, sleep_remaining)
            await asyncio.sleep(interval)
            sleep_remaining -= interval
        return {"waited_seconds": seconds}

    if step.keyword == "log.message":
        return {"message": str(step.params.get("message", ""))}

    raise MockKeywordError(f"Unknown mock keyword: {step.keyword}")


def _event(
    event_type: str,
    request: FrameworkRunRequest,
    *,
    step: FrameworkStep | None = None,
    message: str = "",
    level: str = "info",
    status: str | None = None,
    output: dict[str, Any] | None = None,
    error_message: str = "",
) -> FrameworkEvent:
    if event_type == "log" and not message and output and "message" in output:
        message = str(output["message"])
    return FrameworkEvent(
        type=event_type,  # type: ignore[arg-type]
        task_id=request.task_id,
        timestamp=datetime.now(UTC).isoformat(),
        step_id=step.id if step else None,
        step_index=step.index if step else None,
        keyword=step.keyword if step else None,
        message=message,
        level=level,
        status=status,  # type: ignore[arg-type]
        output=output or {},
        error_message=error_message,
    )
```

- [ ] **Step 5: Create stable entry point**

Create `backend/autotest/entry.py`:

```python
from __future__ import annotations

from collections.abc import AsyncIterator

from autotest.contracts import FrameworkEvent, FrameworkRunRequest
from autotest.mock_runtime import run_script as run_mock_script


async def run_script(
    request: FrameworkRunRequest,
) -> AsyncIterator[FrameworkEvent]:
    async for event in run_mock_script(request):
        yield event
```

- [ ] **Step 6: Run the adapter tests and verify they pass**

Run:

```powershell
cd backend
uv run pytest tests/test_autotest_adapter.py -q
```

Expected: PASS, 3 tests passed.

- [ ] **Step 7: Commit adapter contract work**

Run:

```powershell
git add backend/autotest backend/tests/test_autotest_adapter.py
git commit -m "add automation adapter mock runtime"
```

## Task 2: Add Execution Models And Event Bus

**Files:**
- Create: `backend/app/execution/__init__.py`
- Create: `backend/app/execution/models.py`
- Create: `backend/app/execution/events.py`
- Test: `backend/tests/test_execution_service.py`

- [ ] **Step 1: Write model and event bus tests**

Create `backend/tests/test_execution_service.py` with this first test:

```python
import pytest

from app.execution.events import ExecutionEventBus
from app.execution.models import ExecutionEventMessage


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
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_service.py::test_execution_event_bus_broadcasts_to_subscribers -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.execution'`.

- [ ] **Step 3: Create execution models**

Create `backend/app/execution/__init__.py`:

```python
"""TestFlow execution service package."""
```

Create `backend/app/execution/models.py`:

```python
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

TaskStatus = Literal["pending", "running", "passed", "failed", "canceled", "error"]
StepStatus = Literal["pending", "running", "passed", "failed", "canceled", "error", "skipped"]
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

- [ ] **Step 4: Create event bus**

Create `backend/app/execution/events.py`:

```python
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from app.execution.models import ExecutionEventMessage


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
            await subscriber.put(message)
```

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_service.py::test_execution_event_bus_broadcasts_to_subscribers -q
```

Expected: PASS, 1 test passed.

- [ ] **Step 6: Commit models and event bus**

Run:

```powershell
git add backend/app/execution backend/tests/test_execution_service.py
git commit -m "add execution models and event bus"
```

## Task 3: Add Execution Service And Serial Runner

**Files:**
- Modify: `backend/app/execution/service.py`
- Modify: `backend/tests/test_execution_service.py`

- [ ] **Step 1: Add service tests for successful execution**

Append to `backend/tests/test_execution_service.py`:

```python
from pathlib import Path

import pytest

from app.config import Settings
from app.execution.models import ExecutionTaskCreate
from app.execution.service import ExecutionService
from app.script_catalog import TestScript, save_script


def save_published_script(settings: Settings) -> None:
    save_script(
        settings,
        TestScript(
            id="smoke-cockpit",
            name="Smoke cockpit",
            status="published",
            steps=[
                {
                    "id": "step-1",
                    "keyword": "log.message",
                    "description": "Log startup",
                    "enabled": True,
                    "params": {"message": "startup ok"},
                },
                {
                    "id": "step-2",
                    "keyword": "wait",
                    "description": "Wait briefly",
                    "enabled": True,
                    "params": {"seconds": 0},
                },
            ],
        ),
    )


@pytest.mark.anyio
async def test_execution_service_runs_script_to_passed(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    save_published_script(settings)
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
    assert Path(final_task.log_path).is_file()
    assert "startup ok" in Path(final_task.log_path).read_text(encoding="utf-8")
```

- [ ] **Step 2: Run the service test and verify it fails**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_service.py::test_execution_service_runs_script_to_passed -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.execution.service'`.

- [ ] **Step 3: Create execution service skeleton and helpers**

Create `backend/app/execution/service.py` with:

```python
from __future__ import annotations

import asyncio
import contextlib
from datetime import UTC, datetime
from pathlib import Path
from time import monotonic
from typing import Any
from uuid import uuid4

from autotest.contracts import (
    CancellationToken,
    FrameworkEvent,
    FrameworkRunRequest,
    FrameworkStep,
)
from autotest.entry import run_script

from app.config import Settings
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
from app.script_catalog import TestScript, read_script


TERMINAL_STATUSES: set[TaskStatus] = {"passed", "failed", "canceled", "error"}


class TaskNotFoundError(Exception):
    pass


class TaskAlreadyFinishedError(Exception):
    pass


class ExecutionService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.events = ExecutionEventBus()
        self._tasks: dict[str, ExecutionTask] = {}
        self._tokens: dict[str, CancellationToken] = {}
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._worker: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if self._worker is None or self._worker.done():
            self._worker = asyncio.create_task(self._worker_loop())

    async def stop(self) -> None:
        if self._worker is None:
            return
        self._worker.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await self._worker
        self._worker = None

    async def create_task(self, payload: ExecutionTaskCreate) -> ExecutionTask:
        script = read_script(self.settings, payload.script_id)
        task_id = uuid4().hex
        log_path = self.settings.logs_dir / "executions" / f"{task_id}.log"
        report_dir = self.settings.reports_dir / task_id
        task = _task_from_script(
            task_id=task_id,
            script=script,
            payload=payload,
            log_path=log_path,
            report_dir=report_dir,
        )
        self._tasks[task_id] = task
        self._tokens[task_id] = CancellationToken()
        await self.events.publish(
            ExecutionEventMessage(
                type="task_status",
                task_id=task_id,
                status="pending",
                message="Task queued",
                task=task,
            )
        )
        await self._queue.put(task_id)
        return task

    def list_tasks(self) -> list[ExecutionTaskSummary]:
        return [_summary(task) for task in self._tasks.values()]

    def get_task(self, task_id: str) -> ExecutionTask:
        try:
            return self._tasks[task_id]
        except KeyError as exc:
            raise TaskNotFoundError(task_id) from exc

    async def cancel_task(self, task_id: str) -> ExecutionTask:
        task = self.get_task(task_id)
        if task.status in TERMINAL_STATUSES:
            raise TaskAlreadyFinishedError(task_id)
        self._tokens[task_id].cancel()
        await self._append_log(task, "warning", "Cancellation requested")
        await self.events.publish(
            ExecutionEventMessage(
                type="task_status",
                task_id=task_id,
                status=task.status,
                message="Cancellation requested",
                task=task,
            )
        )
        return task

    async def wait_for_task(self, task_id: str, timeout: float) -> ExecutionTask:
        deadline = monotonic() + timeout
        while monotonic() < deadline:
            task = self.get_task(task_id)
            if task.status in TERMINAL_STATUSES:
                return task
            await asyncio.sleep(0.01)
        raise TimeoutError(f"Timed out waiting for task {task_id}")

    async def _worker_loop(self) -> None:
        while True:
            task_id = await self._queue.get()
            try:
                await self._run_task(task_id)
            finally:
                self._queue.task_done()

    async def _run_task(self, task_id: str) -> None:
        task = self.get_task(task_id)
        token = self._tokens[task_id]
        _mark_task_started(task)
        await self._publish_task_status(task, "Task started")

        request = _framework_request(self.settings, task, token)
        try:
            async for event in run_script(request):
                await self._handle_framework_event(task, event)
        except Exception as exc:
            task.status = "error"
            task.error_message = str(exc)
            await self._append_log(task, "error", str(exc))
            await self._finish_task(task)

        if task.status not in TERMINAL_STATUSES:
            task.status = _final_status_from_steps(task)
            await self._finish_task(task)

    async def _handle_framework_event(
        self,
        task: ExecutionTask,
        event: FrameworkEvent,
    ) -> None:
        if event.type == "run_started":
            await self._append_log(task, "info", "Run started")
            return
        if event.type == "step_started":
            step = _find_step(task, event.step_id)
            step.status = "running"
            step.started_at = event.timestamp
            await self.events.publish(
                ExecutionEventMessage(
                    type="step_status",
                    task_id=task.id,
                    status="running",
                    step_id=step.id,
                    message=event.message,
                    step=step,
                    task=task,
                )
            )
            return
        if event.type == "log":
            await self._append_log(task, event.level, event.message, event.step_id)
            return
        if event.type == "step_finished":
            step = _find_step(task, event.step_id)
            step.status = event.status or "error"  # type: ignore[assignment]
            step.finished_at = event.timestamp
            step.output = event.output
            step.error_message = event.error_message
            step.error_detail = event.error_detail
            step.duration_ms = _duration_ms(step.started_at, step.finished_at)
            await self.events.publish(
                ExecutionEventMessage(
                    type="step_status",
                    task_id=task.id,
                    status=step.status,
                    step_id=step.id,
                    message=event.error_message or event.message,
                    step=step,
                    task=task,
                )
            )
            return
        if event.type == "run_finished":
            task.status = event.status or _final_status_from_steps(task)  # type: ignore[assignment]
            await self._finish_task(task)
            return
        if event.type == "run_error":
            task.status = "error"
            task.error_message = event.error_message or event.message
            await self._finish_task(task)

    async def _append_log(
        self,
        task: ExecutionTask,
        level: str,
        message: str,
        step_id: str | None = None,
    ) -> None:
        entry = ExecutionLogEntry(
            timestamp=utc_now(),
            level=level,
            message=message,
            step_id=step_id,
        )
        task.logs.append(entry)
        path = Path(task.log_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(f"{entry.timestamp} [{entry.level}] {entry.message}\n")
        await self.events.publish(
            ExecutionEventMessage(
                type="log",
                task_id=task.id,
                step_id=step_id,
                message=message,
                level=level,
                task=task,
            )
        )

    async def _publish_task_status(
        self,
        task: ExecutionTask,
        message: str,
    ) -> None:
        await self.events.publish(
            ExecutionEventMessage(
                type="task_status",
                task_id=task.id,
                status=task.status,
                message=message,
                task=task,
            )
        )

    async def _finish_task(self, task: ExecutionTask) -> None:
        if task.finished_at is None:
            task.finished_at = utc_now()
        task.duration_ms = _duration_ms(task.started_at, task.finished_at)
        await self._publish_task_status(task, "Task finished")
        await self.events.publish(
            ExecutionEventMessage(
                type="task_finished",
                task_id=task.id,
                status=task.status,
                message="Task finished",
                task=task,
            )
        )
```

- [ ] **Step 4: Append service helper functions**

Append this code to `backend/app/execution/service.py`:

```python
def _task_from_script(
    *,
    task_id: str,
    script: TestScript,
    payload: ExecutionTaskCreate,
    log_path: Path,
    report_dir: Path,
) -> ExecutionTask:
    version = script.version
    enabled_steps = [step for step in script.steps if step.enabled]
    return ExecutionTask(
        id=task_id,
        script_id=script.id,
        script_name=script.name,
        script_revision=version.revision if version else 1,
        environment=payload.environment,
        target_device=payload.target_device,
        variables=payload.variables,
        executor=payload.executor,
        log_path=str(log_path),
        report_dir=str(report_dir),
        steps=[
            ExecutionStepResult(
                id=step.id,
                index=index,
                keyword=step.keyword,
                description=step.description,
                input=step.params,
            )
            for index, step in enumerate(enabled_steps)
        ],
    )


def _framework_request(
    settings: Settings,
    task: ExecutionTask,
    token: CancellationToken,
) -> FrameworkRunRequest:
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
                params=step.input,
            )
            for step in task.steps
        ],
        variables=task.variables,
        environment=task.environment,
        target_device=task.target_device,
        log_path=Path(task.log_path),
        report_dir=Path(task.report_dir),
        artifact_dir=Path(task.report_dir) / "artifacts",
        cancellation_token=token,
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
    task.started_at = utc_now()


def _find_step(task: ExecutionTask, step_id: str | None) -> ExecutionStepResult:
    for step in task.steps:
        if step.id == step_id:
            return step
    raise ValueError(f"Unknown step id: {step_id}")


def _final_status_from_steps(task: ExecutionTask) -> TaskStatus:
    if any(step.status == "failed" for step in task.steps):
        return "failed"
    if any(step.status == "error" for step in task.steps):
        return "error"
    if any(step.status == "canceled" for step in task.steps):
        return "canceled"
    return "passed"


def _duration_ms(started_at: str | None, finished_at: str | None) -> int | None:
    if started_at is None or finished_at is None:
        return None
    started = datetime.fromisoformat(started_at)
    finished = datetime.fromisoformat(finished_at)
    return max(0, int((finished - started).total_seconds() * 1000))
```

- [ ] **Step 5: Run the successful service test**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_service.py::test_execution_service_runs_script_to_passed -q
```

Expected: PASS, 1 test passed.

- [ ] **Step 6: Add service tests for failure and cancellation**

Append to `backend/tests/test_execution_service.py`:

```python
@pytest.mark.anyio
async def test_execution_service_marks_failed_step_as_failed(
    tmp_path: Path,
) -> None:
    settings = Settings(data_dir=tmp_path)
    save_script(
        settings,
        TestScript(
            id="bad-wait",
            name="Bad wait",
            status="published",
            steps=[
                {
                    "id": "step-1",
                    "keyword": "wait",
                    "enabled": True,
                    "params": {"seconds": -1},
                }
            ],
        ),
    )
    service = ExecutionService(settings)
    await service.start()

    try:
        task = await service.create_task(ExecutionTaskCreate(script_id="bad-wait"))
        final_task = await service.wait_for_task(task.id, timeout=2)
    finally:
        await service.stop()

    assert final_task.status == "failed"
    assert final_task.steps[0].status == "failed"
    assert final_task.steps[0].error_message == "wait.seconds must be greater than or equal to 0"


@pytest.mark.anyio
async def test_execution_service_can_cancel_running_task(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    save_script(
        settings,
        TestScript(
            id="long-wait",
            name="Long wait",
            status="published",
            steps=[
                {
                    "id": "step-1",
                    "keyword": "wait",
                    "enabled": True,
                    "params": {"seconds": 2},
                }
            ],
        ),
    )
    service = ExecutionService(settings)
    await service.start()

    try:
        task = await service.create_task(ExecutionTaskCreate(script_id="long-wait"))
        await asyncio.sleep(0.05)
        await service.cancel_task(task.id)
        final_task = await service.wait_for_task(task.id, timeout=2)
    finally:
        await service.stop()

    assert final_task.status == "canceled"
```

Also add `import asyncio` near the top of `backend/tests/test_execution_service.py`.

- [ ] **Step 7: Run all service tests**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_service.py -q
```

Expected: PASS, all service tests pass.

- [ ] **Step 8: Commit execution service**

Run:

```powershell
git add backend/app/execution backend/tests/test_execution_service.py
git commit -m "add serial execution service"
```

## Task 4: Add Task APIs And Execution WebSocket

**Files:**
- Modify: `backend/app/api/__init__.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_execution_service.py`

- [ ] **Step 1: Add API tests**

Append to `backend/tests/test_execution_service.py`:

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_task_api_creates_and_reads_execution_task(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    save_published_script(settings)

    with TestClient(create_app(settings)) as client:
        create_response = client.post(
            "/api/tasks",
            json={
                "script_id": "smoke-cockpit",
                "environment": "local",
                "target_device": "bench-1",
            },
        )
        task_id = create_response.json()["id"]
        detail_response = client.get(f"/api/tasks/{task_id}")
        list_response = client.get("/api/tasks")

    assert create_response.status_code == 201
    assert create_response.json()["script_id"] == "smoke-cockpit"
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == task_id
    assert list_response.status_code == 200
    assert list_response.json()["items"][0]["id"] == task_id


def test_task_api_returns_404_for_missing_script(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.post("/api/tasks", json={"script_id": "missing"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_task_api_cancels_running_task(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    save_script(
        settings,
        TestScript(
            id="long-wait",
            name="Long wait",
            status="published",
            steps=[
                {
                    "id": "step-1",
                    "keyword": "wait",
                    "enabled": True,
                    "params": {"seconds": 2},
                }
            ],
        ),
    )

    with TestClient(create_app(settings)) as client:
        create_response = client.post("/api/tasks", json={"script_id": "long-wait"})
        task_id = create_response.json()["id"]
        cancel_response = client.post(f"/api/tasks/{task_id}/cancel")

    assert cancel_response.status_code == 200
    assert cancel_response.json()["id"] == task_id
```

- [ ] **Step 2: Run API tests and verify they fail**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_service.py::test_task_api_creates_and_reads_execution_task tests/test_execution_service.py::test_task_api_returns_404_for_missing_script tests/test_execution_service.py::test_task_api_cancels_running_task -q
```

Expected: FAIL because `/api/tasks` still returns the placeholder route.

- [ ] **Step 3: Start execution service in FastAPI lifespan**

Modify `backend/app/main.py`:

```python
from app.execution.service import ExecutionService
```

Then update `lifespan`:

```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    configure_logging(settings)
    ensure_database(settings)
    execution_service = ExecutionService(settings)
    app.state.execution_service = execution_service
    await execution_service.start()
    try:
        yield
    finally:
        await execution_service.stop()
```

- [ ] **Step 4: Replace task routes and add execution WebSocket**

Modify `backend/app/api/__init__.py`.

Add imports:

```python
from app.execution.models import ExecutionTaskCreate
from app.execution.service import (
    TaskAlreadyFinishedError,
    TaskNotFoundError,
)
```

Remove this placeholder route:

```python
api_router.add_api_route("/tasks", empty_items_response, methods=["GET"])
```

Add these route helpers and endpoints:

```python
def execution_service(request: Request):
    return request.app.state.execution_service


@api_router.get("/tasks")
def list_execution_tasks(request: Request) -> dict[str, list[dict[str, object]]]:
    tasks = execution_service(request).list_tasks()
    return {"items": [task.model_dump(mode="json") for task in tasks]}


@api_router.post("/tasks", response_model=None)
async def create_execution_task(
    payload: ExecutionTaskCreate,
    request: Request,
    response: Response,
) -> dict[str, object] | Response:
    try:
        task = await execution_service(request).create_task(payload)
    except FileNotFoundError:
        return error_response(
            status_code=404,
            code="not_found",
            message="Script not found",
        )
    response.status_code = 201
    return task.model_dump(mode="json")


@api_router.get("/tasks/{task_id}")
def get_execution_task(task_id: str, request: Request) -> dict[str, object] | Response:
    try:
        task = execution_service(request).get_task(task_id)
    except TaskNotFoundError:
        return error_response(
            status_code=404,
            code="not_found",
            message="Task not found",
        )
    return task.model_dump(mode="json")


@api_router.post("/tasks/{task_id}/cancel", response_model=None)
async def cancel_execution_task(
    task_id: str,
    request: Request,
) -> dict[str, object] | Response:
    try:
        task = await execution_service(request).cancel_task(task_id)
    except TaskNotFoundError:
        return error_response(
            status_code=404,
            code="not_found",
            message="Task not found",
        )
    except TaskAlreadyFinishedError:
        return error_response(
            status_code=409,
            code="task_finished",
            message="Task has already finished",
        )
    return task.model_dump(mode="json")
```

Add the WebSocket endpoint after the existing `/ws` endpoint:

```python
@websocket_router.websocket("/ws/executions")
async def execution_websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    service = websocket.app.state.execution_service
    try:
        async with service.events.subscribe() as subscriber:
            await websocket.send_json({"type": "connection", "status": "connected"})
            while True:
                message = await subscriber.get()
                await websocket.send_json(message.model_dump(mode="json"))
    except WebSocketDisconnect:
        return
```

- [ ] **Step 5: Confirm foundation route expectation**

In `backend/tests/test_app_foundation.py`, keep `/api/tasks` in the endpoint list and keep expecting `{"items": []}` when no tasks exist. Do not change this file if the existing assertion still matches the new empty task list behavior.

- [ ] **Step 6: Run backend API tests**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_service.py tests/test_app_foundation.py -q
```

Expected: PASS.

- [ ] **Step 7: Run backend lint**

Run:

```powershell
cd backend
uv run ruff check .
```

Expected: PASS. If Ruff reports `ANN401` it is not enabled by the project config; fix only errors reported by the command.

- [ ] **Step 8: Commit API integration**

Run:

```powershell
git add backend/app/api/__init__.py backend/app/main.py backend/tests/test_app_foundation.py backend/tests/test_execution_service.py
git commit -m "add execution task api"
```

## Task 5: Add Frontend API Client Support

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/api.test.ts`

- [ ] **Step 1: Add API client tests**

Append to `apps/web/src/lib/api.test.ts`:

```typescript
  it('exposes execution task endpoints', async () => {
    const task = {
      id: 'task-1',
      script_id: 'smoke-cockpit',
      script_name: 'Smoke cockpit',
      script_revision: 1,
      status: 'pending',
      environment: 'local',
      target_device: 'bench-1',
      variables: {},
      executor: 'local',
      created_at: '2026-06-01T00:00:00+00:00',
      started_at: null,
      finished_at: null,
      duration_ms: null,
      log_path: '',
      report_dir: '',
      steps: [],
      logs: [],
      error_message: '',
    }
    const httpClient = {
      get: vi.fn().mockResolvedValue({ data: { items: [task] } }),
      post: vi.fn().mockResolvedValue({ data: task }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.listTasks()).resolves.toEqual({ items: [task] })
    await expect(
      api.createTask({
        script_id: 'smoke-cockpit',
        environment: 'local',
        target_device: 'bench-1',
        variables: {},
      }),
    ).resolves.toEqual(task)
    await expect(api.cancelTask('task-1')).resolves.toEqual(task)

    expect(httpClient.get).toHaveBeenCalledWith('/api/tasks')
    expect(httpClient.post).toHaveBeenCalledWith('/api/tasks', {
      script_id: 'smoke-cockpit',
      environment: 'local',
      target_device: 'bench-1',
      variables: {},
    })
    expect(httpClient.post).toHaveBeenCalledWith('/api/tasks/task-1/cancel', {})
  })
```

- [ ] **Step 2: Run the API client test and verify it fails**

Run:

```powershell
pnpm --filter @testflow/web test -- api.test.ts
```

Expected: FAIL because `listTasks`, `createTask`, and `cancelTask` do not exist.

- [ ] **Step 3: Add task types and methods**

In `apps/web/src/lib/api.ts`, add these types after `TestScript`:

```typescript
export type TaskStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'canceled'
  | 'error'

export type StepStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'canceled'
  | 'error'
  | 'skipped'

export type ExecutionTaskCreate = {
  script_id: string
  environment: string
  target_device: string
  variables: Record<string, unknown>
  executor?: string
}

export type ExecutionLogEntry = {
  timestamp: string
  level: string
  message: string
  step_id?: string | null
}

export type ExecutionStepResult = {
  id: string
  index: number
  keyword: string
  description: string
  status: StepStatus
  started_at?: string | null
  finished_at?: string | null
  duration_ms?: number | null
  input: Record<string, unknown>
  output: Record<string, unknown>
  error_message: string
  error_detail: string
  attachments: string[]
}

export type ExecutionTask = {
  id: string
  script_id: string
  script_name: string
  script_revision: number
  status: TaskStatus
  environment: string
  target_device: string
  variables: Record<string, unknown>
  executor: string
  created_at: string
  started_at?: string | null
  finished_at?: string | null
  duration_ms?: number | null
  log_path: string
  report_dir: string
  steps: ExecutionStepResult[]
  logs: ExecutionLogEntry[]
  error_message: string
}

export type ExecutionTaskSummary = Pick<
  ExecutionTask,
  | 'id'
  | 'script_id'
  | 'script_name'
  | 'script_revision'
  | 'status'
  | 'environment'
  | 'target_device'
  | 'executor'
  | 'created_at'
  | 'started_at'
  | 'finished_at'
  | 'duration_ms'
> & {
  step_count: number
  passed_step_count: number
  failed_step_count: number
}
```

Add this helper near the existing `post` helper:

```typescript
  async function postEmpty<TResponse>(path: string): Promise<TResponse> {
    try {
      const response = await httpClient.post<TResponse>(path, {})
      return response.data
    } catch (error) {
      throw normalizeApiError(error)
    }
  }
```

Add these methods to the returned client object:

```typescript
    listTasks: () => request<ItemList<ExecutionTaskSummary>>('/api/tasks'),
    getTask: (taskId: string) => request<ExecutionTask>(`/api/tasks/${taskId}`),
    createTask: (task: ExecutionTaskCreate) =>
      post<ExecutionTask, ExecutionTaskCreate>('/api/tasks', task),
    cancelTask: (taskId: string) =>
      postEmpty<ExecutionTask>(`/api/tasks/${taskId}/cancel`),
```

- [ ] **Step 4: Run API client tests**

Run:

```powershell
pnpm --filter @testflow/web test -- api.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit frontend API client work**

Run:

```powershell
git add apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "add execution task api client"
```

## Task 6: Build Execution Task Page

**Files:**
- Create: `apps/web/src/features/execution/TaskPage.tsx`
- Create: `apps/web/src/features/execution/TaskPage.test.tsx`
- Modify: `apps/web/src/app/routes.tsx`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Add execution page tests**

Create `apps/web/src/features/execution/TaskPage.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TaskPage } from './TaskPage'

const mockApi = vi.hoisted(() => ({
  cancelTask: vi.fn(),
  createTask: vi.fn(),
  listScripts: vi.fn(),
  listTasks: vi.fn(),
}))

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    createApiClient: () => mockApi,
  }
})

function renderTaskPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <TaskPage />
    </QueryClientProvider>,
  )
}

describe('TaskPage', () => {
  it('starts execution for a selected published script', async () => {
    mockApi.listScripts.mockResolvedValue({
      items: [
        {
          id: 'smoke-cockpit',
          name: 'Smoke cockpit',
          description: '',
          step_count: 1,
          enabled_step_count: 1,
          revision: 1,
          updated_at: '2026-06-01T00:00:00+00:00',
          status: 'published',
          tags: [],
          group: '',
        },
      ],
    })
    mockApi.listTasks.mockResolvedValue({ items: [] })
    mockApi.createTask.mockResolvedValue({
      id: 'task-1',
      script_id: 'smoke-cockpit',
      script_name: 'Smoke cockpit',
      script_revision: 1,
      status: 'pending',
      environment: 'local',
      target_device: 'bench-1',
      variables: {},
      executor: 'local',
      created_at: '2026-06-01T00:00:00+00:00',
      started_at: null,
      finished_at: null,
      duration_ms: null,
      log_path: '',
      report_dir: '',
      steps: [],
      logs: [],
      error_message: '',
    })

    renderTaskPage()

    await userEvent.selectOptions(
      await screen.findByLabelText('选择脚本'),
      'smoke-cockpit',
    )
    await userEvent.type(screen.getByLabelText('目标设备'), 'bench-1')
    await userEvent.click(screen.getByRole('button', { name: '开始执行' }))

    await waitFor(() => {
      expect(mockApi.createTask).toHaveBeenCalledWith({
        script_id: 'smoke-cockpit',
        environment: 'local',
        target_device: 'bench-1',
        variables: {},
      })
    })
  })
})
```

- [ ] **Step 2: Run the page test and verify it fails**

Run:

```powershell
pnpm --filter @testflow/web test -- TaskPage.test.tsx
```

Expected: FAIL because `TaskPage.tsx` does not exist.

- [ ] **Step 3: Implement TaskPage**

Create `apps/web/src/features/execution/TaskPage.tsx`:

```typescript
import { Activity, Square, TerminalSquare } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  createApiClient,
  type ExecutionEventMessage,
  type ExecutionTask,
  type ExecutionTaskSummary,
} from '@/lib/api'
import { createWebSocketClient } from '@/lib/websocket'

const api = createApiClient({ baseUrl: 'http://127.0.0.1:8000' })
const executionWebSocketUrl = 'ws://127.0.0.1:8000/ws/executions'

export function TaskPage() {
  const queryClient = useQueryClient()
  const [selectedScriptId, setSelectedScriptId] = useState('')
  const [environment, setEnvironment] = useState('local')
  const [targetDevice, setTargetDevice] = useState('')
  const [activeTask, setActiveTask] = useState<ExecutionTask | undefined>()
  const [liveLogs, setLiveLogs] = useState<string[]>([])

  const scriptsQuery = useQuery({
    queryKey: ['scripts'],
    queryFn: api.listScripts,
  })
  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: api.listTasks,
  })

  const createMutation = useMutation({
    mutationFn: api.createTask,
    onSuccess: async (task) => {
      setActiveTask(task)
      setLiveLogs([])
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
  const cancelMutation = useMutation({
    mutationFn: api.cancelTask,
    onSuccess: async (task) => {
      setActiveTask(task)
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  useEffect(() => {
    const client = createWebSocketClient({
      reconnectDelayMs: 1000,
      url: executionWebSocketUrl,
    })
    const unsubscribe = client.subscribe(
      () => undefined,
      (message) => {
        const event = message as ExecutionEventMessage
        if (!event || !('type' in event) || event.type === 'connection') {
          return
        }
        if (event.task) {
          setActiveTask(event.task)
        }
        if (event.type === 'log' && event.message) {
          setLiveLogs((current) => [...current, event.message].slice(-200))
        }
        void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      },
    )
    client.connect()
    return () => {
      unsubscribe()
      client.disconnect()
    }
  }, [queryClient])

  const publishedScripts = useMemo(
    () =>
      (scriptsQuery.data?.items ?? []).filter(
        (script) => script.status === 'published',
      ),
    [scriptsQuery.data?.items],
  )
  const tasks = tasksQuery.data?.items ?? []
  const selectedScript =
    publishedScripts.find((script) => script.id === selectedScriptId) ??
    publishedScripts[0]

  useEffect(() => {
    if (!selectedScriptId && selectedScript) {
      setSelectedScriptId(selectedScript.id)
    }
  }, [selectedScript, selectedScriptId])

  function startTask() {
    if (!selectedScriptId) {
      return
    }
    createMutation.mutate({
      script_id: selectedScriptId,
      environment,
      target_device: targetDevice,
      variables: {},
    })
  }

  const canCancel =
    activeTask?.status === 'pending' || activeTask?.status === 'running'

  return (
    <section className="content-panel execution-workspace">
      <div className="script-page-heading">
        <div className="section-heading">
          <p>阶段六</p>
          <h1>执行任务</h1>
          <span>选择已发布脚本，启动单机串行执行并查看实时日志。</span>
        </div>
        <div className="editor-actions">
          <Button
            disabled={!selectedScriptId || createMutation.isPending}
            onClick={startTask}
            type="button"
          >
            <Activity aria-hidden="true" data-icon="inline-start" />
            开始执行
          </Button>
          <Button
            disabled={!activeTask || !canCancel || cancelMutation.isPending}
            onClick={() => activeTask && cancelMutation.mutate(activeTask.id)}
            type="button"
            variant="secondary"
          >
            <Square aria-hidden="true" data-icon="inline-start" />
            取消
          </Button>
        </div>
      </div>

      <div className="execution-grid">
        <section className="editor-section">
          <h2>任务参数</h2>
          <div className="form-grid">
            <label>
              <span>选择脚本</span>
              <select
                aria-label="选择脚本"
                value={selectedScriptId}
                onChange={(event) => setSelectedScriptId(event.target.value)}
              >
                {publishedScripts.map((script) => (
                  <option key={script.id} value={script.id}>
                    {script.name} v{script.revision}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>执行环境</span>
              <input
                aria-label="执行环境"
                value={environment}
                onChange={(event) => setEnvironment(event.target.value)}
              />
            </label>
            <label>
              <span>目标设备</span>
              <input
                aria-label="目标设备"
                value={targetDevice}
                onChange={(event) => setTargetDevice(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="editor-section">
          <h2>当前任务</h2>
          {activeTask ? <ActiveTask task={activeTask} /> : <EmptyTask />}
        </section>

        <section className="editor-section execution-log-panel">
          <h2>
            <TerminalSquare aria-hidden="true" />
            实时日志
          </h2>
          <div className="execution-log">
            {liveLogs.length === 0 ? (
              <p>暂无日志</p>
            ) : (
              liveLogs.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)
            )}
          </div>
        </section>

        <section className="editor-section">
          <h2>最近任务</h2>
          <div className="task-list">
            {tasks.map((task) => (
              <TaskListItem
                key={task.id}
                onSelect={() => void api.getTask(task.id).then(setActiveTask)}
                task={task}
              />
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function ActiveTask({ task }: { task: ExecutionTask }) {
  return (
    <div className="active-task">
      <div className="script-title-row">
        <h3>{task.script_name}</h3>
        <Badge variant={task.status === 'passed' ? 'default' : 'secondary'}>
          {task.status}
        </Badge>
      </div>
      <p>{task.target_device || task.environment}</p>
      <div className="step-list">
        {task.steps.map((step) => (
          <div className="step-result-row" key={step.id}>
            <span>{step.keyword}</span>
            <strong>{step.status}</strong>
            {step.error_message ? <em>{step.error_message}</em> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyTask() {
  return <div className="catalog-placeholder">尚未启动任务</div>
}

function TaskListItem({
  onSelect,
  task,
}: {
  onSelect: () => void
  task: ExecutionTaskSummary
}) {
  return (
    <button className="task-list-item" onClick={onSelect} type="button">
      <span>{task.script_name}</span>
      <strong>{task.status}</strong>
      <em>
        {task.passed_step_count}/{task.step_count} passed
      </em>
    </button>
  )
}
```

- [ ] **Step 4: Add `ExecutionEventMessage` type to API module**

In `apps/web/src/lib/api.ts`, add:

```typescript
export type ExecutionEventMessage = {
  type: 'task_status' | 'step_status' | 'log' | 'task_finished' | 'connection'
  task_id?: string
  status?: TaskStatus | StepStatus | string | null
  step_id?: string | null
  message?: string
  level?: string
  timestamp?: string
  task?: ExecutionTask | null
  step?: ExecutionStepResult | null
}
```

- [ ] **Step 5: Wire the route**

Modify `apps/web/src/app/routes.tsx`.

Add import:

```typescript
import { TaskPage } from '@/features/execution/TaskPage'
```

Replace the `/tasks` route element with:

```typescript
    element: <TaskPage />,
```

- [ ] **Step 6: Add execution styles**

Append to `apps/web/src/index.css`:

```css
.execution-workspace {
  display: grid;
  gap: 1rem;
}

.execution-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.75fr);
}

.execution-log-panel {
  grid-column: 1 / -1;
}

.execution-log {
  background: #101418;
  border-radius: 8px;
  color: #dce7ef;
  display: grid;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  gap: 0.25rem;
  max-height: 280px;
  overflow: auto;
  padding: 1rem;
}

.execution-log p {
  margin: 0;
}

.active-task,
.task-list {
  display: grid;
  gap: 0.75rem;
}

.task-list-item,
.step-result-row {
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  display: grid;
  gap: 0.5rem;
  grid-template-columns: minmax(0, 1fr) auto auto;
  padding: 0.75rem;
  text-align: left;
}

.task-list-item {
  background: var(--surface);
  color: inherit;
}

.step-result-row em,
.task-list-item em {
  color: var(--muted-foreground);
  font-style: normal;
}

@media (max-width: 900px) {
  .execution-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 7: Run the page test**

Run:

```powershell
pnpm --filter @testflow/web test -- TaskPage.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit execution page**

Run:

```powershell
git add apps/web/src/features/execution apps/web/src/app/routes.tsx apps/web/src/index.css apps/web/src/lib/api.ts
git commit -m "add execution task page"
```

## Task 7: Final Verification And Plan Closeout

**Files:**
- Modify: `implementation-plan`

- [ ] **Step 1: Run backend tests**

Run:

```powershell
cd backend
uv run pytest
```

Expected: PASS, all backend tests pass.

- [ ] **Step 2: Run backend Ruff checks**

Run:

```powershell
cd backend
uv run ruff check .
```

Expected: PASS.

- [ ] **Step 3: Run frontend tests**

Run:

```powershell
pnpm --filter @testflow/web test
```

Expected: PASS.

- [ ] **Step 4: Run web build check**

Run:

```powershell
pnpm check:web
```

Expected: PASS.

- [ ] **Step 5: Run full workspace check**

Run:

```powershell
pnpm check
```

Expected: PASS.

- [ ] **Step 6: Manually smoke test the execution loop**

Run backend and web in separate terminals:

```powershell
pnpm dev:backend
```

```powershell
pnpm dev:web
```

Open `http://127.0.0.1:5174/tasks`, select a published script with `log.message`
or `wait`, start execution, and confirm:

- Task appears in the current task panel.
- Status moves from `pending` to `running` to a terminal status.
- Logs appear in the live log panel.
- Step rows show status and output or error.
- Cancel changes a long-running wait task to `canceled`.

- [ ] **Step 7: Update implementation-plan Phase 6 progress**

In `implementation-plan`, mark only verified Phase 6 checklist items as done.
Use this progress note format under `## 阶段 6：执行器与 pytest 适配`:

```markdown
### 进度

已完成第一版进程内 Adapter + mock runtime 执行闭环。验证命令：`cd backend && uv run pytest`、`cd backend && uv run ruff check .`、`pnpm --filter @testflow/web test`、`pnpm check:web`、`pnpm check`，并通过浏览器 smoke 验证单脚本执行、实时日志、失败步骤和取消。
```

- [ ] **Step 8: Commit verified Phase 6 completion**

Run:

```powershell
git add implementation-plan
git commit -m "mark phase 6 execution loop complete"
```

## Self-Review Notes

- Spec coverage: Adapter boundary is covered by Task 1. Platform task lifecycle, serial scheduling, cancellation, WebSocket events, and log writing are covered by Tasks 2-4. Frontend execution entry and live logs are covered by Tasks 5-6. Final verification and implementation-plan update are covered by Task 7.
- Phase 7 exclusions are explicit: SQLite history, durable reports, filters, and report pages are not part of this plan.
- The public API remains in TestFlow terms. Framework objects stay behind `backend/autotest/entry.py`.
