# Backend Terminal SSH Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `app/ssh_terminal.py` into `modules/terminal` and `integrations/ssh` while preserving `/ws/ssh` behavior and legacy imports.

**Architecture:** This is Phase 6 of the approved modular layered backend architecture. Terminal WebSocket protocol handling moves to `app.modules.terminal.websocket`, terminal request schemas move to `app.modules.terminal.schemas`, low-level asyncssh connection behavior moves behind `app.integrations.ssh.client`, and `app.ssh_terminal` remains a compatibility shim.

**Tech Stack:** FastAPI WebSockets, Starlette WebSocketDisconnect, Pydantic, asyncssh, asyncio, pytest, Ruff, pnpm backend scripts.

---

## Scope

This plan migrates only the interactive SSH terminal boundary.

It intentionally does not add:

- SCP file transfer.
- SSH session persistence.
- Credential persistence.
- Command library autocomplete changes.
- New WebSocket message types.

Public behavior must remain unchanged for:

- `WS /ws/ssh`
- `handle_ssh_terminal_websocket(websocket, connector=...)`
- Password redaction in errors and output.
- `skip_host_key_check` setting `known_hosts=None` only for that connection.
- Terminal input forwarding and resize handling.
- Cleanup of process and connection contexts.

Compatibility imports must remain available from:

- `app.ssh_terminal.SshConnectMessage`
- `app.ssh_terminal.SshConnector`
- `app.ssh_terminal.handle_ssh_terminal_websocket`
- `app.ssh_terminal._relay_output`
- `app.ssh_terminal._sanitize_message`
- `app.ssh_terminal._send_json`

## File Structure

Create:

- `backend/app/integrations/__init__.py`
  - Marks the integrations package.
- `backend/app/integrations/ssh/__init__.py`
  - Re-exports SSH connector types and helper functions.
- `backend/app/integrations/ssh/client.py`
  - Owns `asyncssh.connect`, connector type alias, SSH connect kwargs, and
    process creation.
- `backend/app/modules/terminal/__init__.py`
  - Re-exports terminal schemas and WebSocket handler.
- `backend/app/modules/terminal/schemas.py`
  - Holds `SshConnectMessage`.
- `backend/app/modules/terminal/websocket.py`
  - Owns WebSocket protocol loop, relay, send helper, and secret redaction.

Modify:

- `backend/app/ssh_terminal.py`
  - Replace with compatibility shim exports.
- `backend/app/api/routes/terminal.py`
  - Import from `app.modules.terminal.websocket`.
- `backend/tests/test_app_foundation.py`
  - Add canonical and compatibility import regression test.

Do not modify:

- `backend/app/modules/commands/*`
- `backend/app/modules/executions/*`
- `backend/app/modules/scripts/*`
- `backend/app/modules/keywords/*`

## Task 1: Add Terminal Module Import Regression Test

**Files:**

- Modify: `backend/tests/test_app_foundation.py`

- [ ] **Step 1: Add terminal module compatibility test**

Append this test to `backend/tests/test_app_foundation.py`:

```python
def test_terminal_modules_export_compatible_ssh_api() -> None:
    from app.integrations.ssh.client import SshConnector
    from app.modules.terminal.schemas import SshConnectMessage
    from app.modules.terminal.websocket import _relay_output
    from app.modules.terminal.websocket import _sanitize_message
    from app.modules.terminal.websocket import _send_json
    from app.modules.terminal.websocket import handle_ssh_terminal_websocket
    from app.ssh_terminal import SshConnectMessage as LegacySshConnectMessage
    from app.ssh_terminal import SshConnector as LegacySshConnector
    from app.ssh_terminal import _relay_output as legacy_relay_output
    from app.ssh_terminal import _sanitize_message as legacy_sanitize_message
    from app.ssh_terminal import _send_json as legacy_send_json
    from app.ssh_terminal import (
        handle_ssh_terminal_websocket as legacy_handle_ssh_terminal_websocket,
    )

    assert LegacySshConnectMessage is SshConnectMessage
    assert LegacySshConnector is SshConnector
    assert legacy_handle_ssh_terminal_websocket is handle_ssh_terminal_websocket
    assert legacy_relay_output is _relay_output
    assert legacy_sanitize_message is _sanitize_message
    assert legacy_send_json is _send_json
```

