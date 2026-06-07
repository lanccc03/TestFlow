from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.modules.scp.service import ScpService
from app.modules.terminal.sessions import SshSessionRegistry


def test_local_tree_lists_files_and_rejects_missing_path(tmp_path: Path) -> None:
    local_file = tmp_path / "artifact.txt"
    local_dir = tmp_path / "logs"
    local_file.write_text("ready", encoding="utf-8")
    local_dir.mkdir()
    service = ScpService(SshSessionRegistry(), local_root=tmp_path)

    tree = service.list_local_tree(tmp_path)

    assert tree.path == str(tmp_path)
    assert [
        (node.name, node.path, node.type, node.size)
        for node in tree.items
    ] == [
        ("logs", str(local_dir), "directory", None),
        ("artifact.txt", str(local_file), "file", 5),
    ]

    with pytest.raises(ValueError, match="本地路径不存在"):
        service.list_local_tree(tmp_path / "missing")


@pytest.mark.anyio
async def test_remote_tree_uses_registered_ssh_sftp_session() -> None:
    registry = SshSessionRegistry()
    connection = FakeConnection()
    session_id = registry.register(
        connection=connection,
        host="127.0.0.1",
        username="tester",
        secrets=["secret-password"],
    )
    service = ScpService(registry)

    tree = await service.list_remote_tree(session_id, "/home/tester")

    assert connection.sftp.entered is True
    assert connection.sftp.listdir_paths == ["/home/tester"]
    assert [(node.name, node.path, node.type, node.size) for node in tree.items] == [
        ("logs", "/home/tester/logs", "directory", None),
        ("report.txt", "/home/tester/report.txt", "file", 12),
    ]


@pytest.mark.anyio
async def test_transfer_upload_download_retry_and_cancel(tmp_path: Path) -> None:
    registry = SshSessionRegistry()
    connection = FakeConnection()
    session_id = registry.register(
        connection=connection,
        host="127.0.0.1",
        username="tester",
        secrets=["secret-password"],
    )
    service = ScpService(registry, local_root=tmp_path)
    local_file = tmp_path / "upload.txt"
    local_file.write_text("ready", encoding="utf-8")

    upload = await service.create_upload(
        session_id=session_id,
        local_path=str(local_file),
        remote_path="/tmp/upload.txt",
    )
    download = await service.create_download(
        session_id=session_id,
        remote_path="/home/tester/report.txt",
        local_path=str(tmp_path / "report.txt"),
    )

    assert upload.status == "completed"
    assert upload.progress == 100
    assert download.status == "completed"
    assert connection.sftp.put_calls == [(str(local_file), "/tmp/upload.txt")]
    assert connection.sftp.get_calls == [
        ("/home/tester/report.txt", str(tmp_path / "report.txt"))
    ]

    connection.sftp.error = OSError("failed secret-password transfer")
    failed = await service.create_upload(
        session_id=session_id,
        local_path=str(local_file),
        remote_path="/tmp/failed.txt",
    )
    assert failed.status == "failed"
    assert failed.error_message == "failed [redacted] transfer"

    connection.sftp.error = None
    retried = await service.retry_transfer(failed.id)
    assert retried.status == "completed"

    canceled = await service.cancel_transfer(retried.id)
    assert canceled.status == "canceled"


def test_scp_api_requires_active_ssh_session_and_exposes_local_tree(
    tmp_path: Path,
) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        local_response = client.get("/api/scp/local/tree", params={"path": tmp_path})
        remote_response = client.get(
            "/api/scp/remote/tree",
            params={"session_id": "missing", "path": "/home/tester"},
        )

    assert local_response.status_code == 200
    assert local_response.json()["path"] == str(tmp_path)
    assert remote_response.status_code == 400
    assert remote_response.json()["error"]["code"] == "scp_session_unavailable"


class FakeConnection:
    def __init__(self) -> None:
        self.sftp = FakeSftp()

    def start_sftp_client(self) -> "FakeSftpContext":
        return FakeSftpContext(self.sftp)


class FakeSftpContext:
    def __init__(self, sftp: "FakeSftp") -> None:
        self.sftp = sftp

    async def __aenter__(self) -> "FakeSftp":
        self.sftp.entered = True
        return self.sftp

    async def __aexit__(self, *_args: Any) -> None:
        self.sftp.exited = True


class FakeSftp:
    def __init__(self) -> None:
        self.entered = False
        self.exited = False
        self.error: Exception | None = None
        self.listdir_paths: list[str] = []
        self.get_calls: list[tuple[str, str]] = []
        self.put_calls: list[tuple[str, str]] = []

    async def listdir(self, path: str) -> list[str]:
        self.listdir_paths.append(path)
        return ["logs", "report.txt"]

    async def stat(self, path: str) -> Any:
        attrs = type("FakeAttrs", (), {})()
        attrs.size = None if path.endswith("/logs") else 12
        attrs.permissions = 0o040755 if path.endswith("/logs") else 0o100644
        attrs.mtime = 1_787_817_600
        return attrs

    async def put(self, local_path: str, remote_path: str) -> None:
        if self.error:
            raise self.error
        self.put_calls.append((local_path, remote_path))

    async def get(self, remote_path: str, local_path: str) -> None:
        if self.error:
            raise self.error
        self.get_calls.append((remote_path, local_path))
