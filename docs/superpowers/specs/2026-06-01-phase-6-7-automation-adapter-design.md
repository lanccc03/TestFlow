# Phase 6/7 Automation Adapter Design

Date: 2026-06-01

Status: Approved for implementation planning

## Context

Phase 6 and Phase 7 need to turn saved YAML scripts into executable
automation runs, stream execution progress to the frontend, and preserve
history and reports. The real automation framework source code is not available
in the repository yet, but it will be integrated directly into the backend
later.

To keep TestFlow moving before the framework code arrives, the first
implementation should use a mock runtime behind the same integration boundary
that the real framework will use.

## Decision

Use an in-process adapter with an event stream protocol.

TestFlow owns task lifecycle, persistence, API contracts, WebSocket events, and
report models. The automation framework is accessed only through
`backend/autotest/entry.py`, which converts TestFlow execution requests into
framework calls and converts framework output into standard events.

```text
FastAPI routes
  -> app.execution.service
    -> app.execution.runner
      -> autotest.entry
        -> mock runtime / real framework runtime
```

This keeps the framework integration replaceable without letting framework
models leak into frontend APIs, SQLite tables, or platform report structures.

## Proposed Layout

```text
backend/app/execution/
  __init__.py
  models.py
  service.py
  runner.py
  events.py
  repository.py

backend/autotest/
  __init__.py
  contracts.py
  entry.py
  mock_runtime.py
```

`backend/app/execution` is the TestFlow platform execution layer.

`backend/autotest` is the automation framework adapter boundary. The current
mock runtime and the future real framework integration must both satisfy the
same contracts.

## Responsibility Boundaries

`app.execution` owns:

- Creating execution tasks.
- Single-machine serial scheduling for the first version.
- Task status transitions: `pending`, `running`, `passed`, `failed`,
  `canceled`, `error`.
- Cancellation state and cancellation requests.
- WebSocket event publishing.
- Execution log writing.
- SQLite execution history.
- `data/reports/` report and attachment indexing.
- Public API shapes used by the frontend.

`autotest.entry` owns:

- Reading and normalizing automation framework configuration.
- Discovering or registering available framework keywords.
- Mapping TestFlow script steps to framework calls.
- Calling the mock runtime now and the real framework runtime later.
- Capturing framework logs, step results, attachments, and errors.
- Returning standard framework events.

`autotest.entry` must not write platform database records, call FastAPI
WebSockets, or decide public API response shapes.

## Adapter Contract

`autotest.entry` should expose one main execution function:

```python
async def run_script(
    request: FrameworkRunRequest,
) -> AsyncIterator[FrameworkEvent]:
    ...
```

`FrameworkRunRequest` should include:

- `task_id`
- `script_id`
- `script_name`
- `script_revision`
- `steps`
- `variables`
- `environment`
- `target_device`
- `log_path`
- `report_dir`
- `artifact_dir`
- `cancellation_token`

`FrameworkEvent` should support these event types:

- `run_started`
- `step_started`
- `log`
- `step_finished`
- `attachment`
- `run_finished`
- `run_error`

Every event should include enough identifiers for the platform runner to update
the right task and step without reading framework internals.

## Step Result Shape

The platform should store normalized step results with:

- Step ID.
- Step index.
- Keyword.
- Description.
- Status.
- Start time and end time.
- Duration in milliseconds.
- Input params.
- Output data.
- Error message.
- Error detail or traceback when available.
- Related log offsets or log snippets.
- Attachment references.

The raw framework report can be stored as an attachment or as a
`raw_framework_report` field, but the frontend should render the normalized
TestFlow report first.

## Phase 6 Scope

Phase 6 should implement the execution path with the mock adapter:

- Add execution task models and APIs.
- Add local serial runner.
- Add execution state transitions.
- Add cancellation support.
- Add execution log writing.
- Add `/ws` task event streaming or a dedicated execution WebSocket path.
- Add mock keyword execution for existing keywords such as `wait` and
  `log.message`.
- Convert mock runtime events into task status, step results, and frontend
  messages.
- Add failure-path tests so keyword errors do not crash the backend service.

The mock runtime should behave like the future framework from TestFlow's point
of view. It should emit the same event types, honor cancellation, and produce
step-level output and errors.

## Phase 7 Scope

Phase 7 should persist and display the results created by Phase 6:

- Add execution history SQLModel tables.
- Add report metadata and report detail models.
- Save task snapshots, script revision, environment, target device, variables,
  step results, logs, and attachments.
- Implement history list filters by script, status, time range, and executor.
- Implement report detail API.
- Render history and report pages in the frontend.
- Preserve framework raw reports as attachments when available.

Phase 7 should reuse Phase 6 execution models instead of defining a separate
report-only status vocabulary.

## Error Handling

The runner should distinguish:

- `failed`: the script executed and one or more steps failed.
- `error`: platform or framework infrastructure failed before a valid script
  result could be produced.
- `canceled`: user cancellation was requested and acknowledged.

Unexpected framework exceptions should be captured, logged, converted to
`run_error`, and stored in the task report. They must not terminate the FastAPI
service.

## Testing Strategy

Backend tests should cover:

- Creating a task for an existing script.
- Rejecting task creation for a missing script.
- Running a successful mock script.
- Running a script with a failing mock keyword.
- Recording step-level status, duration, input, output, and errors.
- Canceling a running task.
- Listing execution history.
- Reading report details.
- Ensuring framework exceptions become task errors instead of process crashes.

Frontend checks should cover:

- Starting a script execution.
- Showing live task status and logs.
- Showing failed step information.
- Listing execution history with filters.
- Opening a report detail page.

## Open Implementation Notes

- Keep Phase 6 serial execution. Parallel task execution can be introduced only
  after cancellation, persistence, and logging are stable.
- Keep public API models in TestFlow terms, not framework terms.
- Prefer structured report data for UI rendering. Store raw framework output as
  supplementary evidence.
- When the real framework source arrives, add a real runtime behind
  `autotest.entry` while preserving the adapter contracts and existing tests.
