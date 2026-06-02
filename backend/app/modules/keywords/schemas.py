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
