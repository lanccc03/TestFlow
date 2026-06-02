# Backend Core DB Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move backend cross-cutting configuration, logging, errors, and database setup into `app/core` and `app/db` while preserving current imports and behavior.

**Architecture:** This is Phase 2 of the approved modular layered backend architecture. The new canonical modules become `app.core.config`, `app.core.logging`, `app.core.errors`, and `app.db.session`; old top-level modules remain as compatibility shims so later feature-module migrations can update imports gradually.

**Tech Stack:** FastAPI, Pydantic Settings, SQLModel, SQLAlchemy, pytest, Ruff, pnpm backend scripts.

---

## Scope

This plan migrates only cross-cutting backend infrastructure:

- Settings and environment configuration.
- Common error responses and exception handlers.
- Logging setup.
- Database engine creation, schema setup, and MVP migration marker.

It intentionally does not move:

- Script catalog behavior.
- Command library behavior.
- Execution service behavior.
- SSH terminal behavior.
- API route structure from Phase 1.

Public behavior and existing import paths must continue working.

## File Structure

Create:

- `backend/app/core/__init__.py`
  - Marks the core package.
- `backend/app/core/config.py`
  - Canonical home for `PROJECT_ROOT`, `Settings`, and `get_settings`.
- `backend/app/core/errors.py`
  - Canonical home for `error_response` and `register_exception_handlers`.
- `backend/app/core/logging.py`
  - Canonical home for `configure_logging`.
- `backend/app/db/__init__.py`
  - Re-exports database helpers.
- `backend/app/db/session.py`
  - Canonical home for `create_db_engine`, `ensure_database`, and
    `run_migrations`.

Modify:

- `backend/app/config.py`
  - Replace with compatibility imports from `app.core.config`.
- `backend/app/errors.py`
  - Replace with compatibility imports from `app.core.errors`.
- `backend/app/logging.py`
  - Replace with compatibility imports from `app.core.logging`.
- `backend/app/db.py`
  - Delete after `app/db/__init__.py` becomes the canonical `app.db` import
    target.
- `backend/app/main.py`
  - Use canonical `core` and `db` imports.
- `backend/app/api/routes/commands.py`
  - Use canonical error import.
- `backend/app/api/routes/executions.py`
  - Use canonical error import.
- `backend/app/api/routes/scripts.py`
  - Use canonical error import.
- `backend/app/command_library.py`
  - Use canonical settings import.
- `backend/app/script_catalog.py`
  - Use canonical settings import.
- `backend/app/execution/service.py`
  - Use canonical settings import.
- `backend/tests/test_app_foundation.py`
  - Add import compatibility regression tests.

Do not modify:

- `backend/autotest/*`
- `apps/*`
- `backend/app/api/router.py`
- `backend/app/api/routes/health.py`
- `backend/app/api/routes/keywords.py`
- `backend/app/api/routes/reports.py`
- `backend/app/api/routes/terminal.py`
- `backend/app/api/routes/websockets.py`

## Task 1: Add Compatibility Regression Tests

**Files:**

- Modify: `backend/tests/test_app_foundation.py`

- [ ] **Step 1: Add core/db import compatibility test**

Append this test to `backend/tests/test_app_foundation.py`:

```python
def test_core_and_db_imports_remain_compatible() -> None:
    from app.config import Settings as LegacySettings
    from app.config import get_settings as legacy_get_settings
    from app.core.config import Settings
    from app.core.config import get_settings
    from app.core.errors import error_response
    from app.core.logging import configure_logging
    from app.db import create_db_engine, ensure_database, run_migrations
    from app.db.session import create_db_engine as canonical_create_db_engine
    from app.errors import error_response as legacy_error_response
    from app.logging import configure_logging as legacy_configure_logging

    assert LegacySettings is Settings
    assert legacy_get_settings is get_settings
    assert legacy_error_response is error_response
    assert legacy_configure_logging is configure_logging
    assert create_db_engine is canonical_create_db_engine
    assert ensure_database.__name__ == "ensure_database"
    assert run_migrations.__name__ == "run_migrations"
```

