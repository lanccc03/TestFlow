import asyncio
from collections.abc import AsyncIterator
from numbers import Real
from typing import Any

from autotest.contracts import (
    FrameworkEvent,
    FrameworkKeywordDef,
    FrameworkKeywordParam,
    FrameworkRunRequest,
    FrameworkStep,
)

MAX_WAIT_SECONDS = 2.0
WAIT_POLL_SECONDS = 0.05

KEYWORD_DEFINITIONS: list[FrameworkKeywordDef] = [
    FrameworkKeywordDef(
        name="wait",
        description="等待指定秒数",
        module="flow",
        parameters=(
            FrameworkKeywordParam(
                name="seconds",
                description="等待时长，单位秒",
                type="integer",
                default=1,
                required=True,
                example=5,
            ),
        ),
        example={"seconds": 5},
        enabled=True,
    ),
    FrameworkKeywordDef(
        name="log.message",
        description="记录执行日志消息",
        module="flow",
        parameters=(
            FrameworkKeywordParam(
                name="message",
                description="日志内容",
                type="string",
                default="",
                required=True,
                example="系统已进入测试状态",
            ),
        ),
        example={"message": "系统已进入测试状态"},
        enabled=True,
    ),
]


class MockKeywordError(Exception):
    """Raised when the mock runtime cannot execute a keyword."""


class MockRunCanceled(Exception):
    """Raised when the mock cancellation token requests a cooperative stop."""


class MockAutotestRuntime:
    def list_keywords(self) -> list[FrameworkKeywordDef]:
        return list(KEYWORD_DEFINITIONS)

    def run_script(
        self,
        request: FrameworkRunRequest,
    ) -> AsyncIterator[FrameworkEvent]:
        return _run_script(request)


async def _run_script(
    request: FrameworkRunRequest,
) -> AsyncIterator[FrameworkEvent]:
    yield FrameworkEvent(type="run_started", task_id=request.task_id)

    for step in request.steps:
        if request.cancellation_token.is_canceled:
            yield FrameworkEvent(
                type="run_finished",
                task_id=request.task_id,
                status="canceled",
            )
            return
        if not step.enabled:
            continue

        yield _step_event("step_started", request, step)

        try:
            output, step_events = await _run_step(request, step)
        except MockRunCanceled:
            yield _step_event("step_finished", request, step, status="canceled")
            yield FrameworkEvent(
                type="run_finished",
                task_id=request.task_id,
                status="canceled",
            )
            return
        except MockKeywordError as error:
            message = str(error)
            yield _step_event("log", request, step, message=message, level="error")
            yield _step_event(
                "step_finished",
                request,
                step,
                status="failed",
                error_message=message,
            )
            yield FrameworkEvent(
                type="run_finished",
                task_id=request.task_id,
                status="failed",
            )
            return

        for event in step_events:
            yield event

        if request.cancellation_token.is_canceled:
            yield _step_event("step_finished", request, step, status="canceled")
            yield FrameworkEvent(
                type="run_finished",
                task_id=request.task_id,
                status="canceled",
            )
            return

        yield _step_event(
            "step_finished",
            request,
            step,
            status="passed",
            output=output,
        )

    final_status = (
        "canceled" if request.cancellation_token.is_canceled else "passed"
    )
    yield FrameworkEvent(
        type="run_finished",
        task_id=request.task_id,
        status=final_status,
    )


async def _run_step(
    request: FrameworkRunRequest,
    step: FrameworkStep,
) -> tuple[dict[str, Any] | None, list[FrameworkEvent]]:
    if request.cancellation_token.is_canceled:
        raise MockRunCanceled

    match step.keyword:
        case "log.message":
            message = str(step.params.get("message", ""))
            return (
                {"message": message},
                [
                    _step_event(
                        "log",
                        request,
                        step,
                        message=message,
                        level="info",
                    )
                ],
            )
        case "wait":
            seconds = _parse_wait_seconds(step.params.get("seconds", 0))
            await _sleep_with_cancellation(seconds, request)
            return {"seconds": seconds}, []
        case _:
            raise MockKeywordError(f"Unknown keyword: {step.keyword}")


def _parse_wait_seconds(value: Any) -> float:
    if not isinstance(value, Real) or isinstance(value, bool):
        raise MockKeywordError("wait.seconds must be numeric")
    seconds = float(value)
    if seconds < 0:
        raise MockKeywordError("wait.seconds must be greater than or equal to 0")
    return seconds


async def _sleep_with_cancellation(
    seconds: float,
    request: FrameworkRunRequest,
) -> None:
    remaining = min(seconds, MAX_WAIT_SECONDS)
    while remaining > 0:
        if request.cancellation_token.is_canceled:
            raise MockRunCanceled
        interval = min(WAIT_POLL_SECONDS, remaining)
        await asyncio.sleep(interval)
        remaining -= interval
    if request.cancellation_token.is_canceled:
        raise MockRunCanceled


def _step_event(
    event_type: str,
    request: FrameworkRunRequest,
    step: FrameworkStep,
    **kwargs: Any,
) -> FrameworkEvent:
    return FrameworkEvent(
        type=event_type,
        task_id=request.task_id,
        step_id=step.id,
        step_index=step.index,
        keyword=step.keyword,
        **kwargs,
    )
