# Phase 7 Execution History and Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist every completed execution from Phase 6 and give users searchable execution history plus structured report detail pages.

**Architecture:** TestFlow remains the owner of public execution and report models. Phase 7 adds a SQLite-backed repository under `app.modules.executions`, persists the existing `ExecutionTask` snapshot when the runner finishes, exposes history and report APIs, then renders those APIs through the existing execution feature in the React app. Raw automation framework report output is preserved as supplementary report data; frontend and database behavior are driven by normalized TestFlow task, step, log, and attachment fields.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, SQLModel, SQLite, pytest, React 19, Vite, TypeScript, TanStack Query, Tailwind CSS v4, shadcn/ui.

---

## Scope

Implement Phase 7 from `implementation-plan`:

- Establish execution history and report persistence.
- Implement history list filters by script, status, time range, and executor.
- Implement report detail API.
- Replace the `/history` and `/reports` placeholders with working pages.
- Reuse Phase 6 execution models and statuses.

Do not implement SCP, scheduled execution, dashboard trend charts, report export, report deletion, or real automation framework integration in this phase.

## Existing Context

- Phase 7 requirements: `implementation-plan`
- Adapter design: `docs/superpowers/specs/2026-06-01-phase-6-7-automation-adapter-design.md`
- Backend execution module: `backend/app/modules/executions/`
- Current report placeholder: `backend/app/api/routes/reports.py`
- Current task API: `backend/app/api/routes/executions.py`
- Current execution page: `apps/web/src/features/execution/pages/TaskPage.tsx`
- Current placeholder routes: `apps/web/src/app/routes.tsx`

## File Structure

Create:

- `backend/app/modules/executions/models.py`: SQLModel records for task history and report detail.
- `backend/app/modules/executions/repository.py`: SQLite persistence, filters, report JSON writing, and hydration back to Pydantic models.
- `backend/tests/test_execution_history.py`: backend persistence, history filter, and report API tests.
- `apps/web/src/features/execution/pages/HistoryPage.tsx`: searchable history page.
- `apps/web/src/features/execution/pages/ReportListPage.tsx`: `/reports` index route listing recent reports.
- `apps/web/src/features/execution/pages/ReportDetailPage.tsx`: `/reports/:taskId` detail route.
- `apps/web/src/features/execution/HistoryAndReports.test.tsx`: frontend history/report behavior tests.

Modify:

- `backend/app/db/session.py`: import execution SQLModel records before `create_all`.
- `backend/app/modules/executions/schemas.py`: add history filter and report response schemas.
- `backend/app/modules/executions/runner.py`: persist completed task snapshots.
- `backend/app/modules/executions/service.py`: merge in-memory active tasks with stored history and expose report lookup.
- `backend/app/api/routes/executions.py`: accept history filter query params.
- `backend/app/api/routes/reports.py`: replace placeholder with list/detail report endpoints.
- `apps/web/src/lib/api.ts`: add filter params, report types, `getReport`, and filtered `listTasks`.
- `apps/web/src/features/execution/components/TaskSummaryItem.tsx`: optionally link history/report rows to report details.
- `apps/web/src/features/execution/index.ts`: export new pages.
- `apps/web/src/app/routes.tsx`: wire `/history`, `/reports`, and `/reports/:taskId`.
- `apps/web/src/app/routes.test.ts`: include the hidden report detail route.
- `implementation-plan`: update Phase 7 progress only after all verification passes.

---

## Task 1: Backend Persistence Models

**Files:**
- Create: `backend/app/modules/executions/models.py`
- Modify: `backend/app/db/session.py`
- Test: `backend/tests/test_execution_history.py`

- [ ] **Step 1: Write the failing startup table test**

Create `backend/tests/test_execution_history.py` with this initial test:

```python
import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


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
```

- [ ] **Step 2: Run the failing table test**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_history.py::test_startup_creates_execution_history_tables -q
```

Expected: FAIL because `execution_tasks` and `execution_reports` do not exist.

- [ ] **Step 3: Add SQLModel records**

Create `backend/app/modules/executions/models.py`:

```python
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


def _utc_now() -> datetime:
    return datetime.now(UTC)


class ExecutionTaskRecord(SQLModel, table=True):
    __tablename__ = "execution_tasks"

    id: str = Field(primary_key=True)
    script_id: str = Field(index=True)
    script_name: str
    script_revision: int
    status: str = Field(index=True)
    environment: str = Field(default="")
    target_device: str = Field(default="")
    executor: str = Field(default="local", index=True)
    created_at: str = Field(index=True)
    started_at: str | None = None
    finished_at: str | None = None
    duration_ms: int | None = None
    step_count: int = 0
    passed_step_count: int = 0
    failed_step_count: int = 0
    error_message: str = ""
    log_path: str = ""
    report_dir: str = ""
    report_json_path: str = ""
    variables_json: str = "{}"
    persisted_at: datetime = Field(default_factory=_utc_now)


class ExecutionReportRecord(SQLModel, table=True):
    __tablename__ = "execution_reports"

    task_id: str = Field(primary_key=True)
    task_json: str
    attachments_json: str = "[]"
    raw_framework_report_json: str = "null"
    created_at: str = Field(index=True)
    updated_at: datetime = Field(default_factory=_utc_now)
```

- [ ] **Step 4: Register the models during database startup**

Modify `backend/app/db/session.py` so execution records are imported before `SQLModel.metadata.create_all(engine)`:

```python
from sqlalchemy import Engine, text
from sqlmodel import SQLModel, create_engine

import app.modules.commands.models  # noqa: F401
import app.modules.executions.models  # noqa: F401
from app.core.config import Settings
```

- [ ] **Step 5: Run the table test**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_history.py::test_startup_creates_execution_history_tables -q
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

Run:

```powershell
git add backend/app/modules/executions/models.py backend/app/db/session.py backend/tests/test_execution_history.py
git commit -m "add execution history tables"
```

---

## Task 2: Repository Persistence and Hydration

**Files:**
- Create: `backend/app/modules/executions/repository.py`
- Modify: `backend/app/modules/executions/schemas.py`
- Test: `backend/tests/test_execution_history.py`

- [ ] **Step 1: Add report and filter schemas**

Modify `backend/app/modules/executions/schemas.py` by adding these classes after `ExecutionTaskSummary`:

```python
class ExecutionTaskFilters(BaseModel):
    script_id: str | None = None
    status: TaskStatus | None = None
    created_from: str | None = None
    created_to: str | None = None
    executor: str | None = None


