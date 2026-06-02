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
