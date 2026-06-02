# Backend Scripts Keywords Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `app/script_catalog.py` into focused `modules/scripts` and `modules/keywords` packages while preserving existing script and keyword behavior.

**Architecture:** This is Phase 3 of the approved modular layered backend architecture. Keyword metadata moves to `app.modules.keywords`; script schemas, YAML persistence, validation, and script use cases move to `app.modules.scripts`; `app.script_catalog` remains a compatibility shim for tests and older imports.

**Tech Stack:** FastAPI, Pydantic, PyYAML, pytest, Ruff, pnpm backend scripts.

---

## Scope

This plan migrates only the script catalog and keyword catalog boundary.

It intentionally does not move:

- Execution task models or runner logic.
- Command library persistence.
- SSH terminal behavior.
- Report persistence.
- YAML storage into a generic `app/storage` helper.

Public API behavior must remain unchanged for:

- `GET /api/keywords`
- `GET /api/scripts`
- `GET /api/scripts/{script_id}`
- `POST /api/scripts`
- `DELETE /api/scripts/{script_id}`
- Execution task creation that reads saved scripts.

## File Structure

Create:

- `backend/app/modules/__init__.py`
  - Marks the modules package.
- `backend/app/modules/keywords/__init__.py`
  - Re-exports keyword schemas and service functions.
- `backend/app/modules/keywords/schemas.py`
  - Holds `ParameterType`, `KeywordParameter`, and `KeywordMetadata`.
- `backend/app/modules/keywords/repository.py`
  - Reads keyword metadata YAML.
- `backend/app/modules/keywords/service.py`
  - Exposes keyword use cases such as `load_keywords`.
- `backend/app/modules/scripts/__init__.py`
  - Re-exports script schemas and service functions.
- `backend/app/modules/scripts/schemas.py`
  - Holds script Pydantic schemas and validation exceptions.
- `backend/app/modules/scripts/validators.py`
  - Holds `validate_script` and type matching.
- `backend/app/modules/scripts/repository.py`
  - Reads, writes, lists, and deletes script YAML files.
- `backend/app/modules/scripts/service.py`
  - Exposes script use cases and coordinates keyword validation.

Modify:

- `backend/app/script_catalog.py`
  - Replace with a compatibility shim.
- `backend/app/api/routes/keywords.py`
  - Import from `app.modules.keywords.service`.
- `backend/app/api/routes/scripts.py`
  - Import from `app.modules.scripts`.
- `backend/app/execution/service.py`
  - Import script schemas and read function from canonical modules.
- `backend/tests/test_app_foundation.py`
  - Add canonical and compatibility import regression test.

Do not modify:

- `backend/app/default_keywords.yaml`
- `backend/autotest/*`
- `backend/app/execution/models.py`
- `backend/app/execution/events.py`

## Task 1: Add Module Import Regression Tests

**Files:**

- Modify: `backend/tests/test_app_foundation.py`

- [ ] **Step 1: Add canonical module import compatibility test**

Append this test to `backend/tests/test_app_foundation.py`:

```python
def test_script_and_keyword_modules_export_compatible_catalog_api() -> None:
    from app.modules.keywords.schemas import KeywordMetadata, KeywordParameter
    from app.modules.keywords.service import load_keywords
    from app.modules.scripts.schemas import ScriptStep, TestScript
    from app.modules.scripts.service import read_script, save_script
    from app.script_catalog import KeywordMetadata as LegacyKeywordMetadata
    from app.script_catalog import KeywordParameter as LegacyKeywordParameter
    from app.script_catalog import ScriptStep as LegacyScriptStep
    from app.script_catalog import TestScript as LegacyTestScript
    from app.script_catalog import load_keywords as legacy_load_keywords
    from app.script_catalog import read_script as legacy_read_script
    from app.script_catalog import save_script as legacy_save_script

    assert LegacyKeywordMetadata is KeywordMetadata
    assert LegacyKeywordParameter is KeywordParameter
    assert LegacyScriptStep is ScriptStep
    assert LegacyTestScript is TestScript
    assert legacy_load_keywords is load_keywords
    assert legacy_read_script is read_script
    assert legacy_save_script is save_script
```