class ExecutionReportAttachment(BaseModel):
    path: str
    name: str
    step_id: str | None = None


class ExecutionReport(BaseModel):
    task: ExecutionTask
    attachments: list[ExecutionReportAttachment] = Field(default_factory=list)
    raw_framework_report: dict[str, Any] | None = None
```

- [ ] **Step 2: Write failing repository tests**

Append these tests to `backend/tests/test_execution_history.py`:

```python
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
    ExecutionTaskFilters,
)


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
```

- [ ] **Step 3: Run the failing repository tests**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_history.py::test_repository_saves_and_reads_execution_report tests/test_execution_history.py::test_repository_filters_history_summaries -q
```

Expected: FAIL because `app.modules.executions.repository` does not exist.

- [ ] **Step 4: Implement the repository**

Create `backend/app/modules/executions/repository.py`:

```python
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import desc
from sqlmodel import Session, create_engine, select

from app.core.config import Settings
from app.modules.executions.models import (
    ExecutionReportRecord,
    ExecutionTaskRecord,
    _utc_now,
)
from app.modules.executions.schemas import (
    ExecutionReport,
    ExecutionReportAttachment,
    ExecutionTask,
    ExecutionTaskFilters,
    ExecutionTaskSummary,
)


def save_execution_report(settings: Settings, task: ExecutionTask) -> ExecutionReport:
    report_dir = _report_dir(settings, task)
    report_dir.mkdir(parents=True, exist_ok=True)

    attachments = _attachment_index(task)
    report = ExecutionReport(
        task=task.model_copy(deep=True),
        attachments=attachments,
        raw_framework_report=None,
    )
    report_path = report_dir / "testflow-report.json"
    report_path.write_text(
        json.dumps(report.model_dump(mode="json"), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    summary = _summary_from_task(task)
    task_record = ExecutionTaskRecord(
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
        step_count=summary.step_count,
        passed_step_count=summary.passed_step_count,
        failed_step_count=summary.failed_step_count,
        error_message=task.error_message,
        log_path=task.log_path,
        report_dir=str(report_dir),
        report_json_path=str(report_path),
        variables_json=json.dumps(task.variables, ensure_ascii=False),
        persisted_at=_utc_now(),
    )
    report_record = ExecutionReportRecord(
        task_id=task.id,
        task_json=json.dumps(task.model_dump(mode="json"), ensure_ascii=False),
        attachments_json=json.dumps(
            [attachment.model_dump(mode="json") for attachment in attachments],
            ensure_ascii=False,
        ),
        raw_framework_report_json="null",
        created_at=task.created_at,
        updated_at=_utc_now(),
    )

    with _session(settings) as session:
        _upsert_task_record(session, task_record)
        _upsert_report_record(session, report_record)
        session.commit()

    return report


def list_execution_task_summaries(
    settings: Settings,
    filters: ExecutionTaskFilters | None = None,
) -> list[ExecutionTaskSummary]:
    filters = filters or ExecutionTaskFilters()
    statement = select(ExecutionTaskRecord)
    if filters.script_id:
        statement = statement.where(ExecutionTaskRecord.script_id == filters.script_id)
    if filters.status:
        statement = statement.where(ExecutionTaskRecord.status == filters.status)
    if filters.created_from:
        statement = statement.where(ExecutionTaskRecord.created_at >= filters.created_from)
    if filters.created_to:
        statement = statement.where(ExecutionTaskRecord.created_at <= filters.created_to)
    if filters.executor:
        statement = statement.where(ExecutionTaskRecord.executor == filters.executor)
    statement = statement.order_by(desc(ExecutionTaskRecord.created_at))

    with _session(settings) as session:
        records = list(session.exec(statement).all())

    return [_summary_from_record(record) for record in records]


def get_execution_task(
    settings: Settings,
    task_id: str,
) -> ExecutionTask | None:
    report = get_execution_report(settings, task_id)
    return report.task if report is not None else None


def get_execution_report(
    settings: Settings,
    task_id: str,
) -> ExecutionReport | None:
    with _session(settings) as session:
        record = session.get(ExecutionReportRecord, task_id)

    if record is None:
        return None

    task = ExecutionTask.model_validate(json.loads(record.task_json))
    attachments = [
        ExecutionReportAttachment.model_validate(attachment)
        for attachment in json.loads(record.attachments_json)
    ]
    raw_framework_report = json.loads(record.raw_framework_report_json)
    return ExecutionReport(
        task=task,
        attachments=attachments,
        raw_framework_report=raw_framework_report,
    )


def _upsert_task_record(
    session: Session,
    next_record: ExecutionTaskRecord,
) -> None:
    existing = session.get(ExecutionTaskRecord, next_record.id)
    if existing is None:
        session.add(next_record)
        return

    for field_name in type(next_record).model_fields:
        setattr(existing, field_name, getattr(next_record, field_name))
    session.add(existing)


def _upsert_report_record(
    session: Session,
    next_record: ExecutionReportRecord,
) -> None:
    existing = session.get(ExecutionReportRecord, next_record.task_id)
    if existing is None:
        session.add(next_record)
        return

    for field_name in type(next_record).model_fields:
        setattr(existing, field_name, getattr(next_record, field_name))
    session.add(existing)


def _summary_from_task(task: ExecutionTask) -> ExecutionTaskSummary:
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


def _summary_from_record(record: ExecutionTaskRecord) -> ExecutionTaskSummary:
    return ExecutionTaskSummary(
        id=record.id,
        script_id=record.script_id,
        script_name=record.script_name,
        script_revision=record.script_revision,
        status=record.status,
        environment=record.environment,
        target_device=record.target_device,
        executor=record.executor,
        created_at=record.created_at,
        started_at=record.started_at,
        finished_at=record.finished_at,
        duration_ms=record.duration_ms,
        step_count=record.step_count,
        passed_step_count=record.passed_step_count,
        failed_step_count=record.failed_step_count,
    )


def _attachment_index(task: ExecutionTask) -> list[ExecutionReportAttachment]:
    attachments: list[ExecutionReportAttachment] = []
    for step in task.steps:
        for attachment_path in step.attachments:
            path = Path(attachment_path)
            attachments.append(
                ExecutionReportAttachment(
                    path=attachment_path,
                    name=path.name,
                    step_id=step.id,
                )
            )
    return attachments


def _report_dir(settings: Settings, task: ExecutionTask) -> Path:
    if task.report_dir:
        return Path(task.report_dir)
    return settings.reports_dir / task.id


def _session(settings: Settings) -> Session:
    return Session(create_engine(f"sqlite:///{settings.database_path}", echo=False))
```

