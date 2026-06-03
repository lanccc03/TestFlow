import asyncio
from collections.abc import AsyncIterator

import pytest

from autotest.contracts import (
    FrameworkEvent,
    FrameworkKeywordDef,
    FrameworkRunRequest,
    FrameworkStep,
)


async def collect_events(request: FrameworkRunRequest) -> list[FrameworkEvent]:
    from autotest.entry import run_script

    return [event async for event in run_script(request)]


def make_request() -> FrameworkRunRequest:
    from autotest.contracts import CancellationToken

    return FrameworkRunRequest(
        task_id="task-1",
        script_id="script-1",
        script_name="Smoke Test",
        script_revision=1,
        steps=[
            FrameworkStep(
                id="step-1",
                index=0,
                keyword="fake.keyword",
                description="Fake step",
                enabled=True,
                params={},
            )
        ],
        variables={},
        environment={},
        target_device=None,
        log_path=None,
        report_dir=None,
        artifact_dir=None,
        cancellation_token=CancellationToken(),
    )


class FakeRuntime:
    def list_keywords(self) -> list[FrameworkKeywordDef]:
        return [FrameworkKeywordDef(name="fake.keyword", module="fake")]

    async def run_script(
        self,
        request: FrameworkRunRequest,
    ) -> AsyncIterator[FrameworkEvent]:
        yield FrameworkEvent(type="run_started", task_id=request.task_id)
        yield FrameworkEvent(
            type="run_finished",
            task_id=request.task_id,
            status="passed",
        )


@pytest.fixture(autouse=True)
def reset_runtime_override():
    from autotest import registry

    registry.reset_runtime_for_testing()
    yield
    registry.reset_runtime_for_testing()


def test_entry_delegates_keyword_listing_to_configured_runtime() -> None:
    from autotest import registry
    from autotest.entry import list_keywords

    registry.set_runtime_for_testing(FakeRuntime())

    assert list_keywords() == [FrameworkKeywordDef(name="fake.keyword", module="fake")]


def test_entry_delegates_script_execution_to_configured_runtime() -> None:
    from autotest import registry

    registry.set_runtime_for_testing(FakeRuntime())

    events = asyncio.run(collect_events(make_request()))

    assert [event.type for event in events] == ["run_started", "run_finished"]
    assert events[-1].status == "passed"


def test_registry_rejects_unknown_runtime(monkeypatch) -> None:
    from app.core.config import get_settings
    from autotest.registry import get_runtime

    monkeypatch.setenv("TESTFLOW_AUTOTEST_RUNTIME", "missing")
    get_settings.cache_clear()
    get_runtime.cache_clear()

    with pytest.raises(RuntimeError, match="Unknown autotest runtime: missing"):
        get_runtime()

    get_settings.cache_clear()
    get_runtime.cache_clear()
