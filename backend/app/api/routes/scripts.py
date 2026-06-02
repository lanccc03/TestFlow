from fastapi import APIRouter, Request, Response

from app.errors import error_response
from app.script_catalog import (
    ScriptValidationError,
    TestScript,
    delete_script,
    list_scripts,
    read_script,
    save_script,
)

router = APIRouter()


@router.get("/scripts")
def list_script_summaries(request: Request) -> dict[str, list[dict[str, object]]]:
    scripts = list_scripts(request.app.state.settings)
    return {"items": [script.model_dump(mode="json") for script in scripts]}


@router.get("/scripts/{script_id}")
def get_script(script_id: str, request: Request) -> dict[str, object]:
    try:
        script = read_script(request.app.state.settings, script_id)
    except FileNotFoundError:
        return error_response(
            status_code=404,
            code="not_found",
            message="Script not found",
        )
    return script.model_dump(mode="json")


@router.post("/scripts", response_model=None)
def save_script_endpoint(
    script: TestScript,
    request: Request,
    response: Response,
) -> dict[str, object] | Response:
    try:
        saved_script, was_created = save_script(request.app.state.settings, script)
    except ScriptValidationError as exc:
        return error_response(
            status_code=422,
            code="script_validation_error",
            message="Script validation failed",
            details=[issue.model_dump(mode="json") for issue in exc.issues],
        )

    response.status_code = 201 if was_created else 200
    return saved_script.model_dump(mode="json")


@router.delete("/scripts/{script_id}", status_code=204)
def delete_script_endpoint(script_id: str, request: Request) -> Response:
    was_deleted = delete_script(request.app.state.settings, script_id)
    if not was_deleted:
        return error_response(
            status_code=404,
            code="not_found",
            message="Script not found",
        )

    return Response(status_code=204)