- [ ] **Step 2: Run the new test and verify it fails before implementation**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py::test_core_and_db_imports_remain_compatible -v
```

Expected result:

```text
ModuleNotFoundError: No module named 'app.core'
```

- [ ] **Step 3: Keep the failing test uncommitted until Task 3**

Do not commit `backend/tests/test_app_foundation.py` yet. The new test becomes
green after the canonical modules and compatibility shims are in place.

Confirm the uncommitted test change:

```powershell
git status --short
```

Expected output includes:

```text
 M backend/tests/test_app_foundation.py
```

## Task 2: Create Canonical Core Modules

**Files:**

- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/errors.py`
- Create: `backend/app/core/logging.py`

- [ ] **Step 1: Create the core package marker**

Create `backend/app/core/__init__.py` with:

```python
"""Core application infrastructure."""
```

- [ ] **Step 2: Create canonical config module**

Create `backend/app/core/config.py` with the current contents of
`backend/app/config.py`:

```python
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TESTFLOW_", extra="ignore")

    service_name: str = "testflow-backend"
    version: str = "0.1.0"
    data_dir: Path = Field(default=PROJECT_ROOT / "data")
    host: str = "127.0.0.1"
    port: int = 8000

    @property
    def scripts_dir(self) -> Path:
        return self.data_dir / "scripts"

    @property
    def keyword_config_path(self) -> Path:
        return self.data_dir / "keywords.yaml"

    @property
    def reports_dir(self) -> Path:
        return self.data_dir / "reports"

    @property
    def logs_dir(self) -> Path:
        return self.data_dir / "logs"

    @property
    def database_path(self) -> Path:
        return self.data_dir / "testflow.sqlite3"

    @property
    def app_log_path(self) -> Path:
        return self.logs_dir / "app.log"

    @property
    def execution_log_path(self) -> Path:
        return self.logs_dir / "execution.log"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

The `PROJECT_ROOT` parent count changes from `parents[2]` to `parents[3]`
because `config.py` moves from `backend/app` to `backend/app/core`.

- [ ] **Step 3: Create canonical errors module**

Create `backend/app/core/errors.py` with the current contents of
`backend/app/errors.py`:

```python
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


def error_response(
    *,
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | list[Any] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
            }
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(
        _request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        code = "not_found" if exc.status_code == 404 else "http_error"
        return error_response(
            status_code=exc.status_code,
            code=code,
            message=str(exc.detail),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_exception(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return error_response(
            status_code=422,
            code="validation_error",
            message="Request validation failed",
            details=exc.errors(),
        )
```

- [ ] **Step 4: Create canonical logging module**

Create `backend/app/core/logging.py` with the current logging behavior and a
canonical settings import:

```python
import logging
from pathlib import Path

from app.core.config import Settings


def configure_logging(settings: Settings) -> None:
    settings.logs_dir.mkdir(parents=True, exist_ok=True)
    settings.app_log_path.touch(exist_ok=True)
    settings.execution_log_path.touch(exist_ok=True)

    _configure_file_logger("testflow.app", settings.app_log_path)
    _configure_file_logger("testflow.execution", settings.execution_log_path)


def _configure_file_logger(name: str, path: Path) -> None:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    logger.propagate = False

    for handler in list(logger.handlers):
        if getattr(handler, "_testflow_managed", False):
            logger.removeHandler(handler)
            handler.close()

    file_handler = logging.FileHandler(path)
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
    )
    file_handler._testflow_managed = True  # type: ignore[attr-defined]
    logger.addHandler(file_handler)
```

- [ ] **Step 5: Run core import smoke checks**

Run:

```powershell
cd backend
uv run python -c "from app.core.config import PROJECT_ROOT, Settings; print(PROJECT_ROOT.name, Settings().service_name)"
uv run python -c "from app.core.errors import error_response; print(error_response.__name__)"
uv run python -c "from app.core.logging import configure_logging; print(configure_logging.__name__)"
```

Expected output:

```text
TestFlow testflow-backend
error_response
configure_logging
```

- [ ] **Step 6: Commit canonical core modules**

Run:

```powershell
git add backend/app/core/__init__.py backend/app/core/config.py backend/app/core/errors.py backend/app/core/logging.py
git commit -m "add core infrastructure modules"
```

## Task 3: Create Canonical DB Module and Compatibility Shims

**Files:**

- Create: `backend/app/db/__init__.py`
- Create: `backend/app/db/session.py`
- Modify: `backend/app/config.py`
- Modify: `backend/app/errors.py`
- Modify: `backend/app/logging.py`
- Delete: `backend/app/db.py`
- Modify: `backend/tests/test_app_foundation.py`

- [ ] **Step 1: Create canonical database session module**

Create `backend/app/db/session.py` with the current database setup behavior and
a canonical settings import:

```python
from sqlalchemy import Engine, text
from sqlmodel import SQLModel, create_engine

import app.command_library  # noqa: F401
from app.core.config import Settings


def create_db_engine(settings: Settings) -> Engine:
    return create_engine(f"sqlite:///{settings.database_path}", echo=False)


def ensure_database(settings: Settings) -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.scripts_dir.mkdir(parents=True, exist_ok=True)
    settings.reports_dir.mkdir(parents=True, exist_ok=True)

    engine = create_db_engine(settings)
    SQLModel.metadata.create_all(engine)
    run_migrations(engine)


def run_migrations(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE IF NOT EXISTS alembic_version (version_num TEXT)")
        )
        version = connection.execute(
            text("SELECT version_num FROM alembic_version LIMIT 1")
        ).scalar_one_or_none()
        if version is None:
            connection.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:version)"),
                {"version": "phase_1"},
            )
