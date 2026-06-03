# Framework HTML Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prefer automation-framework generated HTML reports in report detail pages while preserving TestFlow task detail as fallback.

**Architecture:** The framework runtime emits a first-class HTML report reference. The execution runner stores that reference on the task snapshot; the repository persists it through the existing report record JSON; the report API serves local HTML report files through a path-safe proxy. The frontend checks `framework_report` first and renders the framework HTML report before falling back to the current structured task detail.

**Tech Stack:** Python 3.12, FastAPI, SQLModel, pytest, React 19, Vite, TanStack Query, Vitest, Testing Library, Tailwind CSS v4, shadcn/ui.

---

## Scope Check

This spec touches one subsystem: execution reports. It spans backend contracts,
persistence, API serving, and the report detail UI, but all changes serve one
testable behavior: framework HTML report first, TestFlow structured detail as
fallback.

## File Structure

- `backend/autotest/contracts.py`: extend framework event contract with a
  `framework_report` event and HTML report metadata fields.
- `backend/app/modules/executions/schemas.py`: add `ExecutionFrameworkReport`
  and optional `framework_report` fields.
- `backend/app/modules/executions/runner.py`: convert `framework_report` events
  into task state.
- `backend/app/modules/executions/repository.py`: persist task snapshots with
  report references and stop writing `testflow-report.json`.
- `backend/app/modules/executions/report_files.py`: resolve local framework
  report entry and asset files safely under the framework report root.
- `backend/app/api/routes/reports.py`: add endpoints that serve framework HTML
  report entry files and relative assets.
- `backend/tests/test_execution_service.py`: cover event handling.
- `backend/tests/test_execution_history.py`: cover persistence and file serving.
- `docs/automation-framework-adapter-guide.md`: document the new event.
- `apps/web/src/lib/api.ts`: add report reference types and URL helper.
- `apps/web/src/features/execution/pages/ReportDetailPage.tsx`: prefer framework
  HTML reports and keep fallback detail available.
- `apps/web/src/features/execution/HistoryAndReports.test.tsx`: cover framework
  report priority and fallback behavior.

---

### Task 1: Framework Report Event and Task State

**Files:**
- Modify: `backend/autotest/contracts.py`
- Modify: `backend/app/modules/executions/schemas.py`
- Modify: `backend/app/modules/executions/runner.py`
- Test: `backend/tests/test_autotest_adapter.py`
- Test: `backend/tests/test_execution_service.py`

- [ ] **Step 1: Add the failing runner event test**

Append this test to `backend/tests/test_execution_service.py`:

```python
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
```

- [ ] **Step 2: Run the event test and verify it fails**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_service.py::test_execution_service_records_framework_html_report_event -q
```

Expected: FAIL with a constructor or validation error because `framework_report`
events and report metadata fields are not in the contract yet.

- [ ] **Step 3: Extend the framework contract**

In `backend/autotest/contracts.py`, replace `FrameworkEventType` with:

```python
FrameworkEventType = Literal[
    "run_started",
    "step_started",
    "log",
    "step_finished",
    "run_finished",
    "attachment",
    "framework_report",
    "run_error",
]
```

In the `FrameworkEvent` dataclass, add these fields after `attachment_name`:

```python
    report_kind: Literal["html"] | None = None
    report_source: Literal["file", "url"] | None = None
    report_root_dir: Path | str | None = None
    report_entry: Path | str | None = None
    report_title: str | None = None
```

- [ ] **Step 4: Update the contract surface test**

In `backend/tests/test_autotest_adapter.py`, add `"framework_report"` to
`test_contract_event_types_include_adapter_surface()`:

```python
def test_contract_event_types_include_adapter_surface() -> None:
    assert set(get_args(FrameworkEventType)) == {
        "run_started",
        "step_started",
        "log",
        "step_finished",
        "run_finished",
        "attachment",
        "framework_report",
        "run_error",
    }
```

- [ ] **Step 5: Add backend report reference schemas**

In `backend/app/modules/executions/schemas.py`, add these aliases below
`ExecutionEventType`:

```python
ReportKind = Literal["html"]
ReportSource = Literal["file", "url"]
```

Add this model above `ExecutionTask`:

```python
class ExecutionFrameworkReport(BaseModel):
    kind: ReportKind = "html"
    title: str = "框架报告"
    source: ReportSource = "file"
    entry: str
    root_dir: str = ""
