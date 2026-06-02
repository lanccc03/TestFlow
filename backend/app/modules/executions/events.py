from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from app.modules.executions.schemas import ExecutionEventMessage


class ExecutionEventBus:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[ExecutionEventMessage]] = set()

    @asynccontextmanager
    async def subscribe(self) -> AsyncIterator[asyncio.Queue[ExecutionEventMessage]]:
        queue: asyncio.Queue[ExecutionEventMessage] = asyncio.Queue()
        self._subscribers.add(queue)
        try:
            yield queue
        finally:
            self._subscribers.discard(queue)

    async def publish(self, message: ExecutionEventMessage) -> None:
        for subscriber in list(self._subscribers):
            await subscriber.put(message.model_copy(deep=True))
