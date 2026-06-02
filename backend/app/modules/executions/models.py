from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


def _utc_now() -> datetime:
    return datetime.now(UTC)


class ExecutionTaskRecord(SQLModel, table=True):
    __tablename__ = "execution_tasks"

    id: str = Field(primary_key=True)
    script_id: str = Field(index=True)
    script_name: str
    script_revision: int
    status: str = Field(index=True)
    environment: str = Field(default="")
    target_device: str = Field(default="")
    executor: str = Field(default="local", index=True)
    created_at: str = Field(index=True)
    started_at: str | None = None
    finished_at: str | None = None
    duration_ms: int | None = None
    step_count: int = 0
    passed_step_count: int = 0
    failed_step_count: int = 0
    error_message: str = ""
    log_path: str = ""
    report_dir: str = ""
    report_json_path: str = ""
    variables_json: str = "{}"
    persisted_at: datetime = Field(default_factory=_utc_now)


class ExecutionReportRecord(SQLModel, table=True):
    __tablename__ = "execution_reports"

    task_id: str = Field(primary_key=True)
    task_json: str
    attachments_json: str = "[]"
    raw_framework_report_json: str = "null"
    created_at: str = Field(index=True)
    updated_at: datetime = Field(default_factory=_utc_now)
