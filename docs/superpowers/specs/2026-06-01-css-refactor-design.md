# CSS 重构设计方案：严格 Tailwind 化

**日期**: 2026-06-01
**状态**: 设计已确认
**范围**: `apps/web/src/index.css`、`apps/web/src/components/ui/`、应用外壳、路由占位页、脚本页、执行页、工具页及相关前端测试

---

## 目标

将 `apps/web` 从“shadcn token + 大量业务 CSS class”的双轨样式体系，收敛为 **shadcn token + shadcn 组件 + Tailwind utilities** 的单一表现层。

本次接受 shadcn 默认 neutral 视觉方向。现有 teal 主色、深色侧边栏、浅 teal 页面背景等品牌感不要求保留；它们会被 shadcn 默认 token 和组件变体替换。

最终 `apps/web/src/index.css` 只保留：

- Tailwind、动画、shadcn 和字体 import
- `@custom-variant dark`
- `:root` token
- `.dark` token 覆盖
- `@theme inline`
- shadcn `@layer base`
- 必要的全局 reset，例如 `box-sizing`、`body margin`、`#root min-height`

## 非目标

- 不做暗色模式验收，不新增 dark mode 切换入口。
- 不重做业务流程、路由结构或数据交互。
- 不进行完整 UI 重设计，只允许适度整理重复布局和低风险结构。
- 不保留业务样式 class 作为兼容层。

## 关键决策

| 决策 | 选择 |
|---|---|
| 视觉目标 | 完全接受 shadcn 默认 neutral 外观 |
| CSS 严格度 | 删除所有业务 CSS class，不保留带样式的项目级 class |
| 表单策略 | 补齐 shadcn 官方形态的 `Input`、`Textarea`、`Select`、`Checkbox` |
| 页面结构 | 允许适度整理重复布局，但不改变业务流程 |
| 暗色模式 | 保留 token，不纳入本次验收 |
| 验证标准 | 自动检查 + 浏览器抽样检查核心桌面路由 |
| 文档粒度 | 设计方案 + 分阶段迁移顺序 |

## 架构对比

### 现状

```text
shadcn token               手写 CSS 业务 class
     │                              │
     ▼                              ▼
少量 shadcn 组件              大量自定义 class
     │                              │
     └──────────────┬───────────────┘
                    ▼
          页面样式来源混杂，class 和 CSS 文件强耦合
```

### 目标

```text
shadcn token
     │
     ├── shadcn 基础组件
     │      Button / Badge / Card / Alert / Empty
     │      Input / Textarea / Select / Checkbox
     │
     └── Tailwind utilities
            页面布局、响应式、状态样式、局部组合
```

业务页面可以使用 Tailwind utility class，但不得继续依赖 `.content-panel`、`.script-layout`、`.nav-link-active`、`.catalog-placeholder`、`.validation-panel` 等业务 class。

## 颜色策略

本次不是逐个保真映射旧颜色，而是统一切换到 shadcn 默认 neutral token。

- 页面背景使用 `bg-background`。
- 面板和卡片使用 `bg-card text-card-foreground border-border` 或 shadcn `Card`。
- 主要操作使用 shadcn `Button` 默认 variant。
- 次要信息使用 `text-muted-foreground`、`bg-muted`、`bg-secondary`。
- 错误状态使用 `Alert variant="destructive"`、`text-destructive`。
- 成功/警告状态优先使用现有 shadcn `Badge` variant；如需要补充语义色，限制在局部 Tailwind utility，不新增品牌 token。
- 侧边栏也使用 `bg-sidebar text-sidebar-foreground` 等默认 sidebar token，不保留现有深色 teal 外观。

由于接受 neutral 外观，视觉验收重点是层级、可读性、布局稳定性，而不是旧色值还原。

## 基础组件设计

### shadcn 表单组件

新增或引入以下基础 UI 组件到 `apps/web/src/components/ui/`：

- `input.tsx`
- `textarea.tsx`
- `select.tsx`
- `checkbox.tsx`

组件 API 和导入方式遵循 shadcn 当前组件形态。实现时优先使用 shadcn CLI 添加组件；若 CLI 与本项目 monorepo 路径不匹配，则参考已存在的 `button.tsx`、`badge.tsx`、`card.tsx` 风格手动补齐。

