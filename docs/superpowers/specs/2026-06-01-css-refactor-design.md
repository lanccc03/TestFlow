# CSS 重构设计方案：全面 Tailwind 化

**日期**: 2026-06-01
**状态**: 已确认
**范围**: `apps/web/src/index.css` 及所有引用自定义 CSS class 的组件

---

## 目标

将 `apps/web` 项目从"双轨样式体系"（shadcn CSS 变量 + 硬编码手工 CSS）统一为以 shadcn CSS 变量为唯一颜色源、Tailwind utilities + shadcn 组件为唯一表现层的单一样式体系。

## 关键决策

| 决策 | 选择 |
|---|---|
| 修复策略 | **全面 Tailwind 化** — 删除自定义 CSS，改用 Tailwind utilities |
| UI 组件 | **用 shadcn 组件替换** — `<Button>`, `<Badge>`, `<Card>` 等替代自定义 .button-* .badge-* |
| 品牌色 | **完全使用 shadcn 默认色板** — 不引入自定义品牌变量，使用项目已有的 oklch token |

## 架构对比

### 现状

```
CSS Variables (shadcn token)     手工 CSS (~750 行硬编码)
        │                              │
        ▼                              ▼
  shadcn 组件 (少量使用)         自定义 class (大量使用)
        │                              │
        └──────────┬───────────────────┘
                   ▼
              页面渲染（暗色模式下自定义部分不变色）
```

### 目标

```
CSS Variables (shadcn token) — 唯一颜色源
        │
        ├──▶ shadcn 组件 (Button, Badge, Card, Alert, Empty 等)
        │
        └──▶ Tailwind Utilities (bg-card, text-muted-foreground, border-border 等)
```

## 颜色映射

所有硬编码颜色统一映射到 shadcn 默认 token（项目已有的 `:root` 变量）：

| 当前硬编码 | 用途 | 目标 token |
|---|---|---|
| `#eef3f5` | 页面背景 | `bg-background` |
| `#ffffff` | 卡片/面板背景 | `bg-card` |
| `#10232a` | 侧边栏背景 | `bg-sidebar` |
| `#172026` | 主文字 | `text-foreground` |
| `#64757b` / `#65767c` / `#66777d` | 次要文字 | `text-muted-foreground` |
| `#eef5f6` / `#f8fbfc` | 次要背景 | `bg-secondary` / `bg-muted` |
| `#0f5c61` | 主按钮 | `bg-primary` |
| `#d6e1e5` / `#cbdde1` / `#dbe6e9` | 边框 | `border-border` |
| `#933f24` | 错误文字 | `text-destructive` |
| `#fff7f4` | 错误背景 | `bg-destructive/10` |
| `#e6f7ed` / `#dff5e6` | 成功背景 | `bg-green-50`（Tailwind 内置） |
| `#20703a` / `#22643a` | 成功文字 | `text-green-700`（Tailwind 内置） |
| `#fff4df` / `#fff0d1` | 警告背景 | `bg-amber-50`（Tailwind 内置） |
| `#8a5a10` / `#87560b` | 警告文字 | `text-amber-700`（Tailwind 内置） |
| `#79c7bd` | 品牌强调 | `bg-primary/60`（近似） |
| `#e7f7f3` | 活跃导航 | `bg-primary/10` |

## 文件变更计划

### 1. `index.css` — 大幅删减

**删除 (~750 行)**:
- 所有硬编码颜色的自定义 class（`.sidebar`, `.brand`, `.nav-link`, `.topbar`, `.status-pill`, `.main-content`, `.content-panel`, `.section-heading`, `.catalog-*`, `.script-*`, `.editor-*`, `.step-*`, `.param-*`, `.validation-panel`, `.tool-*`, `.execution-*`, `.ssh-*`, `.terminal-*`, `.suggestion-*`, `.command-*`, `code`, `.button`, `.badge`, `.state-box`, `.compact-meta`, `.keyword-*`, `.form-*`, `.save-message`, `.catalog-placeholder`, `.catalog-error` 等）
- 自定义的 `input`, `select`, `textarea`, `button` 基础样式（shadcn 的 `@layer base` 已覆盖）
- 自定义响应式断点 `@media (max-width: 1180px)`, `@media (max-width: 820px)`, `@media (max-width: 640px)`

**保留**:
- `@import "tailwindcss"`, `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"`, `@import "@fontsource-variable/geist"`
- `@custom-variant dark`
- `:root` CSS 变量定义
- `.dark` 变量覆盖
- `@theme inline` 块
- `@layer base` 块（shadcn 生成的）
- `* { box-sizing: border-box }`, `body { margin: 0 }`, `#root { min-height: 100vh }` 等全局重置
- `@font-face` 如果有的话

**新增**:
- 无需新增变量 — 当前 `:root` 中已包含完整的 sidebar token（`--sidebar`, `--sidebar-foreground` 等，第 42-49 行）

### 2. `App.tsx` — 中等修改

