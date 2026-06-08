# Framework Case Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace TestFlow-owned YAML script management with a read-only framework case catalog and execute framework cases while streaming framework logs.

**Architecture:** Keep the automation framework boundary in `backend/autotest`. Add runtime-owned case discovery, make `app.modules.scripts` a read-only adapter over that runtime contract, and change execution task creation to fetch framework case metadata instead of reading `data/scripts`. The web app becomes a read-only case catalog with run actions; the task page continues to show status and real-time framework logs.

**Tech Stack:** FastAPI, Pydantic, pytest, React 19, Vite, Vitest, TanStack Query, Tailwind CSS v4, shadcn/ui.

---

## File Structure

- Modify: `backend/autotest/contracts.py`
  - Add `FrameworkCaseSummary`.
- Modify: `backend/autotest/runtime.py`
  - Add `list_cases()` and `get_case()` to `AutotestRuntime`.
- Modify: `backend/autotest/entry.py`
  - Delegate case catalog calls to the configured runtime.
- Modify: `backend/autotest/mock_runtime.py`
  - Provide demo framework cases and support no-step case execution with framework log events.
- Modify: `backend/autotest/real_runtime.py`
  - Add unimplemented case catalog methods with clear errors until a real adapter is wired.
- Modify: `backend/tests/test_autotest_runtime_registry.py`
  - Verify `entry` delegates case catalog calls.
- Modify: `backend/tests/test_autotest_adapter.py`
  - Verify mock runtime exposes cases and can execute a case without `FrameworkStep` entries.
- Modify: `backend/app/modules/scripts/schemas.py`
  - Replace editable script schemas with read-only `FrameworkCaseSummary`.
- Modify: `backend/app/modules/scripts/service.py`
  - Replace YAML-backed CRUD with runtime-backed case listing/detail.
- Modify: `backend/app/modules/scripts/__init__.py`
  - Export read-only case catalog symbols.
- Modify: `backend/app/api/routes/scripts.py`
  - Keep `GET` routes and remove or explicitly disable write routes.
- Modify: `backend/tests/test_script_catalog.py`
  - Replace YAML CRUD tests with runtime-backed case catalog tests.
- Modify: `backend/app/modules/executions/runner.py`
  - Add `task_from_case()` and keep `_framework_request()` compatible with empty steps.
- Modify: `backend/app/modules/executions/service.py`
  - Fetch runtime case metadata in `create_task()`.
- Modify: `backend/app/api/routes/executions.py`
  - Keep missing case mapped to 404.
- Modify: `backend/tests/test_execution_service.py`
  - Replace script save setup with fake runtime case setup for execution creation tests.
- Modify: `backend/tests/test_execution_history.py`
  - Replace script save setup in tests that create tasks through `ExecutionService`.
- Modify: `apps/web/src/lib/api/scripts.ts`
  - Simplify script API types to read-only framework cases.
- Modify: `apps/web/src/features/scripts/hooks/useScriptListPage.ts`
  - Remove copy/delete logic and search only case name/description/steps.
- Modify: `apps/web/src/features/scripts/pages/ScriptListPage.tsx`
  - Render the read-only case catalog.
- Modify: `apps/web/src/features/scripts/index.ts`
  - Stop exporting the editor page if routes no longer use it.
- Modify: `apps/web/src/app/routes.tsx`
  - Remove editable script routes or redirect them to `/scripts`.
- Modify: `apps/web/src/App.test.tsx`
  - Replace editor/save/delete expectations with read-only catalog expectations.
- Modify: `apps/web/src/features/scripts/ScriptRunNavigation.test.tsx`
  - Keep run navigation test, remove editor run test.
- Modify: `apps/web/src/lib/api.test.ts`
  - Update script response shape tests and remove delete script API test.
- Modify: `apps/web/src/lib/api/endpoints.test.ts`
  - Update script endpoint module expectations.
- Modify: `docs/automation-framework-adapter-guide.md`
  - Document `list_cases()` and `get_case()`.

---

### Task 1: Runtime Case Catalog Contract

**Files:**
- Modify: `backend/autotest/contracts.py`
- Modify: `backend/autotest/runtime.py`
- Modify: `backend/autotest/entry.py`
- Modify: `backend/autotest/mock_runtime.py`
- Modify: `backend/autotest/real_runtime.py`
- Modify: `backend/tests/test_autotest_runtime_registry.py`
- Modify: `backend/tests/test_autotest_adapter.py`

- [ ] **Step 1: Add failing runtime delegation tests**

