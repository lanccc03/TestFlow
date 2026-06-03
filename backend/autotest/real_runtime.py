from collections.abc import AsyncIterator

from autotest.contracts import FrameworkEvent, FrameworkKeywordDef, FrameworkRunRequest


class RealAutotestRuntime:
    def list_keywords(self) -> list[FrameworkKeywordDef]:
        raise NotImplementedError("Real autotest runtime is not implemented yet")

    def run_script(
        self,
        request: FrameworkRunRequest,
    ) -> AsyncIterator[FrameworkEvent]:
        raise NotImplementedError("Real autotest runtime is not implemented yet")
