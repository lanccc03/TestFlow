# 仓库指南

TestFlow 是 pnpm workspace，包含 Vite Web、Electron 桌面壳和 FastAPI 后端。修改时先遵守本文件，再匹配目标文件的既有风格。

## 目录

- `apps/web/`: React 19 + Vite 前端，源码在 `src/`，shadcn 组件在 `src/components/ui/`。
- `apps/desktop/`: Electron main/preload，位于 `src/main/`、`src/preload/`。
- `backend/`: FastAPI 服务在 `app/`，pytest 测试在 `tests/`。
- `docs/`: 项目文档、specs 和 plans。
- `data/reports/`、`data/scripts/`: 本地运行数据占位；不要提交生成产物或大型本地文件，除非明确需要。

## 常用命令

- `pnpm install`: 安装 JS workspace 依赖。
- `cd backend && uv sync`: 安装 Python 依赖。
- `pnpm dev:web`: 启动 Vite，`http://127.0.0.1:5174`。
- `pnpm dev:backend`: 启动 FastAPI，`http://127.0.0.1:8000`。
- `pnpm dev:desktop`: 构建 Electron 并连接 Vite dev server。
- `pnpm check:web`: Web 类型检查和构建。
- `pnpm --filter @testflow/web test`: Web Vitest。
- `pnpm check:desktop` / `pnpm test:desktop`: Electron 检查和测试。
- `pnpm check:backend` / `pnpm test:backend`: Ruff 和 pytest。
- `pnpm check`: 运行 Web 构建、桌面检查/测试、后端检查/测试；不包含 Web Vitest。

## 代码风格

- TypeScript: React 组件用 `PascalCase`，变量和函数用 `camelCase`。
- Python: 面向 Python 3.12，使用 `snake_case`，遵守 `backend/pyproject.toml` 的 Ruff 规则。
- Web 应用层通常用单引号且不写分号；shadcn 生成文件可能用双引号；Electron 使用双引号和分号。
- 不做无关重构；改动范围保持贴近当前任务。

## Web 前端
- 这是桌面端应用， 不需要检查验证移动端布局。
- 使用 Tailwind CSS v4 和 shadcn/ui。先查 `apps/web/src/components/ui/`，再决定是否新增组件。
- 新增 shadcn 组件用 `pnpm dlx shadcn@latest add <component> -c apps/web`，提交前审查生成内容；不要覆盖本地改过的 shadcn 文件。
- `apps/web/src/index.css` 只放 imports、theme tokens、shadcn base layer 和最小 reset；不要加入业务选择器或全局元素样式。
- 优先使用语义化 Tailwind token，如 `bg-background`、`text-muted-foreground`、`border-border`、`bg-sidebar`。
- 条件 class 使用 `cn()`；用 `gap-*`、`size-*` 和 Tailwind 响应式前缀，避免自定义 media query。
- 业务代码按 feature-first 放在 `apps/web/src/features/<domain>/`：`pages/` 负责路由组合，`components/` 负责 UI，`hooks/` 负责状态和副作用，`utils/` 负责纯函数，`constants.ts` / `types.ts` 放领域常量和类型。
- 共享配置放 `apps/web/src/app/config.ts`；全局布局放 `apps/web/src/components/layout/`；`App.tsx` 保持为初始化和路由入口。

## 后端

- 分层遵循 `api/routes -> modules/*/service -> modules/*/{repository, adapters} -> db/integrations`。
- Route 只处理 HTTP/WebSocket 边界、依赖注入和响应；业务编排放 service。
- Repository 负责领域数据读写；数据库会话和底层连接留在 `app.db.*`。
- 外部系统适配器放 `app.integrations.*`，业务规则留在 modules。
- 横切能力放 `app.core.*`。不要向 `backend/app/` 新增顶层业务模块；新领域放 `app.modules.<domain>`。

## 测试

- 后端测试位于 `backend/tests/test_*.py`。修改路由、service、adapter 或数据处理时更新 pytest。
- Web 测试位于 `apps/web/src`，文件名为 `*.test.ts` 或 `*.test.tsx`。修改路由行为、API client、组件交互或非平凡 UI 状态时更新 Vitest。
- 测试断言行为和语义，优先用 role、label、文本、URL 和 ARIA；不要读取 `src/index.css` 来断言业务 class。
- 可见 Web UI 变更需运行 `pnpm check:web`、`pnpm --filter @testflow/web test`，并在浏览器验证相关路由。

## Commit

- Commit message 保持简短直接，例如 `change default port to 5174`、`initial commit.`。

## Agent 专用

- 当回答本仓库中关于 library、framework、SDK、API、CLI 或 cloud service 的问题时，先使用 Context7 MCP 获取当前文档再回答。一般重构、业务逻辑调试、代码审查或从零编写脚本时不需要使用 Context7。