Append to `backend/tests/test_autotest_runtime_registry.py`:

```python
def test_entry_delegates_case_listing_to_configured_runtime() -> None:
    from autotest import registry
    from autotest.contracts import FrameworkCaseSummary
    from autotest.entry import list_cases

    class CaseRuntime(FakeRuntime):
        def list_cases(self) -> list[FrameworkCaseSummary]:
            return [
                FrameworkCaseSummary(
                    id="case.smoke_cockpit",
                    name="座舱冒烟测试",
                    description="基础稳定性巡检",
                    steps=("启动系统", "确认首页加载"),
                )
            ]

    registry.set_runtime_for_testing(CaseRuntime())

    assert list_cases() == [
        FrameworkCaseSummary(
            id="case.smoke_cockpit",
            name="座舱冒烟测试",
            description="基础稳定性巡检",
            steps=("启动系统", "确认首页加载"),
        )
    ]


def test_entry_delegates_case_detail_to_configured_runtime() -> None:
    from autotest import registry
    from autotest.contracts import FrameworkCaseSummary
    from autotest.entry import get_case

    class CaseRuntime(FakeRuntime):
        def get_case(self, case_id: str) -> FrameworkCaseSummary:
            if case_id != "case.smoke_cockpit":
                raise FileNotFoundError(case_id)
            return FrameworkCaseSummary(
                id=case_id,
                name="座舱冒烟测试",
                description="基础稳定性巡检",
                steps=("启动系统", "确认首页加载"),
            )

    registry.set_runtime_for_testing(CaseRuntime())

    assert get_case("case.smoke_cockpit").name == "座舱冒烟测试"
```

- [ ] **Step 2: Add failing mock runtime case tests**

Append to `backend/tests/test_autotest_adapter.py`:

```python
def test_list_cases_returns_framework_case_metadata() -> None:
    from autotest.entry import list_cases

    cases = list_cases()

    assert cases[0].id == "case.smoke_cockpit"
    assert cases[0].name == "座舱冒烟测试"
    assert cases[0].description == "基础稳定性巡检"
    assert cases[0].steps == ("启动系统", "确认首页加载", "检查关键状态正常")


def test_get_case_returns_framework_case_metadata() -> None:
    from autotest.entry import get_case

    case = get_case("case.smoke_cockpit")

    assert case.name == "座舱冒烟测试"
    assert case.steps[1] == "确认首页加载"


def test_get_case_raises_file_not_found_for_missing_case() -> None:
    from autotest.entry import get_case

    try:
        get_case("missing")
    except FileNotFoundError as error:
        assert "missing" in str(error)
    else:
        raise AssertionError("expected FileNotFoundError")


def test_case_execution_without_platform_steps_streams_framework_logs() -> None:
    request = make_request([])

    events = asyncio.run(collect_events(request))

    assert event_types(events) == ["run_started", "log", "run_finished"]
    assert events[1].message == "框架用例日志：座舱冒烟测试开始执行"
    assert events[2].status == "passed"
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
cd backend
uv run pytest tests/test_autotest_runtime_registry.py tests/test_autotest_adapter.py -q
```

Expected: FAIL with import errors for `FrameworkCaseSummary`, `list_cases`, or `get_case`.

- [ ] **Step 4: Add runtime contract implementation**

In `backend/autotest/contracts.py`, add this dataclass before `FrameworkRunRequest`:

```python
@dataclass(frozen=True)
class FrameworkCaseSummary:
    id: str
    name: str
    description: str = ""
    steps: tuple[str, ...] = ()
```

In `backend/autotest/runtime.py`, import `FrameworkCaseSummary` and add methods:

```python
from autotest.contracts import (
    FrameworkCaseSummary,
    FrameworkEvent,
    FrameworkKeywordDef,
    FrameworkRunRequest,
    JsonValue,
)


class AutotestRuntime(Protocol):
    def list_cases(self) -> list[FrameworkCaseSummary]:
        """Return framework test cases available to execute."""
        ...

    def get_case(self, case_id: str) -> FrameworkCaseSummary:
        """Return one framework test case by stable ID."""
        ...
```

In `backend/autotest/entry.py`, import `FrameworkCaseSummary` and add:

```python
def list_cases() -> list[FrameworkCaseSummary]:
    return get_runtime().list_cases()


def get_case(case_id: str) -> FrameworkCaseSummary:
    return get_runtime().get_case(case_id)
```

In `backend/autotest/mock_runtime.py`, import `FrameworkCaseSummary` and add:

