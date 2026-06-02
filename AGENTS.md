# 仓库指南

TestFlow 是一个 pnpm workspace，包含 Vite Web 应用、Electron 桌面壳和 FastAPI 后端。修改代码时先遵守本文件，再按正在编辑文件的既有风格落地。

## 项目结构

- `apps/web/`: React 19 + Vite 前端。源码位于 `src/`；shadcn 组件位于 `src/components/ui/`。
- `apps/desktop/`: Electron main/preload 代码位于 `src/main/` 和 `src/preload/`。
- `backend/`: FastAPI 服务位于 `app/`，pytest 测试位于 `tests/`。
- `docs/`: 项目文档，包括 Superpowers specs 和 plans。
- `data/reports/`、`data/scripts/`: 本地运行数据占位目录。除非明确需要版本化，不要提交生成产物或大型本地文件。

## 常用命令

### 安装依赖

- `pnpm install`: 安装 workspace JavaScript 依赖。
- `cd backend && uv sync`: 安装 Python 后端依赖。

### 本地开发

- `pnpm dev:web`: 启动 Vite，地址为 `http://127.0.0.1:5174`。
- `pnpm dev:backend`: 启动 FastAPI，地址为 `http://127.0.0.1:8000`。
- `pnpm dev:desktop`: 构建 Electron 并连接 Vite dev server 启动桌面应用。

### 检查与测试

- `pnpm check:web`: 对 Web 应用执行类型检查和构建。
- `pnpm --filter @testflow/web test`: 运行 Web Vitest 测试。
- `pnpm check:desktop`: 对 Electron 代码执行类型检查。
- `pnpm test:desktop`: 运行 Electron 测试。
- `pnpm check:backend`: 运行后端 Ruff 检查。
- `pnpm test:backend`: 运行后端 pytest 测试。
- `pnpm check`: 运行 Web 构建、桌面检查/测试、后端检查/测试。它不运行 Web Vitest；涉及前端行为变更时需额外运行 `pnpm --filter @testflow/web test`。

## 代码风格

- 前端和 Electron 代码使用 TypeScript。React 组件使用 `PascalCase`，局部变量和函数使用 `camelCase`。
- Python 代码面向 Python 3.12，函数使用 `snake_case`，并遵循 `backend/pyproject.toml` 中的 Ruff 规则，包括 88 字符行宽、排序导入和现代类型标注。
- 匹配正在编辑文件的既有风格。应用层 Web 文件通常使用单引号且不写分号；生成的 shadcn UI 文件可能使用双引号；Electron 文件使用双引号和分号。

## Web 前端

### UI 与样式

Web 应用使用 Tailwind CSS v4 和 shadcn/ui。

- `apps/web/src/index.css` 只用于 imports、theme tokens、shadcn base layer 和最小全局 reset；不要在其中新增业务选择器或全局元素样式。
- 优先使用 shadcn 组件，而不是自定义 markup。添加组件前先检查 `apps/web/src/components/ui/`。
- 新增 shadcn 组件使用 `pnpm dlx shadcn@latest add <component> -c apps/web`，并在提交前审查生成文件。未经明确批准，不要覆盖本地修改过的 shadcn 组件。
- 使用语义化 Tailwind token，例如 `bg-background`、`text-muted-foreground`、`border-border`、`bg-sidebar`。
- 条件 class 使用 `cn()`；用 `gap-*` 替代 `space-*`；宽高相等时用 `size-*`；响应式使用 Tailwind 前缀，不写自定义 media query。

### 模块架构

Web 前端按 feature-first 组织。新增或修改业务页面时，优先落在对应 `apps/web/src/features/<domain>/` 下；不要把页面、表单、列表、请求、副作用和纯函数重新堆到单个 `*Page.tsx` 或聚合文件里。

