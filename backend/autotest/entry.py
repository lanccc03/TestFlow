from collections.abc import AsyncIterator

from autotest.contracts import (
    FrameworkCaseSummary,
    FrameworkEvent,
    FrameworkRunRequest,
    JsonValue,
)
from autotest.registry import get_runtime


def list_cases() -> list[FrameworkCaseSummary]:
    return get_runtime().list_cases()


def get_case(case_id: str) -> FrameworkCaseSummary:
    return get_runtime().get_case(case_id)


def read_config() -> JsonValue:
    return get_runtime().read_config()


def write_config(config: JsonValue) -> JsonValue:
    return get_runtime().write_config(config)


def run_script(request: FrameworkRunRequest) -> AsyncIterator[FrameworkEvent]:
    return get_runtime().run_script(request)
