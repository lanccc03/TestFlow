from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field

from app.config import Settings

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


class ScriptValidationIssue(BaseModel):
    field: str
    message: str


class ScriptValidationError(Exception):
    def __init__(self, issues: list[ScriptValidationIssue]) -> None:
        self.issues = issues


def load_keywords(settings: Settings) -> list[KeywordMetadata]:
    config_path = settings.keyword_config_path
    if not config_path.is_file():
        config_path = Path(__file__).with_name("default_keywords.yaml")

    data = yaml.safe_load(config_path.read_text(encoding="utf-8")) or []
    return [KeywordMetadata.model_validate(item) for item in data]


def list_scripts(settings: Settings) -> list[ScriptSummary]:
    summaries = [
        _script_to_summary(read_script(settings, path.stem))
        for path in sorted(settings.scripts_dir.glob("*.yaml"))
    ]
    return sorted(summaries, key=lambda summary: summary.updated_at, reverse=True)


def read_script(settings: Settings, script_id: str) -> TestScript:
    script_path = _script_path(settings, script_id)
    data = yaml.safe_load(script_path.read_text(encoding="utf-8")) or {}
    return TestScript.model_validate(data)


def save_script(settings: Settings, script: TestScript) -> tuple[TestScript, bool]:
    keywords = {keyword.name: keyword for keyword in load_keywords(settings)}
    issues = validate_script(script, keywords)
    if issues:
        raise ScriptValidationError(issues)

    script_path = _script_path(settings, script.id)
    was_created = not script_path.exists()
    revision = 1
    if script_path.exists():
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
    script_path.parent.mkdir(parents=True, exist_ok=True)
    script_path.write_text(
        yaml.safe_dump(
            saved_script.model_dump(mode="json", exclude_none=True),
            allow_unicode=True,
            sort_keys=False,
        ),
        encoding="utf-8",
    )
    return saved_script, was_created


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
    )


def _script_path(settings: Settings, script_id: str) -> Path:
    return settings.scripts_dir / f"{script_id}.yaml"
