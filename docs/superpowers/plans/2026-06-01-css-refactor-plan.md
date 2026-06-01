# CSS 重构：全面 Tailwind 化 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除 `index.css` 中 ~750 行硬编码颜色自定义样式，全面迁移至 Tailwind utilities + shadcn 组件，统一使用 shadcn 默认色板。

**Architecture:** shadcn CSS 变量作为唯一颜色源 → 分流至 shadcn 组件（Button, Badge, Card 等）和 Tailwind 原子类（布局、间距、排版）。删除所有自定义 class，用 Tailwind 内置响应式前缀替代自定义媒体查询。

**Tech Stack:** React 19 + Tailwind CSS 4 + shadcn/ui v4 + Vite 8

---

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `apps/web/src/index.css` | Modify | 精简为 ~100 行：@import + :root + .dark + @theme + @layer base + 全局重置 |
| `apps/web/src/lib/utils.ts` | Modify | 新增 `parseTags()` 公共函数 |
| `apps/web/src/App.tsx` | Modify | 侧边栏、顶栏、状态标签全部 Tailwind 化 |
| `apps/web/src/features/scripts/ScriptPages.tsx` | Modify | 脚本列表 + 编辑器 Tailwind 化 |
| `apps/web/src/features/tools/ToolPages.tsx` | Modify | 命令库 + SSH 终端 Tailwind 化 |
| `apps/web/src/features/execution/TaskPage.tsx` | Modify | 执行任务页面 Tailwind 化 |

**不变**: shadcn 组件 (`src/components/ui/*`)、测试文件、配置文件、API/WebSocket 库。

---

### Task 1: 精简 index.css

**Files:**
- Modify: `apps/web/src/index.css`

这是最关键的一步 — 删除所有硬编码颜色的自定义 class，只保留 shadcn token 系统和全局重置。后续所有 task 都依赖此步完成。

- [ ] **Step 1: 备份并替换 index.css**

将 `apps/web/src/index.css` 替换为以下精简版本（从 1133 行缩减到 ~100 行）：

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist";

@custom-variant dark (&:is(.dark *));

:root {
  color: #172026;
  background: #eef3f5;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
input,
select,
textarea {
  font: inherit;
}

#root {
  min-height: 100vh;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}

@theme inline {
  --font-heading: var(--font-sans);
  --font-sans: 'Geist Variable', sans-serif;
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --color-foreground: var(--foreground);
  --color-background: var(--background);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

- [ ] **Step 2: 验证 CSS 构建不报错**

```bash
cd c:/code/TestFlow/apps/web && npx vite build 2>&1 | tail -5
```

预期：构建成功（TypeScript 可能因未更新的组件 class 引用报错，CSS 层应无错误）。

- [ ] **Step 3: 检查是否有遗漏的 CSS 变量引用**

```bash
cd c:/code/TestFlow/apps/web && grep -r "var(--" src/index.css | head -30
```

预期：所有 `var(--*)` 引用均在保留的 `:root`/`.dark`/`@theme inline` 中有定义。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/index.css
git commit -m "refactor(web): strip index.css to shadcn tokens only

Remove ~750 lines of hardcoded custom CSS classes. Keep only:
- @import declarations
- :root / .dark CSS variable definitions
- @theme inline block
- @layer base (shadcn)
- Global resets (box-sizing, body margin, font inherit)

All component-level styles now delegated to Tailwind utilities
and shadcn components."

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 2: 提取 parseTags 到 lib/utils.ts

**Files:**
- Modify: `apps/web/src/lib/utils.ts`

从 ScriptPages.tsx 和 ToolPages.tsx 中消除重复的 `parseTags` 函数。

- [ ] **Step 1: 将 parseTags 添加到 utils.ts**

在 `apps/web/src/lib/utils.ts` 中，`cn` 函数之后添加：

```typescript
export function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  )
}
```

完整文件内容：

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  )
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd c:/code/TestFlow/apps/web && npx tsc -b --noEmit 2>&1 | grep utils
```

预期：utils.ts 无类型错误。

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/lib/utils.ts
git commit -m "refactor(web): extract parseTags to shared utils

Eliminate duplicate parseTags in ScriptPages.tsx and ToolPages.tsx."

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 3: App.tsx — 框架壳 Tailwind 化

**Files:**
- Modify: `apps/web/src/App.tsx`

这是整个应用的布局骨架。侧边栏、顶栏、状态标签全部从自定义 CSS class 迁移到 Tailwind utilities。

- [ ] **Step 1: 用 Tailwind 重写 App 组件**

将 `apps/web/src/App.tsx` 完整替换为：

```tsx
import { useEffect, useState } from "react"
import { Navigate, NavLink, Route, Routes } from "react-router"
import { Cable, ChevronRight, Server } from "lucide-react"

import { appRoutes, navGroups } from "./app/routes"
import { createWebSocketClient, type WebSocketStatus } from "./lib/websocket"
import { Badge } from "./components/ui/badge"
import type { BackendStatus } from "./testflow"

const backendStateLabels: Record<BackendStatus["state"], string> = {
  exited: "已退出",
  failed: "异常",
  running: "运行中",
  starting: "启动中",
  stopped: "已停止",
}

const websocketStateLabels: Record<WebSocketStatus["state"], string> = {
  connected: "已连接",
  connecting: "连接中",
  disconnected: "已断开",
  reconnecting: "重连中",
}

const backendBaseUrl = "http://127.0.0.1:8000"
const websocketUrl = "ws://127.0.0.1:8000/ws"