页面迁移必须先把原生 `input`、`select`、`textarea`、`input[type="checkbox"]` 替换为这些组件或由这些组件组成的结构，再删除 `index.css` 中的全局表单控件样式。

### 低风险结构组件

允许新增少量项目结构组件，用于消除重复 Tailwind 长串，但不得封装业务逻辑：

- `PagePanel`：替代 `content-panel`，负责页面主容器。
- `PageHeader`：替代 `section-heading` 和常见右侧 action 区。
- `EmptyState` 或规范化 shadcn `Empty` 用法：替代 `catalog-placeholder`。
- `Alert` 组合用法：替代 `validation-panel`、`catalog-error`、`save-message`。

列表项优先用 `Card` 和 Tailwind 组合，不新增 `.script-list-item`、`.command-item`、`.execution-task-item` 这类业务 class。

## 文件变更范围

### `index.css`

删除：

- 所有业务 class，包括应用外壳、导航、页面面板、脚本页、执行页、工具页、终端、列表、表单、状态、空状态、错误状态等 class。
- 全局 `input`、`select`、`textarea`、`button` 业务样式。
- 自定义响应式断点块。
- 全局 `code` 业务样式；日志和命令展示改为局部 Tailwind。

保留：

- import、token、theme、base layer 和必要 reset。

### `components/ui/`

保留现有 shadcn 组件，并补齐表单组件：

- `button.tsx`
- `badge.tsx`
- `card.tsx`
- `alert.tsx`
- `empty.tsx`
- `skeleton.tsx`
- `input.tsx`
- `textarea.tsx`
- `select.tsx`
- `checkbox.tsx`

### `App.tsx`

- `app-frame`、`sidebar`、`brand`、`nav-*`、`topbar`、`status-*` 全部改为 Tailwind/shadcn。
- `NavLink` 使用 `className` 回调表达 active 样式，但不输出 `nav-link-active`。
- active 状态测试依赖 `aria-current="page"` 或 route 语义，不依赖 class。
- `StatusPill` 使用 `Badge` 或明确的 Tailwind 组合。

### `app/routes.tsx`

- 替换 `content-panel`、`section-heading`、`state-box`。
- 占位页使用 `PagePanel`、`PageHeader`、`Empty`/`EmptyState`。

### `features/scripts/ScriptPages.tsx`

- 替换 `script-workspace`、`script-page-heading`、`script-filters`、`script-layout`、`script-list-section`、`keyword-sidebar`。
- 表单控件改用 shadcn 表单组件。
- `ScriptListItem`、关键字卡片、步骤列表使用 `Card`/`Button`/`Badge` + Tailwind。
- `validation-panel` 改用 `Alert variant="destructive"`。
- `save-message` 改用 `Alert` 或 `Badge`/`Card` 组合。
- `catalog-placeholder` 改为 `Empty`/`EmptyState`。
- `parseTags` 可提取到 `lib/utils.ts`，避免脚本页和工具页重复。

### `features/execution/TaskPage.tsx`

- 替换 `execution-*`、`editor-section`、`form-grid`、`compact-meta` 等 class。
- 任务控制表单使用 shadcn 表单组件。
- 当前任务、最近任务、选中脚本摘要使用 `Card` + Tailwind。
- 日志区域使用局部 `code`/`pre` Tailwind 样式，保留 `overflow-auto max-h-[420px]` 类行为。
- 错误状态使用 `Alert`。

### `features/tools/ToolPages.tsx`

- 替换 `tool-*`、`command-*`、`ssh-*`、`terminal-*`、`suggestion-*` 等 class。
- 命令库表单和 SSH 表单使用 shadcn 表单组件。
- 命令列表和联想项使用 `Card`/`Button`/`Badge` + Tailwind。
- xterm 终端容器保留必要尺寸、深色终端局部样式和 `overflow-hidden`，但样式写在 JSX Tailwind 中。
- `parseTags` 删除本地重复实现，改用 `@/lib/utils` 公共函数。

### `lib/utils.ts`

- 保留 `cn()`。
- 新增 `parseTags(value: string): string[]`，供脚本页和工具页复用。

### 测试

测试不保持原样。必须更新因 class 删除而失效的断言：

- `App.test.tsx` 中 `nav-link-active` class 断言改为 `aria-current` 或路由语义断言。
- 删除读取 `src/index.css` 匹配 `.nav-link-active:hover` 的测试。
- 现有业务行为测试继续保留；只迁移与样式 class 强耦合的部分。