- [ ] **Step 2: Run the new test and verify it fails before implementation**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py::test_terminal_modules_export_compatible_ssh_api -v
```

Expected result:

```text
ModuleNotFoundError: No module named 'app.integrations'
```

- [ ] **Step 3: Keep the failing test uncommitted until Task 4**

Do not commit `backend/tests/test_app_foundation.py` yet. Task 4 makes this
test pass and commits it with the compatibility shim.

Confirm the uncommitted test change:

```powershell
git status --short
```

Expected output includes:

```text
 M backend/tests/test_app_foundation.py
```

## Task 2: Create SSH Integration Client

**Files:**

- Create: `backend/app/integrations/__init__.py`
- Create: `backend/app/integrations/ssh/__init__.py`
- Create: `backend/app/integrations/ssh/client.py`

- [ ] **Step 1: Create integrations package marker**

Create `backend/app/integrations/__init__.py` with:

```python
"""External system integrations."""
```

- [ ] **Step 2: Create SSH integration client**

Create `backend/app/integrations/ssh/client.py` with:

```python
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
```

- [ ] **Step 3: Create SSH package exports**

Create `backend/app/integrations/ssh/__init__.py` with:

```python
from app.integrations.ssh.client import (
    SshConnector,
    build_connect_kwargs,
    default_ssh_connector,
    open_connection_context,
    open_process_context,
)

__all__ = [
    "SshConnector",
    "build_connect_kwargs",
    "default_ssh_connector",
    "open_connection_context",
    "open_process_context",
]
```

- [ ] **Step 4: Keep the SSH integration changes uncommitted until Task 3**

Do not commit the SSH integration files yet. `client.py` imports
`SshConnectMessage`, which Task 3 creates. Task 3 commits the SSH integration
and terminal module together after both sides can import cleanly.

Confirm the uncommitted files:

```powershell
git status --short
```

Expected output includes:

```text
?? backend/app/integrations/
```

## Task 3: Create Terminal Schemas and WebSocket Module

**Files:**

- Create: `backend/app/modules/terminal/__init__.py`
- Create: `backend/app/modules/terminal/schemas.py`
- Create: `backend/app/modules/terminal/websocket.py`

- [ ] **Step 1: Create terminal schemas**

Create `backend/app/modules/terminal/schemas.py` with:

```python
from pydantic import BaseModel, Field


class SshConnectMessage(BaseModel):
    type: str
    host: str = Field(min_length=1)
    port: int = Field(default=22, ge=1, le=65535)
    username: str = Field(min_length=1)
    password: str = ""
    cols: int = Field(default=80, ge=1)
    rows: int = Field(default=24, ge=1)
    skip_host_key_check: bool = False
```

- [ ] **Step 2: Create terminal WebSocket module**

Create `backend/app/modules/terminal/websocket.py` with:

```python
import asyncio
from typing import Any

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

from app.integrations.ssh.client import (
    SshConnector,
    default_ssh_connector,
    open_connection_context,
    open_process_context,
)
from app.modules.terminal.schemas import SshConnectMessage


