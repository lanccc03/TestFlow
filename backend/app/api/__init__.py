from fastapi import APIRouter, WebSocket

api_router = APIRouter(prefix="/api")
websocket_router = APIRouter()


def empty_items_response() -> dict[str, list[object]]:
    return {"items": []}


api_router.add_api_route("/keywords", empty_items_response, methods=["GET"])
api_router.add_api_route("/scripts", empty_items_response, methods=["GET"])
api_router.add_api_route("/tasks", empty_items_response, methods=["GET"])
api_router.add_api_route("/reports", empty_items_response, methods=["GET"])
api_router.add_api_route("/commands", empty_items_response, methods=["GET"])


@websocket_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.send_json({"type": "connection", "status": "connected"})
    await websocket.close()
