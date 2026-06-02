from sqlalchemy import Engine, text
from sqlmodel import SQLModel, create_engine

import app.command_library  # noqa: F401
from app.core.config import Settings


def create_db_engine(settings: Settings) -> Engine:
    return create_engine(f"sqlite:///{settings.database_path}", echo=False)


def ensure_database(settings: Settings) -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.scripts_dir.mkdir(parents=True, exist_ok=True)
    settings.reports_dir.mkdir(parents=True, exist_ok=True)

    engine = create_db_engine(settings)
    SQLModel.metadata.create_all(engine)
    run_migrations(engine)


def run_migrations(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE IF NOT EXISTS alembic_version (version_num TEXT)")
        )
        version = connection.execute(
            text("SELECT version_num FROM alembic_version LIMIT 1")
        ).scalar_one_or_none()
        if version is None:
            connection.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:version)"),
                {"version": "phase_1"},
            )
