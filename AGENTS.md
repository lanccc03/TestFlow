# Repository Guidelines

## Project Structure & Module Organization

TestFlow is a pnpm workspace with a desktop shell, web UI, and local backend.

- `apps/web/`: React 19 + Vite frontend. Source lives in `src/`; static entrypoint is `index.html`.
- `apps/desktop/`: Electron main and preload code in `src/main/` and `src/preload/`.
- `backend/`: FastAPI service in `app/`, with pytest tests in `tests/`.
- `data/reports/` and `data/scripts/`: local runtime data placeholders; keep generated or large local artifacts out of commits unless intentionally versioned.
- `docs/`: project documentation.

## Build, Test, and Development Commands

- `pnpm install`: install workspace JavaScript dependencies.
- `cd backend && uv sync`: install Python backend dependencies.
- `pnpm dev:web`: start Vite at `http://127.0.0.1:5174`.
- `pnpm dev:backend`: start FastAPI at `http://127.0.0.1:8000`.
- `pnpm dev:desktop`: build Electron and launch it against the Vite dev server.
- `pnpm check:web`: TypeScript-check and build the web app.
- `pnpm check:desktop`: type-check Electron code.
- `pnpm check:backend`: run Ruff checks for the backend.
- `pnpm test:backend`: run backend pytest tests.
- `pnpm check`: run all current checks and backend tests.

## Coding Style & Naming Conventions

Use TypeScript for frontend and Electron code. React components should be `PascalCase` (`App.tsx`), local variables and functions `camelCase`, and CSS classes descriptive kebab-case. Match the style of the file you edit; current web files use single quotes without semicolons, while Electron files use double quotes with semicolons.

Backend code targets Python 3.12. Use Ruff rules from `backend/pyproject.toml` with 88-character lines, sorted imports, modern type hints, and `snake_case` functions.

## Testing Guidelines

Backend tests use pytest and live under `backend/tests/` as `test_*.py`. Name tests by behavior, for example `test_health_returns_service_status_and_data_directory`. Add or update tests when changing FastAPI routes or backend logic. Frontend and desktop coverage currently relies on TypeScript/build checks; add package-level tests when introducing nontrivial UI or Electron behavior.

## Commit & Pull Request Guidelines

History currently uses short, direct commit messages such as `change default port to 5174` and `initial commit.` Keep commits focused and imperative. Pull requests should include a concise description, commands run, linked issues if applicable, and screenshots for visible UI changes.

## Agent-Specific Instructions

When answering library, framework, SDK, API, CLI, or cloud-service questions for this repo, use Context7 MCP for current documentation before responding. Do not use it for general refactoring, business-logic debugging, code review, or scripts written from scratch.
