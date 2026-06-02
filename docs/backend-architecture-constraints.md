# Backend Architecture Constraints

This document is the short, enforceable backend architecture guide for daily
development. For the fuller design rationale, see
`docs/superpowers/specs/2026-06-02-backend-architecture-design.md`.

## Architecture Style

The backend uses a modular layered architecture:

```text
api/routes -> modules/*/service -> repository/storage/integrations
```

Business capabilities live under `backend/app/modules/<domain>/`. Cross-cutting
application infrastructure lives under `backend/app/core/` and `backend/app/db/`.
External systems live under `backend/app/integrations/` or another explicit
adapter boundary such as `backend/autotest/`.

## Directory Rules

- `backend/app/api/routes/` contains FastAPI HTTP and WebSocket route handlers.
- `backend/app/modules/<domain>/schemas.py` contains Pydantic API/application
  models.
- `backend/app/modules/<domain>/models.py` contains SQLModel table models.
- `backend/app/modules/<domain>/repository.py` contains persistence operations
  such as SQLite, YAML, file indexes, or report indexes.
- `backend/app/modules/<domain>/service.py` contains business use cases and
  orchestration.
- `backend/app/modules/<domain>/validators.py`, `runner.py`, or `websocket.py`
  may be added when the domain needs that responsibility.
- `backend/app/core/` contains settings, logging, common errors, and lifecycle
  helpers only.
- `backend/app/db/` contains database engine/session/schema initialization and
  migration-related code only.
- `backend/app/integrations/` contains wrappers around external libraries and
  systems, such as SSH or future external services.

Do not add new top-level business modules under `backend/app/`. Add or extend a
domain package under `backend/app/modules/` instead.

## Dependency Rules

- Route modules may import services, schemas, dependencies, and common errors.
- Route modules must not directly read or write YAML, SQLite, logs, reports, or
  local data files.
- Route modules must not directly call `asyncssh`, `autotest.entry`, or other
  external adapters.
- Services may coordinate repositories, validators, runners, event buses,
  storage helpers, and integrations.
- Repositories must not import FastAPI route modules, `Request`, `Response`, or
  `WebSocket`.
- Integrations must not decide public API response shapes or write platform
  database records directly.
- Public API schemas should be TestFlow-owned models, not raw SQLModel records,
  framework objects, or third-party library objects.
- Preserve the dependency direction:

```text
api/routes
  -> modules/<domain>/service
    -> modules/<domain>/repository
    -> modules/<domain>/validators
    -> modules/<domain>/runner
    -> integrations
```

## Compatibility Shims

The following top-level modules are compatibility shims for older imports:

- `app.config`
- `app.errors`
- `app.logging`
- `app.command_library`
- `app.script_catalog`
- `app.ssh_terminal`
- `app.execution.*`

New or modified application code should prefer canonical imports:

- `app.core.*`
- `app.db.*`
- `app.modules.*`
- `app.integrations.*`

Keep shims thin. They should re-export canonical objects and avoid adding new
business logic.

## Adapter Boundaries

- SSH and `asyncssh` logic belongs under `app.integrations.ssh` and
  `app.modules.terminal`.
- Execution adapter calls to the automation framework go through
  `backend/autotest`.
- Execution service and runner code should expose TestFlow execution models to
  the API. Do not leak framework-native objects to frontend responses or
  WebSocket messages.

## Testing Rules

- Keep public API compatibility unless a breaking change is explicitly approved.
- When moving a module, add or preserve regression tests for legacy imports and
  public API behavior.
- For backend route, service, repository, adapter, or data-processing changes,
  run:

```text
pnpm test:backend
pnpm check:backend
```

- Route tests should cover status codes, response shapes, and error mapping.
- Service tests should cover business workflows and state transitions.
- Repository tests should cover persistence behavior, filtering, and sorting.
- Integration tests should use fake clients or mock runtimes where possible.

## Migration Rules

- Move one domain at a time.
- Keep commits focused.
- Preserve legacy imports until tests and application code no longer need them.
- Do not combine architecture migration with unrelated product behavior changes.
- If a migration requires a public API change, document that as a separate
  product decision before implementation.
