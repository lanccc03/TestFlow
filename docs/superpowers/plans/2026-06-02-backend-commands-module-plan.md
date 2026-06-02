# Backend Commands Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `app/command_library.py` into a focused `modules/commands` package while preserving command template API behavior and database schema creation.

**Architecture:** This is Phase 4 of the approved modular layered backend architecture. SQLModel table records move to `app.modules.commands.models`, API/application schemas move to `schemas`, database access moves to `repository`, command use cases move to `service`, and `app.command_library` remains a compatibility shim.

**Tech Stack:** FastAPI, Pydantic, SQLModel, SQLite, pytest, Ruff, pnpm backend scripts.

---

## Scope

This plan migrates only command template behavior.

It intentionally does not move:

- Execution task persistence.
- Report persistence.
- Generic database session management beyond the command repository.
- SSH terminal behavior.
- Scripts or keywords modules, which were completed in Phase 3.

Public API behavior must remain unchanged for:

- `GET /api/commands`
- `POST /api/commands`
- `PUT /api/commands/{command_id}`
- `DELETE /api/commands/{command_id}`

Database behavior must remain unchanged:

- Startup creates the `command_templates` table.
- Existing command template rows use the same table and column names.
- Tags remain stored in `tags_json` as JSON text.

## File Structure

Create:

- `backend/app/modules/commands/__init__.py`
  - Re-exports canonical command schemas and service functions.
- `backend/app/modules/commands/models.py`
  - Holds `CommandTemplateRecord` SQLModel table and `_utc_now`.
- `backend/app/modules/commands/schemas.py`
  - Holds `CommandTemplatePayload` and `CommandTemplateResponse`.
- `backend/app/modules/commands/repository.py`
  - Holds SQLModel session and CRUD persistence functions.
- `backend/app/modules/commands/service.py`
  - Holds search, mapping, and use-case functions.

Modify:

- `backend/app/command_library.py`
  - Replace with compatibility shim exports.
- `backend/app/api/routes/commands.py`
  - Import from `app.modules.commands`.
- `backend/app/db/session.py`
  - Import `app.modules.commands.models` for SQLModel metadata registration.
- `backend/tests/test_app_foundation.py`
  - Add compatibility regression test.

Do not modify:

- `backend/app/modules/scripts/*`
- `backend/app/modules/keywords/*`
- `backend/app/execution/*`
- `backend/autotest/*`

## Task 1: Add Command Module Import Regression Test

**Files:**

- Modify: `backend/tests/test_app_foundation.py`

- [ ] **Step 1: Add command module compatibility test**

Append this test to `backend/tests/test_app_foundation.py`:

```python
def test_command_module_exports_compatible_library_api() -> None:
    from app.command_library import CommandTemplatePayload as LegacyPayload
    from app.command_library import CommandTemplateRecord as LegacyRecord
    from app.command_library import CommandTemplateResponse as LegacyResponse
    from app.command_library import create_command_template as legacy_create
    from app.command_library import delete_command_template as legacy_delete
    from app.command_library import list_command_templates as legacy_list
    from app.command_library import update_command_template as legacy_update
    from app.modules.commands import CommandTemplatePayload
    from app.modules.commands import CommandTemplateRecord
    from app.modules.commands import CommandTemplateResponse
    from app.modules.commands import create_command_template
    from app.modules.commands import delete_command_template
    from app.modules.commands import list_command_templates
    from app.modules.commands import update_command_template

    assert LegacyPayload is CommandTemplatePayload
    assert LegacyRecord is CommandTemplateRecord
    assert LegacyResponse is CommandTemplateResponse
    assert legacy_create is create_command_template
    assert legacy_delete is delete_command_template
    assert legacy_list is list_command_templates
    assert legacy_update is update_command_template
```

- [ ] **Step 2: Run the new test and verify it fails before implementation**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py::test_command_module_exports_compatible_library_api -v
```

Expected result:

```text
ModuleNotFoundError: No module named 'app.modules.commands'
```

- [ ] **Step 3: Keep the failing test uncommitted until Task 4**

Do not commit `backend/tests/test_app_foundation.py` yet. Task 4 makes this
test pass and commits it with the compatibility shim.

Confirm the uncommitted test change:

```powershell
git status --short
```

Expected output includes:

```text
 M backend/tests/test_app_foundation.py
