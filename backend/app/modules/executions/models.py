from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


def _utc_now() -> datetime:
    return datetime.now(UTC)


class ExecutionTaskRecord(SQLModel, table=True):
    __tablename__ = "execution_tasks"

    id: str = Field(primary_key=True)
    case_id: str = Field(index=True)
    case_name: str
    status: str = Field(index=True)
    created_at: str = Field(index=True)
    started_at: str | None = None
    finished_at: str | None = None
    duration_ms: int | None = None
    error_message: str = ""
    log_path: str = ""
    report_dir: str = ""
    report_json_path: str = ""
    persisted_at: datetime = Field(default_factory=_utc_now)


class ExecutionReportRecord(SQLModel, table=True):
    __tablename__ = "execution_reports"

    task_id: str = Field(primary_key=True)
    task_json: str
    created_at: str = Field(index=True)
    updated_at: datetime = Field(default_factory=_utc_now)
