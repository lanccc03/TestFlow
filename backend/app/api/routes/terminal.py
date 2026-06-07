from fastapi import APIRouter, WebSocket

from app.modules.terminal.websocket import handle_ssh_terminal_websocket

router = APIRouter()


@router.websocket("/ws/ssh")
async def ssh_websocket_endpoint(websocket: WebSocket) -> None:
    await handle_ssh_terminal_websocket(
        websocket,
        session_registry=websocket.app.state.ssh_session_registry,
    )
