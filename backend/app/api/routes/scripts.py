from fastapi import APIRouter, Request

from app.core.errors import error_response
from app.modules.scripts import list_scripts, read_script

router = APIRouter()


@router.get("/scripts")
def list_script_summaries(_request: Request) -> dict[str, list[dict[str, object]]]:
    scripts = list_scripts()
    return {"items": [script.model_dump(mode="json") for script in scripts]}


@router.get("/scripts/{script_id}")
def get_script(script_id: str, _request: Request) -> dict[str, object]:
    try:
        script = read_script(script_id)
    except FileNotFoundError:
        return error_response(
            status_code=404,
            code="not_found",
            message="Script not found",
        )
    return script.model_dump(mode="json")