- [ ] **Step 2: Run the new test and verify it fails before implementation**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py::test_script_and_keyword_modules_export_compatible_catalog_api -v
```

Expected result:

```text
ModuleNotFoundError: No module named 'app.modules'
```

- [ ] **Step 3: Keep the failing test uncommitted until Task 5**

Do not commit `backend/tests/test_app_foundation.py` yet. Task 5 makes this
test pass and commits it with the compatibility shim.

Confirm the uncommitted test change:

```powershell
git status --short
```

Expected output includes:

```text
 M backend/tests/test_app_foundation.py
```

## Task 2: Create Keywords Module

**Files:**

- Create: `backend/app/modules/__init__.py`
- Create: `backend/app/modules/keywords/__init__.py`
- Create: `backend/app/modules/keywords/schemas.py`
- Create: `backend/app/modules/keywords/repository.py`
- Create: `backend/app/modules/keywords/service.py`

- [ ] **Step 1: Create modules package marker**

Create `backend/app/modules/__init__.py` with:

```python
"""Business capability modules."""
```

- [ ] **Step 2: Create keywords package exports**

Create `backend/app/modules/keywords/__init__.py` with:

```python
from app.modules.keywords.schemas import (
    KeywordMetadata,
    KeywordParameter,
    ParameterType,
)
from app.modules.keywords.service import load_keywords

__all__ = [
    "KeywordMetadata",
    "KeywordParameter",
    "ParameterType",
    "load_keywords",
]
```

- [ ] **Step 3: Create keyword schemas**

Create `backend/app/modules/keywords/schemas.py` with:

```python
from typing import Any, Literal

from pydantic import BaseModel, Field

ParameterType = Literal["string", "integer", "number", "boolean", "object", "array"]


class KeywordParameter(BaseModel):
    name: str
    description: str = ""
    type: ParameterType
    default: Any = None
    required: bool = False
    example: Any = None


class KeywordMetadata(BaseModel):
    name: str
    description: str = ""
    module: str
    parameters: list[KeywordParameter] = Field(default_factory=list)
    example: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True
```

- [ ] **Step 4: Create keyword repository**

Create `backend/app/modules/keywords/repository.py` with:

```python
from pathlib import Path

import yaml

from app.core.config import Settings
from app.modules.keywords.schemas import KeywordMetadata

DEFAULT_KEYWORDS_PATH = Path(__file__).resolve().parents[2] / "default_keywords.yaml"


def load_keyword_metadata(settings: Settings) -> list[KeywordMetadata]:
    config_path = settings.keyword_config_path
    if not config_path.is_file():
        config_path = DEFAULT_KEYWORDS_PATH

    data = yaml.safe_load(config_path.read_text(encoding="utf-8")) or []
    return [KeywordMetadata.model_validate(item) for item in data]
```

- [ ] **Step 5: Create keyword service**

Create `backend/app/modules/keywords/service.py` with:

```python
from app.core.config import Settings
from app.modules.keywords.repository import load_keyword_metadata
from app.modules.keywords.schemas import KeywordMetadata


def load_keywords(settings: Settings) -> list[KeywordMetadata]:
    return load_keyword_metadata(settings)
