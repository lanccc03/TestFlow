# Case-Only Execution Refactor Design

## Goal

TestFlow will remove the remaining TestFlow-owned script and step execution model from the automation runtime path. The product will treat framework cases as the source of truth, execute a selected case by ID, stream plain framework logs, record the final case status, and expose a framework report when one is produced.

This is a breaking refactor. Local execution history stored with the old `script_*` and step-result schema does not need to remain compatible.

## Current Problems

The backend already reads cases from `autotest.entry.list_cases()` and creates execution tasks without YAML scripts, but legacy names and data shapes still remain:

- `/api/scripts` returns framework cases.
- Task create payloads use `script_id`.
- Execution tasks store `script_id`, `script_name`, and a fixed `script_revision`.
- Runtime events still include `step_started` and `step_finished`.
- Execution reports and summaries still model step results and step counts.
- The frontend has user-facing case text but code-level script APIs and step-result UI.

These leftovers make the intended architecture harder to understand and invite new code to depend on concepts that should no longer exist.

## Target Behavior

TestFlow displays a read-only framework case catalog. A user starts a case run. During execution, TestFlow shows task status and log lines emitted by the framework. When execution finishes, TestFlow records one final task status:

- `passed`
- `failed`
- `canceled`
- `error`

If the framework emits an HTML report event, TestFlow stores the report reference and renders it on the report detail page. TestFlow does not track per-step progress, per-step logs, per-step attachments, keyword execution, YAML revisions, or step pass counts.

## Backend API

Replace script catalog endpoints with case catalog endpoints:

```text
GET /api/cases
GET /api/cases/{case_id}
```

Remove `/api/scripts` route handlers and frontend call sites.

Task creation changes from:

```json
{
  "script_id": "case.smoke_cockpit"
}
```

to:

```json
{
  "case_id": "case.smoke_cockpit"
}
```

Task creation only accepts `case_id`. Environment, target device, variables, and executor selection are outside this refactor and should not remain on the create payload unless a future runtime integration proves they are needed.

Task list and report filters use `case_id` instead of `script_id`.

## Runtime Contract

`backend/autotest` remains the boundary between TestFlow and the automation framework. The runtime protocol keeps case discovery, config read/write, and execution.

`FrameworkRunRequest` becomes:

```python
@dataclass(frozen=True)
class FrameworkRunRequest:
    task_id: str
    case_id: str
    report_dir: Path | str | None
    cancellation_token: CancellationToken
```

`FrameworkEventType` becomes:

```python
FrameworkEventType = Literal[
    "run_started",
    "log",
    "framework_report",
    "run_finished",
    "run_error",
]
```

`FrameworkEvent` keeps fields for task ID, timestamp, message, log level, final status, error details, and HTML report metadata. It removes step IDs, step indexes, step output, and step attachments.

The minimum successful event stream is:

```text
run_started
log*
framework_report?
run_finished(status="passed" | "failed" | "canceled" | "error")
```

Infrastructure failures use `run_error`, and the execution runner maps that to task status `error`.

## Backend Modules

Rename `app.modules.scripts` to `app.modules.cases`.

The cases module is a thin read-only adapter over:

- `autotest.entry.list_cases()`
- `autotest.entry.get_case(case_id)`

It should not read `data/scripts`, validate keywords, create scripts, copy scripts, delete scripts, or publish drafts.

## Execution Schema

`ExecutionTaskCreate` uses:

```python
class ExecutionTaskCreate(BaseModel):
    case_id: str
```

`ExecutionTask` uses:

- `case_id`
- `case_name`
- final `status`
- timestamps and duration
- log path and report directory
- optional framework report
- logs
- error message

It removes:

- `script_id`
- `script_name`
- `script_revision`
- `environment`
- `target_device`
- `variables`
- `executor`
- `steps`

`ExecutionTaskSummary` removes step counts and uses `case_id` / `case_name`.

`ExecutionLogEntry` removes `step_id`.

`ExecutionEventType` becomes:

```python
ExecutionEventType = Literal["task_status", "log", "task_finished"]
```

`ExecutionEventMessage` removes `step_id` and `step`.

Remove `ExecutionReportAttachment` and the attachment index from platform reports. The only report artifact TestFlow exposes in this workflow is the framework report reference.

## Persistence

This refactor may break local SQLite compatibility. The development database can be deleted and recreated.

`ExecutionTaskRecord` changes:

- `script_id` -> `case_id`
- `script_name` -> `case_name`
- remove `script_revision`
- remove `step_count`
- remove `passed_step_count`
- remove `failed_step_count`

`ExecutionReportRecord.task_json` stores the new task shape without `steps`.

Report file resolution stays based on `framework_report.root_dir` and `framework_report.entry`.

## Frontend API

Replace `apps/web/src/lib/api/scripts.ts` with case APIs:

```ts
export type CaseSummary = {
  id: string
  name: string
  description: string
  test_steps: string[]
}

listCases(): Promise<ItemList<CaseSummary>>
getCase(caseId: string): Promise<CaseSummary>
```

The `test_steps` field in the case catalog is static human-readable metadata from framework comments. It is not an execution result model.

Update execution types:

- `ExecutionTaskCreate.case_id`
- `ExecutionTask.case_id`
- `ExecutionTask.case_name`
- remove `script_revision`
- remove `ExecutionStepResult`
- remove `steps`
- remove step counts from summaries
- remove `step_status` from update events

## Frontend Routes And UI

Routes:

- `/cases` replaces `/scripts`
- The root route redirects to `/cases`
- Navigation label changes from `脚本` to `用例`

The case list page keeps the current user-facing concept: framework case catalog with name, description, documented test steps, and run action. Code and API fields should use `test_steps` for this metadata so it cannot be confused with execution results.

The task control panel should say `选择用例` and use cases from `/api/cases`.

Task summary cards should show case name, status, task ID, and duration. They should not show step pass counts.

Report detail should show:

- framework HTML report, when present
- platform execution summary
- execution logs
- error message, when present

It should remove the `步骤结果` section.

## Tests

Use test-first implementation.

Backend failing tests should cover:

- `FrameworkEventType` no longer contains step events.
- `FrameworkRunRequest` requires `case_id` and has no script fields.
- `POST /api/tasks` accepts `case_id`.
- task summaries return `case_id` and no step counts.
- WebSocket/update event types do not include `step_status`.
- `/api/cases` returns runtime cases.
- `/api/scripts` is gone.
- reports persist and load without `steps`.

Frontend failing tests should cover:

- case API calls `/api/cases`.
- task creation posts `{ case_id }`.
- execution types and guards refresh on task/log/task-finished events only.
- case route is `/cases`.
- report detail renders logs and framework report without step results.

## Rollout

1. Update tests to the case-only contract and watch them fail.
2. Refactor backend contracts, cases route, execution schemas, runner, repository, and tests.
3. Refactor frontend API types, routes, hooks, pages, and tests.
4. Update docs that still mention script execution, keyword execution, or step-level execution results.
5. Run backend and web checks.
6. Delete or recreate local SQLite data if old schema blocks manual testing.

## Out Of Scope

- Implementing the real framework runtime.
- Preserving old local execution history.
- Reintroducing keyword libraries or YAML script editing.
- Per-step execution progress from framework internals.