```python
CASE_DEFINITIONS: list[FrameworkCaseSummary] = [
    FrameworkCaseSummary(
        id="case.smoke_cockpit",
        name="座舱冒烟测试",
        description="基础稳定性巡检",
        steps=("启动系统", "确认首页加载", "检查关键状态正常"),
    )
]
```

Add methods to `MockAutotestRuntime`:

```python
def list_cases(self) -> list[FrameworkCaseSummary]:
    return list(CASE_DEFINITIONS)

def get_case(self, case_id: str) -> FrameworkCaseSummary:
    for case in CASE_DEFINITIONS:
        if case.id == case_id:
            return case
    raise FileNotFoundError(case_id)
```

At the top of `_run_script()` in `backend/autotest/mock_runtime.py`, after `run_started`, add:

```python
    if not request.steps:
        yield FrameworkEvent(
            type="log",
            task_id=request.task_id,
            message="框架用例日志：座舱冒烟测试开始执行",
            level="info",
        )
        yield FrameworkEvent(
            type="run_finished",
            task_id=request.task_id,
            status="passed",
        )
        return
```

In `backend/autotest/real_runtime.py`, import `FrameworkCaseSummary` and add:

```python
def list_cases(self) -> list[FrameworkCaseSummary]:
    raise NotImplementedError("Real autotest runtime case catalog is not implemented yet")

def get_case(self, case_id: str) -> FrameworkCaseSummary:
    raise NotImplementedError(
        f"Real autotest runtime case catalog is not implemented yet: {case_id}"
    )
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```powershell
cd backend
uv run pytest tests/test_autotest_runtime_registry.py tests/test_autotest_adapter.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit runtime contract**

Run:

```powershell
git add backend/autotest backend/tests/test_autotest_runtime_registry.py backend/tests/test_autotest_adapter.py
git commit -m "add framework case runtime contract"
```

---

### Task 2: Read-Only Framework Case API

**Files:**
- Modify: `backend/app/modules/scripts/schemas.py`
- Modify: `backend/app/modules/scripts/service.py`
- Modify: `backend/app/modules/scripts/__init__.py`
- Modify: `backend/app/api/routes/scripts.py`
- Modify: `backend/tests/test_script_catalog.py`

- [ ] **Step 1: Replace script catalog tests with read-only case tests**

Replace `backend/tests/test_script_catalog.py` with:

```python
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from autotest.contracts import FrameworkCaseSummary, FrameworkKeywordDef


class CaseRuntime:
    def list_cases(self) -> list[FrameworkCaseSummary]:
        return [
            FrameworkCaseSummary(
                id="case.smoke_cockpit",
                name="座舱冒烟测试",
                description="基础稳定性巡检",
                steps=("启动系统", "确认首页加载", "检查关键状态正常"),
            )
        ]

    def get_case(self, case_id: str) -> FrameworkCaseSummary:
        if case_id != "case.smoke_cockpit":
            raise FileNotFoundError(case_id)
        return self.list_cases()[0]

    def list_keywords(self) -> list[FrameworkKeywordDef]:
        return []

    def read_config(self):
        return {}

    def write_config(self, config):
        return config

    def run_script(self, request):
        raise NotImplementedError


@pytest.fixture(autouse=True)
def runtime_override():
    from autotest import registry

    registry.set_runtime_for_testing(CaseRuntime())
    yield
    registry.reset_runtime_for_testing()


def test_lists_framework_cases_from_runtime(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.get("/api/scripts")

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "id": "case.smoke_cockpit",
                "name": "座舱冒烟测试",
                "description": "基础稳定性巡检",
                "steps": ["启动系统", "确认首页加载", "检查关键状态正常"],
            }
        ]
    }
    assert not (settings.scripts_dir / "case.smoke_cockpit.yaml").exists()


def test_reads_framework_case_detail_from_runtime(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.get("/api/scripts/case.smoke_cockpit")

    assert response.status_code == 200
    assert response.json()["name"] == "座舱冒烟测试"
    assert response.json()["steps"] == ["启动系统", "确认首页加载", "检查关键状态正常"]


def test_returns_404_for_missing_framework_case(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.get("/api/scripts/missing")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_script_write_endpoints_are_not_available(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        create_response = client.post("/api/scripts", json={})
        delete_response = client.delete("/api/scripts/case.smoke_cockpit")

    assert create_response.status_code == 405
    assert delete_response.status_code == 405
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
cd backend
uv run pytest tests/test_script_catalog.py -q
```

Expected: FAIL because `/api/scripts` still returns YAML script summaries and write routes are still enabled.