```

## Task 2: Create Command Models and Schemas

**Files:**

- Create: `backend/app/modules/commands/__init__.py`
- Create: `backend/app/modules/commands/models.py`
- Create: `backend/app/modules/commands/schemas.py`

- [ ] **Step 1: Create command models**

Create `backend/app/modules/commands/models.py` with:

```python
from datetime import UTC, datetime
from uuid import uuid4

from sqlmodel import Field, SQLModel


def _utc_now() -> datetime:
    return datetime.now(UTC)


class CommandTemplateRecord(SQLModel, table=True):
    __tablename__ = "command_templates"

    id: str = Field(default_factory=lambda: uuid4().hex, primary_key=True)
    name: str
    command: str
    description: str = ""
    group: str = ""
    tags_json: str = "[]"
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)
```

- [ ] **Step 2: Create command schemas**

Create `backend/app/modules/commands/schemas.py` with:

```python
from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, field_validator
from pydantic import Field as PydanticField

from app.modules.commands.models import CommandTemplateRecord


class CommandTemplatePayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = PydanticField(min_length=1)
    command: str = PydanticField(min_length=1)
    description: str = ""
    group: str = ""
    tags: list[str] = PydanticField(default_factory=list)

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, value: list[str]) -> list[str]:
        normalized = [tag.strip() for tag in value if tag.strip()]
        return list(dict.fromkeys(normalized))


class CommandTemplateResponse(CommandTemplatePayload):
    id: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_record(cls, record: CommandTemplateRecord) -> Self:
        return cls(
            id=record.id,
            name=record.name,
            command=record.command,
            description=record.description,
            group=record.group,
            tags=_decode_tags(record.tags_json),
            created_at=record.created_at,
            updated_at=record.updated_at,
        )


def _decode_tags(value: str) -> list[str]:
    import json

    try:
        data = json.loads(value)
    except json.JSONDecodeError:
        return []

    if not isinstance(data, list):
        return []

    return [tag for tag in data if isinstance(tag, str)]
```

- [ ] **Step 3: Create temporary command package exports**

Create `backend/app/modules/commands/__init__.py` with:

```python
from app.modules.commands.models import CommandTemplateRecord
from app.modules.commands.schemas import (
    CommandTemplatePayload,
    CommandTemplateResponse,
)

__all__ = [
    "CommandTemplatePayload",
    "CommandTemplateRecord",
    "CommandTemplateResponse",
]
```

- [ ] **Step 4: Run model and schema smoke checks**

Run:

```powershell
cd backend
uv run python -c "from app.modules.commands.models import CommandTemplateRecord; print(CommandTemplateRecord.__tablename__)"
uv run python -c "from app.modules.commands.schemas import CommandTemplatePayload; print(CommandTemplatePayload(name=' Test ', command=' pwd ', tags=[' a ', 'a']).model_dump())"
```

Expected output includes:

```text
command_templates
```

and:

```text
{'name': 'Test', 'command': 'pwd', 'description': '', 'group': '', 'tags': ['a']}
```

- [ ] **Step 5: Commit command models and schemas**

Run:

```powershell
git add backend/app/modules/commands/__init__.py backend/app/modules/commands/models.py backend/app/modules/commands/schemas.py
git commit -m "add command models and schemas"
```

## Task 3: Create Command Repository and Service

**Files:**

- Create: `backend/app/modules/commands/repository.py`
- Create: `backend/app/modules/commands/service.py`
- Modify: `backend/app/modules/commands/__init__.py`

- [ ] **Step 1: Create command repository**

Create `backend/app/modules/commands/repository.py` with:

```python
from sqlmodel import Session, create_engine, select

from app.core.config import Settings
from app.modules.commands.models import CommandTemplateRecord


def list_command_template_records(settings: Settings) -> list[CommandTemplateRecord]:
    with _session(settings) as session:
        return list(session.exec(select(CommandTemplateRecord)).all())


