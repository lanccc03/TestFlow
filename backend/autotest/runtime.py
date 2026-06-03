from collections.abc import AsyncIterator
from typing import Protocol

from autotest.contracts import FrameworkEvent, FrameworkKeywordDef, FrameworkRunRequest


class AutotestRuntime(Protocol):
    def list_keywords(self) -> list[FrameworkKeywordDef]:
        """Return keyword definitions supported by this runtime."""
        ...

    def run_script(
        self,
        request: FrameworkRunRequest,
    ) -> AsyncIterator[FrameworkEvent]:
        """Run a script and stream framework events."""
        ...