- [ ] **Step 3: Implement read-only script schemas and service**

Replace `backend/app/modules/scripts/schemas.py` with:

```python
from pydantic import BaseModel, ConfigDict


class FrameworkCaseSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    description: str = ""
    steps: list[str] = []
```

Replace `backend/app/modules/scripts/service.py` with:

```python
from app.modules.scripts.schemas import FrameworkCaseSummary
from autotest.entry import get_case, list_cases


def list_scripts() -> list[FrameworkCaseSummary]:
    return [
        _case_to_schema(case)
        for case in sorted(list_cases(), key=lambda item: item.name)
    ]


def read_script(script_id: str) -> FrameworkCaseSummary:
    return _case_to_schema(get_case(script_id))


def _case_to_schema(case) -> FrameworkCaseSummary:
    return FrameworkCaseSummary(
        id=case.id,
        name=case.name,
        description=case.description,
        steps=list(case.steps),
    )
```

Replace `backend/app/modules/scripts/__init__.py` with:

```python
from app.modules.scripts.schemas import FrameworkCaseSummary
from app.modules.scripts.service import list_scripts, read_script

__all__ = [
    "FrameworkCaseSummary",
    "list_scripts",
    "read_script",
]
```

- [ ] **Step 4: Make script routes read-only**

Replace `backend/app/api/routes/scripts.py` with:

```python
from fastapi import APIRouter, Request

from app.core.errors import error_response
from app.modules.scripts import list_scripts, read_script

router = APIRouter()


@router.get("/scripts")
def list_script_summaries(_request: Request) -> dict[str, list[dict[str, object]]]:
    scripts = list_scripts()
    return {"items": [script.model_dump(mode="json") for script in scripts]}


@router.get("/scripts/{script_id}")
def get_script(script_id: str, _request: Request) -> dict[str, object]:
    try:
        script = read_script(script_id)
    except FileNotFoundError:
        return error_response(
            status_code=404,
            code="not_found",
            message="Script not found",
        )
    return script.model_dump(mode="json")
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```powershell
cd backend
uv run pytest tests/test_script_catalog.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit read-only case API**

Run:

```powershell
git add backend/app/modules/scripts backend/app/api/routes/scripts.py backend/tests/test_script_catalog.py
git commit -m "serve framework cases as read-only scripts"
```

---

### Task 3: Execution Uses Framework Case Metadata

**Files:**
- Modify: `backend/app/modules/executions/runner.py`
- Modify: `backend/app/modules/executions/service.py`
- Modify: `backend/app/api/routes/executions.py`
- Modify: `backend/tests/test_execution_service.py`
- Modify: `backend/tests/test_execution_history.py`

- [ ] **Step 1: Add focused execution service tests**

In `backend/tests/test_execution_service.py`, add imports:

```python
from autotest.contracts import FrameworkCaseSummary
from autotest import registry
```

Add this fake runtime near test helpers:

```python
class CaseExecutionRuntime:
    def list_cases(self) -> list[FrameworkCaseSummary]:
        return [
            FrameworkCaseSummary(
                id="case.smoke_cockpit",
                name="座舱冒烟测试",
                description="基础稳定性巡检",
                steps=("启动系统", "确认首页加载"),
            )
        ]

    def get_case(self, case_id: str) -> FrameworkCaseSummary:
        if case_id != "case.smoke_cockpit":
            raise FileNotFoundError(case_id)
        return self.list_cases()[0]

    def list_keywords(self):
        return []

    def read_config(self):
        return {}

    def write_config(self, config):
        return config

    async def run_script(self, request):
        yield FrameworkEvent(type="run_started", task_id=request.task_id)
        yield FrameworkEvent(
            type="log",
            task_id=request.task_id,
            message="framework case log",
            level="info",
        )
        yield FrameworkEvent(
            type="run_finished",
            task_id=request.task_id,
            status="passed",
        )
```

Append tests:

