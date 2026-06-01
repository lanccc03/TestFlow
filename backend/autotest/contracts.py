from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

FrameworkEventType = Literal[
    "run_started",
    "step_started",
    "log",
    "step_finished",
    "run_finished",
    "attachment",
    "run_error",
]
FrameworkStatus = Literal["passed", "failed", "canceled", "error"]
FrameworkLogLevel = Literal["debug", "info", "warning", "error"]


@dataclass
class CancellationToken:
    is_canceled: bool = False

    def cancel(self) -> None:
        self.is_canceled = True


@dataclass(frozen=True)
class FrameworkStep:
    id: str
    index: int
    keyword: str
    description: str
    enabled: bool
    params: dict[str, Any]


@dataclass(frozen=True)
class FrameworkRunRequest:
    task_id: str
    script_id: str
    script_name: str
    script_revision: int
    steps: list[FrameworkStep]
    variables: dict[str, Any]
    environment: dict[str, Any]
    target_device: dict[str, Any] | None
    log_path: Path | str | None
    report_dir: Path | str | None
    artifact_dir: Path | str | None
    cancellation_token: CancellationToken


@dataclass(frozen=True)
class FrameworkEvent:
    type: FrameworkEventType
    task_id: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    step_id: str | None = None
    step_index: int | None = None
    keyword: str | None = None
    message: str | None = None
    level: FrameworkLogLevel | None = None
    status: FrameworkStatus | None = None
    output: dict[str, Any] | None = None
    error_message: str | None = None
    error_detail: dict[str, Any] | str | None = None
    attachment_path: Path | str | None = None
    attachment_name: str | None = None
