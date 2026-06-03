from collections.abc import AsyncIterator

from autotest.contracts import FrameworkEvent, FrameworkKeywordDef, FrameworkRunRequest
from autotest.mock_runtime import KEYWORD_DEFINITIONS
from autotest.mock_runtime import run_script as run_mock_script


def list_keywords() -> list[FrameworkKeywordDef]:
    return list(KEYWORD_DEFINITIONS)


def run_script(request: FrameworkRunRequest) -> AsyncIterator[FrameworkEvent]:
    return run_mock_script(request)