async def handle_ssh_terminal_websocket(
    websocket: WebSocket,
    connector: SshConnector | None = None,
) -> None:
    resolved_connector = connector or default_ssh_connector()
    await websocket.accept()
    secrets: list[str] = []
    connection_context: Any | None = None
    process_context: Any | None = None
    process: Any | None = None
    output_task: asyncio.Task[None] | None = None

    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")

            if message_type == "connect":
                request = SshConnectMessage.model_validate(message)
                secrets = [request.password]
                await _send_json(
                    websocket,
                    {"type": "status", "status": "connecting"},
                )

                connection_context = open_connection_context(
                    request,
                    resolved_connector,
                )
                connection = await connection_context.__aenter__()
                process_context = open_process_context(connection, request)
                process = await process_context.__aenter__()
                output_task = asyncio.create_task(
                    _relay_output(websocket, process, secrets)
                )
                await _send_json(websocket, {"type": "status", "status": "connected"})
                await asyncio.sleep(0)
            elif message_type == "input" and process is not None:
                data = message.get("data", "")
                if isinstance(data, str):
                    process.stdin.write(data)
            elif message_type == "resize" and process is not None:
                cols = message.get("cols")
                rows = message.get("rows")
                if isinstance(cols, int) and isinstance(rows, int):
                    process.change_terminal_size(cols, rows)
            elif message_type == "disconnect":
                break
    except WebSocketDisconnect:
        return
    except Exception as exc:
        message = _sanitize_message(str(exc), secrets)
        await _send_json(
            websocket,
            {"type": "status", "status": "error", "message": message},
        )
        await _send_json(websocket, {"type": "error", "message": message})
    finally:
        if output_task is not None:
            output_task.cancel()
            try:
                await output_task
            except asyncio.CancelledError:
                pass

        if process_context is not None:
            await process_context.__aexit__(None, None, None)
        if connection_context is not None:
            await connection_context.__aexit__(None, None, None)

        await _send_json(websocket, {"type": "status", "status": "disconnected"})


async def _relay_output(
    websocket: WebSocket,
    process: Any,
    secrets: list[str],
) -> None:
    while True:
        data = await process.stdout.read(4096)
        if not data:
            return
        await _send_json(
            websocket,
            {
                "type": "output",
                "data": _sanitize_message(str(data), secrets),
            },
        )


async def _send_json(websocket: WebSocket, message: dict[str, Any]) -> None:
    try:
        await websocket.send_json(message)
    except (RuntimeError, WebSocketDisconnect):
        return


def _sanitize_message(message: str, secrets: list[str]) -> str:
    sanitized = message
    for secret in secrets:
        if secret:
            sanitized = sanitized.replace(secret, "[redacted]")
    return sanitized
```

- [ ] **Step 3: Create terminal package exports**

Create `backend/app/modules/terminal/__init__.py` with:

```python
from app.modules.terminal.schemas import SshConnectMessage

__all__ = ["SshConnectMessage"]
```

- [ ] **Step 4: Run terminal import smoke checks**

Run:

```powershell
cd backend
uv run python -c "from app.modules.terminal.schemas import SshConnectMessage; from app.modules.terminal.websocket import handle_ssh_terminal_websocket; print(SshConnectMessage(type='connect', host='h', username='u').port, handle_ssh_terminal_websocket.__name__)"
uv run python -c "from app.integrations.ssh.client import build_connect_kwargs; from app.modules.terminal.schemas import SshConnectMessage; print(build_connect_kwargs(SshConnectMessage(type='connect', host='h', username='u', password='p', skip_host_key_check=True))['known_hosts'])"
```

Expected output:

```text
22 handle_ssh_terminal_websocket
None
```

- [ ] **Step 5: Commit terminal module and SSH integration together**

Run:

```powershell
git add backend/app/integrations/__init__.py backend/app/integrations/ssh/__init__.py backend/app/integrations/ssh/client.py backend/app/modules/terminal/__init__.py backend/app/modules/terminal/schemas.py backend/app/modules/terminal/websocket.py
git commit -m "add terminal ssh modules"
```

## Task 4: Replace Legacy SSH Terminal With Compatibility Shim

**Files:**

- Modify: `backend/app/ssh_terminal.py`
- Modify: `backend/tests/test_app_foundation.py`

- [ ] **Step 1: Replace legacy SSH terminal module with compatibility exports**

Replace the full contents of `backend/app/ssh_terminal.py` with:

```python
from app.integrations.ssh.client import SshConnector
from app.modules.terminal.schemas import SshConnectMessage
from app.modules.terminal.websocket import (
    _relay_output,
    _sanitize_message,
    _send_json,
    handle_ssh_terminal_websocket,
)

