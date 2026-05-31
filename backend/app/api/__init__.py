from fastapi import APIRouter, Request, Response, WebSocket

from app.errors import error_response
from app.script_catalog import (
    ScriptValidationError,
    TestScript,
    list_scripts,
    load_keywords,
    read_script,
    save_script,
)

api_router = APIRouter(prefix="/api")
websocket_router = APIRouter()


def empty_items_response() -> dict[str, list[object]]:
    return {"items": []}


api_router.add_api_route("/tasks", empty_items_response, methods=["GET"])
api_router.add_api_route("/reports", empty_items_response, methods=["GET"])
api_router.add_api_route("/commands", empty_items_response, methods=["GET"])


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
    script = read_script(request.app.state.settings, script_id)
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


@websocket_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.send_json({"type": "connection", "status": "connected"})
    await websocket.close()
