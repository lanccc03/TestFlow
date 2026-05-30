# TestFlow

TestFlow is an Electron desktop app with a React/Vite frontend and a local FastAPI backend. Phase 0 provides the runnable development skeleton for the desktop shell, web app, and Python service.

## Prerequisites

- Node.js
- pnpm 10
- Python 3.12
- uv

## Install

```bash
pnpm install
cd backend && uv sync
```

## Development Commands

Run the web app:

```bash
pnpm dev:web
```

Run the Python backend:

```bash
pnpm dev:backend
```

Run Electron with the Vite dev server:

```bash
pnpm dev:desktop
```

Run frontend and desktop checks:

```bash
pnpm check:web
pnpm check:desktop
```

Run backend lint and tests:

```bash
pnpm check:backend
pnpm test:backend
```

Run all phase 0 checks:

```bash
pnpm check
```

## Backend Health Check

With `pnpm dev:backend` running, open:

```text
http://127.0.0.1:8000/health
```

The endpoint returns the service status, version, and local data directory.
