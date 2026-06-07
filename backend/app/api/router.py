from fastapi import APIRouter

from app.api.routes import (
    commands,
    executions,
    framework,
    keywords,
    reports,
    scp,
    scripts,
    terminal,
    websockets,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(reports.router, prefix="")
api_router.include_router(keywords.router, prefix="")
api_router.include_router(scripts.router, prefix="")
api_router.include_router(executions.router, prefix="")
api_router.include_router(commands.router, prefix="")
api_router.include_router(framework.router, prefix="")
api_router.include_router(scp.router, prefix="")

websocket_router = APIRouter()
websocket_router.include_router(websockets.router)
websocket_router.include_router(executions.websocket_router)
websocket_router.include_router(terminal.router)
websocket_router.include_router(scp.websocket_router)
