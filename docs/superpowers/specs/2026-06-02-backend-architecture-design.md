# Backend Architecture Design

Date: 2026-06-02

Status: Approved for design documentation

## Context

TestFlow is a local Electron + React + FastAPI automation testing platform. The
backend currently works, but its structure is still centered around a few
top-level feature files:

- `app/api/__init__.py` contains most HTTP and WebSocket route handlers.
- `app/script_catalog.py` owns keyword metadata, script schemas, YAML storage,
  and script validation.
- `app/command_library.py` mixes SQLModel records, API payload schemas,
  database sessions, and command service functions.
- `app/ssh_terminal.py` handles WebSocket protocol, SSH connection setup,
  terminal I/O relay, and secret redaction in one file.
- `app/execution/` has a clearer local boundary, but task orchestration,
  framework adapter calls, log writing, and in-memory task storage still live
  mostly in `service.py`.

This is acceptable for the early MVP, but it will become difficult to maintain
as TestFlow adds real automation framework integration, execution history,
report persistence, SCP transfer, and richer script and keyword management.

The backend needs an architecture that is clear enough to guide refactoring, but
lightweight enough for the current product stage.

## Decision

Use a modular layered architecture.

The backend should be organized by business capability first, with each module
keeping a small internal layering model:

```text
api/routes -> modules/*/service -> repository/storage/integrations
```

This keeps TestFlow pragmatic. It avoids the ceremony of strict Clean
Architecture or full DDD, while still creating stable boundaries between API
protocols, business workflows, persistence, file storage, external frameworks,
and SSH integrations.

## Target Layout

```text
backend/app/
  main.py

  core/
    config.py
    logging.py
    errors.py
    lifecycle.py

  db/
    session.py
    migrations.py

  api/
    router.py
    dependencies.py
    routes/
      health.py
      keywords.py
      scripts.py
      executions.py
      commands.py
      reports.py
      terminal.py

  modules/
    keywords/
      schemas.py
      service.py
      repository.py

    scripts/
      schemas.py
      service.py
      repository.py
      validators.py

    executions/
      schemas.py
      service.py
      runner.py
      events.py
      repository.py

    commands/
      schemas.py
      models.py
      service.py
      repository.py

    reports/
      schemas.py
      service.py
      repository.py

    terminal/
      schemas.py
      service.py
      websocket.py

  integrations/
    ssh/
      client.py

  storage/
    yaml_store.py
    file_store.py
```

`backend/autotest/` should remain as the automation framework adapter boundary
for now, because the Phase 6/7 design already defines it as the replaceable
integration point between TestFlow and the future real framework:

```text
backend/autotest/
  contracts.py
  entry.py
  mock_runtime.py
```

If the real framework integration later benefits from being grouped under
`app/integrations/autotest`, that move can happen after the adapter contract is
stable. It should not be part of the initial architecture cleanup.

## Layer Responsibilities

### API Layer

The API layer owns HTTP and WebSocket protocol details only.

Responsibilities:

- Register route groups.
- Parse path, query, body, and WebSocket messages.
- Resolve dependencies from app state.
- Call module services.
- Convert service results into API responses.
- Convert domain/application errors into HTTP status codes and common error
  response shapes.

The API layer must not:

- Read or write YAML files.
- Create SQLModel sessions directly.
- Import `asyncssh`.
- Import `autotest.entry`.
- Decide task lifecycle transitions.
- Return framework-native objects directly to the frontend.

### Module Service Layer

The service layer owns business use cases.

Examples:

- Create, update, list, publish, and delete scripts.
- Load keyword metadata and validate script steps.
- Create, run, cancel, list, and inspect execution tasks.
- Maintain command templates.
- Open and manage terminal sessions.
- Build report summaries and report details.

Services may coordinate repositories, storage helpers, event buses, and
integrations. They should return TestFlow application models or schema objects,
not FastAPI `Response` objects.

### Repository Layer

Repositories own persistence details.

Examples:

- `scripts.repository` reads and writes script records or script YAML indexes.
- `commands.repository` reads and writes SQLModel command template records.
- `executions.repository` persists task snapshots, history, step results, and
  report indexes.
- `reports.repository` reads report metadata and report detail records.

Repositories should not know about HTTP status codes, route handlers, or
frontend response shapes.

### Storage Layer

Storage helpers own low-level filesystem operations.

Examples:

- YAML load and dump.
- Safe file path construction.
- Report directory creation.
- Attachment path normalization.
- Log file append helpers when the behavior is not execution-specific.

Storage helpers should be reusable by repositories and services, but they should
not encode feature-specific workflows.

### Integration Layer

Integrations own external systems and libraries.

Examples:

- `backend/autotest` adapts TestFlow execution requests into automation
  framework calls and yields standard framework events.
- `integrations/ssh/client.py` wraps `asyncssh` connection and process handling.

