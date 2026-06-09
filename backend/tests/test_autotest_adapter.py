import asyncio
from typing import get_args

from autotest.contracts import (
    CancellationToken,
    FrameworkEvent,
    FrameworkEventType,
    FrameworkRunRequest,
    FrameworkStatus,
)
from autotest.entry import run_case


async def collect_events(request: FrameworkRunRequest) -> list[FrameworkEvent]:
    return [event async for event in run_case(request)]


def make_request(
    cancellation_token: CancellationToken | None = None,
) -> FrameworkRunRequest:
    return FrameworkRunRequest(
        task_id="task-1",
        case_id="case.smoke_cockpit",
        report_dir=None,
        cancellation_token=cancellation_token or CancellationToken(),
    )


def event_types(events: list[FrameworkEvent]) -> list[str]:
    return [event.type for event in events]


def test_contract_event_types_include_adapter_surface() -> None:
    assert set(get_args(FrameworkEventType)) == {
        "log",
        "framework_report",
        "run_finished",
        "run_error",
    }


def test_contract_statuses_include_run_and_step_statuses() -> None:
    assert set(get_args(FrameworkStatus)) == {
        "passed",
        "failed",
        "canceled",
        "error",
    }


def test_cancellation_before_framework_case_starts_finishes_canceled() -> None:
    cancellation_token = CancellationToken()
    cancellation_token.cancel()
    request = make_request(cancellation_token=cancellation_token)

    events = asyncio.run(collect_events(request))

    assert event_types(events) == ["run_finished"]
    assert events[0].status == "canceled"


def test_list_cases_returns_framework_case_metadata() -> None:
    from autotest.entry import list_cases

    cases = list_cases()

    assert cases[0].id == "case.smoke_cockpit"
    assert cases[0].name == "座舱冒烟测试"
    assert cases[0].description == "基础稳定性巡检"
    assert cases[0].steps == ("启动系统", "确认首页加载", "检查关键状态正常")


def test_get_case_returns_framework_case_metadata() -> None:
    from autotest.entry import get_case

    case = get_case("case.smoke_cockpit")

    assert case.name == "座舱冒烟测试"
    assert case.steps[1] == "确认首页加载"


def test_get_case_raises_file_not_found_for_missing_case() -> None:
    from autotest.entry import get_case

    try:
        get_case("missing")
    except FileNotFoundError as error:
        assert "missing" in str(error)
    else:
        raise AssertionError("expected FileNotFoundError")


def test_case_execution_streams_framework_logs() -> None:
    request = make_request()

    events = asyncio.run(collect_events(request))

    assert event_types(events) == ["log", "run_finished"]
    assert events[0].message == "框架用例日志：座舱冒烟测试开始执行"
    assert events[1].status == "passed"