- [ ] **Step 5: Run repository tests**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_history.py::test_repository_saves_and_reads_execution_report tests/test_execution_history.py::test_repository_filters_history_summaries -q
```

Expected: PASS.

- [ ] **Step 6: Run backend lint for import cycles**

Run:

```powershell
cd backend
uv run ruff check app/modules/executions tests/test_execution_history.py
```

Expected: PASS with no import-cycle warnings or lint errors.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git add backend/app/modules/executions/schemas.py backend/app/modules/executions/repository.py backend/tests/test_execution_history.py
git commit -m "persist execution reports"
```

---

## Task 3: Runner and Service History Integration

**Files:**
- Modify: `backend/app/modules/executions/runner.py`
- Modify: `backend/app/modules/executions/service.py`
- Test: `backend/tests/test_execution_history.py`
- Test: `backend/tests/test_execution_service.py`

- [ ] **Step 1: Write failing service persistence tests**

Append these tests to `backend/tests/test_execution_history.py`:

```python
import pytest

from app.modules.executions.schemas import ExecutionTaskCreate
from app.modules.executions.service import ExecutionService
from app.modules.scripts import TestScript as CatalogTestScript
from app.modules.scripts import ScriptStep, save_script


@pytest.mark.anyio
async def test_execution_service_persists_finished_task_history(tmp_path: Path) -> None:
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
        created = await service.create_task(ExecutionTaskCreate(script_id="smoke-cockpit"))
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
```

- [ ] **Step 2: Run the failing service persistence tests**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_history.py::test_execution_service_persists_finished_task_history tests/test_execution_history.py::test_execution_service_persists_failed_task_report -q
```

Expected: FAIL because the runner does not save completed tasks and `ExecutionService.get_report` does not exist.

- [ ] **Step 3: Persist terminal task snapshots in the runner**

Modify `backend/app/modules/executions/runner.py`.

Add this import:

```python
from app.modules.executions.repository import save_execution_report
```

Replace `finish_task` with:

```python
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
```

Add this method inside `ExecutionRunner`:

```python
    async def _persist_finished_task(self, task: ExecutionTask) -> None:
        try:
            save_execution_report(self.settings, task)
        except Exception as error:  # noqa: BLE001
            await self.append_log(
                task,
                f"Report persistence failed: {error}",
                level="error",
            )
