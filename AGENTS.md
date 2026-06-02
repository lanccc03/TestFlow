# 仓库指南

## 项目结构

TestFlow 是一个 pnpm workspace，包含 Vite Web 应用、Electron 桌面壳和 FastAPI 后端。

- `apps/web/`: React 19 + Vite 前端。源码位于 `src/`；shadcn 组件位于 `src/components/ui/`。
- `apps/desktop/`: Electron main/preload 代码位于 `src/main/` 和 `src/preload/`。
- `backend/`: FastAPI 服务位于 `app/`，pytest 测试位于 `tests/`。
- `data/reports/` 和 `data/scripts/`: 本地运行数据占位目录。除非明确需要版本化，不要提交生成产物或大型本地文件。
- `docs/`: 项目文档，包括 Superpowers specs 和 plans。

## 常用命令

- `pnpm install`: 安装 workspace JavaScript 依赖。
- `cd backend && uv sync`: 安装 Python 后端依赖。
- `pnpm dev:web`: 启动 Vite，地址为 `http://127.0.0.1:5174`。
- `pnpm dev:backend`: 启动 FastAPI，地址为 `http://127.0.0.1:8000`。
- `pnpm dev:desktop`: 构建 Electron 并连接 Vite dev server 启动桌面应用。
- `pnpm check:web`: 对 Web 应用执行类型检查和构建。
- `pnpm --filter @testflow/web test`: 运行 Web Vitest 测试。
- `pnpm check:desktop`: 对 Electron 代码执行类型检查。
- `pnpm test:desktop`: 运行 Electron 测试。
- `pnpm check:backend`: 运行后端 Ruff 检查。
- `pnpm test:backend`: 运行后端 pytest 测试。
- `pnpm check`: 运行 Web 构建、桌面检查/测试、后端检查/测试。它不运行 Web Vitest；涉及前端行为变更时需额外运行 `pnpm --filter @testflow/web test`。

## 代码风格

前端和 Electron 代码使用 TypeScript。React 组件使用 `PascalCase`，局部变量和函数使用 `camelCase`，Python 函数使用 `snake_case`。

匹配正在编辑文件的现有风格。应用层 Web 文件通常使用单引号且不写分号；生成的 shadcn UI 文件可能使用双引号；Electron 文件使用双引号和分号。

后端代码面向 Python 3.12。遵循 `backend/pyproject.toml` 中的 Ruff 规则，包括 88 字符行宽、排序导入和现代类型标注。

## Web UI 与样式

Web 应用使用 Tailwind CSS v4 和 shadcn/ui。`apps/web/src/index.css` 只用于 imports、theme tokens、shadcn base layer 和最小全局 reset；不要在其中新增业务选择器或全局元素样式。

优先使用 shadcn 组件，而不是自定义 markup。添加组件前先检查 `apps/web/src/components/ui/`；新增 shadcn 组件使用 `pnpm dlx shadcn@latest add <component> -c apps/web`，并在提交前审查生成文件。未经明确批准，不要覆盖本地修改过的 shadcn 组件。

使用语义化 Tailwind token（如 `bg-background`、`text-muted-foreground`、`border-border`、`bg-sidebar`）和 JSX utilities。避免 raw colors 和自定义品牌变量，SSH terminal 等窄范围集成除外。条件 class 使用 `cn()`；用 `gap-*` 替代 `space-*`；宽高相等时用 `size-*`；响应式使用 Tailwind 前缀，不写自定义 media query。

不要重新引入已移除的业务 class，例如 `.content-panel`、`.script-*`、`.tool-*`、`.execution-*`、`.nav-link-active`、`.catalog-placeholder`，也不要恢复全局 `input/select/textarea/button/code` 样式。

## 测试指南

后端测试使用 pytest，位于 `backend/tests/`，文件名为 `test_*.py`。修改 FastAPI 路由、service、adapter 或后端数据处理时，需要新增或更新后端测试。

Web 测试使用 Vitest 和 Testing Library，位于 `apps/web/src`，文件名为 `*.test.ts` 或 `*.test.tsx`。修改路由行为、API client、组件交互或非平凡 UI 状态时，需要新增或更新 Web 测试。测试应断言行为和语义，不断言已移除的样式 class。优先使用 role、label、文本、URL 和 ARIA 断言，例如用 `aria-current="page"` 验证当前导航。不要添加读取 `src/index.css` 来验证业务 class 文本的测试。

涉及可见 Web UI 变更时，运行 `pnpm check:web`、`pnpm --filter @testflow/web test`，并在浏览器中验证受影响路由。

## 后端架构约束

后端采用模块化分层架构。详细设计见 `docs/superpowers/specs/2026-06-02-backend-architecture-design.md`；`AGENTS.md` 只保留必须遵守的日常约束，避免重复维护两份长文档。

- `backend/app/api/routes/` 只处理 HTTP/WebSocket 协议转换、依赖获取、响应组装和错误码映射。路由层不要直接读写 YAML、SQLite、日志文件，也不要直接调用 `asyncssh` 或 `autotest.entry`。
- 业务能力优先放在 `backend/app/modules/<domain>/` 下，按需拆分为 `schemas.py`、`models.py`、`repository.py`、`service.py`、`validators.py`、`runner.py` 或 `websocket.py`。新增后端业务不要再添加新的顶层业务文件。
- `service.py` 负责用例编排和跨 repository/integration 协调；`repository.py` 负责 SQLite、YAML 或文件索引等持久化细节；`schemas.py` 放 API/应用层 Pydantic 模型；`models.py` 放 SQLModel 表模型。
- 外部系统和第三方库适配放在 `backend/app/integrations/` 或明确的适配边界中。例如 SSH/asyncssh 逻辑放在 `app/integrations/ssh`，自动化框架入口继续通过 `backend/autotest` 边界接入。
- `backend/app/core/` 只放配置、日志、错误处理、生命周期等横切能力；`backend/app/db/` 只放数据库 engine/session/schema 初始化和迁移相关能力。
- 现有顶层兼容 shim（如 `app.config`、`app.errors`、`app.logging`、`app.command_library`、`app.script_catalog`、`app.ssh_terminal`、`app.execution.*`）只用于兼容旧导入。新增或修改应用代码时优先使用 `app.core.*`、`app.modules.*`、`app.integrations.*` 等规范路径。
- 保持依赖方向为 `api/routes -> modules/*/service -> repository/storage/integrations`。不要让 repository import FastAPI 路由、不要让 integrations 决定公开 API 响应结构、不要把底层框架对象直接透传给前端。
- 迁移架构时保持外部 API 兼容，除非明确提出破坏性变更。每次移动模块都需要保留或新增回归测试，并运行 `pnpm test:backend` 与 `pnpm check:backend`。

## Commit 与 Pull Request

当前历史使用简短直接的 commit message，例如 `change default port to 5174` 和 `initial commit.`。保持提交聚焦，并使用祈使语气。不要在 commit message 末尾添加 Co-Authored-By 行。

## Agent 专用说明

当回答本仓库中关于 library、framework、SDK、API、CLI 或 cloud service 的问题时，先使用 Context7 MCP 获取当前文档再回答。一般重构、业务逻辑调试、代码审查或从零编写脚本时不需要使用 Context7。