```

Add this field to `ExecutionTask` after `report_dir`:

```python
    framework_report: ExecutionFrameworkReport | None = None
```

Add this field to `ExecutionReport` after `raw_framework_report`:

```python
    framework_report: ExecutionFrameworkReport | None = None
```

- [ ] **Step 6: Handle the framework report event in the runner**

In `backend/app/modules/executions/runner.py`, add `ExecutionFrameworkReport`
to the schemas import:

```python
from app.modules.executions.schemas import (
    ExecutionEventMessage,
    ExecutionFrameworkReport,
    ExecutionLogEntry,
    ExecutionStepResult,
    ExecutionTask,
    ExecutionTaskCreate,
    ExecutionTaskSummary,
    TaskStatus,
    utc_now,
)
```

In `ExecutionRunner.handle_framework_event()`, insert this block after the
`attachment` event block and before `run_error`:

```python
        if event.type == "framework_report":
            if event.report_kind == "html" and event.report_entry is not None:
                report_source = event.report_source or "file"
                report_root_dir = event.report_root_dir
                if report_source == "file" and report_root_dir is None:
                    report_root_dir = Path(event.report_entry).parent
                task.framework_report = ExecutionFrameworkReport(
                    kind="html",
                    title=event.report_title or "框架报告",
                    source=report_source,
                    root_dir=str(report_root_dir or ""),
                    entry=str(event.report_entry),
                )
            return
```

- [ ] **Step 7: Run the event and contract tests and verify they pass**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_service.py::test_execution_service_records_framework_html_report_event tests/test_autotest_adapter.py::test_contract_event_types_include_adapter_surface -q
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

Run:

```powershell
git add backend/autotest/contracts.py backend/app/modules/executions/schemas.py backend/app/modules/executions/runner.py backend/tests/test_autotest_adapter.py backend/tests/test_execution_service.py
git commit -m "add framework report event"
```

---

### Task 2: Persist Framework Report References Without Generating TestFlow Report Files

**Files:**
- Modify: `backend/app/modules/executions/repository.py`
- Test: `backend/tests/test_execution_history.py`

- [ ] **Step 1: Import the framework report schema in repository tests**

In `backend/tests/test_execution_history.py`, add `ExecutionFrameworkReport` to
the existing schemas import:

```python
from app.modules.executions.schemas import (
    ExecutionFrameworkReport,
    ExecutionLogEntry,
    ExecutionStepResult,
    ExecutionTask,
    ExecutionTaskCreate,
    ExecutionTaskFilters,
)
```

- [ ] **Step 2: Update the existing repository report test expectation**

In `test_repository_saves_and_reads_execution_report()`, replace the final
assertion:

```python
    assert report_json.is_file()
```

with:

```python
    assert not report_json.exists()
```

- [ ] **Step 3: Add the failing persistence test for framework HTML report references**

Append this test after `test_repository_saves_and_reads_execution_report()`:

```python
def test_repository_saves_framework_html_report_reference_without_generating_detail_file(
    tmp_path: Path,
) -> None:
    settings = Settings(data_dir=tmp_path)
    framework_root = tmp_path / "framework-output"
    framework_root.mkdir()
    framework_entry = framework_root / "index.html"
    framework_entry.write_text("<html>framework report</html>", encoding="utf-8")

    with TestClient(create_app(settings)):
        task = ExecutionTask(
            id="exec-html",
            script_id="smoke-cockpit",
            script_name="Smoke Cockpit",
            script_revision=1,
            status="passed",
            executor="alice",
            created_at="2026-06-01T00:00:00+00:00",
            report_dir=str(tmp_path / "reports" / "exec-html"),
            framework_report=ExecutionFrameworkReport(
                kind="html",
                title="自动化框架报告",
                source="file",
                root_dir=str(framework_root),
                entry=str(framework_entry),
            ),
        )

        save_execution_report(settings, task)

    report = get_execution_report(settings, "exec-html")
    report_json = tmp_path / "reports" / "exec-html" / "testflow-report.json"

    assert report is not None
    assert report.framework_report is not None
    assert report.framework_report.kind == "html"
    assert report.framework_report.title == "自动化框架报告"
    assert report.framework_report.root_dir == str(framework_root)
    assert report.framework_report.entry == str(framework_entry)
    assert not report_json.exists()