```

- [ ] **Step 4: Add repository-backed service methods**

Modify `backend/app/modules/executions/service.py`.

Add imports:

```python
from app.modules.executions.repository import (
    get_execution_report,
    get_execution_task,
    list_execution_task_summaries,
)
from app.modules.executions.schemas import (
    ExecutionEventMessage,
    ExecutionReport,
    ExecutionTask,
    ExecutionTaskCreate,
    ExecutionTaskFilters,
    ExecutionTaskSummary,
    TaskStatus,
)
```

Replace `list_tasks` and `get_task`, then add `get_report`:

```python
    def list_tasks(
        self,
        filters: ExecutionTaskFilters | None = None,
    ) -> list[ExecutionTaskSummary]:
        filters = filters or ExecutionTaskFilters()
        summaries_by_id = {
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

    def get_report(self, task_id: str) -> ExecutionReport | None:
        task = self._tasks.get(task_id)
        if task is not None:
            return ExecutionReport(task=task.model_copy(deep=True))
        return get_execution_report(self.settings, task_id)
```

Add this helper below the class:

```python
def _task_matches_filters(
    task: ExecutionTask,
    filters: ExecutionTaskFilters,
) -> bool:
    if filters.script_id and task.script_id != filters.script_id:
        return False
    if filters.status and task.status != filters.status:
        return False
    if filters.created_from and task.created_at < filters.created_from:
        return False
    if filters.created_to and task.created_at > filters.created_to:
        return False
    if filters.executor and task.executor != filters.executor:
        return False
    return True
```

- [ ] **Step 5: Run service persistence tests**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_history.py::test_execution_service_persists_finished_task_history tests/test_execution_history.py::test_execution_service_persists_failed_task_report -q
```

Expected: PASS.

- [ ] **Step 6: Run existing execution service tests**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_service.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run:

```powershell
git add backend/app/modules/executions/runner.py backend/app/modules/executions/service.py backend/tests/test_execution_history.py
git commit -m "persist completed execution tasks"
```

---

## Task 4: History and Report APIs

**Files:**
- Modify: `backend/app/api/routes/executions.py`
- Modify: `backend/app/api/routes/reports.py`
- Test: `backend/tests/test_execution_history.py`

- [ ] **Step 1: Write failing API tests**

Append these tests to `backend/tests/test_execution_history.py`:

```python
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
```

- [ ] **Step 2: Run the failing API tests**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_history.py::test_task_api_lists_persisted_history_with_filters tests/test_execution_history.py::test_report_api_reads_persisted_report_detail -q
```

Expected: FAIL because routes do not accept filters and `/api/reports/{task_id}` does not exist.

- [ ] **Step 3: Add filter params to `/api/tasks`**

Modify `backend/app/api/routes/executions.py`.

Add `TaskStatus` and `ExecutionTaskFilters` imports:

```python
from app.modules.executions.schemas import (
    ExecutionTaskCreate,
    ExecutionTaskFilters,
    TaskStatus,
)
```

Replace `list_execution_tasks` with:

```python
@router.get("/tasks")
def list_execution_tasks(
    request: Request,
    script_id: str | None = None,
    status: TaskStatus | None = None,
    created_from: str | None = None,
    created_to: str | None = None,
    executor: str | None = None,
) -> dict[str, list[dict[str, object]]]:
    service = execution_service(request)
    filters = ExecutionTaskFilters(
        script_id=script_id,
        status=status,
        created_from=created_from,
        created_to=created_to,
        executor=executor,
    )
    return {
        "items": [
            summary.model_dump(mode="json") for summary in service.list_tasks(filters)
        ]
    }
```

- [ ] **Step 4: Replace the report placeholder route**

Replace `backend/app/api/routes/reports.py` with:

```python
from fastapi import APIRouter, Request, Response

from app.api.dependencies import execution_service
from app.core.errors import error_response
from app.modules.executions.schemas import ExecutionTaskFilters, TaskStatus

router = APIRouter()


@router.get("/reports")
def list_reports_endpoint(
    request: Request,
    script_id: str | None = None,
    status: TaskStatus | None = None,
    created_from: str | None = None,
    created_to: str | None = None,
    executor: str | None = None,
) -> dict[str, list[dict[str, object]]]:
    service = execution_service(request)
    filters = ExecutionTaskFilters(
        script_id=script_id,
        status=status,
        created_from=created_from,
        created_to=created_to,
        executor=executor,
    )
    return {
        "items": [
            summary.model_dump(mode="json") for summary in service.list_tasks(filters)
        ]
    }


@router.get("/reports/{task_id}", response_model=None)
def get_report_endpoint(task_id: str, request: Request) -> dict[str, object] | Response:
    report = execution_service(request).get_report(task_id)
    if report is None:
        return error_response(
            status_code=404,
            code="not_found",
            message="Report not found",
        )

    return report.model_dump(mode="json")
```

- [ ] **Step 5: Run API tests**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_history.py::test_task_api_lists_persisted_history_with_filters tests/test_execution_history.py::test_report_api_reads_persisted_report_detail -q
```

Expected: PASS.

- [ ] **Step 6: Run backend route and execution tests**

Run:

```powershell
cd backend
uv run pytest tests/test_app_foundation.py tests/test_execution_service.py tests/test_execution_history.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

Run:

```powershell
git add backend/app/api/routes/executions.py backend/app/api/routes/reports.py backend/tests/test_execution_history.py
git commit -m "add execution history report APIs"
```

---

## Task 5: Frontend API Contract

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Test: `apps/web/src/lib/api.test.ts`

- [ ] **Step 1: Write failing frontend API tests**

Append these assertions inside the existing execution API test block in `apps/web/src/lib/api.test.ts`, or create a new `it` block near the execution tests:

```ts
it('calls execution history and report endpoints with filters', async () => {
  const client = createApiClient({ baseUrl: 'http://localhost', httpClient })

  vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { items: [] } })
  vi.mocked(httpClient.get).mockResolvedValueOnce({
    data: {
      task: executionTask,
      attachments: [],
      raw_framework_report: null,
    },
  })

  await client.listTasks({
    script_id: 'smoke-cockpit',
    status: 'failed',
    created_from: '2026-06-01T00:00:00+00:00',
    created_to: '2026-06-01T23:59:59+00:00',
    executor: 'alice',
  })
  await client.getReport('task-1')

  expect(httpClient.get).toHaveBeenNthCalledWith(1, '/api/tasks', {
    params: {
      script_id: 'smoke-cockpit',
      status: 'failed',
      created_from: '2026-06-01T00:00:00+00:00',
      created_to: '2026-06-01T23:59:59+00:00',
      executor: 'alice',
    },
  })
  expect(httpClient.get).toHaveBeenNthCalledWith(2, '/api/reports/task-1')
})
```

- [ ] **Step 2: Run the failing frontend API test**

Run:

```powershell
pnpm --filter @testflow/web test -- src/lib/api.test.ts
```

Expected: FAIL because `listTasks` does not accept filters and `getReport` does not exist.

- [ ] **Step 3: Add frontend report types**

Modify `apps/web/src/lib/api.ts` after `ExecutionTaskSummary`:

```ts
export type ExecutionTaskFilters = {
  script_id?: string
  status?: TaskStatus
  created_from?: string
  created_to?: string
  executor?: string
}

export type ExecutionReportAttachment = {
  path: string
  name: string
  step_id: string | null
}

export type ExecutionReport = {
  task: ExecutionTask
  attachments: ExecutionReportAttachment[]
  raw_framework_report: Record<string, unknown> | null
}
```

- [ ] **Step 4: Add compact query params helper**

Modify `apps/web/src/lib/api.ts` before `createApiClient`:

```ts
function compactParams<T extends Record<string, unknown>>(params: T) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value != null),
  )
}
```

- [ ] **Step 5: Update execution API methods**

Modify the returned API object in `apps/web/src/lib/api.ts`:

```ts
    listTasks: (filters: ExecutionTaskFilters = {}) =>
      request<ItemList<ExecutionTaskSummary>>('/api/tasks', {
        params: compactParams(filters),
      }),
    getTask: (taskId: string) =>
      request<ExecutionTask>(`/api/tasks/${taskId}`),
    createTask: (task: ExecutionTaskCreate) =>
      post<ExecutionTask, ExecutionTaskCreate>('/api/tasks', task),
    cancelTask: (taskId: string) =>
      postEmpty<ExecutionTask>(`/api/tasks/${taskId}/cancel`),
    listReports: (filters: ExecutionTaskFilters = {}) =>
      request<ItemList<ExecutionTaskSummary>>('/api/reports', {
        params: compactParams(filters),
      }),
    getReport: (taskId: string) =>
      request<ExecutionReport>(`/api/reports/${taskId}`),
```

- [ ] **Step 6: Run frontend API test**

Run:

```powershell
pnpm --filter @testflow/web test -- src/lib/api.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