```

- [ ] **Step 6: Run keyword import and behavior smoke checks**

Run:

```powershell
cd backend
uv run python -c "from app.core.config import Settings; from app.modules.keywords.service import load_keywords; print(load_keywords(Settings())[0].name)"
uv run python -c "from app.modules.keywords.repository import DEFAULT_KEYWORDS_PATH; print(DEFAULT_KEYWORDS_PATH.name)"
```

Expected output:

```text
wait
default_keywords.yaml
```

- [ ] **Step 7: Commit keywords module**

Run:

```powershell
git add backend/app/modules/__init__.py backend/app/modules/keywords/__init__.py backend/app/modules/keywords/schemas.py backend/app/modules/keywords/repository.py backend/app/modules/keywords/service.py
git commit -m "add keywords module"
```

## Task 3: Create Scripts Schemas and Validators

**Files:**

- Create: `backend/app/modules/scripts/__init__.py`
- Create: `backend/app/modules/scripts/schemas.py`
- Create: `backend/app/modules/scripts/validators.py`

- [ ] **Step 1: Create script schemas**

Create `backend/app/modules/scripts/schemas.py` with:

```python
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.keywords.schemas import ParameterType

ScriptStatus = Literal["draft", "published"]


class ScriptVariable(BaseModel):
    name: str
    description: str = ""
    type: ParameterType = "string"
    default: Any = None
    required: bool = False


class ScriptStep(BaseModel):
    id: str
    keyword: str
    params: dict[str, Any] = Field(default_factory=dict)
    description: str = ""
    enabled: bool = True


class ScriptVersion(BaseModel):
    revision: int = 1
    updated_at: str


class TestScript(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: int = 1
    id: str = Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_-]*$")
    name: str
    description: str = ""
    status: ScriptStatus = "draft"
    tags: list[str] = Field(default_factory=list)
    group: str = ""
    variables: list[ScriptVariable] = Field(default_factory=list)
    steps: list[ScriptStep] = Field(default_factory=list)
    version: ScriptVersion | None = None


class ScriptSummary(BaseModel):
    id: str
    name: str
    description: str
    step_count: int
    enabled_step_count: int
    revision: int
    updated_at: str
    status: ScriptStatus
    tags: list[str] = Field(default_factory=list)
    group: str = ""


class ScriptValidationIssue(BaseModel):
    field: str
    message: str


class ScriptValidationError(Exception):
    def __init__(self, issues: list[ScriptValidationIssue]) -> None:
        self.issues = issues
```

- [ ] **Step 2: Create script validators**

Create `backend/app/modules/scripts/validators.py` with:

```python
from typing import Any

from app.modules.keywords.schemas import KeywordMetadata, ParameterType
from app.modules.scripts.schemas import (
    ScriptValidationIssue,
    TestScript,
)


def validate_script(
    script: TestScript,
    keywords: dict[str, KeywordMetadata],
) -> list[ScriptValidationIssue]:
    issues: list[ScriptValidationIssue] = []
    for step_index, step in enumerate(script.steps):
        keyword = keywords.get(step.keyword)
        if keyword is None or not keyword.enabled:
            issues.append(
                ScriptValidationIssue(
                    field=f"steps[{step_index}].keyword",
                    message=f"Unknown keyword: {step.keyword}",
                )
            )
            continue

        for parameter in keyword.parameters:
            parameter_path = f"steps[{step_index}].params.{parameter.name}"
            has_value = parameter.name in step.params
            if parameter.required and not has_value:
                issues.append(
                    ScriptValidationIssue(
                        field=parameter_path,
                        message="Missing required parameter",
                    )
                )
                continue

            if has_value and not _matches_type(
                step.params[parameter.name],
                parameter.type,
            ):
                issues.append(
                    ScriptValidationIssue(
                        field=parameter_path,
                        message=f"Expected {parameter.type}",
                    )
                )

    return issues


def _matches_type(value: Any, parameter_type: ParameterType) -> bool:
    if parameter_type == "string":
        return isinstance(value, str)
    if parameter_type == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if parameter_type == "number":
        return (isinstance(value, int | float)) and not isinstance(value, bool)
    if parameter_type == "boolean":
        return isinstance(value, bool)
    if parameter_type == "object":
        return isinstance(value, dict)
    if parameter_type == "array":
        return isinstance(value, list)
    return False
