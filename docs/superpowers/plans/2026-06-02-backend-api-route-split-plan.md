# Backend API Route Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the current monolithic FastAPI route module into focused API route files while preserving all existing backend behavior.

**Architecture:** This is Phase 1 of the approved modular layered backend architecture. It only reorganizes the API layer into `api/router.py`, `api/dependencies.py`, and `api/routes/*.py`; existing business functions and services remain in their current files so the behavior surface stays stable.

**Tech Stack:** FastAPI, Starlette WebSockets, Pydantic, pytest, FastAPI TestClient, pnpm backend scripts.

---

## Scope

This plan implements only the API route split from the backend architecture
design. It intentionally does not move `app/config.py`, `app/script_catalog.py`,
`app/command_library.py`, `app/execution/*`, or `app/ssh_terminal.py`.

The public API must remain unchanged:

- `GET /health`
- `GET /api/keywords`
- `GET /api/scripts`
- `GET /api/scripts/{script_id}`
- `POST /api/scripts`
- `DELETE /api/scripts/{script_id}`
- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/{task_id}`
- `POST /api/tasks/{task_id}/cancel`
- `GET /api/reports`
- `GET /api/commands`
- `POST /api/commands`
- `PUT /api/commands/{command_id}`
- `DELETE /api/commands/{command_id}`
- `WS /ws`
- `WS /ws/executions`
- `WS /ws/ssh`

## File Structure

Create:

- `backend/app/api/dependencies.py`
  - Holds shared API dependency helpers such as `execution_service`.
- `backend/app/api/router.py`
  - Creates top-level HTTP and WebSocket routers and includes route modules.
- `backend/app/api/routes/__init__.py`
  - Marks the routes package.
- `backend/app/api/routes/health.py`
  - Owns `/health`.
- `backend/app/api/routes/reports.py`
  - Owns `/api/reports`.
- `backend/app/api/routes/keywords.py`
  - Owns `/api/keywords`.
- `backend/app/api/routes/scripts.py`
  - Owns `/api/scripts`.
- `backend/app/api/routes/executions.py`
  - Owns `/api/tasks` and `/ws/executions`.
- `backend/app/api/routes/commands.py`
  - Owns `/api/commands`.
- `backend/app/api/routes/websockets.py`
  - Owns `/ws`.
- `backend/app/api/routes/terminal.py`
  - Owns `/ws/ssh`.

Modify:

- `backend/app/api/__init__.py`
  - Re-export routers and websocket endpoint functions for compatibility with
    existing tests importing from `app.api`.
- `backend/app/main.py`
  - Include the route-level health router and the reorganized API routers.
- `backend/tests/test_app_foundation.py`
  - Add route organization regression checks and keep direct endpoint imports
    working.

Do not modify:

- `backend/app/script_catalog.py`
- `backend/app/command_library.py`
- `backend/app/execution/*`
- `backend/app/ssh_terminal.py`
- `backend/autotest/*`

## Task 1: Add Route Organization Regression Tests

**Files:**

- Modify: `backend/tests/test_app_foundation.py`

- [ ] **Step 1: Leave route imports inside the new tests**

Do not add top-level imports for `app.api.routes`. The first red test should
fail only when that specific test runs, not during pytest collection for the
rest of the suite.

- [ ] **Step 2: Add a regression test for route module prefixes**

Append this test to `backend/tests/test_app_foundation.py`:

```python
def test_api_route_modules_keep_expected_prefixes() -> None:
    from app.api.routes import commands, executions, health, keywords, reports, scripts
    from app.api.routes import terminal, websockets

    assert health.router.prefix == ""
    assert reports.router.prefix == ""
    assert keywords.router.prefix == ""
    assert scripts.router.prefix == ""
    assert executions.router.prefix == ""
    assert commands.router.prefix == ""
    assert websockets.router.prefix == ""
    assert terminal.router.prefix == ""
```

- [ ] **Step 3: Add a regression test for top-level router exports**

Append this test to `backend/tests/test_app_foundation.py`:

```python
def test_api_package_exports_compatibility_endpoints() -> None:
    from app.api import (
        api_router,
        execution_websocket_endpoint,
        ssh_websocket_endpoint,
        websocket_endpoint,
        websocket_router,
    )

    assert api_router.prefix == "/api"
    assert websocket_router.prefix == ""
    assert websocket_endpoint.__name__ == "websocket_endpoint"
    assert execution_websocket_endpoint.__name__ == "execution_websocket_endpoint"
    assert ssh_websocket_endpoint.__name__ == "ssh_websocket_endpoint"
```

- [ ] **Step 4: Run the new tests and verify they fail before implementation**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py::test_api_route_modules_keep_expected_prefixes tests/test_app_foundation.py::test_api_package_exports_compatibility_endpoints -v
```

Expected result:

```text
ModuleNotFoundError: No module named 'app.api.routes'
```

- [ ] **Step 5: Keep the failing tests uncommitted until Task 8**

Do not commit `backend/tests/test_app_foundation.py` yet. Task 8 makes these
tests pass and commits them with the router assembly.

Confirm the test file is the only uncommitted test change:

```powershell
git status --short
```

Expected output includes:

```text
 M backend/tests/test_app_foundation.py
```

## Task 2: Create Shared API Dependencies

**Files:**

- Create: `backend/app/api/dependencies.py`

- [ ] **Step 1: Create the dependency module**

Create `backend/app/api/dependencies.py` with:

```python
from fastapi import Request

from app.execution.service import ExecutionService


def execution_service(request: Request) -> ExecutionService:
    return request.app.state.execution_service
```

- [ ] **Step 2: Run a smoke import check**

Run:

```powershell
cd backend
uv run python -c "from app.api.dependencies import execution_service; print(execution_service.__name__)"
```

Expected output:

```text
execution_service
```

- [ ] **Step 3: Commit the dependency module**

Run:

```powershell
git add backend/app/api/dependencies.py
git commit -m "add api dependencies"
```

## Task 3: Split Health and Report List Routes

**Files:**

- Create: `backend/app/api/routes/__init__.py`
- Create: `backend/app/api/routes/health.py`
- Create: `backend/app/api/routes/reports.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create the routes package**

Create `backend/app/api/routes/__init__.py` with:

```python
"""API route modules."""
```

- [ ] **Step 2: Create the health route module**

Create `backend/app/api/routes/health.py` with:

```python
from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
def read_health(request: Request) -> dict[str, str]:
    settings = request.app.state.settings
    return {
        "status": "ok",
        "service": settings.service_name,
        "version": settings.version,
        "data_dir": settings.data_dir.as_posix(),
    }
```

- [ ] **Step 3: Create the reports route module**

Create `backend/app/api/routes/reports.py` with:

```python
from fastapi import APIRouter

router = APIRouter()


def empty_items_response() -> dict[str, list[object]]:
    return {"items": []}


router.add_api_route("/reports", empty_items_response, methods=["GET"])
```

- [ ] **Step 4: Include the health router from main**

In `backend/app/main.py`, add this import:

```python
from app.api.routes.health import router as health_router
```

Then replace the inline `@app.get("/health")` function with:

```python
    app.include_router(health_router)
```

The end of `create_app` should contain:

```python
    register_exception_handlers(app)
    app.include_router(health_router)
    app.include_router(api_router)
    app.include_router(websocket_router)

    return app
```

- [ ] **Step 5: Run health and foundation tests**

Run:

```powershell
pnpm test:backend -- tests/test_health.py tests/test_app_foundation.py::test_startup_creates_data_directories_database_and_log_files -v
```

Expected result:

```text
passed
```

- [ ] **Step 6: Commit health and report route modules**

Run:

```powershell
git add backend/app/api/routes/__init__.py backend/app/api/routes/health.py backend/app/api/routes/reports.py backend/app/main.py
git commit -m "split health and report routes"
```

## Task 4: Split Keyword and Script Routes

**Files:**

- Create: `backend/app/api/routes/keywords.py`
- Create: `backend/app/api/routes/scripts.py`
- Test: `backend/tests/test_script_catalog.py`

- [ ] **Step 1: Create the keywords route module**

Create `backend/app/api/routes/keywords.py` with:

```python
from fastapi import APIRouter, Request

from app.script_catalog import load_keywords

router = APIRouter()


@router.get("/keywords")
def list_keyword_metadata(request: Request) -> dict[str, list[dict[str, object]]]:
    keywords = load_keywords(request.app.state.settings)
    return {"items": [keyword.model_dump(mode="json") for keyword in keywords]}
```

- [ ] **Step 2: Create the scripts route module**

Create `backend/app/api/routes/scripts.py` with:

```python
from fastapi import APIRouter, Request, Response

from app.errors import error_response
from app.script_catalog import (
    ScriptValidationError,
    TestScript,
    delete_script,
    list_scripts,
    read_script,
    save_script,
)

router = APIRouter()


@router.get("/scripts")
def list_script_summaries(request: Request) -> dict[str, list[dict[str, object]]]:
    scripts = list_scripts(request.app.state.settings)
    return {"items": [script.model_dump(mode="json") for script in scripts]}


@router.get("/scripts/{script_id}")
def get_script(script_id: str, request: Request) -> dict[str, object]:
    try:
        script = read_script(request.app.state.settings, script_id)
    except FileNotFoundError:
        return error_response(
            status_code=404,
            code="not_found",
            message="Script not found",
        )
    return script.model_dump(mode="json")


@router.post("/scripts", response_model=None)
def save_script_endpoint(
    script: TestScript,
    request: Request,
    response: Response,
) -> dict[str, object] | Response:
    try:
        saved_script, was_created = save_script(request.app.state.settings, script)
    except ScriptValidationError as exc:
        return error_response(
            status_code=422,
            code="script_validation_error",
            message="Script validation failed",
            details=[issue.model_dump(mode="json") for issue in exc.issues],
        )

    response.status_code = 201 if was_created else 200
    return saved_script.model_dump(mode="json")


@router.delete("/scripts/{script_id}", status_code=204)
def delete_script_endpoint(script_id: str, request: Request) -> Response:
    was_deleted = delete_script(request.app.state.settings, script_id)
    if not was_deleted:
        return error_response(
            status_code=404,
            code="not_found",
            message="Script not found",
        )

    return Response(status_code=204)
```

- [ ] **Step 3: Run script route tests through the still-monolithic router**

Run:

```powershell
pnpm test:backend -- tests/test_script_catalog.py -v
```

Expected result:

```text
passed
```

The new modules are not included yet, so this verifies the new files do not
break imports.

- [ ] **Step 4: Commit keyword and script route modules**

Run:

```powershell
git add backend/app/api/routes/keywords.py backend/app/api/routes/scripts.py
git commit -m "split keyword and script routes"
```

## Task 5: Split Command Routes

**Files:**

- Create: `backend/app/api/routes/commands.py`
- Test: `backend/tests/test_command_library.py`

- [ ] **Step 1: Create the commands route module**

Create `backend/app/api/routes/commands.py` with:

```python
from fastapi import APIRouter, Request, Response

from app.command_library import (
    CommandTemplatePayload,
    create_command_template,
    delete_command_template,
    list_command_templates,
    update_command_template,
)
from app.errors import error_response

router = APIRouter()


@router.get("/commands")
def list_commands_endpoint(
    request: Request,
    search: str = "",
) -> dict[str, list[dict[str, object]]]:
    commands = list_command_templates(request.app.state.settings, search)
    return {"items": [command.model_dump(mode="json") for command in commands]}


@router.post("/commands", response_model=None)
def create_command_endpoint(
    command: CommandTemplatePayload,
    request: Request,
    response: Response,
) -> dict[str, object]:
    response.status_code = 201
    created = create_command_template(request.app.state.settings, command)
    return created.model_dump(mode="json")


@router.put("/commands/{command_id}", response_model=None)
def update_command_endpoint(
    command_id: str,
    command: CommandTemplatePayload,
    request: Request,
) -> dict[str, object] | Response:
    updated = update_command_template(
        request.app.state.settings,
        command_id,
        command,
    )
    if updated is None:
        return error_response(
            status_code=404,
            code="not_found",
            message="Command template not found",
        )

    return updated.model_dump(mode="json")


@router.delete("/commands/{command_id}", status_code=204)
def delete_command_endpoint(command_id: str, request: Request) -> Response:
    was_deleted = delete_command_template(request.app.state.settings, command_id)
    if not was_deleted:
        return error_response(
            status_code=404,
            code="not_found",
            message="Command template not found",
        )

    return Response(status_code=204)
```

- [ ] **Step 2: Run command route tests through the still-monolithic router**

Run:

```powershell
pnpm test:backend -- tests/test_command_library.py -v
```

Expected result:

```text
passed
```

- [ ] **Step 3: Commit command route module**

Run:

```powershell
git add backend/app/api/routes/commands.py
git commit -m "split command routes"
```

## Task 6: Split Execution Routes and Execution WebSocket

**Files:**

- Create: `backend/app/api/routes/executions.py`
- Test: `backend/tests/test_execution_service.py`

- [ ] **Step 1: Create the executions route module**

Create `backend/app/api/routes/executions.py` with:

```python
import asyncio
from contextlib import suppress

from fastapi import APIRouter, Request, Response, WebSocket
from starlette.websockets import WebSocketDisconnect

from app.api.dependencies import execution_service
from app.errors import error_response
from app.execution.models import ExecutionTaskCreate
from app.execution.service import TaskAlreadyFinishedError, TaskNotFoundError

router = APIRouter()
websocket_router = APIRouter()


@router.get("/tasks")
def list_execution_tasks(request: Request) -> dict[str, list[dict[str, object]]]:
    service = execution_service(request)
    return {
        "items": [
            summary.model_dump(mode="json") for summary in service.list_tasks()
        ]
    }


@router.post("/tasks", response_model=None)
async def create_execution_task(
    payload: ExecutionTaskCreate,
    request: Request,
    response: Response,
) -> dict[str, object] | Response:
    service = execution_service(request)
    try:
        task = await service.create_task(payload)
    except FileNotFoundError:
        return error_response(
            status_code=404,
            code="not_found",
            message="Script not found",
        )

    response.status_code = 201
    return task.model_dump(mode="json")


@router.get("/tasks/{task_id}", response_model=None)
def get_execution_task(task_id: str, request: Request) -> dict[str, object] | Response:
    service = execution_service(request)
    try:
        task = service.get_task(task_id)
    except TaskNotFoundError:
        task = None

    if task is None:
        return error_response(
            status_code=404,
            code="not_found",
            message="Task not found",
        )

    return task.model_dump(mode="json")


@router.post("/tasks/{task_id}/cancel", response_model=None)
async def cancel_execution_task(
    task_id: str,
    request: Request,
) -> dict[str, object] | Response:
    service = execution_service(request)
    try:
        task = await service.cancel_task(task_id)
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
            message="Task already finished",
        )

    return task.model_dump(mode="json")


@websocket_router.websocket("/ws/executions")
async def execution_websocket_endpoint(websocket: WebSocket) -> None:
    try:
        await websocket.accept()
        service = websocket.app.state.execution_service
        async with service.events.subscribe() as subscriber:
            await websocket.send_json({"type": "connection", "status": "connected"})
            while True:
                event_task = asyncio.create_task(subscriber.get())
                receive_task = asyncio.create_task(websocket.receive())
                done, pending = await asyncio.wait(
                    {event_task, receive_task},
                    return_when=asyncio.FIRST_COMPLETED,
                )

                for task in pending:
                    task.cancel()
                    with suppress(asyncio.CancelledError):
                        await task

                if receive_task in done:
                    received = receive_task.result()
                    if received.get("type") == "websocket.disconnect":
                        return
                    continue

                message = event_task.result()
                await websocket.send_json(message.model_dump(mode="json"))
    except WebSocketDisconnect:
        return
```

- [ ] **Step 2: Run execution tests through the still-monolithic router**

Run:

```powershell
pnpm test:backend -- tests/test_execution_service.py -v
```

Expected result:

```text
passed
```

- [ ] **Step 3: Commit execution route module**

Run:

```powershell
git add backend/app/api/routes/executions.py
git commit -m "split execution routes"
```

## Task 7: Split Base WebSocket and SSH Terminal Routes

**Files:**

- Create: `backend/app/api/routes/websockets.py`
- Create: `backend/app/api/routes/terminal.py`
- Test: `backend/tests/test_app_foundation.py`
- Test: `backend/tests/test_ssh_terminal.py`

- [ ] **Step 1: Create the base WebSocket route module**

Create `backend/app/api/routes/websockets.py` with:

```python
from fastapi import APIRouter, WebSocket
from starlette.websockets import WebSocketDisconnect

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    try:
        await websocket.accept()
        await websocket.send_json({"type": "connection", "status": "connected"})
        await websocket.close()
    except WebSocketDisconnect:
        return
```

- [ ] **Step 2: Create the SSH terminal route module**

Create `backend/app/api/routes/terminal.py` with:

```python
from fastapi import APIRouter, WebSocket

from app.ssh_terminal import handle_ssh_terminal_websocket

router = APIRouter()


@router.websocket("/ws/ssh")
async def ssh_websocket_endpoint(websocket: WebSocket) -> None:
    await handle_ssh_terminal_websocket(websocket)
```

- [ ] **Step 3: Run WebSocket and SSH tests through the still-monolithic router**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py::test_websocket_route_is_registered tests/test_app_foundation.py::test_websocket_endpoint_ignores_client_disconnect tests/test_ssh_terminal.py -v
```

Expected result:

```text
passed
```

- [ ] **Step 4: Commit WebSocket route modules**

Run:

```powershell
git add backend/app/api/routes/websockets.py backend/app/api/routes/terminal.py
git commit -m "split websocket routes"
```

## Task 8: Assemble Routers and Replace Monolithic API Module

**Files:**

- Create: `backend/app/api/router.py`
- Modify: `backend/app/api/__init__.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_app_foundation.py`

- [ ] **Step 1: Create the router assembly module**

Create `backend/app/api/router.py` with:

```python
from fastapi import APIRouter

from app.api.routes import commands, executions, keywords, reports, scripts
from app.api.routes import terminal, websockets

api_router = APIRouter(prefix="/api")
api_router.include_router(reports.router, prefix="")
api_router.include_router(keywords.router, prefix="")
api_router.include_router(scripts.router, prefix="")
api_router.include_router(executions.router, prefix="")
api_router.include_router(commands.router, prefix="")

websocket_router = APIRouter()
websocket_router.include_router(websockets.router)
websocket_router.include_router(executions.websocket_router)
websocket_router.include_router(terminal.router)
```

- [ ] **Step 2: Replace `app/api/__init__.py` with compatibility exports**

Replace the full contents of `backend/app/api/__init__.py` with:

```python
from app.api.router import api_router, websocket_router
from app.api.routes.executions import execution_websocket_endpoint
from app.api.routes.terminal import ssh_websocket_endpoint
from app.api.routes.websockets import websocket_endpoint

__all__ = [
    "api_router",
    "websocket_router",
    "execution_websocket_endpoint",
    "ssh_websocket_endpoint",
    "websocket_endpoint",
]
```

- [ ] **Step 3: Verify `main.py` imports the assembled routers**

`backend/app/main.py` should import:

```python
from app.api import api_router, websocket_router
from app.api.routes.health import router as health_router
```

`create_app` should include routers in this order:

```python
    register_exception_handlers(app)
    app.include_router(health_router)
    app.include_router(api_router)
    app.include_router(websocket_router)
```

- [ ] **Step 4: Run foundation tests**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py -v
```

Expected result:

```text
passed
```

- [ ] **Step 5: Commit router assembly**

Run:

```powershell
git add backend/app/api/router.py backend/app/api/__init__.py backend/app/main.py backend/app/api/routes/reports.py backend/app/api/routes/keywords.py backend/app/api/routes/scripts.py backend/app/api/routes/executions.py backend/app/api/routes/commands.py backend/tests/test_app_foundation.py
git commit -m "assemble split api routers"
```

## Task 9: Run Full Backend Verification

**Files:**

- No source edits expected.

- [ ] **Step 1: Run all backend tests**

Run:

```powershell
pnpm test:backend
```

Expected result:

```text
passed
```

- [ ] **Step 2: Run backend lint check**

Run:

```powershell
pnpm check:backend
```

Expected result:

```text
passed
```

- [ ] **Step 3: Inspect final changed files**

Run:

```powershell
git status --short
git diff --stat HEAD
```

Expected result:

```text
No uncommitted source changes after the final verification commit, or only the current task changes ready to commit.
```

- [ ] **Step 4: Commit final verification note only if files changed**

If no files changed, do not commit. If formatting or import order changed files,
commit them with:

```powershell
git add backend/app backend/tests
git commit -m "verify api route split"
```

## Self-Review

Spec coverage:

- API route split is covered by Tasks 1 through 8.
- API compatibility is covered by existing route behavior tests and Task 9.
- The plan intentionally leaves core, DB, scripts, commands, executions,
  terminal service extraction, and report persistence for later phase plans.

Completion wording scan:

- No steps contain unspecified implementation work.
- Every source edit step includes concrete file paths and code.

Type consistency:

- `execution_service` returns `ExecutionService`, matching the existing service.
- `api_router` and `websocket_router` remain exported from `app.api`.
- Direct test imports of `websocket_endpoint` and
  `execution_websocket_endpoint` remain compatible.

## Execution Handoff

Plan complete and saved to
`docs/superpowers/plans/2026-06-02-backend-api-route-split-plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task,
   review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using
   executing-plans, batch execution with checkpoints.