```

- [ ] **Step 4: Run the repository tests and verify they fail**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_history.py::test_repository_saves_and_reads_execution_report tests/test_execution_history.py::test_repository_saves_framework_html_report_reference_without_generating_detail_file -q
```

Expected: FAIL because `save_execution_report()` still writes
`testflow-report.json`, and `ExecutionReport.framework_report` is not populated
from the persisted task snapshot.

- [ ] **Step 5: Stop writing `testflow-report.json` and return the report reference**

In `backend/app/modules/executions/repository.py`, replace
`save_execution_report()` with this implementation:

```python
def save_execution_report(settings: Settings, task: ExecutionTask) -> ExecutionReport:
    report_dir = _report_dir(settings, task)
    report_dir.mkdir(parents=True, exist_ok=True)

    attachments = _attachment_index(task)
    report = ExecutionReport(
        task=task.model_copy(deep=True),
        attachments=attachments,
        raw_framework_report=None,
        framework_report=task.framework_report,
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
        report_json_path="",
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
```

In `get_execution_report()`, replace the returned `ExecutionReport(...)` block
with:

```python
    return ExecutionReport(
        task=task,
        attachments=attachments,
        raw_framework_report=raw_framework_report,
        framework_report=task.framework_report,
    )
```

- [ ] **Step 6: Run the repository tests and verify they pass**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_history.py::test_repository_saves_and_reads_execution_report tests/test_execution_history.py::test_repository_saves_framework_html_report_reference_without_generating_detail_file -q
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git add backend/app/modules/executions/repository.py backend/tests/test_execution_history.py
git commit -m "persist framework html report references"
```

---

### Task 3: Serve Local Framework HTML Reports Safely

**Files:**
- Create: `backend/app/modules/executions/report_files.py`
- Modify: `backend/app/api/routes/reports.py`
- Test: `backend/tests/test_execution_history.py`

- [ ] **Step 1: Add failing API tests for entry, assets, and traversal protection**

Append these helper and tests to `backend/tests/test_execution_history.py`:

```python
def save_framework_report_task(settings: Settings, tmp_path: Path) -> Path:
    framework_root = tmp_path / "framework-output"
    assets_dir = framework_root / "assets"
    assets_dir.mkdir(parents=True)
    framework_entry = framework_root / "index.html"
    framework_entry.write_text(
        '<html><head><link rel="stylesheet" href="assets/report.css"></head>'
        "<body>Framework HTML Report</body></html>",
        encoding="utf-8",
    )
    (assets_dir / "report.css").write_text(
        "body { color: rgb(20, 40, 60); }",
        encoding="utf-8",
    )

    with TestClient(create_app(settings)):
        save_execution_report(
            settings,
            ExecutionTask(
                id="exec-html",
                script_id="smoke-cockpit",
                script_name="Smoke Cockpit",
                script_revision=1,
                status="passed",
                created_at="2026-06-01T00:00:00+00:00",
                report_dir=str(tmp_path / "reports" / "exec-html"),
                framework_report=ExecutionFrameworkReport(
                    kind="html",
                    title="自动化框架报告",
                    source="file",
                    root_dir=str(framework_root),
                    entry="index.html",
                ),
            ),
        )

    return framework_root