def create_command_template_record(
    settings: Settings,
    record: CommandTemplateRecord,
) -> CommandTemplateRecord:
    with _session(settings) as session:
        session.add(record)
        session.commit()
        session.refresh(record)
        return record


def get_command_template_record(
    settings: Settings,
    command_id: str,
) -> CommandTemplateRecord | None:
    with _session(settings) as session:
        return session.get(CommandTemplateRecord, command_id)


def update_command_template_record(
    settings: Settings,
    record: CommandTemplateRecord,
) -> CommandTemplateRecord:
    with _session(settings) as session:
        session.add(record)
        session.commit()
        session.refresh(record)
        return record


def delete_command_template_record(settings: Settings, command_id: str) -> bool:
    with _session(settings) as session:
        record = session.get(CommandTemplateRecord, command_id)
        if record is None:
            return False

        session.delete(record)
        session.commit()
        return True


def _session(settings: Settings) -> Session:
    return Session(create_engine(f"sqlite:///{settings.database_path}", echo=False))
```

- [ ] **Step 2: Create command service**

Create `backend/app/modules/commands/service.py` with:

```python
import json

from app.core.config import Settings
from app.modules.commands.models import CommandTemplateRecord, _utc_now
from app.modules.commands.repository import (
    create_command_template_record,
    delete_command_template_record,
    get_command_template_record,
    list_command_template_records,
    update_command_template_record,
)
from app.modules.commands.schemas import (
    CommandTemplatePayload,
    CommandTemplateResponse,
)


def list_command_templates(
    settings: Settings,
    search: str = "",
) -> list[CommandTemplateResponse]:
    query = search.strip().lower()
    records = list_command_template_records(settings)

    templates = [CommandTemplateResponse.from_record(record) for record in records]
    if query:
        templates = [
            template
            for template in templates
            if query
            in " ".join(
                [
                    template.name,
                    template.command,
                    template.description,
                    template.group,
                    *template.tags,
                ]
            ).lower()
        ]

    return sorted(templates, key=lambda template: template.updated_at, reverse=True)


def create_command_template(
    settings: Settings,
    payload: CommandTemplatePayload,
) -> CommandTemplateResponse:
    now = _utc_now()
    record = CommandTemplateRecord(
        name=payload.name,
        command=payload.command,
        description=payload.description,
        group=payload.group,
        tags_json=json.dumps(payload.tags, ensure_ascii=False),
        created_at=now,
        updated_at=now,
    )
    created = create_command_template_record(settings, record)
    return CommandTemplateResponse.from_record(created)


def update_command_template(
    settings: Settings,
    command_id: str,
    payload: CommandTemplatePayload,
) -> CommandTemplateResponse | None:
    record = get_command_template_record(settings, command_id)
    if record is None:
        return None

    record.name = payload.name
    record.command = payload.command
    record.description = payload.description
    record.group = payload.group
    record.tags_json = json.dumps(payload.tags, ensure_ascii=False)
    record.updated_at = _utc_now()
    updated = update_command_template_record(settings, record)
    return CommandTemplateResponse.from_record(updated)


def delete_command_template(settings: Settings, command_id: str) -> bool:
    return delete_command_template_record(settings, command_id)
```

- [ ] **Step 3: Update command package exports**

Replace `backend/app/modules/commands/__init__.py` with:

```python
from app.modules.commands.models import CommandTemplateRecord
from app.modules.commands.schemas import (
    CommandTemplatePayload,
    CommandTemplateResponse,
)
from app.modules.commands.service import (
    create_command_template,
    delete_command_template,
    list_command_templates,
    update_command_template,
)

