# Case-Only Execution Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the old script and step execution model so TestFlow executes framework cases by `case_id` and records only logs, framework reports, and final task status.

**Architecture:** Keep `backend/autotest` as the runtime boundary, but shrink its run request and events. Replace script-facing backend and frontend APIs with case-facing names. Remove step result handling from schemas, persistence, websocket messages, and UI.

**Tech Stack:** FastAPI, SQLModel, pytest, React 19, Vite, TanStack Query, Vitest.

---

## File Map

- `backend/autotest/contracts.py`: Defines the runtime request, runtime events, statuses, config error, cancellation token, and case summaries.
- `backend/autotest/{entry,runtime,mock_runtime,real_runtime,registry}.py`: Exposes and selects the runtime implementation.
- `backend/app/modules/cases/*`: New read-only case catalog module backed by `autotest.entry`.
- `backend/app/api/routes/cases.py`: New `/api/cases` endpoints.
- `backend/app/modules/executions/*`: Task schemas, persistence, service, and runner using `case_id` and no step model.
- `apps/web/src/lib/api/cases.ts`: New frontend case catalog API.
- `apps/web/src/lib/api/executions.ts`: Case-only task and event types.
- `apps/web/src/features/scripts/*`: Rename or refactor to case terminology.
- `apps/web/src/features/execution/*`: Remove step result UI and step-status event handling.

### Task 1: Backend Autotest Contract

**Files:**
- Modify: `backend/tests/test_autotest_adapter.py`
- Modify: `backend/tests/test_autotest_runtime_registry.py`
- Modify: `backend/autotest/contracts.py`
- Modify: `backend/autotest/mock_runtime.py`
- Modify: `backend/autotest/real_runtime.py`

- [ ] **Step 1: Write failing contract tests**

Update request builders in the autotest tests to use:

```python
FrameworkRunRequest(
    task_id="task-1",
    case_id="case.smoke_cockpit",
    report_dir=tmp_path / "reports",
    cancellation_token=CancellationToken(),
)
```

Assert event types are exactly:

```python
assert set(get_args(FrameworkEventType)) == {
    "log",
    "framework_report",
    "run_finished",
    "run_error",
}
```

- [ ] **Step 2: Run failing tests**

Run:

```powershell
cd backend
uv run pytest tests/test_autotest_adapter.py tests/test_autotest_runtime_registry.py -q
```

Expected: FAIL because `FrameworkRunRequest` still requires `script_*` fields and `FrameworkEventType` still includes step and attachment events.

- [ ] **Step 3: Implement minimal contract refactor**

Change `FrameworkRunRequest` to:

```python
@dataclass(frozen=True)
class FrameworkRunRequest:
    task_id: str
    case_id: str
    report_dir: Path | str | None
    cancellation_token: CancellationToken
```

Change `FrameworkEventType` to:

```python
FrameworkEventType = Literal[
    "log",
    "framework_report",
    "run_finished",
    "run_error",
]
```

Remove step and attachment fields from `FrameworkEvent`.

- [ ] **Step 4: Run passing contract tests**

Run the same pytest command. Expected: PASS.

### Task 2: Backend Case API And Execution Model

**Files:**
- Create: `backend/app/modules/cases/__init__.py`
- Create: `backend/app/modules/cases/schemas.py`
- Create: `backend/app/modules/cases/service.py`
- Create: `backend/app/api/routes/cases.py`
- Modify: `backend/app/api/router.py`
- Modify: `backend/app/api/routes/executions.py`
- Modify: `backend/app/api/routes/reports.py`
- Modify: `backend/app/modules/executions/__init__.py`
- Modify: `backend/app/modules/executions/schemas.py`
- Modify: `backend/app/modules/executions/models.py`
- Modify: `backend/app/modules/executions/repository.py`
- Modify: `backend/app/modules/executions/runner.py`
- Modify: `backend/app/modules/executions/service.py`
- Delete: `backend/app/modules/scripts/*`
- Delete: `backend/app/api/routes/scripts.py`

- [ ] **Step 1: Write failing backend API tests**

Update backend tests to assert:

