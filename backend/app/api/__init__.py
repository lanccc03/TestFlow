import asyncio
from contextlib import suppress

from fastapi import APIRouter, Request, Response, WebSocket
from starlette.websockets import WebSocketDisconnect

from app.command_library import (
    CommandTemplatePayload,
    create_command_template,
    delete_command_template,
    list_command_templates,
    update_command_template,
)
from app.errors import error_response
from app.execution.models import ExecutionTaskCreate
from app.execution.service import (
    ExecutionService,
    TaskAlreadyFinishedError,
    TaskNotFoundError,
)
from app.script_catalog import (
    ScriptValidationError,
    TestScript,
    delete_script,
    list_scripts,
    load_keywords,
    read_script,
    save_script,
)
from app.ssh_terminal import handle_ssh_terminal_websocket

api_router = APIRouter(prefix="/api")
websocket_router = APIRouter()


def empty_items_response() -> dict[str, list[object]]:
    return {"items": []}


api_router.add_api_route("/reports", empty_items_response, methods=["GET"])


def execution_service(request: Request) -> ExecutionService:
    return request.app.state.execution_service


@api_router.get("/tasks")
def list_execution_tasks(request: Request) -> dict[str, list[dict[str, object]]]:
    service = execution_service(request)
    return {
        "items": [
            summary.model_dump(mode="json") for summary in service.list_tasks()
        ]
    }


@api_router.post("/tasks", response_model=None)
async def create_execution_task(
    payload: ExecutionTaskCreate,
    request: Request,
    response: Response,
) -> dict[str, object] | Response:
    service = execution_service(request)
    try:
        task = await service.create_task(payload)
    except FileNotFoundError:
        return error_response(
            status_code=404,
            code="not_found",
            message="Script not found",
        )

    response.status_code = 201
    return task.model_dump(mode="json")


@api_router.get("/tasks/{task_id}", response_model=None)
def get_execution_task(task_id: str, request: Request) -> dict[str, object] | Response:
    service = execution_service(request)
    try:
        task = service.get_task(task_id)
    except TaskNotFoundError:
        task = None

    if task is None:
        return error_response(
            status_code=404,
            code="not_found",
            message="Task not found",
        )

    return task.model_dump(mode="json")


@api_router.post("/tasks/{task_id}/cancel", response_model=None)
async def cancel_execution_task(
    task_id: str,
    request: Request,
) -> dict[str, object] | Response:
    service = execution_service(request)
    try:
        task = await service.cancel_task(task_id)
    except TaskNotFoundError:
        return error_response(
            status_code=404,
            code="not_found",
            message="Task not found",
        )
    except TaskAlreadyFinishedError:
        return error_response(
            status_code=409,
            code="task_finished",
            message="Task already finished",
        )

    return task.model_dump(mode="json")


@api_router.get("/keywords")
def list_keyword_metadata(request: Request) -> dict[str, list[dict[str, object]]]:
    keywords = load_keywords(request.app.state.settings)
    return {"items": [keyword.model_dump(mode="json") for keyword in keywords]}


@api_router.get("/scripts")
def list_script_summaries(request: Request) -> dict[str, list[dict[str, object]]]:
    scripts = list_scripts(request.app.state.settings)
    return {"items": [script.model_dump(mode="json") for script in scripts]}


@api_router.get("/scripts/{script_id}")
def get_script(script_id: str, request: Request) -> dict[str, object]:
    try:
        script = read_script(request.app.state.settings, script_id)
    except FileNotFoundError:
        return error_response(
            status_code=404,
            code="not_found",
            message="Script not found",
        )
    return script.model_dump(mode="json")


@api_router.post("/scripts", response_model=None)
def save_script_endpoint(
    script: TestScript,
    request: Request,
    response: Response,
) -> dict[str, object] | Response:
    try:
        saved_script, was_created = save_script(request.app.state.settings, script)
    except ScriptValidationError as exc:
        return error_response(
            status_code=422,
            code="script_validation_error",
            message="Script validation failed",
            details=[issue.model_dump(mode="json") for issue in exc.issues],
        )

    response.status_code = 201 if was_created else 200
    return saved_script.model_dump(mode="json")


@api_router.delete("/scripts/{script_id}", status_code=204)
def delete_script_endpoint(script_id: str, request: Request) -> Response:
    was_deleted = delete_script(request.app.state.settings, script_id)
    if not was_deleted:
        return error_response(
            status_code=404,
            code="not_found",
            message="Script not found",
        )

    return Response(status_code=204)


@api_router.get("/commands")
def list_commands_endpoint(
    request: Request,
    search: str = "",
) -> dict[str, list[dict[str, object]]]:
    commands = list_command_templates(request.app.state.settings, search)
    return {"items": [command.model_dump(mode="json") for command in commands]}


@api_router.post("/commands", response_model=None)
def create_command_endpoint(
    command: CommandTemplatePayload,
    request: Request,
    response: Response,
) -> dict[str, object]:
    response.status_code = 201
    created = create_command_template(request.app.state.settings, command)
    return created.model_dump(mode="json")


@api_router.put("/commands/{command_id}", response_model=None)
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


@api_router.delete("/commands/{command_id}", status_code=204)
def delete_command_endpoint(command_id: str, request: Request) -> Response:
    was_deleted = delete_command_template(request.app.state.settings, command_id)
    if not was_deleted:
        return error_response(
            status_code=404,
            code="not_found",
            message="Command template not found",
        )

    return Response(status_code=204)


@websocket_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    try:
        await websocket.accept()
        await websocket.send_json({"type": "connection", "status": "connected"})
        await websocket.close()
    except WebSocketDisconnect:
        return


@websocket_router.websocket("/ws/executions")
async def execution_websocket_endpoint(websocket: WebSocket) -> None:
    try:
        await websocket.accept()
        service = websocket.app.state.execution_service
        async with service.events.subscribe() as subscriber:
            await websocket.send_json({"type": "connection", "status": "connected"})
            while True:
                event_task = asyncio.create_task(subscriber.get())
                receive_task = asyncio.create_task(websocket.receive())
                done, pending = await asyncio.wait(
                    {event_task, receive_task},
                    return_when=asyncio.FIRST_COMPLETED,
                )

                for task in pending:
                    task.cancel()
                    with suppress(asyncio.CancelledError):
                        await task

                if receive_task in done:
                    received = receive_task.result()
                    if received.get("type") == "websocket.disconnect":
                        return
                    continue

                message = event_task.result()
                await websocket.send_json(message.model_dump(mode="json"))
    except WebSocketDisconnect:
        return


@websocket_router.websocket("/ws/ssh")
async def ssh_websocket_endpoint(websocket: WebSocket) -> None:
    await handle_ssh_terminal_websocket(websocket)
