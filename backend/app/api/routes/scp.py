from fastapi import APIRouter, HTTPException, Request, WebSocket
from starlette.websockets import WebSocketDisconnect

from app.modules.scp.schemas import ScpTransferCreate
from app.modules.scp.service import (
    ScpService,
    ScpSessionUnavailableError,
    ScpTransferNotFoundError,
)

router = APIRouter()
websocket_router = APIRouter()


@router.get("/scp/local/tree")
def local_tree(request: Request, path: str | None = None):
    try:
        return _scp_service(request).list_local_tree(path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/scp/remote/tree")
async def remote_tree(request: Request, session_id: str, path: str = "."):
    try:
        return await _scp_service(request).list_remote_tree(session_id, path)
    except ScpSessionUnavailableError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "scp_session_unavailable",
                "message": str(exc),
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/scp/transfers")
def list_transfers(request: Request):
    return {"items": _scp_service(request).list_transfers()}


@router.post("/scp/transfers/upload")
async def upload_transfer(request: Request, payload: ScpTransferCreate):
    try:
        return await _scp_service(request).create_upload(
            session_id=payload.session_id,
            local_path=payload.source_path,
            remote_path=payload.target_path,
        )
    except ScpSessionUnavailableError as exc:
        raise _session_unavailable(exc) from exc


@router.post("/scp/transfers/download")
async def download_transfer(request: Request, payload: ScpTransferCreate):
    try:
        return await _scp_service(request).create_download(
            session_id=payload.session_id,
            remote_path=payload.source_path,
            local_path=payload.target_path,
        )
    except ScpSessionUnavailableError as exc:
        raise _session_unavailable(exc) from exc


@router.post("/scp/transfers/{transfer_id}/retry")
async def retry_transfer(request: Request, transfer_id: str):
    try:
        return await _scp_service(request).retry_transfer(transfer_id)
    except ScpSessionUnavailableError as exc:
        raise _session_unavailable(exc) from exc
    except ScpTransferNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/scp/transfers/{transfer_id}/cancel")
async def cancel_transfer(request: Request, transfer_id: str):
    try:
        return await _scp_service(request).cancel_transfer(transfer_id)
    except ScpTransferNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@websocket_router.websocket("/ws/scp/transfers")
async def scp_transfer_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    service: ScpService = websocket.app.state.scp_service
    queue = service.event_bus.subscribe()
    try:
        while True:
            event = await queue.get()
            await websocket.send_json(event.model_dump())
    except WebSocketDisconnect:
        return
    finally:
        service.event_bus.unsubscribe(queue)


def _scp_service(request: Request) -> ScpService:
    return request.app.state.scp_service


def _session_unavailable(exc: ScpSessionUnavailableError) -> HTTPException:
    return HTTPException(
        status_code=400,
        detail={
            "code": "scp_session_unavailable",
            "message": str(exc),
        },
    )
