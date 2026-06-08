from collections.abc import AsyncIterator
from typing import Protocol

from autotest.contracts import (
    FrameworkCaseSummary,
    FrameworkEvent,
    FrameworkRunRequest,
    JsonValue,
)


class AutotestRuntime(Protocol):
    def list_cases(self) -> list[FrameworkCaseSummary]:
        """Return framework test cases available to execute."""
        ...

    def get_case(self, case_id: str) -> FrameworkCaseSummary:
        """Return one framework test case by stable ID."""
        ...

    def read_config(self) -> JsonValue:
        """Return the automation framework configuration as JSON."""
        ...

    def write_config(self, config: JsonValue) -> JsonValue:
        """Replace and return the automation framework configuration."""
        ...

    def run_script(
        self,
        request: FrameworkRunRequest,
    ) -> AsyncIterator[FrameworkEvent]:
        """Run a script and stream framework events."""
        ...
