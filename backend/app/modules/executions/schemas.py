from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field

TaskStatus = Literal["pending", "running", "passed", "failed", "canceled", "error"]
ExecutionEventType = Literal["task_status", "task_finished"]
ReportKind = Literal["html"]
ReportSource = Literal["file", "url"]


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


class ExecutionTaskCreate(BaseModel):
    case_id: str


class ExecutionLogEntry(BaseModel):
    timestamp: str
    level: str = "info"
    message: str


class ExecutionFrameworkReport(BaseModel):
    kind: ReportKind = "html"
    title: str = "框架报告"
    source: ReportSource = "file"
    entry: str
    root_dir: str = ""


class ExecutionTask(BaseModel):
    id: str
    case_id: str
    case_name: str
    status: TaskStatus = "pending"
    created_at: str = Field(default_factory=utc_now)
    started_at: str | None = None
    finished_at: str | None = None
    duration_ms: int | None = None
    log_path: str = ""
    report_dir: str = ""
    framework_report: ExecutionFrameworkReport | None = None
    logs: list[ExecutionLogEntry] = Field(default_factory=list)
    error_message: str = ""


class ExecutionTaskSummary(BaseModel):
    id: str
    case_id: str
    case_name: str
    status: TaskStatus
    created_at: str
    started_at: str | None
    finished_at: str | None
    duration_ms: int | None


class ExecutionTaskFilters(BaseModel):
    case_id: str | None = None
    status: TaskStatus | None = None
    created_from: str | None = None
    created_to: str | None = None


class ExecutionEventMessage(BaseModel):
    type: ExecutionEventType
    task_id: str
    status: TaskStatus | None = None
    message: str = ""
    level: str = "info"
    timestamp: str = Field(default_factory=utc_now)
    task: ExecutionTask | None = None
