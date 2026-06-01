from collections.abc import AsyncIterator

from autotest.contracts import FrameworkEvent, FrameworkRunRequest
from autotest.mock_runtime import run_script as run_mock_script


def run_script(request: FrameworkRunRequest) -> AsyncIterator[FrameworkEvent]:
    return run_mock_script(request)
