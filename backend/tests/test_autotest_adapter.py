import asyncio
from typing import get_args

from autotest.contracts import (
    CancellationToken,
    FrameworkEvent,
    FrameworkEventType,
    FrameworkRunRequest,
    FrameworkStatus,
    FrameworkStep,
)
from autotest.entry import run_script


async def collect_events(request: FrameworkRunRequest) -> list[FrameworkEvent]:
    return [event async for event in run_script(request)]


def make_request(
    steps: list[FrameworkStep],
    cancellation_token: CancellationToken | None = None,
) -> FrameworkRunRequest:
    return FrameworkRunRequest(
        task_id="task-1",
        script_id="script-1",
        script_name="Smoke Test",
        script_revision=1,
        steps=steps,
        variables={},
        environment={},
        target_device=None,
        log_path=None,
        report_dir=None,
        artifact_dir=None,
        cancellation_token=cancellation_token or CancellationToken(),
    )


def event_types(events: list[FrameworkEvent]) -> list[str]:
    return [event.type for event in events]


def test_contract_event_types_include_adapter_surface() -> None:
    assert set(get_args(FrameworkEventType)) == {
        "run_started",
        "step_started",
        "log",
        "step_finished",
        "run_finished",
        "attachment",
        "run_error",
    }


def test_contract_statuses_include_run_and_step_statuses() -> None:
    assert set(get_args(FrameworkStatus)) == {
        "passed",
        "failed",
        "canceled",
        "error",
    }


def test_log_message_step_emits_passed_run_events() -> None:
    request = make_request(
        [
            FrameworkStep(
                id="step-1",
                index=0,
                keyword="log.message",
                description="Log hello",
                enabled=True,
                params={"message": "hello"},
            )
        ]
    )

    events = asyncio.run(collect_events(request))

    assert event_types(events) == [
        "run_started",
        "step_started",
        "log",
        "step_finished",
        "run_finished",
    ]
    assert events[2].message == "hello"
    assert events[3].status == "passed"
    assert events[3].output == {"message": "hello"}
    assert events[4].status == "passed"


def test_negative_wait_seconds_fails_step_and_run() -> None:
    request = make_request(
        [
            FrameworkStep(
                id="step-1",
                index=0,
                keyword="wait",
                description="Bad wait",
                enabled=True,
                params={"seconds": -1},
            )
        ]
    )

    events = asyncio.run(collect_events(request))

    assert event_types(events) == [
        "run_started",
        "step_started",
        "log",
        "step_finished",
        "run_finished",
    ]
    assert events[3].status == "failed"
    assert events[3].error_message == "wait.seconds must be greater than or equal to 0"
    assert events[4].status == "failed"


def test_cancellation_before_first_step_finishes_canceled() -> None:
    cancellation_token = CancellationToken()
    cancellation_token.cancel()
    request = make_request(
        [
            FrameworkStep(
                id="step-1",
                index=0,
                keyword="log.message",
                description="Log hello",
                enabled=True,
                params={"message": "hello"},
            )
        ],
        cancellation_token=cancellation_token,
    )

    events = asyncio.run(collect_events(request))

    assert event_types(events) == ["run_started", "run_finished"]
    assert events[1].status == "canceled"
