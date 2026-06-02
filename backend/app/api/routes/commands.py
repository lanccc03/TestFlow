from fastapi import APIRouter, Request, Response

from app.command_library import (
    CommandTemplatePayload,
    create_command_template,
    delete_command_template,
    list_command_templates,
    update_command_template,
)
from app.errors import error_response

router = APIRouter()


@router.get("/commands")
def list_commands_endpoint(
    request: Request,
    search: str = "",
) -> dict[str, list[dict[str, object]]]:
    commands = list_command_templates(request.app.state.settings, search)
    return {"items": [command.model_dump(mode="json") for command in commands]}


@router.post("/commands", response_model=None)
def create_command_endpoint(
    command: CommandTemplatePayload,
    request: Request,
    response: Response,
) -> dict[str, object]:
    response.status_code = 201
    created = create_command_template(request.app.state.settings, command)
    return created.model_dump(mode="json")


@router.put("/commands/{command_id}", response_model=None)
def update_command_endpoint(
    command_id: str,
    command: CommandTemplatePayload,
    request: Request,
) -> dict[str, object] | Response:
    updated = update_command_template(
        request.app.state.settings,
        command_id,
        command,
    )
    if updated is None:
        return error_response(
            status_code=404,
            code="not_found",
            message="Command template not found",
        )

    return updated.model_dump(mode="json")


@router.delete("/commands/{command_id}", status_code=204)
def delete_command_endpoint(command_id: str, request: Request) -> Response:
    was_deleted = delete_command_template(request.app.state.settings, command_id)
    if not was_deleted:
        return error_response(
            status_code=404,
            code="not_found",
            message="Command template not found",
        )

    return Response(status_code=204)