## 响应式策略

删除自定义 `@media`，用 Tailwind 响应式前缀表达布局：

| 原断点 | 迁移方向 |
|---|---|
| `@media (max-width: 1180px)` | `max-xl:` 或 `lg:`/`xl:` 正向布局 |
| `@media (max-width: 820px)` | `max-lg:` / `md:` / `lg:` |
| `@media (max-width: 640px)` | `max-sm:` / `sm:` |

实现时优先保持现有信息架构：桌面多列、窄屏单列。允许适度调整网格比例和间距，但不改变页面功能入口。

## 分阶段迁移顺序

### 1. 基础 UI 与测试策略

- 补齐 `Input`、`Textarea`、`Select`、`Checkbox`。
- 更新 `App.test.tsx` 的导航 active 测试，移除 CSS 文本断言。
- 暂不删除旧 CSS，避免页面在迁移中间态失去样式。

### 2. 应用外壳

- 迁移 `App.tsx` 的主布局、侧边栏、导航、顶栏、状态标签。
- 确认 `nav-link-active` 不再被引用。
- 删除外壳相关 CSS。

### 3. 公共页面结构

- 迁移 `app/routes.tsx`。
- 建立最小结构组件或规范化 `PagePanel`、`PageHeader`、`Empty`、`Alert` 用法。
- 删除 `content-panel`、`section-heading`、`state-box`、`catalog-placeholder`、`catalog-error` 等共享 CSS。

### 4. 脚本页

- 迁移 `ScriptPages.tsx`。
- 提取 `parseTags` 到 `lib/utils.ts`。
- 删除 `script-*`、`keyword-*`、`step-*`、`param-*`、`editor-*`、`form-*` 等已无引用 CSS。

### 5. 执行页

- 迁移 `TaskPage.tsx`。
- 删除 `execution-*`、`compact-meta`、`detail-list` 等已无引用 CSS。

### 6. 工具页

- 迁移 `ToolPages.tsx`。
- 重点检查 xterm 容器高度和 overflow 行为。
- 删除 `tool-*`、`command-*`、`ssh-*`、`terminal-*`、`suggestion-*` 等已无引用 CSS。

### 7. 最终 CSS 清理

- 删除所有剩余业务 CSS 和全局表单 CSS。
- 用 `rg` 确认无旧 class 引用。
- 保留干净的 `index.css` 基础层。

## 验收标准

自动检查：

- `pnpm check:web`
- 现有 Vitest 前端测试，至少覆盖已修改测试文件和相关页面测试。

浏览器抽样检查桌面视口：

- `/scripts`
- `/scripts/new`
- `/execution/tasks`
- `/tools/commands`
- `/tools/ssh`

重点检查：

- 导航 active 状态清晰。
- 表单控件有边框、聚焦态、禁用态和合理高度。
- 空状态、错误状态、保存成功状态可读。
- 列表卡片层级清晰，文本不溢出关键容器。
- SSH 终端容器不塌陷，xterm 区域可见。

## 风险与缓解

| 风险 | 缓解措施 |
|---|---|
| 旧品牌色消失导致视觉变化超预期 | 已明确接受 shadcn neutral；验收按新方向看层级和可读性 |
| 删除全局表单 CSS 后控件裸奔 | 先补齐并迁移 shadcn 表单组件，再删除全局表单 CSS |
| class 删除导致测试失败 | 将测试迁移到 role、label、aria-current 等语义断言 |
| 一次性删除 CSS 难以定位问题 | 按阶段迁移，每阶段用 `rg` 确认旧 class 引用，再删除对应 CSS |
| Tailwind class 过长降低可维护性 | 只为页面壳、标题区、空状态等低风险结构抽最小组件 |
| xterm 终端布局被普通 Card 样式影响 | 终端区域单独用局部 Tailwind 保持固定高度、深色背景和 overflow |

## 完成定义

- `index.css` 不再包含业务样式 class 或全局表单控件业务样式。
- `apps/web/src` 不再引用被删除的业务 class。
- shadcn 表单组件存在并被页面使用。
- 与样式 class 强耦合的测试已迁移。
- 自动检查通过。
- 核心桌面路由完成浏览器抽样检查。
