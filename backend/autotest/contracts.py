from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

type JsonValue = dict[str, Any] | list[Any] | str | int | float | bool | None

FrameworkEventType = Literal[
    "log",
    "framework_report",
    "run_finished",
    "run_error",
]
FrameworkStatus = Literal["passed", "failed", "canceled", "error"]
FrameworkLogLevel = Literal["debug", "info", "warning", "error"]


@dataclass
class CancellationToken:
    is_canceled: bool = False

    def cancel(self) -> None:
        self.is_canceled = True


class FrameworkConfigError(RuntimeError):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        status_code: int = 500,
        details: dict[str, Any] | list[Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


@dataclass(frozen=True)
class FrameworkCaseSummary:
    id: str
    name: str
    description: str = ""
    tag: str = ""
    steps: tuple[str, ...] = ()


@dataclass(frozen=True)
class FrameworkRunRequest:
    task_id: str
    case_id: str
    report_dir: Path | str | None
    cancellation_token: CancellationToken


@dataclass(frozen=True)
class FrameworkEvent:
    type: FrameworkEventType
    task_id: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    message: str | None = None
    level: FrameworkLogLevel | None = None
    status: FrameworkStatus | None = None
    error_message: str | None = None