```python
client.get("/api/cases").status_code == 200
client.get("/api/scripts").status_code == 404
client.post("/api/tasks", json={"case_id": "case.smoke_cockpit"}).status_code == 200
```

Assert task JSON contains `case_id` and `case_name`, and does not contain:

```python
for removed in [
    "script_id",
    "script_name",
    "script_revision",
    "environment",
    "target_device",
    "variables",
    "executor",
    "steps",
]:
    assert removed not in task_json
```

Assert summary JSON has no `step_count`, `passed_step_count`, or `failed_step_count`.

- [ ] **Step 2: Run failing backend tests**

Run focused backend tests:

```powershell
cd backend
uv run pytest tests/test_script_catalog.py tests/test_execution_service.py tests/test_execution_history.py tests/test_app_foundation.py -q
```

Expected: FAIL because routes, payloads, and schemas still use script and step fields.

- [ ] **Step 3: Implement backend case-only model**

Create `app.modules.cases` as the runtime-backed catalog. Update execution schemas:

```python
class ExecutionTaskCreate(BaseModel):
    case_id: str
```

```python
class ExecutionTask(BaseModel):
    id: str
    case_id: str
    case_name: str
    status: TaskStatus = "pending"
    created_at: str = Field(default_factory=utc_now)
    started_at: str | None = None
    finished_at: str | None = None
    duration_ms: int | None = None
    log_path: str = ""
    report_dir: str = ""
    framework_report: ExecutionFrameworkReport | None = None
    logs: list[ExecutionLogEntry] = Field(default_factory=list)
    error_message: str = ""
```

Update runner final status logic so `run_finished.status` directly sets task status. Remove `_find_step`, `_final_status_from_steps`, and all step event branches.

- [ ] **Step 4: Run passing backend tests**

Run the same focused pytest command. Expected: PASS.

### Task 3: Frontend Case API And UI

**Files:**
- Create: `apps/web/src/lib/api/cases.ts`
- Modify: `apps/web/src/lib/api/index.ts`
- Modify: `apps/web/src/lib/api/endpoints.test.ts`
- Modify: `apps/web/src/lib/api/executions.ts`
- Modify: `apps/web/src/app/routes.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify or rename files under `apps/web/src/features/scripts`
- Modify files under `apps/web/src/features/execution`

- [ ] **Step 1: Write failing frontend tests**

Update tests to expect:

```ts
expect(client.get).toHaveBeenCalledWith('/api/cases')
expect(client.post).toHaveBeenCalledWith('/api/tasks', { case_id: 'case.smoke_cockpit' })
```

Update event tests so refreshable update types are only:

```ts
['task_status', 'task_finished']
```

Report detail tests should not expect a `步骤结果` section.

- [ ] **Step 2: Run failing frontend tests**

Run:

```powershell
pnpm --filter @testflow/web test
```

Expected: FAIL because frontend still imports scripts API, posts `script_id`, and renders step result UI.

- [ ] **Step 3: Implement frontend case-only refactor**

Create `cases.ts`:

```ts
export type CaseSummary = {
  id: string
  name: string
  description: string
  test_steps: string[]
}
```

Update execution task types to use `case_id` and `case_name`, remove step result types and step counts, and update UI copy from script to case where visible.

- [ ] **Step 4: Run passing frontend tests**

Run the same Vitest command. Expected: PASS.

### Task 4: Docs And Full Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-06-09-case-only-execution-refactor-design.md`
- Modify docs that still describe script, keyword, or step-level execution.

- [ ] **Step 1: Search stale references**

Run:

```powershell
rg -n "script_id|script_name|script_revision|/api/scripts|step_status|ExecutionStepResult|step_count|passed_step_count|failed_step_count" backend apps docs -S -g "!node_modules"
```

Expected: only historical docs may remain. Runtime code, API code, frontend app code, and tests should not contain stale execution-path references.

- [ ] **Step 2: Run backend verification**

Run:

```powershell
pnpm check:backend
```

Expected: PASS.

- [ ] **Step 3: Run web verification**

Run:

```powershell
pnpm check:web
pnpm --filter @testflow/web test
```

Expected: PASS.