def test_report_api_serves_framework_html_report_from_external_directory(
    tmp_path: Path,
) -> None:
    settings = Settings(data_dir=tmp_path / "testflow-data")
    save_framework_report_task(settings, tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.get("/api/reports/exec-html/framework-report")

    assert response.status_code == 200
    assert "Framework HTML Report" in response.text
    assert response.headers["content-type"].startswith("text/html")


def test_report_api_serves_framework_html_report_assets(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path / "testflow-data")
    save_framework_report_task(settings, tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.get(
            "/api/reports/exec-html/framework-report/assets/report.css"
        )

    assert response.status_code == 200
    assert "rgb(20, 40, 60)" in response.text
    assert "text/css" in response.headers["content-type"]


def test_framework_report_file_resolver_rejects_path_traversal(
    tmp_path: Path,
) -> None:
    from app.modules.executions.report_files import (
        FrameworkReportFileForbidden,
        resolve_framework_report_file,
    )

    settings = Settings(data_dir=tmp_path / "testflow-data")
    save_framework_report_task(settings, tmp_path)
    report = get_execution_report(settings, "exec-html")

    assert report is not None
    with pytest.raises(FrameworkReportFileForbidden):
        resolve_framework_report_file(report, "../secret.txt")
```

- [ ] **Step 2: Run the API tests and verify they fail**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_history.py::test_report_api_serves_framework_html_report_from_external_directory tests/test_execution_history.py::test_report_api_serves_framework_html_report_assets tests/test_execution_history.py::test_framework_report_file_resolver_rejects_path_traversal -q
```

Expected: FAIL because the report file resolver module and framework report
serving endpoints do not exist yet.

- [ ] **Step 3: Create the path-safe report file resolver**

Create `backend/app/modules/executions/report_files.py`:

```python
from __future__ import annotations

from pathlib import Path

from app.modules.executions.schemas import ExecutionReport


class FrameworkReportFileMissing(Exception):
    pass


class FrameworkReportFileForbidden(Exception):
    pass


def resolve_framework_report_file(
    report: ExecutionReport,
    asset_path: str | None = None,
) -> Path:
    framework_report = report.framework_report
    if (
        framework_report is None
        or framework_report.kind != "html"
        or framework_report.source != "file"
    ):
        raise FrameworkReportFileMissing("Framework HTML report is not available")

    root = Path(framework_report.root_dir).expanduser().resolve(strict=False)
    if not root.is_dir():
        raise FrameworkReportFileMissing("Framework HTML report root is missing")

    requested = Path(asset_path if asset_path is not None else framework_report.entry)
    if asset_path is not None and requested.is_absolute():
        raise FrameworkReportFileForbidden("Framework report asset path is invalid")

    candidate = (
        requested.expanduser().resolve(strict=False)
        if requested.is_absolute()
        else (root / requested).resolve(strict=False)
    )
    if not candidate.is_relative_to(root):
        raise FrameworkReportFileForbidden(
            "Framework report file is outside the report root"
        )
    if not candidate.is_file():
        raise FrameworkReportFileMissing("Framework report file is missing")
    return candidate
```

- [ ] **Step 4: Add framework report serving routes**

In `backend/app/api/routes/reports.py`, update the imports:

```python
from fastapi import APIRouter, Request, Response
from fastapi.responses import FileResponse

from app.api.dependencies import execution_service
from app.core.errors import error_response
from app.modules.executions.report_files import (
    FrameworkReportFileForbidden,
    FrameworkReportFileMissing,
    resolve_framework_report_file,
)
from app.modules.executions.schemas import ExecutionTaskFilters, TaskStatus
```

Append these endpoints and helper after `get_report_endpoint()`:

```python
@router.get("/reports/{task_id}/framework-report", response_model=None)
def get_framework_report_endpoint(task_id: str, request: Request) -> Response:
    return _framework_report_file_response(task_id, request)


@router.get("/reports/{task_id}/framework-report/{asset_path:path}", response_model=None)
def get_framework_report_asset_endpoint(
    task_id: str,
    asset_path: str,
    request: Request,
) -> Response:
    return _framework_report_file_response(task_id, request, asset_path)


def _framework_report_file_response(
    task_id: str,
    request: Request,
    asset_path: str | None = None,
) -> Response:
    service = execution_service(request)
    report = service.get_report(task_id)
    if report is None:
        return error_response(
            status_code=404,
            code="not_found",
            message="Report not found",
        )

    try:
        report_file = resolve_framework_report_file(report, asset_path)
    except FrameworkReportFileForbidden as error:
        return error_response(
            status_code=403,
            code="forbidden",
            message=str(error),
        )
    except FrameworkReportFileMissing as error:
        return error_response(
            status_code=404,
            code="not_found",
            message=str(error),
        )

    return FileResponse(report_file)
```

- [ ] **Step 5: Run the API tests and verify they pass**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_history.py::test_report_api_serves_framework_html_report_from_external_directory tests/test_execution_history.py::test_report_api_serves_framework_html_report_assets tests/test_execution_history.py::test_framework_report_file_resolver_rejects_path_traversal -q
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

Run:

```powershell
git add backend/app/modules/executions/report_files.py backend/app/api/routes/reports.py backend/tests/test_execution_history.py
git commit -m "serve framework html reports"
```

---

### Task 4: Frontend Types and Framework Report UI

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/features/execution/pages/ReportDetailPage.tsx`
- Test: `apps/web/src/features/execution/HistoryAndReports.test.tsx`

- [ ] **Step 1: Add the failing frontend test for framework report priority**

In `apps/web/src/features/execution/HistoryAndReports.test.tsx`, append this
test inside `describe('Report pages', () => { ... })`:

```tsx
  it('prefers the framework HTML report when one is available', async () => {
    apiMock.getReport.mockResolvedValue({
      task: {
        ...reportTask,
        framework_report: {
          kind: 'html',
          title: '自动化框架报告',
          source: 'file',
          root_dir: 'C:/framework/reports/exec-1',
          entry: 'index.html',
        },
      },
      attachments: [],
      raw_framework_report: null,
      framework_report: {
        kind: 'html',
        title: '自动化框架报告',
        source: 'file',
        root_dir: 'C:/framework/reports/exec-1',
        entry: 'index.html',
      },
    })

    render(
      <MemoryRouter initialEntries={['/reports/exec-1']}>
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: { queries: { retry: false } },
            })
          }
        >
          <Routes>
            <Route path="/reports/:taskId" element={<ReportDetailPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('自动化框架报告')).toBeInTheDocument()
    expect(screen.getByTitle('框架 HTML 报告')).toHaveAttribute(
      'src',
      'http://127.0.0.1:8000/api/reports/exec-1/framework-report',
    )
    expect(screen.getByRole('link', { name: '打开框架报告' })).toHaveAttribute(
      'href',
      'http://127.0.0.1:8000/api/reports/exec-1/framework-report',
    )
  })