Integrations should not write platform database records, publish FastAPI
WebSocket messages directly, or decide public API response shapes.

### Core and Database

`core` owns cross-cutting application concerns:

- Settings.
- Logging configuration.
- Common errors and exception handlers.
- FastAPI lifespan setup and shutdown.

`db` owns database setup:

- Engine/session creation.
- Schema initialization during the current MVP.
- Alembic integration when migrations are introduced.

## Module Design

### Keywords

The keywords module owns keyword metadata and keyword lookup.

Initial responsibilities:

- Load keyword metadata from configured YAML.
- Fall back to bundled default keyword metadata.
- Normalize keyword data into Pydantic schemas.
- Provide keyword lookup for script validation and execution preparation.

Future responsibilities:

- Discover keywords from the real automation framework.
- Support disabled or deprecated keywords.
- Support generated metadata from function decorators or framework scans.

### Scripts

The scripts module owns user-authored test scripts.

Initial responsibilities:

- Define script schemas, steps, variables, versions, and summaries.
- Read and write script YAML files.
- Validate published scripts against keyword metadata.
- Maintain script revision metadata.
- Delete scripts.

Recommended split:

- `schemas.py`: `TestScript`, `ScriptStep`, `ScriptVariable`,
  `ScriptSummary`, and validation issue schemas.
- `validators.py`: keyword and parameter validation.
- `repository.py`: YAML-backed script persistence.
- `service.py`: use cases such as save, publish validation, list, read, delete.

### Executions

The executions module owns TestFlow task lifecycle and platform execution state.

Initial responsibilities:

- Create execution tasks from saved scripts.
- Maintain the serial execution queue.
- Track task and step status transitions.
- Handle cancellation.
- Write execution logs.
- Publish task and log events for WebSocket subscribers.
- Call the automation adapter through the existing `backend/autotest` contract.

Recommended split:

- `schemas.py`: public execution task, step, summary, log, and event schemas.
- `events.py`: event bus and subscriber management.
- `runner.py`: worker loop, adapter event handling, status transitions.
- `repository.py`: task history and report persistence when Phase 7 lands.
- `service.py`: API-facing use cases such as create, list, get, cancel, wait.

For the MVP, in-memory task storage may remain inside the service or runner
while persistence is not finished. Once history and report detail APIs are
added, task state should be persisted through `executions.repository`.

### Commands

The commands module owns SSH command templates.

Initial responsibilities:

- Define command template payload and response schemas.
- Define SQLModel command template records.
- Create, update, list, search, and delete command templates.
- Normalize tags.

Recommended split:

- `models.py`: SQLModel table records.
- `schemas.py`: API/application payload and response schemas.
- `repository.py`: SQLModel queries and mutations.
- `service.py`: search behavior, normalization, and use case methods.

### Terminal

The terminal module owns interactive SSH terminal behavior.

Initial responsibilities:

- Parse WebSocket messages.
- Validate SSH connection requests.
- Relay input, output, resize, disconnect, and status messages.
- Redact secrets before sending messages to the frontend.
- Use an SSH integration client instead of importing `asyncssh` directly in
  WebSocket orchestration code.

Recommended split:

- `schemas.py`: WebSocket message schemas.
- `websocket.py`: protocol loop and frontend message handling.
- `service.py`: terminal session lifecycle orchestration.
- `integrations/ssh/client.py`: asyncssh wrapper.

### Reports

The reports module owns execution report lookup and presentation data.

Initial responsibilities:

- Keep `/api/reports` stable while report persistence is not implemented.
- Later list report summaries from execution history.
- Read normalized report detail data.
- Include raw framework report links as supplementary attachments, not as the
  primary frontend model.

Reports should reuse execution status vocabulary instead of creating a separate
report-only status model.

## Dependency Rules

The following rules are intended to keep the structure easy to reason about:

1. Route modules may import schemas, services, dependencies, and core errors.
2. Route modules must not import repositories, storage helpers, `asyncssh`, or
   `autotest.entry`.
3. Services may import repositories, storage helpers, module schemas, core
   settings, event buses, and integrations.
4. Repositories may import database sessions, SQLModel records, storage helpers,
   and schemas needed for mapping.
5. Repositories must not import FastAPI route objects or WebSocket types.
6. Integrations must not import API routes or write platform database records.
7. Public API schemas should be TestFlow-owned models, not raw framework,
   SQLModel, or third-party library objects.
8. Cross-module calls should go through service interfaces when there is
   behavior involved. Direct schema imports are fine.

## Current File Migration Map

