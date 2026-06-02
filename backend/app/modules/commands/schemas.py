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
