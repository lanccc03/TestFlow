from __future__ import annotations

import stat
from datetime import UTC, datetime
from pathlib import Path
from posixpath import join as posix_join
from typing import Any
from uuid import uuid4

from app.modules.scp.events import ScpTransferEventBus
from app.modules.scp.schemas import ScpFileNode, ScpFileTree, ScpTransferEvent
from app.modules.scp.schemas import ScpTransferTask as ScpTransferTaskSchema
from app.modules.terminal.sessions import SshSession, SshSessionRegistry


class ScpService:
    def __init__(
        self,
        session_registry: SshSessionRegistry,
        *,
        local_root: Path | None = None,
        event_bus: ScpTransferEventBus | None = None,
    ) -> None:
        self.session_registry = session_registry
        self.local_root = local_root or Path.cwd()
        self.event_bus = event_bus or ScpTransferEventBus()
        self._transfers: dict[str, ScpTransferTaskSchema] = {}
        self._transfer_sessions: dict[str, str] = {}

    def list_local_tree(self, path: str | Path | None = None) -> ScpFileTree:
        target = Path(path) if path else self.local_root
        if not target.exists():
            raise ValueError("本地路径不存在")
        if not target.is_dir():
            raise ValueError("本地路径不是目录")

        items = [
            _local_node(child)
            for child in sorted(
                target.iterdir(),
                key=lambda item: (not item.is_dir(), item.name.lower()),
            )
        ]
        return ScpFileTree(path=str(target), items=items)

    async def list_remote_tree(self, session_id: str, path: str = ".") -> ScpFileTree:
        session = self._require_session(session_id)
        async with session.connection.start_sftp_client() as sftp:
            names = await sftp.listdir(path)
            items = []
            for name in sorted(names, key=str.lower):
                child_path = posix_join(path.rstrip("/") or "/", name)
                attrs = await sftp.stat(child_path)
                items.append(_remote_node(name, child_path, attrs))
        return ScpFileTree(path=path, items=items)

    def list_transfers(self) -> list[ScpTransferTaskSchema]:
        return list(self._transfers.values())

    async def create_upload(
        self,
        *,
        session_id: str,
        local_path: str,
        remote_path: str,
    ) -> ScpTransferTaskSchema:
        task = self._create_task(
            direction="upload",
            source_path=local_path,
            target_path=remote_path,
        )
        return await self._run_transfer(task, session_id)

    async def create_download(
        self,
        *,
        session_id: str,
        remote_path: str,
        local_path: str,
    ) -> ScpTransferTaskSchema:
        task = self._create_task(
            direction="download",
            source_path=remote_path,
            target_path=local_path,
        )
        return await self._run_transfer(task, session_id)

    async def retry_transfer(self, transfer_id: str) -> ScpTransferTaskSchema:
        task = self._require_transfer(transfer_id)
        if task.status != "failed":
            return task

        session_id = self._transfer_sessions.get(task.id, "")
        return await self._run_transfer(task, session_id)

    async def cancel_transfer(self, transfer_id: str) -> ScpTransferTaskSchema:
        task = self._require_transfer(transfer_id)
        updated = task.model_copy(update={"status": "canceled", "progress": 0})
        self._transfers[transfer_id] = updated
        await self._publish(updated)
        return updated

    def _create_task(
        self,
        *,
        direction: str,
        source_path: str,
        target_path: str,
    ) -> ScpTransferTaskSchema:
        task = ScpTransferTaskSchema(
            id=str(uuid4()),
            direction=direction,
            source_path=source_path,
            target_path=target_path,
            status="pending",
            progress=0,
        )
        self._transfers[task.id] = task
        return task

    async def _run_transfer(
        self,
        task: ScpTransferTaskSchema,
        session_id: str,
    ) -> ScpTransferTaskSchema:
        session = self._require_session(session_id)
        self._transfer_sessions[task.id] = session_id
        task = task.model_copy(update={"status": "running", "progress": 0})
        self._transfers[task.id] = task
        await self._publish(task)

        try:
            async with session.connection.start_sftp_client() as sftp:
                if task.direction == "upload":
                    await sftp.put(task.source_path, task.target_path)
                else:
                    await sftp.get(task.source_path, task.target_path)
        except Exception as exc:
            task = task.model_copy(
                update={
                    "status": "failed",
                    "progress": 0,
                    "error_message": _sanitize_message(str(exc), session.secrets),
                }
            )
        else:
            task = task.model_copy(
                update={
                    "status": "completed",
                    "progress": 100,
                    "error_message": None,
                }
            )

        self._transfers[task.id] = task
        await self._publish(task)
        return task

    def _require_session(self, session_id: str) -> SshSession:
        session = self.session_registry.get(session_id)
        if session is None:
            raise ScpSessionUnavailableError("SSH 会话不可用，请先连接 SSH 终端")
        return session

    def _require_transfer(self, transfer_id: str) -> ScpTransferTaskSchema:
        task = self._transfers.get(transfer_id)
        if task is None:
            raise ScpTransferNotFoundError("传输任务不存在")
        return task

    async def _publish(self, task: ScpTransferTaskSchema) -> None:
        await self.event_bus.publish(ScpTransferEvent(task=task))


class ScpSessionUnavailableError(ValueError):
    pass


class ScpTransferNotFoundError(ValueError):
    pass


def _local_node(path: Path) -> ScpFileNode:
    path_stat = path.stat()
    return ScpFileNode(
        name=path.name,
        path=str(path),
        type="directory" if path.is_dir() else "file",
        size=None if path.is_dir() else path_stat.st_size,
        modified_at=_timestamp(path_stat.st_mtime),
    )


def _remote_node(name: str, path: str, attrs: Any) -> ScpFileNode:
    permissions = getattr(attrs, "permissions", 0) or 0
    is_directory = stat.S_ISDIR(permissions)
    size = getattr(attrs, "size", None)
    return ScpFileNode(
        name=name,
        path=path,
        type="directory" if is_directory else "file",
        size=None if is_directory else size,
        modified_at=_timestamp(getattr(attrs, "mtime", None)),
    )


def _timestamp(value: float | int | None) -> str | None:
    if value is None:
        return None
    return datetime.fromtimestamp(value, UTC).isoformat()


def _sanitize_message(message: str, secrets: list[str]) -> str:
    sanitized = message
    for secret in secrets:
        if secret:
            sanitized = sanitized.replace(secret, "[redacted]")
    return sanitized