Run:

```powershell
git add apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "add execution report api client"
```

---

## Task 6: Execution History Page

**Files:**
- Create: `apps/web/src/features/execution/pages/HistoryPage.tsx`
- Modify: `apps/web/src/features/execution/index.ts`
- Test: `apps/web/src/features/execution/HistoryAndReports.test.tsx`

- [ ] **Step 1: Write failing history page test**

Create `apps/web/src/features/execution/HistoryAndReports.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({
  getReport: vi.fn(),
  listReports: vi.fn(),
  listScripts: vi.fn(),
  listTasks: vi.fn(),
}))

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    createApiClient: vi.fn(() => apiMock),
  }
})

import { HistoryPage } from '@/features/execution'

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('HistoryPage', () => {
  beforeEach(() => {
    apiMock.listScripts.mockResolvedValue({
      items: [
        {
          id: 'smoke-cockpit',
          name: '座舱冒烟测试',
          description: '基础稳定性巡检',
          step_count: 1,
          enabled_step_count: 1,
          revision: 1,
          updated_at: '2026-06-01T00:00:00+00:00',
          status: 'published',
          tags: [],
          group: 'stability',
        },
      ],
    })
    apiMock.listTasks.mockResolvedValue({
      items: [
        {
          id: 'exec-1',
          script_id: 'smoke-cockpit',
          script_name: '座舱冒烟测试',
          script_revision: 1,
          status: 'failed',
          environment: 'local',
          target_device: 'bench-1',
          executor: 'alice',
          created_at: '2026-06-01T00:00:00+00:00',
          started_at: '2026-06-01T00:00:01+00:00',
          finished_at: '2026-06-01T00:00:02+00:00',
          duration_ms: 1000,
          step_count: 1,
          passed_step_count: 0,
          failed_step_count: 1,
        },
      ],
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('filters execution history and links to report details', async () => {
    renderWithProviders(<HistoryPage />)

    expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('执行人'), {
      target: { value: 'alice' },
    })
    fireEvent.click(screen.getByRole('button', { name: '查询历史' }))

    await waitFor(() =>
      expect(apiMock.listTasks).toHaveBeenLastCalledWith(
        expect.objectContaining({ executor: 'alice' }),
      ),
    )
    expect(screen.getByRole('link', { name: '查看报告' })).toHaveAttribute(
      'href',
      '/reports/exec-1',
    )
  })
})
```

- [ ] **Step 2: Run the failing history page test**

Run:

```powershell
pnpm --filter @testflow/web test -- src/features/execution/HistoryAndReports.test.tsx
```

Expected: FAIL because `HistoryPage` is not exported.

- [ ] **Step 3: Implement `HistoryPage`**

Create `apps/web/src/features/execution/pages/HistoryPage.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { backendBaseUrl } from '@/app/config'
import { createApiClient, type ExecutionTaskFilters, type TaskStatus } from '@/lib/api'

import { statusVariant, taskStatusLabel } from '../utils/taskFormatters'

const api = createApiClient({ baseUrl: backendBaseUrl })
const allScriptsValue = 'all-scripts'
const allStatusesValue = 'all-statuses'
const statuses: TaskStatus[] = ['pending', 'running', 'passed', 'failed', 'canceled', 'error']

export function HistoryPage() {
  const [draftFilters, setDraftFilters] = useState({
    scriptId: '',
    status: '',
    createdFrom: '',
    createdTo: '',
    executor: '',
  })
  const [filters, setFilters] = useState<ExecutionTaskFilters>({})

  const scriptsQuery = useQuery({
    queryKey: ['scripts'],
    queryFn: api.listScripts,
  })
  const historyQuery = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => api.listTasks(filters),
  })

  const scripts = scriptsQuery.data?.items ?? []
  const tasks = historyQuery.data?.items ?? []
  const selectedScriptName = useMemo(
    () => scripts.find((script) => script.id === draftFilters.scriptId)?.name,
    [draftFilters.scriptId, scripts],
  )

  function applyFilters() {
    setFilters({
      script_id: draftFilters.scriptId || undefined,
      status: (draftFilters.status || undefined) as TaskStatus | undefined,
      created_from: draftFilters.createdFrom || undefined,
      created_to: draftFilters.createdTo || undefined,
      executor: draftFilters.executor || undefined,
    })
  }

  return (
    <PagePanel>
      <PageHeader
        eyebrow="阶段七"
        title="执行历史"
        subtitle="按脚本、状态、时间和执行人追溯测试执行结果。"
        actions={<Badge variant="secondary">{tasks.length} 条记录</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-5 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
          <Select
            value={draftFilters.scriptId || allScriptsValue}
            onValueChange={(value) =>
              setDraftFilters((current) => ({
                ...current,
                scriptId: value === allScriptsValue ? '' : value,
              }))
            }
          >
            <SelectTrigger aria-label="脚本">
              <SelectValue placeholder={selectedScriptName ?? '全部脚本'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={allScriptsValue}>全部脚本</SelectItem>
              {scripts.map((script) => (
                <SelectItem value={script.id} key={script.id}>
                  {script.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={draftFilters.status || allStatusesValue}
            onValueChange={(value) =>
              setDraftFilters((current) => ({
                ...current,
                status: value === allStatusesValue ? '' : value,
              }))
            }
          >
            <SelectTrigger aria-label="状态">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={allStatusesValue}>全部状态</SelectItem>
              {statuses.map((status) => (
                <SelectItem value={status} key={status}>
                  {taskStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label="开始时间"
            value={draftFilters.createdFrom}
            placeholder="2026-06-01T00:00:00+00:00"
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                createdFrom: event.target.value,
              }))
            }
          />
          <Input
            aria-label="结束时间"
            value={draftFilters.createdTo}
            placeholder="2026-06-02T23:59:59+00:00"
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                createdTo: event.target.value,
              }))
            }
          />
          <div className="flex gap-2">
            <Input
              aria-label="执行人"
              value={draftFilters.executor}
              placeholder="local"
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  executor: event.target.value,
                }))
              }
            />
            <Button type="button" onClick={applyFilters}>
              查询历史
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>历史记录</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2.5">
          {historyQuery.isPending ? (
            <EmptyState title="正在加载历史记录" />
          ) : tasks.length === 0 ? (
            <EmptyState title="暂无历史记录" />
          ) : (
            tasks.map((task) => (
              <Card size="sm" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 max-sm:grid-cols-1" key={task.id}>
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="m-0 text-base font-semibold">{task.script_name}</h3>
                    <Badge variant={statusVariant(task.status)}>{taskStatusLabel(task.status)}</Badge>
                  </div>
                  <p className="m-0 text-sm text-muted-foreground">{task.id}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-sm text-muted-foreground">
                    {task.executor} · {task.passed_step_count}/{task.step_count}
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/reports/${task.id}`}>查看报告</Link>
                  </Button>
                </div>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </PagePanel>
  )
}
```

- [ ] **Step 4: Export `HistoryPage`**

Modify `apps/web/src/features/execution/index.ts`:

```ts
export { HistoryPage } from './pages/HistoryPage'
export { TaskPage } from './pages/TaskPage'
```

- [ ] **Step 5: Run history page test**

Run:

```powershell
pnpm --filter @testflow/web test -- src/features/execution/HistoryAndReports.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

