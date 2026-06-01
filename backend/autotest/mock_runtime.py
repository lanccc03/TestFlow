import asyncio
from collections.abc import AsyncIterator
from numbers import Real
from typing import Any

from autotest.contracts import FrameworkEvent, FrameworkRunRequest, FrameworkStep

MAX_WAIT_SECONDS = 2.0
WAIT_POLL_SECONDS = 0.05


class MockKeywordError(Exception):
    """Raised when the mock runtime cannot execute a keyword."""


async def run_script(
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
        except asyncio.CancelledError:
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
        raise asyncio.CancelledError

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
            raise asyncio.CancelledError
        interval = min(WAIT_POLL_SECONDS, remaining)
        await asyncio.sleep(interval)
        remaining -= interval


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
