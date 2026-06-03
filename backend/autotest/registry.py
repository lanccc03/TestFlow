from functools import lru_cache

from app.core.config import get_settings
from autotest.mock_runtime import MockAutotestRuntime
from autotest.runtime import AutotestRuntime

_runtime_for_testing: AutotestRuntime | None = None


@lru_cache
def get_runtime() -> AutotestRuntime:
    if _runtime_for_testing is not None:
        return _runtime_for_testing

    settings = get_settings()
    match settings.autotest_runtime:
        case "mock":
            return MockAutotestRuntime()
        case "real":
            from autotest.real_runtime import RealAutotestRuntime

            return RealAutotestRuntime()
        case value:
            raise RuntimeError(f"Unknown autotest runtime: {value}")


def set_runtime_for_testing(runtime: AutotestRuntime) -> None:
    global _runtime_for_testing

    _runtime_for_testing = runtime
    get_runtime.cache_clear()


def reset_runtime_for_testing() -> None:
    global _runtime_for_testing

    _runtime_for_testing = None
    get_runtime.cache_clear()