Run:

```powershell
git add apps/web/src/features/execution/pages/HistoryPage.tsx apps/web/src/features/execution/index.ts apps/web/src/features/execution/HistoryAndReports.test.tsx
git commit -m "add execution history page"
```

---

## Task 7: Report List and Detail Pages

**Files:**
- Create: `apps/web/src/features/execution/pages/ReportListPage.tsx`
- Create: `apps/web/src/features/execution/pages/ReportDetailPage.tsx`
- Modify: `apps/web/src/features/execution/utils/taskFormatters.ts`
- Modify: `apps/web/src/features/execution/index.ts`
- Test: `apps/web/src/features/execution/HistoryAndReports.test.tsx`

- [ ] **Step 1: Add failing report page tests**

Append to `apps/web/src/features/execution/HistoryAndReports.test.tsx`:

Change the existing execution feature import in the test file to:

```tsx
import { HistoryPage, ReportDetailPage, ReportListPage } from '@/features/execution'
```

Then append this report fixture and test block:

```tsx

const reportTask = {
  id: 'exec-1',
  script_id: 'smoke-cockpit',
  script_name: '座舱冒烟测试',
  script_revision: 1,
  status: 'failed',
  environment: 'local',
  target_device: 'bench-1',
  variables: {},
  executor: 'alice',
  created_at: '2026-06-01T00:00:00+00:00',
  started_at: '2026-06-01T00:00:01+00:00',
  finished_at: '2026-06-01T00:00:02+00:00',
  duration_ms: 1000,
  log_path: 'data/logs/executions/exec-1.log',
  report_dir: 'data/reports/exec-1',
  steps: [
    {
      id: 'step-1',
      index: 0,
      keyword: 'wait',
      description: 'Bad wait',
      status: 'failed',
      started_at: '2026-06-01T00:00:01+00:00',
      finished_at: '2026-06-01T00:00:02+00:00',
      duration_ms: 1000,
      input: { seconds: -1 },
      output: {},
      error_message: 'wait.seconds must be greater than or equal to 0',
      error_detail: '',
      attachments: ['data/reports/exec-1/failure.txt'],
    },
  ],
  logs: [
    {
      timestamp: '2026-06-01T00:00:01+00:00',
      level: 'error',
      message: 'wait.seconds must be greater than or equal to 0',
      step_id: 'step-1',
    },
  ],
  error_message: '',
}

describe('Report pages', () => {
  beforeEach(() => {
    apiMock.listReports.mockResolvedValue({
      items: [
        {
          id: 'exec-1',
          script_id: 'smoke-cockpit',
          script_name: '座舱冒烟测试',
          script_revision: 1,
          status: 'failed',
          environment: 'local',
          target_device: 'bench-1',
          executor: 'alice',
          created_at: '2026-06-01T00:00:00+00:00',
          started_at: '2026-06-01T00:00:01+00:00',
          finished_at: '2026-06-01T00:00:02+00:00',
          duration_ms: 1000,
          step_count: 1,
          passed_step_count: 0,
          failed_step_count: 1,
        },
      ],
    })
    apiMock.getReport.mockResolvedValue({
      task: reportTask,
      attachments: [
        {
          path: 'data/reports/exec-1/failure.txt',
          name: 'failure.txt',
          step_id: 'step-1',
        },
      ],
      raw_framework_report: null,
    })
  })

  it('lists recent reports', async () => {
    renderWithProviders(<ReportListPage />)

    expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查看报告' })).toHaveAttribute(
      'href',
      '/reports/exec-1',
    )
  })

  it('shows report summary, failed step, logs, and attachments', async () => {
    render(
      <MemoryRouter initialEntries={['/reports/exec-1']}>
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: { queries: { retry: false } },
            })
          }
        >
          <ReportDetailPage />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()
    expect(screen.getByText('wait.seconds must be greater than or equal to 0')).toBeInTheDocument()
    expect(screen.getByText('failure.txt')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run failing report page tests**

Run:

```powershell
pnpm --filter @testflow/web test -- src/features/execution/HistoryAndReports.test.tsx
```

Expected: FAIL because report pages are not exported.

- [ ] **Step 3: Allow formatter helpers to handle step statuses**

Modify `apps/web/src/features/execution/utils/taskFormatters.ts`:

```ts
import type {
  ExecutionTask,
  ExecutionUpdateEvent,
  StepStatus,
  TaskStatus,
} from '@/lib/api'

export function formatLogEntry(log: ExecutionTask['logs'][number]) {
  return `${log.timestamp} [${log.level}] ${log.message}`
}

export function formatEventLog(event: ExecutionUpdateEvent) {
  const timestamp = event.timestamp ?? new Date().toISOString()
  const level = event.level ?? 'info'
  return `${timestamp} [${level}] ${event.message ?? ''}`
}

