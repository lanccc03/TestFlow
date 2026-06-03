from collections.abc import AsyncIterator

from autotest.contracts import FrameworkEvent, FrameworkKeywordDef, FrameworkRunRequest
from autotest.registry import get_runtime


def list_keywords() -> list[FrameworkKeywordDef]:
    return get_runtime().list_keywords()


def run_script(request: FrameworkRunRequest) -> AsyncIterator[FrameworkEvent]:
    return get_runtime().run_script(request)
