from __future__ import annotations

from pathlib import Path

from app.modules.executions.schemas import ExecutionTask


class FrameworkReportFileMissing(Exception):
    pass


class FrameworkReportFileForbidden(Exception):
    pass


def resolve_framework_report_file(
    task: ExecutionTask,
    asset_path: str | None = None,
) -> Path:
    framework_report = task.framework_report
    if (
        framework_report is None
        or framework_report.kind != "html"
        or framework_report.source != "file"
    ):
        raise FrameworkReportFileMissing("Framework HTML report is not available")

    root = Path(framework_report.root_dir).expanduser().resolve(strict=False)
    if not root.is_dir():
        raise FrameworkReportFileMissing("Framework HTML report root is missing")

    requested = Path(asset_path if asset_path is not None else framework_report.entry)
    if asset_path is not None and requested.is_absolute():
        raise FrameworkReportFileForbidden("Framework report asset path is invalid")

    candidate = (
        requested.expanduser().resolve(strict=False)
        if requested.is_absolute()
        else (root / requested).resolve(strict=False)
    )
    if not candidate.is_relative_to(root):
        raise FrameworkReportFileForbidden(
            "Framework report file is outside the report root"
        )
    if not candidate.is_file():
        raise FrameworkReportFileMissing("Framework report file is missing")
    return candidate