```

- [ ] **Step 2: Create db package exports**

Create `backend/app/db/__init__.py` with:

```python
from app.db.session import create_db_engine, ensure_database, run_migrations

__all__ = ["create_db_engine", "ensure_database", "run_migrations"]
```

- [ ] **Step 3: Replace legacy config module with a shim**

Replace the full contents of `backend/app/config.py` with:

```python
from app.core.config import PROJECT_ROOT, Settings, get_settings

__all__ = ["PROJECT_ROOT", "Settings", "get_settings"]
```

- [ ] **Step 4: Replace legacy errors module with a shim**

Replace the full contents of `backend/app/errors.py` with:

```python
from app.core.errors import error_response, register_exception_handlers

__all__ = ["error_response", "register_exception_handlers"]
```

- [ ] **Step 5: Replace legacy logging module with a shim**

Replace the full contents of `backend/app/logging.py` with:

```python
from app.core.logging import configure_logging

__all__ = ["configure_logging"]
```

- [ ] **Step 6: Delete the legacy database module**

Delete `backend/app/db.py`. After `backend/app/db/__init__.py` exists,
`from app.db import ensure_database` resolves through the package and remains
compatible.

Run:

```powershell
Remove-Item -LiteralPath backend/app/db.py
```

- [ ] **Step 7: Run the compatibility regression test**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py::test_core_and_db_imports_remain_compatible -v
```

Expected result:

```text
passed
```

- [ ] **Step 8: Run startup foundation test**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py::test_startup_creates_data_directories_database_and_log_files -v
```

Expected result:

```text
passed
```

- [ ] **Step 9: Commit db module and compatibility shims**

Run:

```powershell
git add backend/app/db/__init__.py backend/app/db/session.py backend/app/config.py backend/app/errors.py backend/app/logging.py backend/tests/test_app_foundation.py
git add -A backend/app/db.py
git commit -m "add core db compatibility shims"
```

## Task 4: Update Canonical Imports in Main and API Routes

**Files:**

- Modify: `backend/app/main.py`
- Modify: `backend/app/api/routes/commands.py`
- Modify: `backend/app/api/routes/executions.py`
- Modify: `backend/app/api/routes/scripts.py`

- [ ] **Step 1: Update main imports**

In `backend/app/main.py`, replace:

```python
from app.config import Settings, get_settings
from app.db import ensure_database
from app.errors import register_exception_handlers
from app.logging import configure_logging
```

with:

```python
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.db.session import ensure_database
```

- [ ] **Step 2: Update route error imports**

In these files:

- `backend/app/api/routes/commands.py`
- `backend/app/api/routes/executions.py`
- `backend/app/api/routes/scripts.py`

Replace:

```python
from app.errors import error_response
```

with:

```python
from app.core.errors import error_response
```

- [ ] **Step 3: Run route and foundation tests**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py tests/test_command_library.py tests/test_execution_service.py tests/test_script_catalog.py -v
```