```

- [ ] **Step 3: Create temporary scripts package exports**

Create `backend/app/modules/scripts/__init__.py` with:

```python
from app.modules.scripts.schemas import (
    ScriptStatus,
    ScriptStep,
    ScriptSummary,
    ScriptValidationError,
    ScriptValidationIssue,
    ScriptVariable,
    ScriptVersion,
    TestScript,
)
from app.modules.scripts.validators import validate_script

__all__ = [
    "ScriptStatus",
    "ScriptStep",
    "ScriptSummary",
    "ScriptValidationError",
    "ScriptValidationIssue",
    "ScriptVariable",
    "ScriptVersion",
    "TestScript",
    "validate_script",
]
```

- [ ] **Step 4: Run validator smoke checks**

Run:

```powershell
cd backend
uv run python -c "from app.modules.scripts.schemas import TestScript; print(TestScript(id='smoke', name='Smoke').id)"
uv run python -c "from app.modules.scripts.validators import validate_script; print(validate_script.__name__)"
```

Expected output:

```text
smoke
validate_script
```

- [ ] **Step 5: Commit script schemas and validators**

Run:

```powershell
git add backend/app/modules/scripts/__init__.py backend/app/modules/scripts/schemas.py backend/app/modules/scripts/validators.py
git commit -m "add script schemas and validators"
```

## Task 4: Create Scripts Repository and Service

**Files:**

- Create: `backend/app/modules/scripts/repository.py`
- Create: `backend/app/modules/scripts/service.py`
- Modify: `backend/app/modules/scripts/__init__.py`

- [ ] **Step 1: Create scripts repository**

Create `backend/app/modules/scripts/repository.py` with:

```python
from pathlib import Path

import yaml

from app.core.config import Settings
from app.modules.scripts.schemas import TestScript


def list_script_paths(settings: Settings) -> list[Path]:
    return sorted(settings.scripts_dir.glob("*.yaml"))


def read_script_file(settings: Settings, script_id: str) -> TestScript:
    script_path = script_path_for(settings, script_id)
    data = yaml.safe_load(script_path.read_text(encoding="utf-8")) or {}
    return TestScript.model_validate(data)


def write_script_file(settings: Settings, script: TestScript) -> None:
    script_path = script_path_for(settings, script.id)
    script_path.parent.mkdir(parents=True, exist_ok=True)
    script_path.write_text(
        yaml.safe_dump(
            script.model_dump(mode="json", exclude_none=True),
            allow_unicode=True,
            sort_keys=False,
        ),
        encoding="utf-8",
    )


def delete_script_file(settings: Settings, script_id: str) -> bool:
    script_path = script_path_for(settings, script_id)
    if not script_path.exists():
        return False

    script_path.unlink()
    return True


def script_file_exists(settings: Settings, script_id: str) -> bool:
    return script_path_for(settings, script_id).exists()


def script_path_for(settings: Settings, script_id: str) -> Path:
    return settings.scripts_dir / f"{script_id}.yaml"
```

- [ ] **Step 2: Create scripts service**

Create `backend/app/modules/scripts/service.py` with:

```python
from datetime import UTC, datetime

from app.core.config import Settings
from app.modules.keywords.service import load_keywords
from app.modules.scripts.repository import (
    delete_script_file,
    list_script_paths,
    read_script_file,
    script_file_exists,
    write_script_file,
)
from app.modules.scripts.schemas import (
    ScriptSummary,
    ScriptValidationError,
    ScriptVersion,
    TestScript,
)
from app.modules.scripts.validators import validate_script


def list_scripts(settings: Settings) -> list[ScriptSummary]:
    summaries = [
        _script_to_summary(read_script(settings, path.stem))
        for path in list_script_paths(settings)
    ]
    return sorted(summaries, key=lambda summary: summary.updated_at, reverse=True)


