from dataclasses import dataclass
from typing import Any
from uuid import uuid4


@dataclass
class SshSession:
    id: str
    connection: Any
    host: str
    username: str
    secrets: list[str]


class SshSessionRegistry:
    def __init__(self) -> None:
        self._sessions: dict[str, SshSession] = {}

    def register(
        self,
        *,
        connection: Any,
        host: str,
        username: str,
        secrets: list[str] | None = None,
    ) -> str:
        session_id = str(uuid4())
        self._sessions[session_id] = SshSession(
            id=session_id,
            connection=connection,
            host=host,
            username=username,
            secrets=secrets or [],
        )
        return session_id

    def get(self, session_id: str) -> SshSession | None:
        return self._sessions.get(session_id)

    def unregister(self, session_id: str | None) -> None:
        if session_id:
            self._sessions.pop(session_id, None)