Expected result:

```text
passed
```

- [ ] **Step 4: Commit canonical main and route imports**

Run:

```powershell
git add backend/app/main.py backend/app/api/routes/commands.py backend/app/api/routes/executions.py backend/app/api/routes/scripts.py
git commit -m "use core imports in api layer"
```

## Task 5: Update Canonical Settings Imports in Business Modules

**Files:**

- Modify: `backend/app/command_library.py`
- Modify: `backend/app/script_catalog.py`
- Modify: `backend/app/execution/service.py`

- [ ] **Step 1: Update command library settings import**

In `backend/app/command_library.py`, replace:

```python
from app.config import Settings
```

with:

```python
from app.core.config import Settings
```

- [ ] **Step 2: Update script catalog settings import**

In `backend/app/script_catalog.py`, replace:

```python
from app.config import Settings
```

with:

```python
from app.core.config import Settings
```

- [ ] **Step 3: Update execution service settings import**

In `backend/app/execution/service.py`, replace:

```python
from app.config import Settings
```

with:

```python
from app.core.config import Settings
```

- [ ] **Step 4: Verify no app code still depends on legacy infrastructure imports**

Run:

```powershell
rg "from app\.(config|errors|logging)|from app\.db import|import app\.(config|errors|logging)" backend/app
```

Expected result:

```text
No matches.
```

This confirms application code uses `app.core.*` and `app.db.session` for
internal infrastructure dependencies. Tests may continue importing
`app.config.Settings` to verify compatibility.

- [ ] **Step 5: Run affected module tests**

Run:

```powershell
pnpm test:backend -- tests/test_command_library.py tests/test_script_catalog.py tests/test_execution_service.py -v
```

Expected result:

```text
passed
```

- [ ] **Step 6: Commit canonical business module imports**

Run:

```powershell
git add backend/app/command_library.py backend/app/script_catalog.py backend/app/execution/service.py
git commit -m "use core settings imports"
```

## Task 6: Run Full Backend Verification

**Files:**

- No source edits expected.

- [ ] **Step 1: Run all backend tests**

Run:

```powershell
pnpm test:backend
```

Expected result:

```text
51 passed
```

- [ ] **Step 2: Run backend lint check**

Run:

```powershell
pnpm check:backend
```

Expected result:

```text
All checks passed!
```

- [ ] **Step 3: Inspect final status**

Run:

```powershell
git status --short
git diff --stat HEAD
```

Expected result:

```text
No uncommitted source changes after the final verification commit, or only the current task changes ready to commit.
```

- [ ] **Step 4: Commit verification-only edits only if files changed**

If no files changed, do not commit. If formatting or import order changed files,
commit them with:

```powershell
git add backend/app backend/tests
git commit -m "verify core db migration"
```

## Self-Review

Spec coverage:

- Core config, logging, and errors move is covered by Tasks 2 through 4.
- Database setup move is covered by Task 3.
- Compatibility imports are covered by Task 3 and the regression test.
- Later feature-module extraction remains intentionally out of scope.

Completion wording scan:

- No steps contain unspecified implementation work.
- Every source edit step includes concrete file paths and code.

Type consistency:

- `Settings` and `get_settings` remain the same exported objects through legacy
  and canonical imports.
- `create_db_engine`, `ensure_database`, and `run_migrations` remain available
  from `app.db`.
- `main.py` continues to include the existing API routers and lifespan behavior.

## Execution Handoff

Plan complete and saved to
`docs/superpowers/plans/2026-06-02-backend-core-db-migration-plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task,
   review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using
   executing-plans, batch execution with checkpoints.