__all__ = [
    "SshConnectMessage",
    "SshConnector",
    "_relay_output",
    "_sanitize_message",
    "_send_json",
    "handle_ssh_terminal_websocket",
]
```

- [ ] **Step 2: Run compatibility and SSH terminal tests**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py::test_terminal_modules_export_compatible_ssh_api tests/test_ssh_terminal.py -v
```

Expected result:

```text
passed
```

- [ ] **Step 3: Commit terminal compatibility shim and test**

Run:

```powershell
git add backend/app/ssh_terminal.py backend/tests/test_app_foundation.py
git commit -m "add ssh terminal compatibility shim"
```

## Task 5: Update API Route to Canonical Terminal Module

**Files:**

- Modify: `backend/app/api/routes/terminal.py`

- [ ] **Step 1: Update terminal route import**

In `backend/app/api/routes/terminal.py`, replace:

```python
from app.ssh_terminal import handle_ssh_terminal_websocket
```

with:

```python
from app.modules.terminal.websocket import handle_ssh_terminal_websocket
```

- [ ] **Step 2: Verify app code no longer imports legacy SSH terminal module**

Run:

```powershell
rg "from app\.ssh_terminal|import app\.ssh_terminal" backend/app
```

Expected result:

```text
No matches.
```

Tests may continue importing `app.ssh_terminal` to verify compatibility.

- [ ] **Step 3: Run affected tests**

Run:

```powershell
pnpm test:backend -- tests/test_app_foundation.py tests/test_ssh_terminal.py -v
```

Expected result:

```text
passed
```

- [ ] **Step 4: Commit canonical terminal route import**

Run:

```powershell
git add backend/app/api/routes/terminal.py
git commit -m "use terminal module in api route"
```

## Task 6: Run Full Backend Verification

**Files:**

- No source edits expected.

- [ ] **Step 1: Run all backend tests**

Run:

```powershell
pnpm test:backend
```

Expected result:

```text
All collected backend tests pass.
```

- [ ] **Step 2: Run backend lint check**

Run:

```powershell
pnpm check:backend
```

Expected result:

```text
All checks passed!
```

- [ ] **Step 3: Inspect final status**

Run:

```powershell
git status --short
git diff --stat HEAD
```

Expected result:

```text
No uncommitted source changes after the final verification commit, or only the current task changes ready to commit.
```

- [ ] **Step 4: Commit verification-only edits only if files changed**

If no files changed, do not commit. If formatting or import order changed files,
commit them with:

```powershell
git add backend/app backend/tests
git commit -m "verify terminal ssh module"
```

## Self-Review

Spec coverage:

- Terminal schema extraction is covered by Task 3.
- SSH integration boundary is covered by Task 2.
- WebSocket protocol extraction is covered by Task 3.
- `app.ssh_terminal` compatibility is covered by Task 4.
- API route canonical import is covered by Task 5.
- Full backend verification is covered by Task 6.

Completion wording scan:

- No steps contain unspecified implementation work.
- Every source edit step includes concrete file paths and code.

Type consistency:

- `SshConnectMessage` keeps the same fields and validation constraints.
- `SshConnector` remains `Callable[..., Any]`.
- `handle_ssh_terminal_websocket` still accepts `connector=` for tests.
- `_sanitize_message`, `_send_json`, and `_relay_output` remain importable from
  `app.ssh_terminal`.
- `skip_host_key_check=True` still maps to `known_hosts=None`.

## Execution Handoff

Plan complete and saved to
`docs/superpowers/plans/2026-06-02-backend-terminal-ssh-module-plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task,
   review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using
   executing-plans, batch execution with checkpoints.
