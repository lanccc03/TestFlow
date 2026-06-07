from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router, websocket_router
from app.api.routes.health import router as health_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.db.session import ensure_database
from app.modules.executions.service import ExecutionService
from app.modules.scp.service import ScpService
from app.modules.terminal.sessions import SshSessionRegistry


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    configure_logging(settings)
    ensure_database(settings)
    ssh_session_registry = SshSessionRegistry()
    execution_service = ExecutionService(settings)
    app.state.ssh_session_registry = ssh_session_registry
    app.state.execution_service = execution_service
    app.state.scp_service = ScpService(
        ssh_session_registry,
        local_root=settings.data_dir,
    )
    await execution_service.start()
    try:
        yield
    finally:
        await execution_service.stop()


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()
    app = FastAPI(
        title="TestFlow Backend",
        version=resolved_settings.version,
        lifespan=lifespan,
    )
    app.state.settings = resolved_settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5174",
            "http://localhost:5174",
        ],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(health_router)
    app.include_router(api_router)
    app.include_router(websocket_router)

    return app


app = create_app()