```text
app/config.py              -> app/core/config.py
app/logging.py             -> app/core/logging.py
app/errors.py              -> app/core/errors.py
app/db.py                  -> app/db/session.py and app/core/lifecycle.py

app/api/__init__.py        -> app/api/router.py and app/api/routes/*

app/script_catalog.py      -> app/modules/scripts/*
                            -> app/modules/keywords/*

app/command_library.py     -> app/modules/commands/*

app/execution/models.py    -> app/modules/executions/schemas.py
app/execution/events.py    -> app/modules/executions/events.py
app/execution/service.py   -> app/modules/executions/service.py
                            -> app/modules/executions/runner.py
                            -> app/modules/executions/repository.py

app/ssh_terminal.py        -> app/modules/terminal/*
                            -> app/integrations/ssh/client.py

backend/autotest/*         -> keep as backend/autotest/* for now
```

Compatibility imports may be used briefly during migration, but the final
structure should remove old top-level business modules once tests are updated.

## API Compatibility

The architecture cleanup should preserve the existing external API while the
frontend is already using it:

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

Breaking API changes should be handled as separate product decisions, not as
side effects of moving files.

## Error Handling

Use common TestFlow application errors inside services and repositories. API
routes should translate them into the existing common error response format:

```json
{
  "error": {
    "code": "not_found",
    "message": "Resource not found",
    "details": {}
  }
}
```

Recommended categories:

- `NotFoundError`
- `ValidationError`
- `ConflictError`
- `ExecutionError`
- `IntegrationError`

Services should raise application errors. Routes should choose HTTP status codes.
Repositories may raise lower-level errors only when the service can convert
them into application errors.

## Lifespan and App State

Application startup should become explicit and small:

1. Resolve settings.
2. Configure logging.
3. Ensure data directories and database schema exist.
4. Create long-lived services, such as the execution service.
5. Start background workers.
6. Stop background workers on shutdown.

`main.py` should mostly create the FastAPI app, attach settings/state, register
middleware, register exception handlers, and include the top-level router.

## Incremental Migration Plan

### Phase 1: Split API Routes

Create `app/api/router.py`, `app/api/dependencies.py`, and
`app/api/routes/*.py`.

Keep existing service functions where they are. This phase is mostly a route
organization change and should preserve behavior exactly.

### Phase 2: Move Core and DB Infrastructure

Move settings, logging, errors, and database setup into `core` and `db`.

Add compatibility imports only if needed to avoid a large simultaneous rewrite.
Remove compatibility imports once all references are updated.

### Phase 3: Extract Scripts and Keywords Modules

Split `script_catalog.py` into scripts and keywords modules.

Move YAML persistence into `scripts.repository` and keyword loading into
`keywords.repository` or `keywords.service`. Keep script validation in
`scripts.validators`.

### Phase 4: Extract Commands Module

Split SQLModel record, payload schemas, repository queries, and service behavior
from `command_library.py`.

This is a good early persistence-layer example because the command module is
small and already backed by SQLite.

### Phase 5: Refine Executions Module

Move execution models to schemas, separate runner concerns from service use
cases, and prepare repository interfaces for history and report persistence.

Keep the existing `backend/autotest` contract stable.

### Phase 6: Extract Terminal and SSH Integration

Separate WebSocket protocol handling from SSH client operations.

Keep secret redaction and error handling behavior covered by tests.

### Phase 7: Add Reports Repository and History Persistence

Use the new execution repository to persist task snapshots, step results, log
references, attachment references, and report metadata.

Change `/api/reports` from a placeholder to a real report list only after the
data model is implemented and tested.

## Testing Strategy

Architecture migration should be test-preserving.

Run these backend checks after each phase:

```text
pnpm test:backend
pnpm check:backend
```

When a module is moved, add or update focused tests for the layer being
introduced:

- Route tests cover API status codes, response shapes, and error mapping.
- Service tests cover business workflows and state transitions.
- Repository tests cover persistence behavior and sorting/filtering.
- Integration tests cover adapter boundaries with mock clients or runtimes.

Existing behavior tests should remain the source of truth during migration:

- Health startup and route registration.
- Script catalog listing, saving, validation, and deletion.
- Command template CRUD and search.
- Execution task lifecycle, cancellation, event publishing, and failure paths.
- SSH terminal connection, relay, disconnect, and secret redaction.

## Non-Goals

This architecture design does not require:

- Rewriting the backend in one large change.
- Introducing strict DDD aggregates and value objects everywhere.
- Changing public API contracts.
- Moving `backend/autotest` immediately.
- Implementing Phase 7 execution history or reports before the module
  boundaries are ready.
- Adding a new dependency injection framework.

## Success Criteria

The architecture refactor is successful when:

- Route files are small and protocol-focused.
- Feature behavior lives in module services.
- YAML, SQLite, and file storage details are no longer mixed into route
  handlers.
- SSH and automation framework dependencies are isolated behind integration
  boundaries.
- Execution and report persistence can be added without another major
  restructuring.
- Existing backend tests pass throughout the migration.
- New module-level tests make future changes easier to localize.