```

- [ ] **Step 2: Run the frontend report test and verify it fails**

Run:

```powershell
pnpm --filter @testflow/web test -- src/features/execution/HistoryAndReports.test.tsx
```

Expected: FAIL because the report detail page does not render a framework HTML
report iframe or open link.

- [ ] **Step 3: Add frontend API types and URL helper**

In `apps/web/src/lib/api.ts`, add this type after
`ExecutionReportAttachment`:

```ts
export type ExecutionFrameworkReport = {
  kind: 'html'
  title: string
  source: 'file' | 'url'
  entry: string
  root_dir: string
}
```

Add this optional field to `ExecutionTask` after `report_dir`:

```ts
  framework_report?: ExecutionFrameworkReport | null
```

Add this optional field to `ExecutionReport` after `raw_framework_report`:

```ts
  framework_report?: ExecutionFrameworkReport | null
```

Add this helper above `createApiClient()`:

```ts
export function frameworkReportUrl(baseUrl: string, taskId: string) {
  return `${baseUrl.replace(/\/+$/, '')}/api/reports/${encodeURIComponent(taskId)}/framework-report`
}
```

- [ ] **Step 4: Render the framework HTML report first**

In `apps/web/src/features/execution/pages/ReportDetailPage.tsx`, update the
imports:

```tsx
import { ExternalLink } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import {
  createApiClient,
  frameworkReportUrl,
  type ExecutionFrameworkReport,
  type ExecutionReportAttachment,
  type ExecutionTask,
} from '@/lib/api'
import { backendBaseUrl } from '@/app/config'

import { formatLogEntry, statusVariant, taskStatusLabel } from '../utils/taskFormatters'
```

Replace this line:

```tsx
  const { task, attachments } = reportQuery.data
```

with:

```tsx
  const { task, attachments } = reportQuery.data
  const frameworkReport = reportQuery.data.framework_report ?? task.framework_report ?? null
```

Replace the return statement after that line with:

```tsx
  return (
    <PagePanel>
      <PageHeader
        title={task.script_name}
        subtitle={`任务 ${task.id}`}
      />

      {frameworkReport?.kind === 'html' ? (
        <FrameworkHtmlReport taskId={task.id} report={frameworkReport} />
      ) : null}

      {frameworkReport?.kind === 'html' ? (
        <div className="text-sm font-medium text-muted-foreground">平台记录</div>
      ) : null}

      <StructuredReportDetail task={task} attachments={attachments} />
    </PagePanel>
  )
