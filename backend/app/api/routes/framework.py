from json import JSONDecodeError
from typing import cast

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.errors import error_response
from autotest.contracts import FrameworkConfigError, JsonValue
from autotest.entry import read_config, write_config

router = APIRouter()


@router.get("/framework/config", response_model=None)
def get_framework_config() -> JsonValue | JSONResponse:
    try:
        return read_config()
    except FrameworkConfigError as exc:
        return _framework_config_error_response(exc)


@router.put("/framework/config", response_model=None)
async def update_framework_config(request: Request) -> JsonValue | JSONResponse:
    try:
        config = cast(JsonValue, await request.json())
        return write_config(config)
    except JSONDecodeError:
        return error_response(
            status_code=422,
            code="validation_error",
            message="Request validation failed",
            details=[
                {
                    "type": "json_invalid",
                    "loc": ["body"],
                    "msg": "JSON decode error",
                }
            ],
        )
    except FrameworkConfigError as exc:
        return _framework_config_error_response(exc)


def _framework_config_error_response(exc: FrameworkConfigError) -> JSONResponse:
    return error_response(
        status_code=exc.status_code,
        code=exc.code,
        message=exc.message,
        details=exc.details,
    )
