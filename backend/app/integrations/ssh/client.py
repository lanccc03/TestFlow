from collections.abc import Callable
from typing import Any

import asyncssh

from app.modules.terminal.schemas import SshConnectMessage

SshConnector = Callable[..., Any]


def default_ssh_connector() -> SshConnector:
    return asyncssh.connect


def build_connect_kwargs(request: SshConnectMessage) -> dict[str, Any]:
    connect_kwargs: dict[str, Any] = {
        "port": request.port,
        "username": request.username,
        "password": request.password,
    }
    if request.skip_host_key_check:
        connect_kwargs["known_hosts"] = None
    return connect_kwargs


def open_connection_context(
    request: SshConnectMessage,
    connector: SshConnector,
) -> Any:
    return connector(request.host, **build_connect_kwargs(request))


def open_process_context(connection: Any, request: SshConnectMessage) -> Any:
    return connection.create_process(
        term_type="xterm-256color",
        term_size=(request.cols, request.rows),
    )
