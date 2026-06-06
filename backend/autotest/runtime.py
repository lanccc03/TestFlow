from collections.abc import AsyncIterator
from typing import Protocol

from autotest.contracts import (
    FrameworkEvent,
    FrameworkKeywordDef,
    FrameworkRunRequest,
    JsonValue,
)


class AutotestRuntime(Protocol):
    def list_keywords(self) -> list[FrameworkKeywordDef]:
        """Return keyword definitions supported by this runtime."""
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