export function statusVariant(status: TaskStatus | StepStatus) {
  if (status === 'passed') return 'default'
  if (status === 'failed' || status === 'error') return 'destructive'
  return 'secondary'
}

export function taskStatusLabel(status: TaskStatus | StepStatus) {
  if (status === 'pending') return '等待中'
  if (status === 'running') return '运行中'
  if (status === 'passed') return '通过'
  if (status === 'failed') return '失败'
  if (status === 'canceled') return '已取消'
  if (status === 'skipped') return '已跳过'
  return '异常'
}
```

- [ ] **Step 4: Implement `ReportListPage`**

Create `apps/web/src/features/execution/pages/ReportListPage.tsx`:

```tsx
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { backendBaseUrl } from '@/app/config'
import { createApiClient } from '@/lib/api'

import { statusVariant, taskStatusLabel } from '../utils/taskFormatters'

const api = createApiClient({ baseUrl: backendBaseUrl })

export function ReportListPage() {
  const reportsQuery = useQuery({
    queryKey: ['reports'],
    queryFn: () => api.listReports(),
  })
  const reports = reportsQuery.data?.items ?? []

  return (
    <PagePanel>
      <PageHeader
        eyebrow="阶段七"
        title="报告详情"
        subtitle="打开最近执行报告，查看步骤结果、日志和附件索引。"
        actions={<Badge variant="secondary">{reports.length} 份报告</Badge>}
      />
      <Card>
        <CardHeader>
          <CardTitle>最近报告</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2.5">
          {reportsQuery.isPending ? (
            <EmptyState title="正在加载报告" />
          ) : reports.length === 0 ? (
            <EmptyState title="暂无报告" />
          ) : (
            reports.map((report) => (
              <Card size="sm" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 max-sm:grid-cols-1" key={report.id}>
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="m-0 text-base font-semibold">{report.script_name}</h3>
                    <Badge variant={statusVariant(report.status)}>{taskStatusLabel(report.status)}</Badge>
                  </div>
                  <p className="m-0 text-sm text-muted-foreground">{report.id}</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/reports/${report.id}`}>查看报告</Link>
                </Button>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </PagePanel>
  )
}
```

- [ ] **Step 5: Implement `ReportDetailPage`**

Create `apps/web/src/features/execution/pages/ReportDetailPage.tsx`:

```tsx
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { backendBaseUrl } from '@/app/config'
import { createApiClient } from '@/lib/api'

import { formatLogEntry, statusVariant, taskStatusLabel } from '../utils/taskFormatters'

const api = createApiClient({ baseUrl: backendBaseUrl })

export function ReportDetailPage() {
  const { taskId = '' } = useParams()
  const reportQuery = useQuery({
    queryKey: ['reports', taskId],
    queryFn: () => api.getReport(taskId),
    enabled: Boolean(taskId),
  })
  const report = reportQuery.data
  const task = report?.task

  if (reportQuery.isPending) {
    return (
      <PagePanel>
        <PageHeader eyebrow="阶段七" title="报告详情" subtitle="正在加载结构化执行报告。" />
        <EmptyState title="正在加载报告" />
      </PagePanel>
    )
  }

  if (!task) {
    return (
      <PagePanel>
        <PageHeader eyebrow="阶段七" title="报告详情" subtitle="没有找到对应的执行报告。" />
        <EmptyState title="报告不存在" />
      </PagePanel>
    )
  }

  return (
    <PagePanel>
      <PageHeader
        eyebrow={`报告 ${task.id}`}
        title={task.script_name}
        subtitle={`脚本版本 ${task.script_revision} · ${task.executor} · ${task.environment}`}
        actions={<Badge variant={statusVariant(task.status)}>{taskStatusLabel(task.status)}</Badge>}
      />

      <div className="grid grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)] gap-4 max-xl:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>总体结果</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
              <span className="text-muted-foreground">任务 ID</span>
              <span className="[overflow-wrap:anywhere]">{task.id}</span>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
              <span className="text-muted-foreground">目标设备</span>
              <span>{task.target_device || '-'}</span>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
              <span className="text-muted-foreground">耗时</span>
              <span>{task.duration_ms ?? 0} ms</span>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
              <span className="text-muted-foreground">报告目录</span>
              <span className="[overflow-wrap:anywhere]">{task.report_dir || '-'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>步骤明细</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            {task.steps.map((step) => (
              <Card size="sm" className="grid gap-2 p-3" key={step.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(step.status)}>{taskStatusLabel(step.status)}</Badge>
                  <strong>{step.index + 1}. {step.keyword}</strong>
                  <span className="text-sm text-muted-foreground">{step.duration_ms ?? 0} ms</span>
                </div>
                {step.description ? <p className="m-0 text-sm text-muted-foreground">{step.description}</p> : null}
                {step.error_message ? (
                  <Alert variant="destructive">
                    <AlertDescription>{step.error_message}</AlertDescription>
                  </Alert>
                ) : null}
              </Card>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>日志查看</CardTitle>
          </CardHeader>
          <CardContent>
            {task.logs.length === 0 ? (
              <EmptyState title="暂无日志" />
            ) : (
              <div className="grid max-h-[420px] gap-2 overflow-auto" aria-label="执行日志">
                {task.logs.map((log, index) => (
                  <code className="block rounded-md bg-muted px-2 py-1.5 font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]" key={`${log.timestamp}-${index}`}>
                    {formatLogEntry(log)}
                  </code>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>附件索引</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {(report.attachments.length === 0) ? (
              <EmptyState title="暂无附件" />
            ) : (
              report.attachments.map((attachment) => (
                <div className="rounded-md border bg-muted px-2 py-1.5 text-sm" key={attachment.path}>
                  <strong>{attachment.name}</strong>
                  <p className="m-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">{attachment.path}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PagePanel>
  )
}
```

- [ ] **Step 6: Export report pages**

Modify `apps/web/src/features/execution/index.ts`:

```ts
export { HistoryPage } from './pages/HistoryPage'
export { ReportDetailPage } from './pages/ReportDetailPage'
export { ReportListPage } from './pages/ReportListPage'
export { TaskPage } from './pages/TaskPage'
```

- [ ] **Step 7: Run report page tests**

Run:

```powershell
pnpm --filter @testflow/web test -- src/features/execution/HistoryAndReports.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit Task 7**

Run:

```powershell
git add apps/web/src/features/execution/pages/ReportListPage.tsx apps/web/src/features/execution/pages/ReportDetailPage.tsx apps/web/src/features/execution/utils/taskFormatters.ts apps/web/src/features/execution/index.ts apps/web/src/features/execution/HistoryAndReports.test.tsx
git commit -m "add execution report pages"
```

---

## Task 8: Route Wiring and Navigation

**Files:**
- Modify: `apps/web/src/app/routes.tsx`
- Modify: `apps/web/src/app/routes.test.ts`
- Test: `apps/web/src/app/routes.test.ts`

- [ ] **Step 1: Write failing route test expectation**

Modify `apps/web/src/app/routes.test.ts` expected paths:

```ts
    expect(appRoutes.map((route) => route.path)).toEqual([
      '/scripts',
      '/scripts/new',
      '/scripts/:scriptId',
      '/tasks',
      '/history',
      '/reports',
      '/reports/:taskId',
      '/ssh',
      '/scp',
      '/commands',
    ])
```

- [ ] **Step 2: Run the failing route test**

Run:

```powershell
pnpm --filter @testflow/web test -- src/app/routes.test.ts
```

Expected: FAIL because `/reports/:taskId` is not in `appRoutes`.

- [ ] **Step 3: Wire new pages**

Modify imports in `apps/web/src/app/routes.tsx`:

```tsx
import {
  HistoryPage,
  ReportDetailPage,
  ReportListPage,
  TaskPage,
} from '@/features/execution'
```

Replace the `/history` route element:

```tsx
    element: <HistoryPage />,
```

Replace the `/reports` route element:

```tsx
    element: <ReportListPage />,
```

Insert this hidden route immediately after `/reports`:

```tsx
  {
    path: '/reports/:taskId',
    label: '报告详情',
    description: '展示执行报告、步骤结果和日志片段。',
    navGroup: 'execution',
    icon: FileText,
    element: <ReportDetailPage />,
    navHidden: true,
  },
```

- [ ] **Step 4: Run route test**

Run:

```powershell
pnpm --filter @testflow/web test -- src/app/routes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run execution feature tests**

Run:

```powershell
pnpm --filter @testflow/web test -- src/features/execution
```

Expected: PASS.

- [ ] **Step 6: Commit Task 8**

Run:

```powershell
git add apps/web/src/app/routes.tsx apps/web/src/app/routes.test.ts
git commit -m "wire execution history routes"
```

---

## Task 9: Full Verification, Browser Smoke, and Plan Status

**Files:**
- Modify: `implementation-plan`

- [ ] **Step 1: Run backend checks**

Run:

```powershell
pnpm test:backend
pnpm check:backend
```

Expected: both commands PASS.

- [ ] **Step 2: Run web checks**

Run:

```powershell
pnpm --filter @testflow/web test
pnpm check:web
```

Expected: both commands PASS.

- [ ] **Step 3: Run full workspace check**

Run:

```powershell
pnpm check
```

Expected: PASS.

- [ ] **Step 4: Browser smoke test**

Start the backend and web app:

```powershell
pnpm dev:backend
pnpm dev:web
```

In the browser:

1. Open `http://127.0.0.1:5174/tasks`.
2. Start a published script execution.
3. Wait for the task to finish.
4. Open `http://127.0.0.1:5174/history`.
5. Filter by the executed script and status.
6. Open the task report through `查看报告`.
7. Confirm the report page shows summary, steps, logs, and attachment index.

Expected: no console errors, no overlapping UI text, and history/report data remains visible after refreshing the page.

- [ ] **Step 5: Update Phase 7 progress**

In `implementation-plan`, add this progress note under `## 阶段 7：执行历史与报告` after the design decision section:

```markdown
### 进度

已完成执行历史与报告第一版。验证命令：`pnpm test:backend`、`pnpm check:backend`、`pnpm --filter @testflow/web test`、`pnpm check:web`、`pnpm check`，并通过浏览器 smoke 验证任务完成后可在历史页筛选、打开报告详情、查看步骤结果、失败原因、日志和附件索引。
```

Then mark these Phase 7 checklist items as complete:

```markdown
- [x] 建立执行历史数据模型。
- [x] 建立报告数据模型。
- [x] 实现执行历史列表 API。
- [x] 实现报告详情 API。
- [x] 实现执行历史页面：
  - 按脚本筛选。
  - 按状态筛选。
  - 按时间筛选。
  - 按执行人筛选。
- [x] 实现报告详情页面：
  - 总体结果。
  - 步骤明细。
  - 失败原因。
  - 日志查看。
  - 附件索引。
- [x] 接入测试框架已有报告输出；如字段不足，补充平台结构化报告。
```

For the final checklist item, the first implementation satisfies it by persisting the normalized TestFlow report and preserving `raw_framework_report` as `null` until the real framework emits raw report content.

- [ ] **Step 6: Commit Task 9**

Run:

```powershell
git add implementation-plan
git commit -m "complete phase 7 history reports"
```

---

## Self-Review Checklist

- Spec coverage: Phase 7 data models, history API, report API, filters, history UI, report UI, framework raw report preservation, and verification are all mapped to tasks.
- Type consistency: backend `ExecutionTaskFilters`, `ExecutionReport`, `ExecutionReportAttachment` match frontend `ExecutionTaskFilters`, `ExecutionReport`, and `ExecutionReportAttachment`.
- Boundary consistency: persistence lives in `app.modules.executions.repository`; routes stay thin; frontend pages stay in `features/execution`.
- Risk note: `repository.py` importing `task_summary` from `runner.py` may create a cycle depending on import order. Task 2 includes a concrete fallback: move the count calculation into a local helper if the lint/test run exposes the cycle.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-02-phase-7-execution-history-reports-plan.md`. Two execution options:

1. Subagent-Driven (recommended): dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution: execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.