- `features/<domain>/pages/`: 只放路由页面和页面组合逻辑。页面可以读取路由参数、调用 feature hooks、组合本 feature 组件，但应避免承载大段列表项、表单字段、日志面板等可复用 JSX。
- `features/<domain>/components/`: 放 feature 内部 UI 组件。组件通过 props 工作，不要在组件内创建 API client、直接访问 WebSocket、执行跨页面 mutation，或隐藏全局副作用。
- `features/<domain>/hooks/`: 放 React state、TanStack Query、mutation、WebSocket 订阅和页面派生状态。副作用逻辑优先进入 hook，而不是散在 JSX 组件里。
- `features/<domain>/utils/`: 放纯函数，例如过滤、验证、格式化、类型守卫、状态文案映射和命令建议。纯函数不要依赖 React，不要读写浏览器全局对象，便于 Vitest 单测。
- `features/<domain>/constants.ts` 和 `types.ts`: 放本 feature 专属常量和类型。
- 跨 feature 的后端地址、WebSocket 地址等共享配置放在 `apps/web/src/app/config.ts`。
- 每个 feature 使用 `index.ts` 导出路由页面，`apps/web/src/app/routes.tsx` 从 feature root 导入，例如 `@/features/scripts`、`@/features/execution`、`@/features/tools`。
- 全局应用壳放在 `apps/web/src/components/layout/`，例如 `AppShell`、`Sidebar`、`TopStatusBar`、`StatusPill`。`App.tsx` 保持为应用状态初始化和路由挂载入口，不重新承载导航和主布局 JSX。
- 新增业务域时沿用 `pages/`、`components/`、`hooks/`、`utils/`、`constants.ts`、`types.ts`、`index.ts` 的结构；如果某个目录暂时没有内容，可以不创建空目录。
- 拆分或新增模块时同步更新相关测试 import。测试文件可以留在 feature 根目录或与被测文件相邻，但应继续覆盖行为和语义，不以文件拆分本身作为断言目标。

## 后端架构

后端按清晰分层组织：`api/routes -> modules/*/service -> modules/*/{repository, adapters} -> db/integrations`。

- `app.api.routes.*` 只负责 HTTP/WebSocket 边界：解析请求、注入依赖、调用 service、返回响应；不要在 route 中编排业务流程或直接访问存储、外部集成。
- `app.modules.<domain>.service` 承载业务流程和用例编排；同一领域的 schemas、repository、validators、runner、events 等放在对应 `app.modules.<domain>` 包内。
- `app.modules.<domain>.repository` 负责本领域数据读写；数据库会话和底层连接放在 `app.db.*`，不要散落到 route 或跨领域 service 中。
- `app.integrations.*` 只放外部系统适配器，例如 SSH 客户端；业务规则留在 modules，避免集成层反向依赖业务层。
- `app.core.*` 放配置、日志、错误等横切基础设施；新增公共能力前先确认是否属于 core，而不是新建顶层业务模块。
- 不要向 `backend/app/` 新增顶层业务模块。新领域优先建在 `app.modules.<domain>`；跨领域共享逻辑先收敛到明确的 service 或 core 能力。

## 测试指南

- 后端测试使用 pytest，位于 `backend/tests/`，文件名为 `test_*.py`。修改 FastAPI 路由、service、adapter 或后端数据处理时，需要新增或更新后端测试。
- Web 测试使用 Vitest 和 Testing Library，位于 `apps/web/src`，文件名为 `*.test.ts` 或 `*.test.tsx`。修改路由行为、API client、组件交互或非平凡 UI 状态时，需要新增或更新 Web 测试。
- 测试应断言行为和语义，不断言已移除的样式 class。优先使用 role、label、文本、URL 和 ARIA 断言，例如用 `aria-current="page"` 验证当前导航。
- 不要添加读取 `src/index.css` 来验证业务 class 文本的测试。
- 涉及可见 Web UI 变更时，运行 `pnpm check:web`、`pnpm --filter @testflow/web test`，并在浏览器中验证受影响路由。

## Commit 与 Pull Request

- 当前历史使用简短直接的 commit message，例如 `change default port to 5174` 和 `initial commit.`。

## Agent 专用说明

当回答本仓库中关于 library、framework、SDK、API、CLI 或 cloud service 的问题时，先使用 Context7 MCP 获取当前文档再回答。一般重构、业务逻辑调试、代码审查或从零编写脚本时不需要使用 Context7。当前文档回答。

以下情况不需要使用 Context7：一般重构、从零编写脚本、调试业务逻辑、代码审查、通用编程概念。