```python
@pytest.mark.anyio
async def test_execution_service_runs_framework_case_without_yaml_script(tmp_path) -> None:
    registry.set_runtime_for_testing(CaseExecutionRuntime())
    service = ExecutionService(Settings(data_dir=tmp_path))

    await service.start()
    try:
        task = await service.create_task(
            ExecutionTaskCreate(
                script_id="case.smoke_cockpit",
                environment="local",
                target_device="bench-1",
            )
        )
        final_task = await service.wait_for_task(task.id, timeout=2)
    finally:
        await service.stop()
        registry.reset_runtime_for_testing()

    assert final_task.status == "passed"
    assert final_task.script_id == "case.smoke_cockpit"
    assert final_task.script_name == "座舱冒烟测试"
    assert final_task.script_revision == 1
    assert final_task.steps == []
    assert any(log.message == "framework case log" for log in final_task.logs)
    assert not (tmp_path / "scripts" / "case.smoke_cockpit.yaml").exists()


@pytest.mark.anyio
async def test_execution_service_returns_missing_framework_case(tmp_path) -> None:
    registry.set_runtime_for_testing(CaseExecutionRuntime())
    service = ExecutionService(Settings(data_dir=tmp_path))

    try:
        with pytest.raises(FileNotFoundError):
            await service.create_task(ExecutionTaskCreate(script_id="missing"))
    finally:
        registry.reset_runtime_for_testing()
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_service.py::test_execution_service_runs_framework_case_without_yaml_script tests/test_execution_service.py::test_execution_service_returns_missing_framework_case -q
```

Expected: FAIL because `ExecutionService.create_task()` still reads `data/scripts`.

- [ ] **Step 3: Add task creation from framework case**

In `backend/app/modules/executions/runner.py`, remove the `TestScript` import and add:

```python
from autotest.contracts import FrameworkCaseSummary
```

Add this function above `task_from_script()`:

```python
def task_from_case(
    case: FrameworkCaseSummary,
    payload: ExecutionTaskCreate,
    task_id: str,
    log_path: Path,
    report_dir: Path,
) -> ExecutionTask:
    return ExecutionTask(
        id=task_id,
        script_id=case.id,
        script_name=case.name,
        script_revision=1,
        environment=payload.environment,
        target_device=payload.target_device,
        variables=deepcopy(payload.variables),
        executor=payload.executor,
        log_path=str(log_path),
        report_dir=str(report_dir),
        steps=[],
    )
```

Keep `task_from_script()` temporarily only if older tests still import it. If no imports remain after this task, delete it and its `TestScript` dependency.

In `backend/app/modules/executions/service.py`, change imports:

```python
from app.modules.executions.runner import (
    TERMINAL_STATUSES,
    ExecutionRunner,
    _mark_task_canceled,
    task_from_case,
    task_summary,
)
from autotest.entry import get_case
```

Replace the first lines of `create_task()` with:

```python
    async def create_task(self, payload: ExecutionTaskCreate) -> ExecutionTask:
        case = get_case(payload.script_id)
        task_id = f"exec-{uuid4().hex}"
        log_path = self.settings.logs_dir / "executions" / f"{task_id}.log"
        report_dir = self.settings.reports_dir / task_id
        report_dir.mkdir(parents=True, exist_ok=True)
        task = task_from_case(case, payload, task_id, log_path, report_dir)
```

In `backend/app/api/routes/executions.py`, keep `except FileNotFoundError` as-is so missing cases still return 404.

- [ ] **Step 4: Run focused tests to verify they pass**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_service.py::test_execution_service_runs_framework_case_without_yaml_script tests/test_execution_service.py::test_execution_service_returns_missing_framework_case -q
```

Expected: PASS.

- [ ] **Step 5: Update old execution tests that save YAML scripts**

For tests in `backend/tests/test_execution_service.py` and `backend/tests/test_execution_history.py` that call `save_script()` only to make task creation succeed, replace setup with `registry.set_runtime_for_testing(CaseExecutionRuntime())` and reset it in `finally`.

Use this pattern:

```python
registry.set_runtime_for_testing(CaseExecutionRuntime())
service = ExecutionService(settings)
try:
    task = await service.create_task(ExecutionTaskCreate(script_id="case.smoke_cockpit"))
finally:
    registry.reset_runtime_for_testing()
```

For tests that need a long-running cancellation case, add `CaseExecutionRuntime.run_script()` behavior based on `request.script_id`:

```python
if request.script_id == "case.long_wait":
    yield FrameworkEvent(type="run_started", task_id=request.task_id)
    while not request.cancellation_token.is_canceled:
        await asyncio.sleep(0.01)
    yield FrameworkEvent(type="run_finished", task_id=request.task_id, status="canceled")
    return
```

- [ ] **Step 6: Run backend execution and history tests**

Run:

```powershell
cd backend
uv run pytest tests/test_execution_service.py tests/test_execution_history.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit execution migration**

Run:

```powershell
git add backend/app/modules/executions backend/app/api/routes/executions.py backend/tests/test_execution_service.py backend/tests/test_execution_history.py
git commit -m "run execution tasks from framework cases"
```

