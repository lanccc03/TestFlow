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
