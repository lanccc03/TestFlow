import asyncio
from contextlib import suppress

from fastapi import APIRouter, Request, Response, WebSocket
from starlette.websockets import WebSocketDisconnect

from app.api.dependencies import execution_service
from app.core.errors import error_response
from app.modules.executions.schemas import ExecutionTaskCreate
from app.modules.executions.service import (
    TaskAlreadyFinishedError,
    TaskNotFoundError,
)

router = APIRouter()
websocket_router = APIRouter()


@router.get("/tasks")
def list_execution_tasks(request: Request) -> dict[str, list[dict[str, object]]]:
    service = execution_service(request)
    return {
        "items": [
            summary.model_dump(mode="json") for summary in service.list_tasks()
        ]
    }


@router.post("/tasks", response_model=None)
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


@router.get("/tasks/{task_id}", response_model=None)
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


@router.post("/tasks/{task_id}/cancel", response_model=None)
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
