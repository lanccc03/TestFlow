from collections.abc import AsyncIterator

from autotest.contracts import (
    FrameworkCaseSummary,
    FrameworkConfigError,
    FrameworkEvent,
    FrameworkRunRequest,
    JsonValue,
)


class RealAutotestRuntime:
    def list_cases(self) -> list[FrameworkCaseSummary]:
        raise NotImplementedError(
            "Real autotest runtime case catalog is not implemented yet"
        )

    def get_case(self, case_id: str) -> FrameworkCaseSummary:
        raise NotImplementedError(
            f"Real autotest runtime case catalog is not implemented yet: {case_id}"
        )

    def read_config(self) -> JsonValue:
        raise FrameworkConfigError(
            code="framework_config_unavailable",
            message="Real autotest runtime config is not implemented yet",
            status_code=501,
        )

    def write_config(self, _config: JsonValue) -> JsonValue:
        raise FrameworkConfigError(
            code="framework_config_unavailable",
            message="Real autotest runtime config is not implemented yet",
            status_code=501,
        )

    def run_case(
        self,
        request: FrameworkRunRequest,
    ) -> AsyncIterator[FrameworkEvent]:
        raise NotImplementedError("Real autotest runtime is not implemented yet")