function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    healthUrl: `${backendBaseUrl}/health`,
    state: window.testflow ? "starting" : "stopped",
  })
  const [websocketStatus, setWebsocketStatus] = useState<WebSocketStatus>({
    state: "connecting",
  })

  useEffect(() => {
    if (!window.testflow) {
      return
    }

    let isMounted = true
    void window.testflow.backend.getStatus().then((status) => {
      if (isMounted && status) {
        setBackendStatus(status)
      }
    })
    const unsubscribe = window.testflow.backend.onStatusChange((status) => {
      setBackendStatus(status)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const client = createWebSocketClient({ url: websocketUrl })
    const unsubscribe = client.subscribe((status) => setWebsocketStatus(status))
    client.connect()

    return () => {
      unsubscribe()
      client.disconnect()
    }
  }, [])

  return (
    <div className="grid grid-cols-[264px_1fr] min-h-screen max-sm:grid-cols-1">
      <aside
        className="flex flex-col gap-7 py-[22px] px-[14px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border max-sm:gap-4"
        aria-label="主导航"
      >
        <div className="flex items-center gap-3 px-2">
          <div className="flex items-center justify-center size-[38px] rounded-md bg-primary/60 text-primary-foreground text-[13px] font-extrabold">
            TF
          </div>
          <div>
            <strong className="block text-white text-[17px]">TestFlow</strong>
            <span className="block text-sidebar-foreground/60 text-xs mt-0.5">
              自动化测试工作台
            </span>
          </div>
        </div>

        <nav className="grid gap-2">
          {navGroups.map((group) => (
            <div className="grid gap-2 border-t border-sidebar-border pt-4" key={group.id}>
              <div className="flex items-center gap-2 text-sidebar-foreground/60 text-xs font-bold px-[10px] pb-1">
                <group.icon aria-hidden="true" size={14} />
                {group.label}
              </div>
              {appRoutes
                .filter((route) => route.navGroup === group.id && !route.navHidden)
                .map((route) => (
                  <NavLink
                    className={({ isActive }) =>
                      `grid grid-cols-[18px_1fr_14px] items-center gap-[10px] rounded-md text-sm min-h-[38px] px-[10px] no-underline text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground ${
                        isActive
                          ? "bg-primary/10 text-primary font-bold hover:bg-primary/10 hover:text-primary"
                          : ""
                      }`
                    }
                    end
                    key={route.path}
                    to={route.path}
                  >
                    <route.icon aria-hidden="true" size={17} />
                    <span>{route.label}</span>
                    <ChevronRight aria-hidden="true" size={14} />
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="grid grid-rows-[auto_1fr] min-w-0">
        <header className="flex items-center justify-between min-h-[72px] px-7 py-[14px] bg-card/86 border-b border-border max-sm:flex-col max-sm:items-start max-sm:gap-3 max-sm:px-4">
          <div>
            <p className="text-muted-foreground text-xs m-0">前端应用壳与基础交互框架</p>
            <strong className="block text-foreground text-lg mt-[3px]">阶段三</strong>
          </div>
          <div className="flex flex-wrap gap-[10px] justify-end" aria-label="系统状态">
            <StatusPill
              icon={Server}
              label="后端服务"
              tone={backendStatus.state === "running" ? "success" : "warning"}
              value={backendStateLabels[backendStatus.state]}
            />
            <StatusPill
              icon={Cable}
              label="WebSocket"
              tone={websocketStatus.state === "connected" ? "success" : "warning"}
              value={websocketStateLabels[websocketStatus.state]}
            />
          </div>
        </header>

        <main className="grid gap-5 p-6 pb-[34px] max-sm:px-4">
          <Routes>
            <Route element={<Navigate replace to="/scripts" />} path="/" />
            {appRoutes.map((route) => (
              <Route element={route.element} key={route.path} path={route.path} />
            ))}
            <Route element={<Navigate replace to="/scripts" />} path="*" />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function StatusPill({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof Server
  label: string
  tone: "success" | "warning"
  value: string
}) {
  return (
    <div
      className={`flex items-center gap-[7px] min-h-[34px] px-[10px] rounded-md border text-xs font-bold ${
        tone === "success"
          ? "bg-green-50 border-green-200 text-green-700"
          : "bg-amber-50 border-amber-200 text-amber-700"
      }`}
    >
      <Icon aria-hidden="true" size={14} />
      <span className="text-muted-foreground font-normal">{label}</span>
      <strong className="text-xs">{value}</strong>
    </div>
  )
}

export default App
```

- [ ] **Step 2: 检查 TypeScript 编译**

```bash
cd c:/code/TestFlow/apps/web && npx tsc -b --noEmit 2>&1 | head -20
```

预期：App.tsx 无类型错误（可能 ScriptPages/ToolPages/TaskPage 仍有错误，正常，后续 task 修复）。

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/App.tsx
git commit -m "refactor(web): migrate App shell to Tailwind utilities

Replace all custom CSS classes (.app-frame, .sidebar, .brand,
.topbar, .status-pill, .nav-link, .main-content) with Tailwind
utilities. Use shadcn Badge for status indicators."

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 4: ScriptPages.tsx — 脚本列表页面

**Files:**
- Modify: `apps/web/src/features/scripts/ScriptPages.tsx`

脚本列表区域：搜索筛选、脚本卡片、关键字侧栏。这是一个大文件，分两个 task 处理。

- [ ] **Step 1: 重写 ScriptListPage 组件**

在 `apps/web/src/features/scripts/ScriptPages.tsx` 中，替换 imports（添加 `parseTags` 从 utils，添加 shadcn Badge/Button/Card）：

```tsx
import {
  ArrowDown,
  ArrowUp,
  Copy,
  FilePlus2,
  Plus,
  Save,
  Trash2,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  createApiClient,
  type ApiError,
  type KeywordMetadata,
  type KeywordParameter,
  type ScriptStep,
  type ScriptSummary,
  type TestScript,
} from "@/lib/api"
import { parseTags } from "@/lib/utils"
```

将 `ScriptListPage` 函数体中的 JSX 替换为：

```tsx
export function ScriptListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [groupFilter, setGroupFilter] = useState("all")
  const [tagFilter, setTagFilter] = useState("all")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | undefined>()

  const scriptsQuery = useQuery({
    queryKey: ["scripts"],
    queryFn: api.listScripts,
  })
  const keywordsQuery = useQuery({
    queryKey: ["keywords"],
    queryFn: api.listKeywords,
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteScript,
    onSuccess: async () => {
      setConfirmDeleteId(undefined)
      await queryClient.invalidateQueries({ queryKey: ["scripts"] })
    },
  })
  const copyMutation = useMutation({
    mutationFn: async (scriptId: string) => {
      const source = await api.getScript(scriptId)
      const nextId = `${source.id}-copy-${Date.now()}`
      return api.saveScript({
        ...source,
        id: nextId,
        name: `${source.name} 副本`,
        status: "draft",
        version: undefined,
      })
    },
    onSuccess: async (script) => {
      await queryClient.invalidateQueries({ queryKey: ["scripts"] })
      navigate(`/scripts/${script.id}`)
    },
  })

  const scripts = scriptsQuery.data?.items ?? []
  const keywords = keywordsQuery.data?.items ?? []
  const groups = uniqueValues(scripts.map((script) => script.group).filter(Boolean))
  const tags = uniqueValues(scripts.flatMap((script) => script.tags))
  const filteredScripts = filterScripts({
    scripts,
    search,
    statusFilter,
    groupFilter,
    tagFilter,
  })

  return (
    <section className="grid gap-6 content-start rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-[10px]">
        <div className="grid gap-[6px]">
          <p className="text-primary/80 text-xs font-extrabold m-0">阶段五</p>
          <h1 className="text-foreground text-[28px] leading-tight m-0">脚本管理</h1>
          <span className="text-muted-foreground text-sm m-0">
            管理 YAML 测试脚本、筛选分组标签，并进入可视化编辑。
          </span>
        </div>
        <Button asChild>
          <Link to="/scripts/new">
            <FilePlus2 aria-hidden="true" data-icon="inline-start" />
            新建脚本
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-1">
        <label className="grid gap-[6px]">
          <span className="text-muted-foreground/80 text-xs font-extrabold">搜索脚本</span>
          <input
            aria-label="搜索脚本"
            className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="名称、ID、描述、标签"
          />
        </label>
        <label className="grid gap-[6px]">
          <span className="text-muted-foreground/80 text-xs font-extrabold">状态筛选</span>
          <select
            aria-label="状态筛选"
            className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
          </select>
        </label>
        <label className="grid gap-[6px]">
          <span className="text-muted-foreground/80 text-xs font-extrabold">分组筛选</span>
          <select
            aria-label="分组筛选"
            className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
          >
            <option value="all">全部分组</option>
            {groups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-[6px]">
          <span className="text-muted-foreground/80 text-xs font-extrabold">标签筛选</span>
          <select
            aria-label="标签筛选"
            className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
          >
            <option value="all">全部标签</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-[1.2fr_0.8fr] gap-4 max-xl:grid-cols-1">
        <section className="grid gap-3 bg-muted/30 border border-border rounded-lg p-4">
          <h2 className="text-foreground text-[17px] m-0">脚本列表</h2>
          {scriptsQuery.isPending ? (
            <div className="flex items-center gap-2 bg-muted/50 border border-dashed border-border rounded-lg text-muted-foreground text-sm min-h-[72px] p-[14px]">
              正在加载
            </div>
          ) : scriptsQuery.isError ? (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm min-h-[72px] p-[14px]">
              后端脚本数据不可用
            </div>
          ) : filteredScripts.length === 0 ? (
            <div className="flex items-center gap-2 bg-muted/50 border border-dashed border-border rounded-lg text-muted-foreground text-sm min-h-[72px] p-[14px]">
              没有匹配的脚本
            </div>
          ) : (
            <div className="grid gap-[10px]">
              {filteredScripts.map((script) => (
                <ScriptListItem
                  confirmDeleteId={confirmDeleteId}
                  key={script.id}
                  onCopy={() => copyMutation.mutate(script.id)}
                  onDelete={() => deleteMutation.mutate(script.id)}
                  onPrepareDelete={() => setConfirmDeleteId(script.id)}
                  script={script}
                />
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-3 bg-muted/30 border border-border rounded-lg p-4">
          <h2 className="text-foreground text-[17px] m-0">关键字库</h2>
          {keywordsQuery.isPending ? (
            <div className="flex items-center gap-2 bg-muted/50 border border-dashed border-border rounded-lg text-muted-foreground text-sm min-h-[72px] p-[14px]">
              正在加载
            </div>
          ) : (
            <div className="grid gap-[10px]">
              {keywords.map((keyword) => (
                <article
                  className="grid gap-3 bg-card border border-border rounded-lg p-[14px]"
                  key={keyword.name}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-foreground text-[15px] m-0">{keyword.name}</h3>
                    <Badge variant={keyword.enabled ? "default" : "secondary"}>
                      {keyword.module}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-[13px] leading-snug m-0">
                    {keyword.description}
                  </p>
                  <span className="text-muted-foreground text-[13px]">
                    {keyword.parameters.length > 0
                      ? `${keyword.parameters.length} 个参数`
                      : "无参数"}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 重写 ScriptListItem 组件**

在同一个文件中，将 `ScriptListItem` 替换为：

```tsx
function ScriptListItem({
  confirmDeleteId,
  onCopy,
  onDelete,
  onPrepareDelete,
  script,
}: {
  confirmDeleteId: string | undefined
  onCopy: () => void
  onDelete: () => void
  onPrepareDelete: () => void
  script: ScriptSummary
}) {
  return (
    <article className="grid grid-cols-[1fr_auto_auto] items-center gap-3 bg-card border border-border rounded-lg p-[14px] max-sm:grid-cols-1">
      <div>
        <div className="flex items-center justify-start gap-2 mb-1">
          <h3 className="text-foreground text-[15px] m-0">{script.name}</h3>
          <Badge variant={script.status === "published" ? "default" : "secondary"}>
            {script.status === "published" ? "已发布" : "草稿"}
          </Badge>
        </div>
        <p className="text-muted-foreground text-[13px] leading-snug m-0">
          {script.description || script.id}
        </p>
        <div className="flex flex-wrap gap-[6px] mt-2">
          {script.group ? (
            <Badge variant="secondary">{script.group}</Badge>
          ) : null}
          {script.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      <dl className="flex gap-[10px] m-0">
        <div className="bg-secondary rounded-md min-w-16 px-[9px] py-[7px]">
          <dt className="text-muted-foreground text-[11px] m-0">步骤</dt>
          <dd className="text-foreground text-[13px] font-extrabold m-0">
            {script.enabled_step_count}/{script.step_count}
          </dd>
        </div>
        <div className="bg-secondary rounded-md min-w-16 px-[9px] py-[7px]">
          <dt className="text-muted-foreground text-[11px] m-0">版本</dt>
          <dd className="text-foreground text-[13px] font-extrabold m-0">v{script.revision}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-[6px] justify-end">
        <Button asChild size="sm" variant="secondary">
          <Link to={`/scripts/${script.id}`}>编辑</Link>
        </Button>
        <Button
          aria-label={`复制 ${script.name}`}
          onClick={onCopy}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Copy aria-hidden="true" />
        </Button>
        {confirmDeleteId === script.id ? (
          <Button
            aria-label={`确认删除 ${script.name}`}
            onClick={onDelete}
            size="sm"
            type="button"
            variant="destructive"
          >
            确认
          </Button>
        ) : (
          <Button
            aria-label={`删除 ${script.name}`}
            onClick={onPrepareDelete}
            size="icon-sm"
            type="button"
            variant="destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </div>
    </article>
  )
}
```

- [ ] **Step 3: 更新唯一未变的辅助函数（保留原样）**

确认 `filterScripts`, `uniqueValues` 保持在文件中不变（它们是纯逻辑函数，不涉及 CSS）。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/features/scripts/ScriptPages.tsx
git commit -m "refactor(web): migrate ScriptListPage to Tailwind utilities

Replace custom CSS classes with Tailwind utilities and shadcn
Badge/Button components. Import parseTags from shared utils."

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 5: ScriptPages.tsx — 脚本编辑器页面

**Files:**
- Modify: `apps/web/src/features/scripts/ScriptPages.tsx`

编辑器区域：基本信息表单、步骤列表、步骤详情、参数输入。

- [ ] **Step 1: 重写 ScriptEditorPage 组件**

在 `apps/web/src/features/scripts/ScriptPages.tsx` 中，将 `ScriptEditorPage` 函数体中的 JSX 替换。关键变更：

布局容器、标题区、验证面板、编辑器网格、步骤列表、参数表单 — 全部从自定义 class 改为 Tailwind。

```tsx
export function ScriptEditorPage() {
  const { scriptId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [script, setScript] = useState<TestScript>(emptyScript)
  const [tagText, setTagText] = useState("")
  const [selectedStepId, setSelectedStepId] = useState<string | undefined>()
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [saveMessage, setSaveMessage] = useState("")

  const keywordsQuery = useQuery({
    queryKey: ["keywords"],
    queryFn: api.listKeywords,
  })
  const scriptQuery = useQuery({
    queryKey: ["script", scriptId],
    queryFn: () => api.getScript(scriptId ?? ""),
    enabled: Boolean(scriptId),
  })

  useEffect(() => {
    if (scriptQuery.data) {
      setScript(scriptQuery.data)
      setTagText(scriptQuery.data.tags.join(", "))
      setSelectedStepId(scriptQuery.data.steps[0]?.id)
    }
  }, [scriptQuery.data])

  const keywords = useMemo(
    () => (keywordsQuery.data?.items ?? []).filter((keyword) => keyword.enabled),
    [keywordsQuery.data?.items],
  )
  const keywordMap = useMemo(
    () => new Map(keywords.map((keyword) => [keyword.name, keyword])),
    [keywords],
  )
  const selectedStep =
    script.steps.find((step) => step.id === selectedStepId) ?? script.steps[0]
  const selectedKeyword = selectedStep
    ? keywordMap.get(selectedStep.keyword)
    : undefined

  const saveMutation = useMutation({
    mutationFn: api.saveScript,
    onSuccess: async (savedScript) => {
      setScript(savedScript)
      setTagText(savedScript.tags.join(", "))
      setSaveMessage(
        savedScript.status === "published" ? "已发布" : "草稿已保存",
      )
      queryClient.setQueryData(["script", savedScript.id], savedScript)
      await queryClient.invalidateQueries({ queryKey: ["scripts"] })
      if (!scriptId) {
        navigate(`/scripts/${savedScript.id}`)
      }
    },
    onError: (error) => {
      setIssues(normalizeMutationIssues(error))
    },
  })

  function updateScript(update: Partial<TestScript>) {
    setScript((current) => ({ ...current, ...update }))
  }

  function updateStep(stepId: string, update: Partial<ScriptStep>) {
    setScript((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.id === stepId ? { ...step, ...update } : step,
      ),
    }))
  }

  function addStep() {
    const nextStep: ScriptStep = {
      id: `step-${Date.now()}`,
      keyword: keywords[0]?.name ?? "",
      description: "",
      enabled: true,
      params: {},
    }
    setScript((current) => ({
      ...current,
      steps: [...current.steps, nextStep],
    }))
    setSelectedStepId(nextStep.id)
  }

  function removeStep(stepId: string) {
    setScript((current) => {
      const steps = current.steps.filter((step) => step.id !== stepId)
      setSelectedStepId(steps[0]?.id)
      return { ...current, steps }
    })
  }

  function copyStep(step: ScriptStep) {
    const nextStep = { ...step, id: `step-${Date.now()}` }
    setScript((current) => ({
      ...current,
      steps: [...current.steps, nextStep],
    }))
    setSelectedStepId(nextStep.id)
  }

  function moveStep(stepId: string, direction: -1 | 1) {
    setScript((current) => {
      const index = current.steps.findIndex((step) => step.id === stepId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.steps.length) {
        return current
      }
      const steps = [...current.steps]
      const [step] = steps.splice(index, 1)
      steps.splice(nextIndex, 0, step)
      return { ...current, steps }
    })
  }

  function updateParam(
    step: ScriptStep,
    parameter: KeywordParameter,
    value: string | boolean,
  ) {
    const nextParams = { ...step.params }
    if (value === "") {
      delete nextParams[parameter.name]
    } else if (parameter.type === "boolean") {
      nextParams[parameter.name] = Boolean(value)
    } else if (parameter.type === "integer" || parameter.type === "number") {
      nextParams[parameter.name] = Number(value)
    } else {
      nextParams[parameter.name] = value
    }
    updateStep(step.id, { params: nextParams })
  }

  function submit(nextStatus: TestScript["status"]) {
    const payload = {
      ...script,
      status: nextStatus,
      tags: parseTags(tagText),
    }
    const nextIssues = validateScript(payload, keywordMap)
    setIssues(nextIssues)
    setSaveMessage("")
    if (nextStatus === "published" && nextIssues.length > 0) {
      return
    }
    saveMutation.mutate(payload)
  }

  if (scriptQuery.isPending && scriptId) {
    return (
      <section className="grid gap-6 content-start rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 bg-muted/50 border border-dashed border-border rounded-lg text-muted-foreground text-sm min-h-[72px] p-[14px]">
          正在加载脚本
        </div>
      </section>
    )
  }

  return (
    <section className="grid gap-6 content-start rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-[10px]">
        <div className="grid gap-[6px]">
          <p className="text-primary/80 text-xs font-extrabold m-0">阶段五</p>
          <h1 className="text-foreground text-[28px] leading-tight m-0">脚本编辑器</h1>
          <span className="text-muted-foreground text-sm m-0">
            通过关键字和参数表单编排 YAML 测试脚本。
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-[10px]">
          <Button onClick={() => submit("draft")} type="button" variant="secondary">
            <Save aria-hidden="true" data-icon="inline-start" />
            保存草稿
          </Button>
          <Button onClick={() => submit("published")} type="button">
            发布
          </Button>
        </div>
      </div>

      {issues.length > 0 ? (
        <div className="grid gap-[6px] bg-destructive/10 border border-destructive/30 rounded-lg text-destructive p-3">
          {issues.map((issue) => (
            <p className="m-0" key={`${issue.field}-${issue.message}`}>
              {formatIssue(issue)}
            </p>
          ))}
        </div>
      ) : null}
      {saveMessage ? (
        <div className="bg-green-50 border border-green-200 rounded-lg text-green-700 font-extrabold p-3">
          {saveMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-[0.8fr_1fr] gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <section className="grid gap-3 bg-muted/30 border border-border rounded-lg p-4">
          <h2 className="text-foreground text-[17px] m-0">基本信息</h2>
          <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-1">
            <label className="grid gap-[6px]">
              <span className="text-muted-foreground/80 text-xs font-extrabold">脚本 ID</span>
              <input
                aria-label="脚本 ID"
                className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full disabled:opacity-50"
                disabled={Boolean(scriptId)}
                value={script.id}
                onChange={(event) => updateScript({ id: event.target.value })}
              />
            </label>
            <label className="grid gap-[6px]">
              <span className="text-muted-foreground/80 text-xs font-extrabold">脚本名称</span>
              <input
                aria-label="脚本名称"
                className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
                value={script.name}
                onChange={(event) => updateScript({ name: event.target.value })}
              />
            </label>
            <label className="grid gap-[6px]">
              <span className="text-muted-foreground/80 text-xs font-extrabold">分组</span>
              <input
                aria-label="分组"
                className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
                value={script.group}
                onChange={(event) => updateScript({ group: event.target.value })}
              />
            </label>
            <label className="grid gap-[6px]">
              <span className="text-muted-foreground/80 text-xs font-extrabold">标签</span>
              <input
                aria-label="标签"
                className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
                value={tagText}
                onChange={(event) => setTagText(event.target.value)}
              />
            </label>
            <label className="grid gap-[6px] col-span-full">
              <span className="text-muted-foreground/80 text-xs font-extrabold">描述</span>
              <textarea
                aria-label="描述"
                className="bg-background border border-border rounded-md text-foreground min-h-[74px] px-[9px] py-[7px] w-full resize-y"
                value={script.description}
                onChange={(event) => updateScript({ description: event.target.value })}
              />
            </label>
          </div>
        </section>

        <section className="grid gap-3 bg-muted/30 border border-border rounded-lg p-4">
          <div className="flex items-center justify-between gap-[10px]">
            <h2 className="text-foreground text-[17px] m-0">步骤列表</h2>
            <Button onClick={addStep} type="button" variant="secondary">
              <Plus aria-hidden="true" data-icon="inline-start" />
              添加步骤
            </Button>
          </div>
          {script.steps.length === 0 ? (
            <div className="flex items-center gap-2 bg-muted/50 border border-dashed border-border rounded-lg text-muted-foreground text-sm min-h-[72px] p-[14px]">
              暂无步骤
            </div>
          ) : (
            <div className="grid gap-2">
              {script.steps.map((step, index) => (
                <button
                  className={`grid gap-[3px] text-left bg-card border rounded-lg p-[10px] cursor-pointer ${
                    step.id === selectedStep?.id
                      ? "border-primary/60 shadow-[0_0_0_2px_rgba(121,199,189,0.18)]"
                      : "border-border"
                  }`}
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  type="button"
                >
                  <span className="text-muted-foreground text-xs not-italic">
                    步骤 {index + 1}
                  </span>
                  <strong className="text-sm">{step.keyword || "未选择关键字"}</strong>
                  <em className="text-muted-foreground text-xs not-italic">
                    {step.enabled ? "启用" : "禁用"}
                  </em>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-3 bg-muted/30 border border-border rounded-lg p-4 col-span-full">
          <h2 className="text-foreground text-[17px] m-0">步骤详情</h2>
          {selectedStep ? (
            <>
              <div className="flex flex-wrap items-center gap-[10px]">
                <Button
                  onClick={() => moveStep(selectedStep.id, -1)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  onClick={() => moveStep(selectedStep.id, 1)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button
                  onClick={() => copyStep(selectedStep)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Copy aria-hidden="true" />
                </Button>
                <Button
                  onClick={() => removeStep(selectedStep.id)}
                  size="icon-sm"
                  type="button"
                  variant="destructive"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-1">
                <label className="grid gap-[6px]">
                  <span className="text-muted-foreground/80 text-xs font-extrabold">关键字</span>
                  <select
                    aria-label="关键字"
                    className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
                    value={selectedStep.keyword}
                    onChange={(event) =>
                      updateStep(selectedStep.id, {
                        keyword: event.target.value,
                        params: {},
                      })
                    }
                  >
                    <option value="">选择关键字</option>
                    {groupKeywords(keywords).map(([module, items]) => (
                      <optgroup key={module} label={module}>
                        {items.map((keyword) => (
                          <option key={keyword.name} value={keyword.name}>
                            {keyword.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="grid gap-[6px]">
                  <span className="text-muted-foreground/80 text-xs font-extrabold">启用步骤</span>
                  <input
                    aria-label="启用步骤"
                    className="size-[18px]"
                    checked={selectedStep.enabled}
                    onChange={(event) =>
                      updateStep(selectedStep.id, { enabled: event.target.checked })
                    }
                    type="checkbox"
                  />
                </label>
                <label className="grid gap-[6px] col-span-full">
                  <span className="text-muted-foreground/80 text-xs font-extrabold">步骤描述</span>
                  <textarea
                    aria-label="步骤描述"
                    className="bg-background border border-border rounded-md text-foreground min-h-[74px] px-[9px] py-[7px] w-full resize-y"
                    value={selectedStep.description}
                    onChange={(event) =>
                      updateStep(selectedStep.id, { description: event.target.value })
                    }
                  />
                </label>
              </div>

              <div className="grid gap-[10px]">
                {selectedKeyword?.parameters.map((parameter) => (
                  <ParameterInput
                    key={parameter.name}
                    onChange={(value) => updateParam(selectedStep, parameter, value)}
                    parameter={parameter}
                    value={selectedStep.params[parameter.name]}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 bg-muted/50 border border-dashed border-border rounded-lg text-muted-foreground text-sm min-h-[72px] p-[14px]">
              请选择或添加步骤
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 重写 ParameterInput 组件**

```tsx
function ParameterInput({
  onChange,
  parameter,
  value,
}: {
  onChange: (value: string | boolean) => void
  parameter: KeywordParameter
  value: unknown
}) {
  if (parameter.type === "boolean") {
    return (
      <label className="grid gap-[6px]">
        <span className="text-muted-foreground/80 text-xs font-extrabold">
          {parameter.description || parameter.name}
        </span>
        <input
          aria-label={`参数 ${parameter.name}`}
          className="size-[18px]"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
      </label>
    )
  }

  return (
    <label className="grid gap-[6px]">
      <span className="text-muted-foreground/80 text-xs font-extrabold">
        {parameter.description || parameter.name}
      </span>
      <input
        aria-label={`参数 ${parameter.name}`}
        className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
        type={parameter.type === "integer" || parameter.type === "number" ? "number" : "text"}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
```

- [ ] **Step 3: 删除文件内 parseTags 和 uniqueValues 函数**

因为 `parseTags` 已从 `@/lib/utils` 导入。`uniqueValues` 仍在使用，保留。确认 imports 中有 `import { parseTags } from "@/lib/utils"`。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/features/scripts/ScriptPages.tsx
git commit -m "refactor(web): migrate ScriptEditorPage to Tailwind utilities

Replace custom CSS classes with Tailwind utilities. Use parseTags
from shared utils. Style form inputs, step list, validation panel
with Tailwind + shadcn Badge/Button components."

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 6: ToolPages.tsx — 命令库 + SSH 终端

**Files:**
- Modify: `apps/web/src/features/tools/ToolPages.tsx`

两大部分：CommandLibraryPage（命令模板 CRUD）和 SshTerminalPage（SSH 终端 + 命令联想）。

- [ ] **Step 1: 更新 imports，添加 parseTags**

在 `apps/web/src/features/tools/ToolPages.tsx` 顶部修改 imports：

```tsx
import "@xterm/xterm/css/xterm.css"

import type { FitAddon as XtermFitAddon } from "@xterm/addon-fit"
import type { Terminal as XtermTerminal } from "@xterm/xterm"
import {
  Edit3,
  Plug,
  Plus,
  Save,
  Search,
  SquareTerminal,
  Trash2,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  createApiClient,
  type CommandTemplate,
  type CommandTemplatePayload,
} from "@/lib/api"
import { parseTags } from "@/lib/utils"
```

- [ ] **Step 2: 重写 CommandLibraryPage 组件的 JSX**

将 `CommandLibraryPage` 的 return 语句替换为（逻辑部分保持不变，只改 JSX）：

```tsx
  return (
    <section className="grid gap-6 content-start rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-[10px]">
        <div className="grid gap-[6px]">
          <p className="text-primary/80 text-xs font-extrabold m-0">阶段八</p>
          <h1 className="text-foreground text-[28px] leading-tight m-0">命令库</h1>
          <span className="text-muted-foreground text-sm m-0">
            维护完整 SSH 命令，并在终端输入时用于联想。
          </span>
        </div>
        <Badge variant="secondary">完整命令</Badge>
      </div>

      <div className="grid grid-cols-[0.85fr_1.15fr] gap-4 max-xl:grid-cols-1">
        <section className="grid gap-3 bg-muted/30 border border-border rounded-lg p-4">
          <div className="flex items-center justify-between gap-[10px]">
            <h2 className="text-foreground text-[17px] m-0">
              {editingId ? "编辑命令" : "新增命令"}
            </h2>
            {editingId ? (
              <Button onClick={resetForm} type="button" variant="ghost">
                <Plus aria-hidden="true" data-icon="inline-start" />
                新建
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <label className="grid gap-[6px]">
              <span className="text-muted-foreground/80 text-xs font-extrabold">命令名称</span>
              <input
                aria-label="命令名称"
                className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
                value={form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
              />
            </label>
            <label className="grid gap-[6px]">
              <span className="text-muted-foreground/80 text-xs font-extrabold">分组</span>
              <input
                aria-label="分组"
                className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
                value={form.group}
                onChange={(event) => updateForm({ group: event.target.value })}
              />
            </label>
            <label className="grid gap-[6px] col-span-full">
              <span className="text-muted-foreground/80 text-xs font-extrabold">完整命令</span>
              <textarea
                aria-label="完整命令"
                className="bg-background border border-border rounded-md text-foreground min-h-[74px] px-[9px] py-[7px] w-full resize-y"
                value={form.command}
                onChange={(event) => updateForm({ command: event.target.value })}
              />
            </label>
            <label className="grid gap-[6px]">
              <span className="text-muted-foreground/80 text-xs font-extrabold">标签</span>
              <input
                aria-label="标签"
                className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
                value={tagText}
                onChange={(event) => setTagText(event.target.value)}
              />
            </label>
            <label className="grid gap-[6px] col-span-full">
              <span className="text-muted-foreground/80 text-xs font-extrabold">说明</span>
              <textarea
                aria-label="说明"
                className="bg-background border border-border rounded-md text-foreground min-h-[74px] px-[9px] py-[7px] w-full resize-y"
                value={form.description}
                onChange={(event) => updateForm({ description: event.target.value })}
              />
            </label>
          </div>
          <Button
            disabled={!form.name.trim() || !form.command.trim()}
            onClick={submit}
            type="button"
          >
            <Save aria-hidden="true" data-icon="inline-start" />
            保存命令
          </Button>
        </section>

        <section className="grid gap-3 bg-muted/30 border border-border rounded-lg p-4">
          <label className="grid gap-[6px]">
            <span className="flex items-center gap-[7px] text-muted-foreground/80 text-xs font-extrabold">
              <Search aria-hidden="true" size={14} />
              搜索命令
            </span>
            <input
              aria-label="搜索命令"
              className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="名称、命令、分组、标签"
            />
          </label>

          {commandsQuery.isPending ? (
            <div className="flex items-center gap-2 bg-muted/50 border border-dashed border-border rounded-lg text-muted-foreground text-sm min-h-[72px] p-[14px]">
              正在加载命令
            </div>
          ) : commands.length === 0 ? (
            <div className="flex items-center gap-2 bg-muted/50 border border-dashed border-border rounded-lg text-muted-foreground text-sm min-h-[72px] p-[14px]">
              暂无命令
            </div>
          ) : (
            <div className="grid gap-[10px]">
              {commands.map((command) => (
                <article
                  className="grid grid-cols-[1fr_auto] items-start gap-3 bg-card border border-border rounded-lg p-[14px] max-sm:grid-cols-1"
                  key={command.id}
                >
                  <div>
                    <div className="flex items-center justify-start gap-2 mb-1">
                      <h3 className="text-foreground text-[15px] m-0">{command.name}</h3>
                      {command.group ? (
                        <Badge variant="secondary">{command.group}</Badge>
                      ) : null}
                    </div>
                    <code className="block bg-muted rounded-md text-foreground/80 text-xs font-mono leading-snug break-words p-2 my-2">
                      {command.command}
                    </code>
                    {command.description ? (
                      <p className="text-muted-foreground text-[13px] leading-snug m-0 mt-2">
                        {command.description}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-[6px] mt-2">
                      {command.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-[6px] justify-end">
                    <Button
                      aria-label={`编辑 ${command.name}`}
                      onClick={() => editCommand(command)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Edit3 aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label={`删除 ${command.name}`}
                      onClick={() => deleteMutation.mutate(command.id)}
                      size="icon-sm"
                      type="button"
                      variant="destructive"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
```

- [ ] **Step 3: 重写 SshTerminalPage 组件的 JSX**

逻辑代码（useEffect, connect, disconnect 等）完全不变，只替换 JSX 部分：

```tsx
  return (
    <section className="grid gap-6 content-start rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-[10px]">
        <div className="grid gap-[6px]">
          <p className="text-primary/80 text-xs font-extrabold m-0">阶段八</p>
          <h1 className="text-foreground text-[28px] leading-tight m-0">SSH 终端</h1>
          <span className="text-muted-foreground text-sm m-0">
            连接测试设备并通过命令库获得输入联想。
          </span>
        </div>
        <Badge variant={status === "connected" ? "default" : "secondary"}>
          {sshStatusLabel(status)}
        </Badge>
      </div>

      <div className="grid grid-cols-[320px_1fr] gap-4 max-xl:grid-cols-1">
        <section className="grid gap-3 content-start bg-muted/30 border border-border rounded-lg p-4">
          <h2 className="text-foreground text-[17px] m-0">连接</h2>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <label className="grid gap-[6px]">
              <span className="text-muted-foreground/80 text-xs font-extrabold">主机</span>
              <input
                aria-label="主机"
                className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
                value={form.host}
                onChange={(event) => updateForm({ host: event.target.value })}
              />
            </label>
            <label className="grid gap-[6px]">
              <span className="text-muted-foreground/80 text-xs font-extrabold">端口</span>
              <input
                aria-label="端口"
                className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
                type="number"
                value={form.port}
                onChange={(event) => updateForm({ port: event.target.value })}
              />
            </label>
            <label className="grid gap-[6px]">
              <span className="text-muted-foreground/80 text-xs font-extrabold">账号</span>
              <input
                aria-label="账号"
                className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
                value={form.username}
                onChange={(event) => updateForm({ username: event.target.value })}
              />
            </label>
            <label className="grid gap-[6px]">
              <span className="text-muted-foreground/80 text-xs font-extrabold">密码</span>
              <input
                aria-label="密码"
                className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
                type="password"
                value={form.password}
                onChange={(event) => updateForm({ password: event.target.value })}
              />
            </label>
            <label className="flex items-center gap-[7px] text-muted-foreground/80 text-xs font-extrabold col-span-full">
              <input
                aria-label="跳过本次主机密钥校验"
                className="size-[18px] flex-none"
                checked={form.skipHostKeyCheck}
                onChange={(event) => updateForm({ skipHostKeyCheck: event.target.checked })}
                type="checkbox"
              />
              <span>跳过本次主机密钥校验</span>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-[10px]">
            <Button
              disabled={!form.host.trim() || !form.username.trim()}
              onClick={connect}
              type="button"
            >
              <Plug aria-hidden="true" data-icon="inline-start" />
              连接
            </Button>
            <Button onClick={disconnect} type="button" variant="secondary">
              断开
            </Button>
          </div>
          {errorMessage ? (
            <div className="grid gap-[6px] bg-destructive/10 border border-destructive/30 rounded-lg text-destructive p-3">
              <p className="m-0">{errorMessage}</p>
            </div>
          ) : null}
        </section>

        <section className="grid grid-rows-[auto_minmax(360px,58vh)] bg-gray-950 border border-gray-800 rounded-lg overflow-hidden min-w-0">
          <div className="flex items-center gap-2 bg-gray-900 border-b border-gray-800 text-gray-400 text-xs min-h-9 px-3">
            <SquareTerminal aria-hidden="true" size={16} />
            <span>{sshWebSocketUrl}</span>
          </div>
          <div className="min-h-0 p-[10px]" ref={terminalContainerRef} />
        </section>

        <section className="grid gap-3 content-start bg-muted/30 border border-border rounded-lg p-4 col-span-full">
          <h2 className="text-foreground text-[17px] m-0">命令联想</h2>
          {suggestions.length === 0 ? (
            <div className="flex items-center gap-2 bg-muted/50 border border-dashed border-border rounded-lg text-muted-foreground text-sm min-h-[72px] p-[14px]">
              输入命令前缀后显示联想
            </div>
          ) : (
            <div className="grid gap-[10px]">
              {suggestions.map((command) => (
                <button
                  className="grid gap-2 text-left bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/60 hover:shadow-[0_0_0_2px_rgba(121,199,189,0.16)]"
                  key={command.id}
                  onClick={() => applySuggestion(command)}
                  type="button"
                >
                  <strong className="text-foreground text-[13px]">{command.name}</strong>
                  <code className="bg-muted rounded-md text-foreground/80 text-xs font-mono p-2 m-0 break-words">
                    {command.command}
                  </code>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
```

- [ ] **Step 4: 删除文件末尾的 parseTags 函数**

文件内已有的 `parseTags` 函数（约 L539-548）需要删除，因为已从 `@/lib/utils` 导入。其余辅助函数（`filterCommandSuggestions`, `applyTerminalInput`, `sshStatusLabel`）保持不变。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/features/tools/ToolPages.tsx
git commit -m "refactor(web): migrate ToolPages to Tailwind utilities

Replace custom CSS classes with Tailwind utilities and shadcn
Badge/Button components. Use parseTags from shared utils. Apply
Tailwind styling to command library and SSH terminal panels."

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 7: TaskPage.tsx — 执行任务页面

**Files:**
- Modify: `apps/web/src/features/execution/TaskPage.tsx`

执行任务控制区、当前任务详情、实时日志、最近任务列表。

- [ ] **Step 1: 重写 TaskPage 组件的 JSX**

逻辑代码（useEffect, createMutation, cancelMutation 等）完全不变，只替换 JSX：

```tsx
  return (
    <section className="grid gap-6 content-start rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-[10px]">
        <div className="grid gap-[6px]">
          <p className="text-primary/80 text-xs font-extrabold m-0">阶段六</p>
          <h1 className="text-foreground text-[28px] leading-tight m-0">执行任务</h1>
          <span className="text-muted-foreground text-sm m-0">
            选择已发布脚本，启动本地执行并查看实时任务输出。
          </span>
        </div>
        <Badge variant={activeTask ? statusVariant(activeTask.status) : "secondary"}>
          {activeTask ? taskStatusLabel(activeTask.status) : "未启动"}
        </Badge>
      </div>

      <section className="grid gap-3 content-start bg-muted/30 border border-border rounded-lg p-4">
        <h2 className="text-foreground text-[17px] m-0">任务控制</h2>
        <div className="grid grid-cols-[1.2fr_0.6fr_0.8fr] gap-3 max-sm:grid-cols-1">
          <label className="grid gap-[6px]">
            <span className="text-muted-foreground/80 text-xs font-extrabold">选择脚本</span>
            <select
              aria-label="选择脚本"
              className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
              value={selectedScriptId}
              onChange={(event) => setSelectedScriptId(event.target.value)}
            >
              <option value="">选择已发布脚本</option>
              {publishedScripts.map((script) => (
                <option key={script.id} value={script.id}>
                  {script.name || script.id}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-[6px]">
            <span className="text-muted-foreground/80 text-xs font-extrabold">执行环境</span>
            <select
              aria-label="执行环境"
              className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
              value={environment}
              onChange={(event) => setEnvironment(event.target.value)}
            >
              <option value="local">local</option>
              <option value="lab">lab</option>
              <option value="ci">ci</option>
            </select>
          </label>
          <label className="grid gap-[6px]">
            <span className="text-muted-foreground/80 text-xs font-extrabold">目标设备</span>
            <input
              aria-label="目标设备"
              className="bg-background border border-border rounded-md text-foreground min-h-9 px-[9px] py-[7px] w-full"
              value={targetDevice}
              onChange={(event) => setTargetDevice(event.target.value)}
              placeholder="bench-1"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-[10px]">
          <Button
            disabled={!selectedScriptId || createMutation.isPending}
            onClick={startExecution}
            type="button"
          >
            <Play aria-hidden="true" data-icon="inline-start" />
            开始执行
          </Button>
          <Button
            disabled={!canCancelTask(activeTask) || cancelMutation.isPending}
            onClick={cancelExecution}
            type="button"
            variant="secondary"
          >
            <Square aria-hidden="true" data-icon="inline-start" />
            取消
          </Button>
        </div>
        {scriptsQuery.isError ? (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm min-h-[72px] p-[14px]">
            脚本列表不可用
          </div>
        ) : null}
        {publishedScripts.length === 0 && !scriptsQuery.isPending ? (
          <div className="flex items-center gap-2 bg-muted/50 border border-dashed border-border rounded-lg text-muted-foreground text-sm min-h-[72px] p-[14px]">
            暂无已发布脚本
          </div>
        ) : null}
        {selectedScript ? <SelectedScriptSummary script={selectedScript} /> : null}
      </section>

      <div className="grid grid-cols-[0.8fr_1.2fr] gap-4 max-xl:grid-cols-1">
        <section className="grid gap-3 bg-muted/30 border border-border rounded-lg p-4">
          <h2 className="text-foreground text-[17px] m-0">当前任务</h2>
          {activeTask ? (
            <TaskDetail task={activeTask} />
          ) : (
            <div className="flex items-center gap-2 bg-muted/50 border border-dashed border-border rounded-lg text-muted-foreground text-sm min-h-[72px] p-[14px]">
              启动执行后显示当前任务
            </div>
          )}
        </section>

        <section className="grid gap-3 bg-muted/30 border border-border rounded-lg p-4">
          <h2 className="text-foreground text-[17px] m-0">实时日志</h2>
          {liveLogs.length === 0 ? (
            <div className="flex items-center gap-2 bg-muted/50 border border-dashed border-border rounded-lg text-muted-foreground text-sm min-h-[72px] p-[14px]">
              等待执行日志
            </div>
          ) : (
            <div className="grid gap-[10px] max-h-[420px] overflow-auto content-start" aria-label="实时日志">
              {liveLogs.map((log, index) => (
                <code
                  className="bg-muted rounded-md text-foreground/80 text-xs font-mono leading-snug p-2 break-words"
                  key={`${log}-${index}`}
                >
                  {log}
                </code>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-3 bg-muted/30 border border-border rounded-lg p-4 col-span-full">
          <h2 className="text-foreground text-[17px] m-0">最近任务</h2>
          {tasksQuery.isPending ? (
            <div className="flex items-center gap-2 bg-muted/50 border border-dashed border-border rounded-lg text-muted-foreground text-sm min-h-[72px] p-[14px]">
              正在加载任务
            </div>
          ) : recentTasks.length === 0 ? (
            <div className="flex items-center gap-2 bg-muted/50 border border-dashed border-border rounded-lg text-muted-foreground text-sm min-h-[72px] p-[14px]">
              暂无执行任务
            </div>
          ) : (
            <div className="grid gap-[10px]">
              {recentTasks.map((task) => (
                <TaskSummaryItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
```

- [ ] **Step 2: 重写 SelectedScriptSummary 组件**

```tsx
function SelectedScriptSummary({ script }: { script: ScriptSummary }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-[10px] bg-card border border-border rounded-lg p-[14px]">
      <strong className="text-foreground">{script.name}</strong>
      <span className="text-muted-foreground text-[13px] col-span-full overflow-hidden text-ellipsis">
        {script.description || script.id}
      </span>
      <Badge variant="secondary">v{script.revision}</Badge>
    </div>
  )
}
```

- [ ] **Step 3: 重写 TaskDetail 组件**

```tsx
function TaskDetail({ task }: { task: ExecutionTask }) {
  return (
    <div className="grid gap-[10px] bg-card border border-border rounded-lg p-[14px]">
      <div className="flex items-center justify-start gap-2 mb-1">
        <h3 className="text-foreground text-[15px] m-0 overflow-hidden text-ellipsis">
          {task.script_name}
        </h3>
        <Badge variant={statusVariant(task.status)}>
          {taskStatusLabel(task.status)}
        </Badge>
      </div>
      <dl className="grid gap-[10px] m-0">
        <div>
          <dt className="text-muted-foreground text-[11px]">任务 ID</dt>
          <dd className="text-foreground overflow-hidden text-ellipsis m-0">{task.id}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-[11px]">环境</dt>
          <dd className="text-foreground m-0">{task.environment}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-[11px]">设备</dt>
          <dd className="text-foreground m-0">{task.target_device || "-"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-[11px]">执行器</dt>
          <dd className="text-foreground m-0">{task.executor}</dd>
        </div>
      </dl>
      {task.error_message ? (
        <div className="grid gap-[6px] bg-destructive/10 border border-destructive/30 rounded-lg text-destructive p-3">
          <p className="m-0">{task.error_message}</p>
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: 重写 TaskSummaryItem 组件**

```tsx
function TaskSummaryItem({ task }: { task: ExecutionTaskSummary }) {
  return (
    <article className="grid grid-cols-[1fr_auto] items-center gap-3 bg-card border border-border rounded-lg p-[14px] max-sm:grid-cols-1">
      <div>
        <div className="flex items-center justify-start gap-2 mb-1">
          <h3 className="text-foreground text-[15px] m-0 overflow-hidden text-ellipsis">
            {task.script_name}
          </h3>
          <Badge variant={statusVariant(task.status)}>
            {taskStatusLabel(task.status)}
          </Badge>
        </div>
        <p className="text-muted-foreground text-[13px] m-0">{task.id}</p>
      </div>
      <dl className="flex gap-[10px] m-0">
        <div className="bg-secondary rounded-md min-w-16 px-[9px] py-[7px]">
          <dt className="text-muted-foreground text-[11px] m-0">步骤</dt>
          <dd className="text-foreground text-[13px] font-extrabold m-0 overflow-hidden text-ellipsis">
            {task.passed_step_count}/{task.step_count}
          </dd>
        </div>
        <div className="bg-secondary rounded-md min-w-16 px-[9px] py-[7px]">
          <dt className="text-muted-foreground text-[11px] m-0">环境</dt>
          <dd className="text-foreground text-[13px] font-extrabold m-0">{task.environment}</dd>
        </div>
      </dl>
    </article>
  )
}
```

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/features/execution/TaskPage.tsx
git commit -m "refactor(web): migrate TaskPage to Tailwind utilities

Replace custom CSS classes with Tailwind utilities and shadcn
Badge/Button components. Apply consistent styling to execution
controls, task cards, log display, and task summary items."

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 8: 验证 — TypeScript + 测试 + 构建

**Files:**
- No changes — 验证所有已修改文件

- [ ] **Step 1: TypeScript 类型检查**

```bash
cd c:/code/TestFlow/apps/web && npx tsc -b --noEmit 2>&1
```

预期：无类型错误。若有，根据错误信息修复对应文件的 import 或类型问题。

- [ ] **Step 2: 运行测试**

```bash
cd c:/code/TestFlow/apps/web && npx vitest run 2>&1
```

预期：所有测试通过。测试使用 `aria-label` / `role` 选择器，CSS class 变化不应影响。

- [ ] **Step 3: Vite 构建**

```bash
cd c:/code/TestFlow/apps/web && npx vite build 2>&1
```

预期：构建成功，CSS 输出应显著减小（从 ~1133 行原生 CSS 缩减到 ~100 行 + Tailwind 生成的 utilities）。

- [ ] **Step 4: 提交**

```bash
git commit -m "chore(web): verify CSS refactor — types, tests, build pass

TypeScript type check passes.
All vitest tests pass.
Vite build succeeds with significantly reduced CSS footprint."

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```