__all__ = [
    "CommandTemplatePayload",
    "CommandTemplateRecord",
    "CommandTemplateResponse",
    "create_command_template",
    "delete_command_template",
    "list_command_templates",
    "update_command_template",
]
```

- [ ] **Step 4: Run command service smoke check**

Run:

```powershell
cd backend
uv run python -c "from pathlib import Path; from tempfile import TemporaryDirectory; from app.core.config import Settings; from app.db.session import ensure_database; from app.modules.commands import CommandTemplatePayload, create_command_template, list_command_templates; tmp=TemporaryDirectory(); settings=Settings(data_dir=Path(tmp.name)); ensure_database(settings); created=create_command_template(settings, CommandTemplatePayload(name='Logs', command='tail -f app.log', tags=['logs'])); print(created.name, list_command_templates(settings, 'tail')[0].id == created.id); tmp.cleanup()"
```

Expected output:

```text
Logs True
```

- [ ] **Step 5: Commit command repository and service**

Run:

```powershell
git add backend/app/modules/commands/__init__.py backend/app/modules/commands/repository.py backend/app/modules/commands/service.py
git commit -m "add command repository service"
```

## Task 4: Replace Command Library With Compatibility Shim

**Files:**

- Modify: `backend/app/command_library.py`
- Modify: `backend/app/db/session.py`
- Modify: `backend/tests/test_app_foundation.py`

- [ ] **Step 1: Replace command library with compatibility exports**

Replace the full contents of `backend/app/command_library.py` with:

```python
from app.modules.commands import (
    CommandTemplatePayload,
    CommandTemplateRecord,
    CommandTemplateResponse,
    create_command_template,
    delete_command_template,
    list_command_templates,
    update_command_template,
)

__all__ = [
    "CommandTemplatePayload",
    "CommandTemplateRecord",
    "CommandTemplateResponse",
    "create_command_template",
    "delete_command_template",
    "list_command_templates",
    "update_command_template",
]
```

- [ ] **Step 2: Update SQLModel metadata registration import**

In `backend/app/db/session.py`, replace:

```python
import app.command_library  # noqa: F401
```

with:

```python
import app.modules.commands.models  # noqa: F401
```

- [ ] **Step 3: Run compatibility and command tests**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py::test_command_module_exports_compatible_library_api tests/test_command_library.py -v
```

Expected result:

```text
passed
```

- [ ] **Step 4: Commit command compatibility shim and test**

Run:

```powershell
git add backend/app/command_library.py backend/app/db/session.py backend/tests/test_app_foundation.py
git commit -m "add command library compatibility shim"
```

## Task 5: Update API Route to Canonical Command Module

**Files:**

- Modify: `backend/app/api/routes/commands.py`

- [ ] **Step 1: Update command route imports**

In `backend/app/api/routes/commands.py`, replace:

```python
from app.command_library import (
    CommandTemplatePayload,
    create_command_template,
    delete_command_template,
    list_command_templates,
    update_command_template,
)
```

with:

```python
from app.modules.commands import (
    CommandTemplatePayload,
    create_command_template,
    delete_command_template,
    list_command_templates,
    update_command_template,
)
```

- [ ] **Step 2: Verify app code no longer imports command library**

Run:

```powershell
rg "from app\.command_library|import app\.command_library" backend/app
```

Expected result:

```text
No matches.
```

Tests may continue importing `app.command_library` to verify compatibility.

- [ ] **Step 3: Run affected tests**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py tests/test_command_library.py -v
```

Expected result:

```text
passed
```

- [ ] **Step 4: Commit canonical command route import**

Run:

```powershell
git add backend/app/api/routes/commands.py
git commit -m "use command module in api route"
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
All collected backend tests pass.
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
git commit -m "verify command module"
```

## Self-Review

Spec coverage:

- Command SQLModel record extraction is covered by Task 2.
- Command schemas are covered by Task 2.
- Command repository and service boundaries are covered by Task 3.
- `app.command_library` compatibility is covered by Task 4.
- API route canonical imports are covered by Task 5.
- Full backend verification is covered by Task 6.

Completion wording scan:

- No steps contain unspecified implementation work.
- Every source edit step includes concrete file paths and code.

Type consistency:

- `CommandTemplateRecord.__tablename__` remains `command_templates`.
- `CommandTemplatePayload` still strips whitespace and deduplicates tags.
- `CommandTemplateResponse.from_record` still decodes `tags_json`.
- `create_command_template`, `update_command_template`,
  `delete_command_template`, and `list_command_templates` keep the same
  signatures as the legacy module.
- `app.command_library` re-exports the same canonical objects for legacy
  imports.

## Execution Handoff

Plan complete and saved to
`docs/superpowers/plans/2026-06-02-backend-commands-module-plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task,
   review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using
   executing-plans, batch execution with checkpoints.