- 侧边栏布局：`.app-frame` → `grid grid-cols-[264px_1fr] min-h-screen`
- 侧边栏：`.sidebar` → `bg-sidebar text-sidebar-foreground flex flex-col gap-7 py-[22px] px-[14px]`
- 品牌区：`.brand` → `flex items-center gap-3`
- 品牌图标：`.brand-mark` → shadcn 风格圆角图标
- 导航链接：`.nav-link` → Tailwind 原子类 + `NavLink` 的 `className` 回调
- 顶部栏：`.topbar` → `flex items-center justify-between bg-card/86 border-b min-h-[72px]`
- 状态标签：`.status-pill` → 自定义 StatusPill 组件使用 shadcn Badge 变体
- 导入 shadcn Card 组件用于内容区域

### 3. `ScriptPages.tsx` — 中等修改

- 布局容器：`.script-workspace` → `grid gap-6 content-start`
- 页面标题区：`.script-page-heading` → `flex items-center justify-between`
- 筛选表单：`.script-filters` → `grid grid-cols-4 gap-3`
- 脚本列表卡片：`.script-list-item` → shadcn Card 或自定义 div + Tailwind
- 脚本标签：`.script-tags span` → shadcn Badge variant="secondary"
- 步骤列表：`.step-list-item` → `button` + Tailwind + 条件 active 样式
- 编辑器表单：`.editor-grid` → `grid grid-cols-2 gap-4`
- 表单输入：`.form-grid` → `grid grid-cols-4 gap-3`
- 验证面板：`.validation-panel` → shadcn Alert variant="destructive"
- 保存消息：`.save-message` → shadcn Alert 或绿色背景 div
- 加载/空状态：`.catalog-placeholder` → shadcn Empty 组件或 Tailwind 样式

### 4. `ToolPages.tsx` — 中等修改

- 命令库布局：`.tool-grid` → `grid grid-cols-[320px_1fr] gap-4`
- 命令列表卡片：`.command-item` → Tailwind + shadcn Badge
- 搜索框：`.tool-search` → Tailwind 表单样式
- SSH 连接表单：`.ssh-connect-panel` → Tailwind 表单 + shadcn Card
- 终端面板：`.terminal-shell` → `bg-gray-950 border rounded-lg overflow-hidden`
- 命令联想：`.suggestion-item` → shadcn Button variant="ghost" 或自定义按钮
- `parseTags` 函数：从 `ToolPages.tsx` 中删除，统一使用 `@/lib/utils` 中提取的公共函数

### 5. `TaskPage.tsx` — 中等修改

- 执行控制区：`.execution-controls` → Tailwind 布局
- 任务卡片：`.execution-task-card` → shadcn Card
- 任务摘要：`.execution-task-item` → shadcn Card variant
- 日志列表：`.execution-log-list` → Tailwind + `overflow-auto max-h-[420px]`
- 脚本摘要：`.execution-selected-script` → shadcn Card

### 6. `lib/utils.ts` — 轻微修改

- 新增 `parseTags(value: string): string[]` — 从 `ScriptPages.tsx` 和 `ToolPages.tsx` 提取的公共函数
- 保留已有的 `cn()` 函数

## 响应式策略

删除所有自定义 `@media` 断点查询，改用 Tailwind 内置响应式前缀：

| 原断点 | Tailwind class |
|---|---|
| `@media (max-width: 640px)` | `max-sm:` |
| `@media (max-width: 820px)` | `max-md:` 或 `max-lg:` |
| `@media (max-width: 1180px)` | `max-xl:` |

具体断点微调在组件实现时根据实际效果选择最接近的 Tailwind 断点。

## 不变内容

以下内容保持不变：
- shadcn UI 组件（[src/components/ui/](src/components/ui/) 全部保留）
- `vite.config.ts`, `tsconfig.*.json`, `eslint.config.js`
- `package.json` 依赖
- 测试文件（App.test.tsx, ScriptPages 暂无独立测试, ToolPages.test.tsx, TaskPage.test.tsx）
- `@/lib/api.ts` — API 类型和客户端
- `@/lib/websocket.ts` — WebSocket 客户端
- `src/test/setup.ts`, `src/testflow.d.ts`

## 风险

| 风险 | 缓解措施 |
|---|---|
| 颜色映射后视觉效果不一致 | 每个组件改完后用 `pnpm dev` 启动开发服务器目视确认 |
| 响应式断点变化导致布局错位 | 优先保持布局结构，只替换实现方式 |
| 测试因 class 名变化失败 | 测试使用的 `aria-label` / `role` 选择器应不受影响 |
| `.nav-link-active:hover` 等复杂交互样式难以用 Tailwind 表达 | 使用 `group` + `group-hover:` 或 `has-[:checked]:` 等 Tailwind 高级选择器 |

## 实施顺序

1. `index.css` — 先删后增（删除硬编码样式，确保 shadcn token 完整）
2. `lib/utils.ts` — 提取公共函数
3. `App.tsx` — 框架壳（侧边栏、顶栏），这是所有页面的容器
4. `ScriptPages.tsx` — 最大的文件，最复杂的样式
5. `ToolPages.tsx` — 命令库 + SSH 终端
6. `TaskPage.tsx` — 执行任务页面
7. 全量测试 + 目视验证
