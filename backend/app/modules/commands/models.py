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
