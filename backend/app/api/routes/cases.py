from fastapi import APIRouter, Request

from app.core.errors import error_response
from app.modules.cases import list_all_cases, read_case

router = APIRouter()


@router.get("/cases")
def list_cases_endpoint(_request: Request) -> dict[str, list[dict[str, object]]]:
    cases = list_all_cases()
    return {"items": [case.model_dump(mode="json") for case in cases]}


@router.get("/cases/{case_id}")
def get_case_endpoint(case_id: str, _request: Request) -> dict[str, object]:
    try:
        case = read_case(case_id)
    except FileNotFoundError:
        return error_response(
            status_code=404, code="not_found", message="Case not found"
        )
    return case.model_dump(mode="json")
