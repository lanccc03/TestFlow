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