def read_script(settings: Settings, script_id: str) -> TestScript:
    return read_script_file(settings, script_id)


def save_script(settings: Settings, script: TestScript) -> tuple[TestScript, bool]:
    keywords = {keyword.name: keyword for keyword in load_keywords(settings)}
    if script.status == "published":
        issues = validate_script(script, keywords)
        if issues:
            raise ScriptValidationError(issues)

    was_created = not script_file_exists(settings, script.id)
    revision = 1
    if not was_created:
        existing = read_script(settings, script.id)
        revision = (existing.version.revision if existing.version else 0) + 1

    saved_script = script.model_copy(
        update={
            "schema_version": 1,
            "version": ScriptVersion(
                revision=revision,
                updated_at=datetime.now(UTC).isoformat(),
            ),
        }
    )
    write_script_file(settings, saved_script)
    return saved_script, was_created


def delete_script(settings: Settings, script_id: str) -> bool:
    return delete_script_file(settings, script_id)


def _script_to_summary(script: TestScript) -> ScriptSummary:
    version = script.version
    return ScriptSummary(
        id=script.id,
        name=script.name,
        description=script.description,
        step_count=len(script.steps),
        enabled_step_count=sum(1 for step in script.steps if step.enabled),
        revision=version.revision if version else 1,
        updated_at=version.updated_at if version else "",
        status=script.status,
        tags=script.tags,
        group=script.group,
    )
```

- [ ] **Step 3: Update scripts package exports**

Replace `backend/app/modules/scripts/__init__.py` with:

```python
from app.modules.scripts.schemas import (
    ScriptStatus,
    ScriptStep,
    ScriptSummary,
    ScriptValidationError,
    ScriptValidationIssue,
    ScriptVariable,
    ScriptVersion,
    TestScript,
)
from app.modules.scripts.service import (
    delete_script,
    list_scripts,
    read_script,
    save_script,
)
from app.modules.scripts.validators import validate_script

__all__ = [
    "ScriptStatus",
    "ScriptStep",
    "ScriptSummary",
    "ScriptValidationError",
    "ScriptValidationIssue",
    "ScriptVariable",
    "ScriptVersion",
    "TestScript",
    "delete_script",
    "list_scripts",
    "read_script",
    "save_script",
    "validate_script",
]
```

- [ ] **Step 4: Run script service smoke check**

Run:

```powershell
cd backend
uv run python -c "from tempfile import TemporaryDirectory; from pathlib import Path; from app.core.config import Settings; from app.modules.scripts import TestScript, save_script, list_scripts; tmp=TemporaryDirectory(); settings=Settings(data_dir=Path(tmp.name)); saved, created=save_script(settings, TestScript(id='smoke', name='Smoke')); print(created, saved.version.revision, list_scripts(settings)[0].id); tmp.cleanup()"
```

Expected output:

```text
True 1 smoke
```

- [ ] **Step 5: Commit scripts repository and service**

Run:

```powershell
git add backend/app/modules/scripts/__init__.py backend/app/modules/scripts/repository.py backend/app/modules/scripts/service.py
git commit -m "add scripts module service"
```

## Task 5: Replace Script Catalog With Compatibility Shim

**Files:**

- Modify: `backend/app/script_catalog.py`
- Modify: `backend/tests/test_app_foundation.py`

- [ ] **Step 1: Replace script catalog with compatibility exports**

Replace the full contents of `backend/app/script_catalog.py` with:

```python
from app.modules.keywords import (
    KeywordMetadata,
    KeywordParameter,
    ParameterType,
    load_keywords,
)
from app.modules.scripts import (
    ScriptStatus,
    ScriptStep,
    ScriptSummary,
    ScriptValidationError,
    ScriptValidationIssue,
    ScriptVariable,
    ScriptVersion,
    TestScript,
    delete_script,
    list_scripts,
    read_script,
    save_script,
    validate_script,
)

