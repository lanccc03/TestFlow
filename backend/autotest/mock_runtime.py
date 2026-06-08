from collections.abc import AsyncIterator

from autotest.contracts import (
    FrameworkCaseSummary,
    FrameworkEvent,
    FrameworkRunRequest,
    JsonValue,
)

CASE_DEFINITIONS: list[FrameworkCaseSummary] = [
    FrameworkCaseSummary(
        id="case.smoke_cockpit",
        name="座舱冒烟测试",
        description="基础稳定性巡检",
        steps=("启动系统", "确认首页加载", "检查关键状态正常"),
    )
]


class MockAutotestRuntime:
    def __init__(self) -> None:
        self._config: JsonValue = {}

    def list_cases(self) -> list[FrameworkCaseSummary]:
        return list(CASE_DEFINITIONS)

    def get_case(self, case_id: str) -> FrameworkCaseSummary:
        for case in CASE_DEFINITIONS:
            if case.id == case_id:
                return case
        raise FileNotFoundError(case_id)

    def read_config(self) -> JsonValue:
        return self._config

    def write_config(self, config: JsonValue) -> JsonValue:
        self._config = config
        return self._config

    def run_script(
        self,
        request: FrameworkRunRequest,
    ) -> AsyncIterator[FrameworkEvent]:
        return _run_script(request)


async def _run_script(
    request: FrameworkRunRequest,
) -> AsyncIterator[FrameworkEvent]:
    yield FrameworkEvent(type="run_started", task_id=request.task_id)

    if request.cancellation_token.is_canceled:
        yield FrameworkEvent(
            type="run_finished",
            task_id=request.task_id,
            status="canceled",
        )
        return

    yield FrameworkEvent(
        type="log",
        task_id=request.task_id,
        message="框架用例日志：座舱冒烟测试开始执行",
        level="info",
    )

    final_status = "canceled" if request.cancellation_token.is_canceled else "passed"
    yield FrameworkEvent(
        type="run_finished",
        task_id=request.task_id,
        status=final_status,
    )
