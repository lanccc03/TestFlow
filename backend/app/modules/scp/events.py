import asyncio

from app.modules.scp.schemas import ScpTransferEvent


class ScpTransferEventBus:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[ScpTransferEvent]] = set()

    def subscribe(self) -> asyncio.Queue[ScpTransferEvent]:
        queue: asyncio.Queue[ScpTransferEvent] = asyncio.Queue()
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[ScpTransferEvent]) -> None:
        self._subscribers.discard(queue)

    async def publish(self, event: ScpTransferEvent) -> None:
        for queue in list(self._subscribers):
            await queue.put(event)
