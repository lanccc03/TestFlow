from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

TaskStatus = Literal["pending", "running", "passed", "failed", "canceled", "error"]
StepStatus = Literal[
    "pending",
    "running",
    "passed",
    "failed",
    "canceled",
    "error",
    "skipped",
]
ExecutionEventType = Literal["task_status", "step_status", "log", "task_finished"]


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


class ExecutionTaskCreate(BaseModel):
    script_id: str
    environment: str = "local"
    target_device: str = ""
    variables: dict[str, Any] = Field(default_factory=dict)
    executor: str = "local"


class ExecutionLogEntry(BaseModel):
    timestamp: str
    level: str = "info"
    message: str
    step_id: str | None = None


class ExecutionStepResult(BaseModel):
    id: str
    index: int
    keyword: str
    description: str = ""
    status: StepStatus = "pending"
    started_at: str | None = None
    finished_at: str | None = None
    duration_ms: int | None = None
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    error_message: str = ""
    error_detail: str = ""
    attachments: list[str] = Field(default_factory=list)


class ExecutionTask(BaseModel):
    id: str
    script_id: str
    script_name: str
    script_revision: int
    status: TaskStatus = "pending"
    environment: str = "local"
    target_device: str = ""
    variables: dict[str, Any] = Field(default_factory=dict)
    executor: str = "local"
    created_at: str = Field(default_factory=utc_now)
    started_at: str | None = None
    finished_at: str | None = None
    duration_ms: int | None = None
    log_path: str = ""
    report_dir: str = ""
    steps: list[ExecutionStepResult] = Field(default_factory=list)
    logs: list[ExecutionLogEntry] = Field(default_factory=list)
    error_message: str = ""


class ExecutionTaskSummary(BaseModel):
    id: str
    script_id: str
    script_name: str
    script_revision: int
    status: TaskStatus
    environment: str
    target_device: str
    executor: str
    created_at: str
    started_at: str | None
    finished_at: str | None
    duration_ms: int | None
    step_count: int
    passed_step_count: int
    failed_step_count: int


class ExecutionEventMessage(BaseModel):
    type: ExecutionEventType
    task_id: str
    status: TaskStatus | StepStatus | None = None
    step_id: str | None = None
    message: str = ""
    level: str = "info"
    timestamp: str = Field(default_factory=utc_now)
    task: ExecutionTask | None = None
    step: ExecutionStepResult | None = None