__all__ = [
    "KeywordMetadata",
    "KeywordParameter",
    "ParameterType",
    "ScriptStatus",
    "ScriptStep",
    "ScriptSummary",
    "ScriptValidationError",
    "ScriptValidationIssue",
    "ScriptVariable",
    "ScriptVersion",
    "TestScript",
    "delete_script",
    "list_scripts",
    "load_keywords",
    "read_script",
    "save_script",
    "validate_script",
]
```

- [ ] **Step 2: Run compatibility and script catalog tests**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py::test_script_and_keyword_modules_export_compatible_catalog_api tests/test_script_catalog.py -v
```

Expected result:

```text
passed
```

- [ ] **Step 3: Commit compatibility shim and test**

Run:

```powershell
git add backend/app/script_catalog.py backend/tests/test_app_foundation.py
git commit -m "add script catalog compatibility shim"
```

## Task 6: Update App Code to Canonical Module Imports

**Files:**

- Modify: `backend/app/api/routes/keywords.py`
- Modify: `backend/app/api/routes/scripts.py`
- Modify: `backend/app/execution/service.py`

- [ ] **Step 1: Update keywords route import**

In `backend/app/api/routes/keywords.py`, replace:

```python
from app.script_catalog import load_keywords
```

with:

```python
from app.modules.keywords.service import load_keywords
```

- [ ] **Step 2: Update scripts route imports**

In `backend/app/api/routes/scripts.py`, replace:

```python
from app.script_catalog import (
    ScriptValidationError,
    TestScript,
    delete_script,
    list_scripts,
    read_script,
    save_script,
)
```

with:

```python
from app.modules.scripts import (
    ScriptValidationError,
    TestScript,
    delete_script,
    list_scripts,
    read_script,
    save_script,
)
```

- [ ] **Step 3: Update execution service imports**

In `backend/app/execution/service.py`, replace:

```python
from app.script_catalog import TestScript, read_script
```

with:

```python
from app.modules.scripts import TestScript, read_script
```

- [ ] **Step 4: Verify app code no longer imports script catalog**

Run:

```powershell
rg "from app\.script_catalog|import app\.script_catalog" backend/app
```

Expected result:

```text
No matches.
```

Tests may continue importing `app.script_catalog` to verify compatibility.

- [ ] **Step 5: Run affected tests**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py tests/test_script_catalog.py tests/test_execution_service.py -v
```

Expected result:

```text
passed
```

- [ ] **Step 6: Commit canonical script and keyword imports**

Run:

```powershell
git add backend/app/api/routes/keywords.py backend/app/api/routes/scripts.py backend/app/execution/service.py
git commit -m "use script keyword modules"
```

## Task 7: Run Full Backend Verification

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
git commit -m "verify scripts keywords modules"
```

## Self-Review

Spec coverage:

- Keyword schemas, metadata loading, and service boundary are covered by Task 2.
- Script schemas and validation are covered by Task 3.
- YAML persistence and script use cases are covered by Task 4.
- Compatibility with `app.script_catalog` is covered by Task 5.
- App code canonical imports are covered by Task 6.
- Full backend verification is covered by Task 7.

Completion wording scan:

- No steps contain unspecified implementation work.
- Every source edit step includes concrete file paths and code.

Type consistency:

- `ParameterType` lives in `app.modules.keywords.schemas` and is reused by
  script schemas.
- `ScriptValidationError` continues exposing an `issues` attribute.
- `save_script` continues returning `(saved_script, was_created)`.
- `read_script` still raises `FileNotFoundError` through `Path.read_text` when
  a script YAML file is missing.
- `app.script_catalog` re-exports the same canonical objects for legacy imports.

## Execution Handoff

Plan complete and saved to
`docs/superpowers/plans/2026-06-02-backend-scripts-keywords-modules-plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task,
   review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using
   executing-plans, batch execution with checkpoints.
