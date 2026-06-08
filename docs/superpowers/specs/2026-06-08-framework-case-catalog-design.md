# Framework Case Catalog Design

## Goal

TestFlow will stop maintaining its own YAML test scripts. It will read test cases from the automation framework, display framework-provided case metadata, and execute framework cases directly while streaming the framework case logs to the task page.

## Scope

This design covers:

- Replacing the TestFlow-owned script catalog with a read-only framework case catalog.
- Displaying only case name, case description, and test steps on the frontend.
- Starting execution by passing a framework case ID/reference to the runtime.
- Streaming logs printed by the framework case to the execution task page.

This design does not cover:

- Editing, creating, copying, deleting, publishing, or validating TestFlow YAML scripts.
- Showing TestFlow-owned per-step execution progress.
- Parsing framework-specific comment syntax outside the runtime adapter.
- Building a real runtime implementation for a specific external framework.

## Current State

The current backend reads `data/scripts/*.yaml` through `app.modules.scripts`, validates steps against keyword metadata, and converts the saved `TestScript` into `FrameworkRunRequest.steps` before calling `autotest.entry.run_script()`.

The current frontend script pages expose script CRUD, a visual keyword editor, draft/published status, step parameter editing, copy/delete actions, and run actions. The task page already displays task status and real-time logs.

## Target Model

The automation runtime becomes the source of truth for test cases. TestFlow consumes a small, stable case metadata shape:

```ts
type FrameworkCaseSummary = {
  id: string
  name: string
  description: string
  steps: string[]
}
```

Field meanings:

- `id`: Stable framework case ID, path, or reference that can be passed back to the runtime for execution.
- `name`: Human-readable case name parsed from framework script comments.
- `description`: Human-readable case description parsed from framework script comments.
- `steps`: Ordered textual test steps parsed from framework script comments.

The runtime owns the parsing rules. If a framework stores the case name and steps in comments, `RealAutotestRuntime` parses those comments and returns the structured metadata. TestFlow does not inspect raw framework files or encode framework-specific comment syntax.

## Runtime Contract

Add framework case discovery to the `backend/autotest` boundary:

```python
@dataclass(frozen=True)
class FrameworkCaseSummary:
    id: str
    name: str
    description: str = ""
    steps: tuple[str, ...] = ()
```

The runtime protocol gains:

```python
class AutotestRuntime(Protocol):
    def list_cases(self) -> list[FrameworkCaseSummary]:
        ...

    def get_case(self, case_id: str) -> FrameworkCaseSummary:
        ...
```

`autotest.entry` exposes matching `list_cases()` and `get_case(case_id)` functions. `MockAutotestRuntime` returns a small in-memory case list for tests and local demos. `RealAutotestRuntime` will eventually scan the real framework and parse comments.

`get_case()` raises `FileNotFoundError` for missing cases. Framework-specific parse problems that do not prevent execution should produce empty `description` or `steps` rather than failing the catalog.

## API Design

Keep `/api/scripts` as the frontend-facing route for now, but change the semantics from editable scripts to read-only framework cases.

```text
GET /api/scripts
GET /api/scripts/{script_id}
```

Responses use the existing item envelope:

```json
{
  "items": [
    {
      "id": "case.smoke_cockpit",
      "name": "座舱冒烟测试",
      "description": "验证座舱基础启动链路",
      "steps": ["启动系统", "检查首页加载", "确认关键状态正常"]
    }
  ]
}
```

Remove or disable write operations:

```text
POST /api/scripts -> 405 Method Not Allowed
DELETE /api/scripts/{script_id} -> 405 Method Not Allowed
```

If frontend call sites are removed, these route handlers can be deleted instead of kept as explicit 405 handlers. The user-facing behavior must make clear that TestFlow no longer maintains scripts.

## Execution Design

`POST /api/tasks` keeps accepting:

