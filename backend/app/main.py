from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router, websocket_router
from app.config import Settings, get_settings
from app.db import ensure_database
from app.errors import register_exception_handlers
from app.logging import configure_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    configure_logging(settings)
    ensure_database(settings)
    yield


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
    app.include_router(api_router)
    app.include_router(websocket_router)

    @app.get("/health")
    def read_health() -> dict[str, str]:
        return {
            "status": "ok",
            "service": resolved_settings.service_name,
            "version": resolved_settings.version,
            "data_dir": resolved_settings.data_dir.as_posix(),
        }

    return app


app = create_app()
