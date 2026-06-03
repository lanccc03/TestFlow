from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import desc
from sqlmodel import Session, create_engine, select

from app.core.config import Settings
from app.modules.executions.models import (
    ExecutionReportRecord,
    ExecutionTaskRecord,
    _utc_now,
)
from app.modules.executions.schemas import (
    ExecutionReport,
    ExecutionReportAttachment,
    ExecutionTask,
    ExecutionTaskFilters,
    ExecutionTaskSummary,
)


def save_execution_report(settings: Settings, task: ExecutionTask) -> ExecutionReport:
    report_dir = _report_dir(settings, task)
    report_dir.mkdir(parents=True, exist_ok=True)

    attachments = _attachment_index(task)
    report = ExecutionReport(
        task=task.model_copy(deep=True),
        attachments=attachments,
        raw_framework_report=None,
        framework_report=task.framework_report,
    )

    summary = _summary_from_task(task)
    task_record = ExecutionTaskRecord(
        id=task.id,
        script_id=task.script_id,
        script_name=task.script_name,
        script_revision=task.script_revision,
        status=task.status,
        environment=task.environment,
        target_device=task.target_device,
        executor=task.executor,
        created_at=task.created_at,
        started_at=task.started_at,
        finished_at=task.finished_at,
        duration_ms=task.duration_ms,
        step_count=summary.step_count,
        passed_step_count=summary.passed_step_count,
        failed_step_count=summary.failed_step_count,
        error_message=task.error_message,
        log_path=task.log_path,
        report_dir=str(report_dir),
        report_json_path="",
        variables_json=json.dumps(task.variables, ensure_ascii=False),
        persisted_at=_utc_now(),
    )
    report_record = ExecutionReportRecord(
        task_id=task.id,
        task_json=json.dumps(task.model_dump(mode="json"), ensure_ascii=False),
        attachments_json=json.dumps(
            [attachment.model_dump(mode="json") for attachment in attachments],
            ensure_ascii=False,
        ),
        raw_framework_report_json="null",
        created_at=task.created_at,
        updated_at=_utc_now(),
    )

    with _session(settings) as session:
        _upsert_task_record(session, task_record)
        _upsert_report_record(session, report_record)
        session.commit()

    return report


def list_execution_task_summaries(
    settings: Settings,
    filters: ExecutionTaskFilters | None = None,
) -> list[ExecutionTaskSummary]:
    filters = filters or ExecutionTaskFilters()
    statement = select(ExecutionTaskRecord)
    if filters.script_id:
        statement = statement.where(ExecutionTaskRecord.script_id == filters.script_id)
    if filters.status:
        statement = statement.where(ExecutionTaskRecord.status == filters.status)
    if filters.created_from:
        cr_from = filters.created_from
        statement = statement.where(ExecutionTaskRecord.created_at >= cr_from)
    if filters.created_to:
        cr_to = filters.created_to
        statement = statement.where(ExecutionTaskRecord.created_at <= cr_to)
    if filters.executor:
        statement = statement.where(ExecutionTaskRecord.executor == filters.executor)
    statement = statement.order_by(desc(ExecutionTaskRecord.created_at))

    with _session(settings) as session:
        records = list(session.exec(statement).all())

    return [_summary_from_record(record) for record in records]


def get_execution_task(
    settings: Settings,
    task_id: str,
) -> ExecutionTask | None:
    report = get_execution_report(settings, task_id)
    return report.task if report is not None else None


def get_execution_report(
    settings: Settings,
    task_id: str,
) -> ExecutionReport | None:
    with _session(settings) as session:
        record = session.get(ExecutionReportRecord, task_id)

    if record is None:
        return None

    task = ExecutionTask.model_validate(json.loads(record.task_json))
    attachments = [
        ExecutionReportAttachment.model_validate(attachment)
        for attachment in json.loads(record.attachments_json)
    ]
    raw_framework_report = json.loads(record.raw_framework_report_json)
    return ExecutionReport(
        task=task,
        attachments=attachments,
        raw_framework_report=raw_framework_report,
        framework_report=task.framework_report,
    )


def _upsert_task_record(
    session: Session,
    next_record: ExecutionTaskRecord,
) -> None:
    existing = session.get(ExecutionTaskRecord, next_record.id)
    if existing is None:
        session.add(next_record)
        return

    _SKIP_ON_UPSERT = {"persisted_at"}
    for field_name in type(next_record).model_fields:
        if field_name in _SKIP_ON_UPSERT:
            continue
        setattr(existing, field_name, getattr(next_record, field_name))
    session.add(existing)


def _upsert_report_record(
    session: Session,
    next_record: ExecutionReportRecord,
) -> None:
    existing = session.get(ExecutionReportRecord, next_record.task_id)
    if existing is None:
        session.add(next_record)
        return

    for field_name in type(next_record).model_fields:
        setattr(existing, field_name, getattr(next_record, field_name))
    session.add(existing)


def _summary_from_task(task: ExecutionTask) -> ExecutionTaskSummary:
    return ExecutionTaskSummary(
        id=task.id,
        script_id=task.script_id,
        script_name=task.script_name,
        script_revision=task.script_revision,
        status=task.status,
        environment=task.environment,
        target_device=task.target_device,
        executor=task.executor,
        created_at=task.created_at,
        started_at=task.started_at,
        finished_at=task.finished_at,
        duration_ms=task.duration_ms,
        step_count=len(task.steps),
        passed_step_count=sum(1 for step in task.steps if step.status == "passed"),
        failed_step_count=sum(1 for step in task.steps if step.status == "failed"),
    )


def _summary_from_record(record: ExecutionTaskRecord) -> ExecutionTaskSummary:
    return ExecutionTaskSummary(
        id=record.id,
        script_id=record.script_id,
        script_name=record.script_name,
        script_revision=record.script_revision,
        status=record.status,
        environment=record.environment,
        target_device=record.target_device,
        executor=record.executor,
        created_at=record.created_at,
        started_at=record.started_at,
        finished_at=record.finished_at,
        duration_ms=record.duration_ms,
        step_count=record.step_count,
        passed_step_count=record.passed_step_count,
        failed_step_count=record.failed_step_count,
    )


def _attachment_index(task: ExecutionTask) -> list[ExecutionReportAttachment]:
    attachments: list[ExecutionReportAttachment] = []
    for step in task.steps:
        for attachment_path in step.attachments:
            path = Path(attachment_path)
            attachments.append(
                ExecutionReportAttachment(
                    path=attachment_path,
                    name=path.name,
                    step_id=step.id,
                )
            )
    return attachments


def _report_dir(settings: Settings, task: ExecutionTask) -> Path:
    if task.report_dir:
        return Path(task.report_dir)
    return settings.reports_dir / task.id


def _session(settings: Settings) -> Session:
    return Session(create_engine(f"sqlite:///{settings.database_path}", echo=False))