```json
{
  "script_id": "case.smoke_cockpit",
  "environment": "local",
  "target_device": "bench-1",
  "variables": {},
  "executor": "local"
}
```

`ExecutionService.create_task()` calls `autotest.entry.get_case(script_id)` to fetch display metadata. It creates an `ExecutionTask` with:

- `script_id` from the case ID.
- `script_name` from the case name.
- `script_revision` fixed to `1`, because TestFlow does not own framework case versions.
- `steps` as an empty list.

`FrameworkRunRequest` still carries `script_id`, `script_name`, environment, target device, variables, log path, report directory, artifact directory, and cancellation token. It does not need TestFlow-owned `FrameworkStep` entries for this workflow.

The runtime executes the framework case identified by `request.script_id`. It streams logs printed by the framework case through `FrameworkEvent(type="log", ...)`. The task page renders these log events in real time.

The minimum expected event stream is:

```text
run_started
log*
framework_report?
run_finished
```

Infrastructure failures use:

```text
run_started?
run_error
run_finished(status="error")
```

`step_started` and `step_finished` are optional. TestFlow will not require them for framework case execution.

## Frontend Design

The `/scripts` page becomes a read-only framework case catalog.

It displays:

- Case name as the main row title.
- Case description below or beside the title.
- Test steps as an ordered list.
- A run button that calls `api.createTask({ script_id: case.id })` and navigates to `/tasks?taskId=<id>`.

Remove from the user flow:

- New script button.
- Script editor route as an editable experience.
- Save draft and publish actions.
- Keyword picker and parameter inputs.
- Copy and delete actions.
- Draft/published status display.
- Revision display.

The task page remains focused on:

- Current task status.
- Stop button.
- Real-time log panel showing framework case logs.
- Recent task list.

The task page should not present a TestFlow-owned step progress list as a required execution view.

## Error Handling

- Missing framework case: `POST /api/tasks` returns 404 with `code="not_found"` and `message="Script not found"`.
- Catalog unavailable: `GET /api/scripts` returns the existing error envelope with a runtime-specific error code.
- Comment parse gaps: show empty description or an empty step list; do not block execution.
- Runtime execution failure: stream `run_error`, mark the task `error`, and show the error message in the task detail.

## Persistence

Execution history keeps using `script_id` and `script_name` on task records. Because TestFlow no longer owns script revisions, persisted tasks use `script_revision=1` unless a future runtime contract provides framework version metadata.

`data/scripts` is no longer used for framework case execution. Existing files can remain as local fixtures during migration, but new behavior must not require them.

## Testing

Backend tests:

- Verify `GET /api/scripts` returns cases from a fake runtime with `name`, `description`, and `steps`.
- Verify `GET /api/scripts/{script_id}` returns one fake runtime case.
- Verify missing cases return 404.
- Verify script write endpoints are removed or return 405.
- Verify `POST /api/tasks` creates a task without reading `data/scripts`.
- Verify task execution streams framework `log` events to task logs.
- Verify execution succeeds with no `FrameworkStep` entries.

Frontend tests:

- Verify the script page renders case name, description, and ordered test steps.
- Verify the script page does not render new/edit/copy/delete/save/publish controls.
- Verify clicking run creates a task with `{ script_id: case.id }` and navigates to `/tasks?taskId=<id>`.
- Verify the task page displays framework log messages received through WebSocket events.

## Migration Notes

The implementation should keep changes narrow:

1. Extend `autotest.contracts`, `runtime`, `entry`, and mock runtime with case catalog methods.
2. Refactor `app.modules.scripts` from YAML repository/service to runtime-backed read-only case service.
3. Refactor `ExecutionService.create_task()` so it fetches case metadata from runtime instead of reading `data/scripts`.
4. Simplify frontend script API types and script page UI.
5. Remove editor route usage or redirect editor paths back to `/scripts`.
6. Update tests around scripts and execution.

The adapter guide should be updated after implementation to document `list_cases()` and `get_case()`.