```

Append these components below `ReportDetailPage()`:

```tsx
function FrameworkHtmlReport({
  taskId,
  report,
}: {
  taskId: string
  report: ExecutionFrameworkReport
}) {
  const reportUrl = report.source === 'url'
    ? report.entry
    : frameworkReportUrl(backendBaseUrl, taskId)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{report.title || '框架报告'}</CardTitle>
        <Button asChild variant="outline" size="sm">
          <a href={reportUrl} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" />
            打开框架报告
          </a>
        </Button>
      </CardHeader>
      <CardContent>
        {report.source === 'file' ? (
          <iframe
            title="框架 HTML 报告"
            src={reportUrl}
            className="h-[calc(100vh-18rem)] min-h-[520px] w-full rounded-md border bg-background"
          />
        ) : (
          <div className="rounded-md border bg-muted p-3 text-sm [overflow-wrap:anywhere]">
            {report.entry}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StructuredReportDetail({
  task,
  attachments,
}: {
  task: ExecutionTask
  attachments: ExecutionReportAttachment[]
}) {
  return (
    <div className="grid grid-cols-[1fr_2fr] gap-6 max-lg:grid-cols-1">
      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>执行摘要</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">状态:</span>
              <Badge variant={statusVariant(task.status)}>
                {taskStatusLabel(task.status)}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">目标设备: </span>
              {task.target_device}
            </div>
            <div>
              <span className="text-muted-foreground">执行人: </span>
              {task.executor}
            </div>
            <div>
              <span className="text-muted-foreground">耗时: </span>
              {task.duration_ms != null ? `${task.duration_ms} ms` : '-'}
            </div>
            <div>
              <span className="text-muted-foreground">报告目录: </span>
              {task.report_dir}
            </div>
          </CardContent>
        </Card>

        {task.logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>执行日志</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
                {task.logs.map((log, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all">
                    {formatLogEntry(log)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid content-start gap-6">
        {task.steps.map((step) => (
          <Card key={step.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant={statusVariant(step.status)}>
                  {taskStatusLabel(step.status)}
                </Badge>
                <span>
                  {step.keyword} — {step.description}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">耗时: </span>
                {step.duration_ms != null ? `${step.duration_ms} ms` : '-'}
              </div>
              {step.error_message && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {step.error_message}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ))}

        {attachments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>附件</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {attachments.map((attachment, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span className="font-medium">{attachment.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {attachment.path}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run the frontend report test and verify it passes**

Run:

```powershell
pnpm --filter @testflow/web test -- src/features/execution/HistoryAndReports.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

Run:

```powershell
git add apps/web/src/lib/api.ts apps/web/src/features/execution/pages/ReportDetailPage.tsx apps/web/src/features/execution/HistoryAndReports.test.tsx
git commit -m "prefer framework html reports in ui"
```

---

### Task 5: Adapter Guide Update

**Files:**
- Modify: `docs/automation-framework-adapter-guide.md`

- [ ] **Step 1: Document the framework report event**

In `docs/automation-framework-adapter-guide.md`, add `framework_report` to the
supported event table:

```markdown
| `framework_report` | 框架生成 HTML 报告入口 | `task_id`, `report_kind`, `report_source`, `report_root_dir`, `report_entry` |
```

In the “附件和报告” section, replace the current report path guidance with:

````markdown
框架自己的 HTML 报告应保留在框架报告目录中，不要复制到 TestFlow 的 `data/`
目录，也不要让 TestFlow 重新生成一份报告详情。真实 runtime 在拿到报告入口后发出
`framework_report` 事件：

```python
FrameworkEvent(
    type="framework_report",
    task_id=request.task_id,
    report_kind="html",
    report_source="file",
    report_root_dir=framework_report_dir,
    report_entry=framework_report_dir / "index.html",
    report_title="自动化框架报告",
)
```

TestFlow 会保存这个入口，并通过报告详情页优先展示框架 HTML 报告。普通截图、
trace、日志压缩包等仍然使用 `attachment` 事件。
````

- [ ] **Step 2: Commit Task 5**

Run:

```powershell
git add docs/automation-framework-adapter-guide.md
git commit -m "document framework html report event"
```

---

### Task 6: Full Verification

**Files:**
- Verify: backend, frontend, browser route

- [ ] **Step 1: Run focused backend tests**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_service.py tests/test_execution_history.py -q
```

Expected: PASS.

- [ ] **Step 2: Run backend checks**

Run:

```powershell
pnpm check:backend
```

Expected: PASS with Ruff and pytest completing successfully.

- [ ] **Step 3: Run focused frontend report tests**

Run:

```powershell
pnpm --filter @testflow/web test -- src/features/execution/HistoryAndReports.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run full web check**

Run:

```powershell
pnpm check:web
```

Expected: PASS with TypeScript and Vite build completing successfully.

- [ ] **Step 5: Run workspace check**

Run:

```powershell
pnpm check
```

Expected: PASS.

- [ ] **Step 6: Browser-verify report routes**

Start the backend and web dev servers:

```powershell
pnpm dev:backend
pnpm dev:web
```

In another terminal, create a local smoke report record with an external
framework HTML report:

```powershell
@'
from pathlib import Path

from app.core.config import get_settings
from app.db.session import ensure_database
from app.modules.executions.repository import save_execution_report
from app.modules.executions.schemas import ExecutionFrameworkReport, ExecutionTask

settings = get_settings()
ensure_database(settings)
framework_root = Path.cwd().parent / ".tmp-framework-html-report"
framework_root.mkdir(exist_ok=True)
(framework_root / "index.html").write_text(
    "<html><body><h1>Framework HTML Smoke Report</h1></body></html>",
    encoding="utf-8",
)
save_execution_report(
    settings,
    ExecutionTask(
        id="exec-framework-html-smoke",
        script_id="smoke-cockpit",
        script_name="Framework HTML Smoke",
        script_revision=1,
        status="passed",
        report_dir=str(settings.reports_dir / "exec-framework-html-smoke"),
        framework_report=ExecutionFrameworkReport(
            kind="html",
            title="自动化框架报告",
            source="file",
            root_dir=str(framework_root),
            entry="index.html",
        ),
    ),
)
'@ | Set-Content -LiteralPath "$env:TEMP\testflow-framework-report-smoke.py" -Encoding UTF8
cd backend
uv run python "$env:TEMP\testflow-framework-report-smoke.py"
```

Open `http://127.0.0.1:5174/reports/exec-framework-html-smoke` in the browser.
Expected: the page shows `自动化框架报告`, the iframe displays
`Framework HTML Smoke Report`, and the open link loads the same report in a new
tab. Also open a mock-run report without `framework_report`; expected: the page
shows the structured TestFlow summary, steps, logs, and attachments.

- [ ] **Step 7: Commit verification note if the project tracks one**

If `implementation-plan` is still the project progress file, append this note
under the execution history/report area:

```markdown
已接入框架 HTML 报告优先展示。TestFlow 不再生成 `testflow-report.json` 作为报告详情，
只保存框架报告入口并提供路径安全的 HTML/资源访问；没有框架报告时保留平台结构化详情兜底。
验证命令：`pnpm check:backend`、`pnpm test:backend`、`pnpm --filter @testflow/web test -- src/features/execution/HistoryAndReports.test.tsx`、`pnpm check:web`、`pnpm check`，并通过浏览器验证 `/reports/exec-framework-html-smoke`。
```

Then commit:

```powershell
git add implementation-plan
git commit -m "update framework html report progress"
```

Skip this step if `implementation-plan` no longer tracks active project
progress.

---

## Self-Review

- Spec coverage: Tasks cover framework report event contract, external HTML
  report reference persistence, no generated `testflow-report.json`, safe local
  HTML and asset serving, frontend framework-report priority, fallback
  structured detail, adapter documentation, and verification.
- Placeholder scan: The plan contains concrete file paths, test code,
  implementation code, commands, expected failures, and expected passes.
- Type consistency: Backend uses `ExecutionFrameworkReport` with `kind`,
  `title`, `source`, `root_dir`, and `entry`; frontend uses the same property
  names. Framework events use `report_kind`, `report_source`,
  `report_root_dir`, `report_entry`, and `report_title`, and the runner maps
  them into the report schema.

Plan complete and saved to `docs/superpowers/plans/2026-06-03-framework-html-report-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
