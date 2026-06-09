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
    ExecutionTask,
    ExecutionTaskFilters,
    ExecutionTaskSummary,
)


def save_execution_report(settings: Settings, task: ExecutionTask) -> ExecutionTask:
    report_dir = _report_dir(settings, task)
    report_dir.mkdir(parents=True, exist_ok=True)

    task_record = ExecutionTaskRecord(
        id=task.id,
        case_id=task.case_id,
        case_name=task.case_name,
        status=task.status,
        created_at=task.created_at,
        started_at=task.started_at,
        finished_at=task.finished_at,
        duration_ms=task.duration_ms,
        error_message=task.error_message,
        log_path=task.log_path,
        report_dir=str(report_dir),
        report_json_path="",
        persisted_at=_utc_now(),
    )
    report_record = ExecutionReportRecord(
        task_id=task.id,
        task_json=json.dumps(task.model_dump(mode="json"), ensure_ascii=False),
        created_at=task.created_at,
        updated_at=_utc_now(),
    )

    with _session(settings) as session:
        _upsert_task_record(session, task_record)
        _upsert_report_record(session, report_record)
        session.commit()

    return task


def list_execution_task_summaries(
    settings: Settings,
    filters: ExecutionTaskFilters | None = None,
) -> list[ExecutionTaskSummary]:
    filters = filters or ExecutionTaskFilters()
    statement = select(ExecutionTaskRecord)
    if filters.case_id:
        statement = statement.where(ExecutionTaskRecord.case_id == filters.case_id)
    if filters.status:
        statement = statement.where(ExecutionTaskRecord.status == filters.status)
    if filters.created_from:
        cr_from = filters.created_from
        statement = statement.where(ExecutionTaskRecord.created_at >= cr_from)
    if filters.created_to:
        cr_to = filters.created_to
        statement = statement.where(ExecutionTaskRecord.created_at <= cr_to)
    statement = statement.order_by(desc(ExecutionTaskRecord.created_at))

    with _session(settings) as session:
        records = list(session.exec(statement).all())

    return [_summary_from_record(record) for record in records]


def get_execution_task(
    settings: Settings,
    task_id: str,
) -> ExecutionTask | None:
    return get_execution_report(settings, task_id)


def get_execution_report(
    settings: Settings,
    task_id: str,
) -> ExecutionTask | None:
    with _session(settings) as session:
        record = session.get(ExecutionReportRecord, task_id)

    if record is None:
        return None

    return ExecutionTask.model_validate(json.loads(record.task_json))


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


def _summary_from_record(record: ExecutionTaskRecord) -> ExecutionTaskSummary:
    return ExecutionTaskSummary(
        id=record.id,
        case_id=record.case_id,
        case_name=record.case_name,
        status=record.status,
        created_at=record.created_at,
        started_at=record.started_at,
        finished_at=record.finished_at,
        duration_ms=record.duration_ms,
    )


def _report_dir(settings: Settings, task: ExecutionTask) -> Path:
    if task.report_dir:
        return Path(task.report_dir)
    return settings.reports_dir / task.id


def _session(settings: Settings) -> Session:
    return Session(create_engine(f"sqlite:///{settings.database_path}", echo=False))