---

### Task 4: Frontend Read-Only Case Catalog

**Files:**
- Modify: `apps/web/src/lib/api/scripts.ts`
- Modify: `apps/web/src/features/scripts/hooks/useScriptListPage.ts`
- Modify: `apps/web/src/features/scripts/pages/ScriptListPage.tsx`
- Modify: `apps/web/src/features/scripts/index.ts`
- Modify: `apps/web/src/app/routes.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/features/scripts/ScriptRunNavigation.test.tsx`
- Modify: `apps/web/src/lib/api.test.ts`
- Modify: `apps/web/src/lib/api/endpoints.test.ts`

- [ ] **Step 1: Update API tests for framework case shape**

In `apps/web/src/lib/api.test.ts`, replace the script summary/detail/delete tests with:

```typescript
  it('returns framework cases from the backend', async () => {
    const httpClient = {
      get: vi.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'case.smoke_cockpit',
              name: '座舱冒烟测试',
              description: '基础稳定性巡检',
              steps: ['启动系统', '确认首页加载'],
            },
          ],
        },
      }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.listScripts()).resolves.toEqual({
      items: [
        {
          id: 'case.smoke_cockpit',
          name: '座舱冒烟测试',
          description: '基础稳定性巡检',
          steps: ['启动系统', '确认首页加载'],
        },
      ],
    })
    expect(httpClient.get).toHaveBeenCalledWith('/api/scripts')
  })

  it('returns a framework case detail from the backend', async () => {
    const httpClient = {
      get: vi.fn().mockResolvedValue({
        data: {
          id: 'case.smoke_cockpit',
          name: '座舱冒烟测试',
          description: '基础稳定性巡检',
          steps: ['启动系统', '确认首页加载'],
        },
      }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.getScript('case.smoke_cockpit')).resolves.toMatchObject({
      id: 'case.smoke_cockpit',
      steps: ['启动系统', '确认首页加载'],
    })
    expect(httpClient.get).toHaveBeenCalledWith('/api/scripts/case.smoke_cockpit')
  })
```

In `apps/web/src/lib/api/endpoints.test.ts`, update the script endpoint test:

```typescript
  it('keeps framework case endpoints in a focused module', async () => {
    const client = createClientMock()
    const scriptsApi = createScriptsApi(client)

    await scriptsApi.listScripts()
    await scriptsApi.getScript('case.smoke_cockpit')

    expect(client.get).toHaveBeenNthCalledWith(1, '/api/scripts')
    expect(client.get).toHaveBeenNthCalledWith(
      2,
      '/api/scripts/case.smoke_cockpit',
    )
    expect(client.remove).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Update UI tests for read-only catalog**

In `apps/web/src/features/scripts/ScriptRunNavigation.test.tsx`, remove `deleteScript`, `listKeywords`, `saveScript`, and `getScript` mock usage. Use this script summary:

```typescript
const scriptSummary = {
  id: 'case.smoke_cockpit',
  name: '座舱冒烟测试',
  description: '基础稳定性巡检',
  steps: ['启动系统', '确认首页加载', '检查关键状态正常'],
}
```

Keep one test:

```typescript
  it('navigates from framework case catalog run action to tasks with taskId', async () => {
    renderWithQuery(<ScriptListPage />, ['/scripts'])

    expect(await screen.findByRole('table', { name: '用例列表' })).toBeInTheDocument()
    expect(screen.getByText('座舱冒烟测试')).toBeInTheDocument()
    expect(screen.getByText('基础稳定性巡检')).toBeInTheDocument()
    expect(screen.getByText('启动系统')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /新建脚本/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /删除/ })).not.toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: '运行 座舱冒烟测试' }))

    await waitFor(() =>
      expect(apiMock.createTask).toHaveBeenCalledWith({
        script_id: 'case.smoke_cockpit',
      }),
    )
    expect(await screen.findByLabelText('location')).toHaveTextContent('/tasks?taskId=exec-123')
  })
```

In `apps/web/src/App.test.tsx`, change mocked `/api/scripts` response to the case shape and delete tests that assert editor/save/delete/publish behavior. Add:

```typescript
  it('renders framework case catalog without script maintenance controls', async () => {
    renderApp()

    expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()
    expect(screen.getByText('基础稳定性巡检')).toBeInTheDocument()
    expect(screen.getByText('启动系统')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /新建脚本/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /删除/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /复制/ })).not.toBeInTheDocument()
  })
