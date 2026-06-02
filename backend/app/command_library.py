import json
from datetime import UTC, datetime
from typing import Self
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, field_validator
from pydantic import Field as PydanticField
from sqlmodel import Field, Session, SQLModel, create_engine, select

from app.core.config import Settings


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


def list_command_templates(
    settings: Settings,
    search: str = "",
) -> list[CommandTemplateResponse]:
    query = search.strip().lower()
    with _session(settings) as session:
        records = session.exec(select(CommandTemplateRecord)).all()

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
    with _session(settings) as session:
        session.add(record)
        session.commit()
        session.refresh(record)

    return CommandTemplateResponse.from_record(record)


def update_command_template(
    settings: Settings,
    command_id: str,
    payload: CommandTemplatePayload,
) -> CommandTemplateResponse | None:
    with _session(settings) as session:
        record = session.get(CommandTemplateRecord, command_id)
        if record is None:
            return None

        record.name = payload.name
        record.command = payload.command
        record.description = payload.description
        record.group = payload.group
        record.tags_json = json.dumps(payload.tags, ensure_ascii=False)
        record.updated_at = _utc_now()
        session.add(record)
        session.commit()
        session.refresh(record)

    return CommandTemplateResponse.from_record(record)


def delete_command_template(settings: Settings, command_id: str) -> bool:
    with _session(settings) as session:
        record = session.get(CommandTemplateRecord, command_id)
        if record is None:
            return False

        session.delete(record)
        session.commit()
        return True


def _session(settings: Settings) -> Session:
    return Session(create_engine(f"sqlite:///{settings.database_path}", echo=False))


def _decode_tags(value: str) -> list[str]:
    try:
        data = json.loads(value)
    except json.JSONDecodeError:
        return []

    if not isinstance(data, list):
        return []

    return [tag for tag in data if isinstance(tag, str)]
