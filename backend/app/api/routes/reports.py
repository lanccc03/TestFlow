from fastapi import APIRouter, Request, Response

from app.api.dependencies import execution_service
from app.core.errors import error_response
from app.modules.executions.schemas import ExecutionTaskFilters, TaskStatus

router = APIRouter()


@router.get("/reports")
def list_reports_endpoint(
    request: Request,
    script_id: str | None = None,
    status: TaskStatus | None = None,
    created_from: str | None = None,
    created_to: str | None = None,
    executor: str | None = None,
) -> dict[str, list[dict[str, object]]]:
    service = execution_service(request)
    filters = ExecutionTaskFilters(
        script_id=script_id,
        status=status,
        created_from=created_from,
        created_to=created_to,
        executor=executor,
    )
    return {
        "items": [
            summary.model_dump(mode="json") for summary in service.list_tasks(filters)
        ]
    }


@router.get("/reports/{task_id}", response_model=None)
def get_report_endpoint(task_id: str, request: Request) -> dict[str, object] | Response:
    service = execution_service(request)
    report = service.get_report(task_id)
    if report is None:
        return error_response(
            status_code=404,
            code="not_found",
            message="Report not found",
        )

    return report.model_dump(mode="json")