```

- [ ] **Step 3: Run frontend tests to verify they fail**

Run:

```powershell
pnpm --filter @testflow/web test -- api.test.ts endpoints.test.ts ScriptRunNavigation.test.tsx App.test.tsx
```

Expected: FAIL because the frontend still expects editable script fields and controls.

- [ ] **Step 4: Simplify script API types**

Replace `apps/web/src/lib/api/scripts.ts` with:

```typescript
import type { ApiRequestClient } from './client'
import type { ItemList } from './types'

export type ScriptSummary = {
  id: string
  name: string
  description: string
  steps: string[]
}

export type TestScript = ScriptSummary

export function createScriptsApi(client: ApiRequestClient) {
  return {
    listScripts: () => client.get<ItemList<ScriptSummary>>('/api/scripts'),
    getScript: (scriptId: string) =>
      client.get<TestScript>(`/api/scripts/${scriptId}`),
  }
}
```

- [ ] **Step 5: Simplify script list hook**

Replace `apps/web/src/features/scripts/hooks/useScriptListPage.ts` with:

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'

import { api } from '@/app/backend'

export function useScriptListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const scriptsQuery = useQuery({
    queryKey: ['scripts'],
    queryFn: api.listScripts,
  })
  const executeMutation = useMutation({
    mutationFn: (scriptId: string) => api.createTask({ script_id: scriptId }),
    onSuccess: (task) => {
      navigate(`/tasks?taskId=${encodeURIComponent(task.id)}`)
    },
  })

  const scripts = scriptsQuery.data?.items ?? []
  const query = search.trim().toLowerCase()
  const filteredScripts = query
    ? scripts.filter((script) =>
        [script.id, script.name, script.description, ...script.steps]
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
    : scripts

  return {
    executeMutation,
    filteredScripts,
    search,
    scripts,
    scriptsQuery,
    setSearch,
  }
}
```

- [ ] **Step 6: Replace script list page UI**

Replace `apps/web/src/features/scripts/pages/ScriptListPage.tsx` with:

```typescript
import { Play } from 'lucide-react'

import { ListToolbar } from '@/components/layout/list'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { useScriptListPage } from '../hooks/useScriptListPage'

export function ScriptListPage() {
  const {
    executeMutation,
    filteredScripts,
    search,
    scriptsQuery,
    setSearch,
  } = useScriptListPage()

  return (
    <PagePanel>
      <PageHeader
        title="框架用例库"
        subtitle="从测试框架读取用例名称、描述和测试步骤。"
      />

      <ListToolbar className="grid-cols-[minmax(280px,1fr)] items-center">
        <Input
          aria-label="搜索用例"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索用例名称、描述或测试步骤"
          value={search}
        />
      </ListToolbar>

      <Table aria-label="用例列表">
        <TableHeader>
          <TableRow>
            <TableHead>用例</TableHead>
            <TableHead>测试步骤</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scriptsQuery.isPending ? (
            <TableRow>
              <TableCell colSpan={3}>
                <EmptyState title="正在加载" />
              </TableCell>
            </TableRow>
          ) : scriptsQuery.isError ? (
            <TableRow>
              <TableCell colSpan={3}>
                <Alert variant="destructive">
                  <AlertDescription>后端用例数据不可用</AlertDescription>
                </Alert>
              </TableCell>
            </TableRow>
          ) : filteredScripts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3}>
                <EmptyState title={search.trim() ? '没有匹配的用例' : '没有用例'} />
              </TableCell>
            </TableRow>
          ) : (
            filteredScripts.map((script) => (
              <TableRow key={script.id}>
                <TableCell className="max-w-[360px] align-top">
                  <div className="grid gap-1">
                    <div className="font-medium">{script.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {script.description || script.id}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  {script.steps.length === 0 ? (
                    <span className="text-sm text-muted-foreground">暂无步骤说明</span>
                  ) : (
                    <ol className="m-0 grid gap-1 pl-5 text-sm">
                      {script.steps.map((step, index) => (
                        <li key={`${script.id}-${index}`}>{step}</li>
                      ))}
                    </ol>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex justify-end">
                    <Button
                      aria-label={`运行 ${script.name}`}
                      disabled={executeMutation.isPending}
                      onClick={() => executeMutation.mutate(script.id)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Play aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </PagePanel>
  )
}
```

- [ ] **Step 7: Remove editor routes from navigation**

In `apps/web/src/features/scripts/index.ts`, export only:

```typescript
export { FrameworkConfigPage } from './pages/FrameworkConfigPage'
export { ScriptListPage } from './pages/ScriptListPage'
```

In `apps/web/src/app/routes.tsx`, remove imports and route entries for `ScriptEditorPage`, `/scripts/new`, and `/scripts/:scriptId`. Change the `/scripts` route label to:

```typescript
label: '框架用例库',
description: '从测试框架读取用例名称、描述和测试步骤。',
```

- [ ] **Step 8: Run frontend tests to verify they pass**

Run:

```powershell
pnpm --filter @testflow/web test -- api.test.ts endpoints.test.ts ScriptRunNavigation.test.tsx App.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Run full web verification**

Run:

```powershell
pnpm check:web
pnpm --filter @testflow/web test
```

Expected: PASS.

- [ ] **Step 10: Commit frontend catalog migration**

Run:

```powershell
git add apps/web/src/lib/api apps/web/src/features/scripts apps/web/src/app/routes.tsx apps/web/src/App.test.tsx
git commit -m "show framework cases in script catalog"
```

---

### Task 5: Adapter Guide and Full Verification

**Files:**
- Modify: `docs/automation-framework-adapter-guide.md`

- [ ] **Step 1: Add docs update test by searching for missing case contract text**

Run:

```powershell
rg -n "list_cases|get_case|FrameworkCaseSummary" docs/automation-framework-adapter-guide.md
```

Expected: no matches before editing.

- [ ] **Step 2: Update adapter guide**

In `docs/automation-framework-adapter-guide.md`, update the boundary section to include:

```markdown
- `autotest.entry.list_cases()`：返回测试框架可执行用例的只读目录。
- `autotest.entry.get_case(case_id)`：按框架用例 ID/引用读取名称、描述和测试步骤。
```

Add a new section after framework config:

````markdown
## 框架用例目录

TestFlow 不再维护自己的 YAML 脚本。用例目录来自自动化框架 runtime：

```text
GET /api/scripts
GET /api/scripts/{script_id}
```

runtime 需要返回 `FrameworkCaseSummary`：

```python
FrameworkCaseSummary(
    id="case.smoke_cockpit",
    name="座舱冒烟测试",
    description="基础稳定性巡检",
    steps=("启动系统", "确认首页加载", "检查关键状态正常"),
)
```

真实框架如果在脚本注释中维护用例名称、描述和测试步骤，应在
`RealAutotestRuntime.list_cases()` / `get_case()` 内解析注释。不要让
`app.modules.*` 或前端解析框架脚本文件。
````

Update the request contract section to say `steps` may be empty when executing a framework-owned case:

```markdown
| `steps` | TestFlow 自维护步骤；执行框架原生用例时可以为空 |
```

Update the event section to say:

```markdown
执行框架原生用例时，最小事件流可以只有 `run_started`、`log*`、`framework_report?` 和
`run_finished`。`step_started` / `step_finished` 仅在 runtime 能自然提供逐步骤状态时使用。
```

- [ ] **Step 3: Verify docs text is present**

Run:

```powershell
rg -n "list_cases|get_case|FrameworkCaseSummary|框架原生用例" docs/automation-framework-adapter-guide.md
```

Expected: matches in the updated sections.

- [ ] **Step 4: Run backend verification**

Run:

```powershell
pnpm check:backend
pnpm test:backend
```

Expected: PASS.

- [ ] **Step 5: Run frontend verification**

Run:

```powershell
pnpm check:web
pnpm --filter @testflow/web test
```

Expected: PASS.

- [ ] **Step 6: Run complete workspace verification**

Run:

```powershell
pnpm check
```

Expected: PASS.

- [ ] **Step 7: Commit docs and verification follow-up**

Run:

```powershell
git add docs/automation-framework-adapter-guide.md
git commit -m "document framework case catalog adapter"
```

---

## Final Review Checklist

- [ ] `GET /api/scripts` returns only `id`, `name`, `description`, and `steps`.
- [ ] `POST /api/scripts` and `DELETE /api/scripts/{script_id}` are unavailable.
- [ ] `POST /api/tasks` succeeds without any file under `data/scripts`.
- [ ] Execution tasks created from framework cases have empty platform steps.
- [ ] Framework `log` events appear in task logs and WebSocket output.
- [ ] `/scripts` shows case name, case description, and ordered test steps.
- [ ] `/scripts` does not show create, edit, copy, delete, save, publish, or revision UI.
- [ ] Adapter docs explain that comment parsing belongs in `RealAutotestRuntime`.
- [ ] `pnpm check:backend`, `pnpm test:backend`, `pnpm check:web`, `pnpm --filter @testflow/web test`, and `pnpm check` pass.
