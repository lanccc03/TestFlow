# Web Module Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split oversized Web page files into focused feature modules while preserving current behavior, routes, tests, and visual output.

**Architecture:** Keep a feature-first structure: route pages compose feature-local hooks and components; hooks own React Query, mutations, WebSocket subscriptions, and form state; utilities stay pure and testable. Shared app shell layout moves to `components/layout`, and shared URLs move to `app/config.ts`.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, Vite 8, TypeScript 6, Vitest, Testing Library, shadcn/ui, Tailwind CSS v4, lucide-react.

---

## File Structure

Create or modify these files:

- Create: `apps/web/src/app/config.ts`
  - Own shared backend and WebSocket URL constants.
- Modify: `apps/web/src/App.tsx`
  - Keep status effects and route rendering, delegate layout to `AppShell`.
- Modify: `apps/web/src/app/routes.tsx`
  - Import route pages from feature barrel files.
- Create: `apps/web/src/components/layout/AppShell.tsx`
  - Render outer grid, sidebar, header, and main content slot.
- Create: `apps/web/src/components/layout/Sidebar.tsx`
  - Render brand and navigation links.
- Create: `apps/web/src/components/layout/TopStatusBar.tsx`
  - Render backend and WebSocket status pills.
- Create: `apps/web/src/components/layout/StatusPill.tsx`
  - Render a single status badge.
- Create: `apps/web/src/features/scripts/index.ts`
  - Export script route pages.
- Create: `apps/web/src/features/scripts/constants.ts`
  - Own `emptyScript`.
- Create: `apps/web/src/features/scripts/types.ts`
  - Own `ValidationIssue`.
- Create: `apps/web/src/features/scripts/pages/ScriptListPage.tsx`
  - Own script list page composition and list mutations.
- Create: `apps/web/src/features/scripts/pages/ScriptEditorPage.tsx`
  - Own script editor page composition and editor mutations.
- Create: `apps/web/src/features/scripts/components/ScriptFilters.tsx`
  - Render search and filter controls.
- Create: `apps/web/src/features/scripts/components/ScriptListItem.tsx`
  - Render one script list item.
- Create: `apps/web/src/features/scripts/components/ParameterInput.tsx`
  - Render keyword parameter inputs.
- Create: `apps/web/src/features/scripts/utils/filters.ts`
  - Own `filterScripts` and `uniqueValues`.
- Create: `apps/web/src/features/scripts/utils/keywords.ts`
  - Own `groupKeywords`.
- Create: `apps/web/src/features/scripts/utils/validation.ts`
  - Own validation and issue formatting helpers.
- Delete after migration: `apps/web/src/features/scripts/ScriptPages.tsx`
- Create: `apps/web/src/features/execution/index.ts`
  - Export execution route page.
- Create: `apps/web/src/features/execution/constants.ts`
  - Own `executionWebSocketUrl`.
- Create: `apps/web/src/features/execution/pages/TaskPage.tsx`
  - Own execution page composition.
- Create: `apps/web/src/features/execution/components/SelectedScriptSummary.tsx`
  - Render selected script metadata.
- Create: `apps/web/src/features/execution/components/TaskDetail.tsx`
  - Render active task details.
- Create: `apps/web/src/features/execution/components/TaskSummaryItem.tsx`
  - Render one recent task item.
- Create: `apps/web/src/features/execution/components/TaskControlPanel.tsx`
  - Render script/environment/device controls and start/cancel buttons.
- Create: `apps/web/src/features/execution/utils/taskFormatters.ts`
  - Own log formatting and status label helpers.
- Create: `apps/web/src/features/execution/utils/taskGuards.ts`
  - Own message and task guard helpers.
- Delete after migration: `apps/web/src/features/execution/TaskPage.tsx`
- Create: `apps/web/src/features/tools/index.ts`
  - Export tool route pages.
- Create: `apps/web/src/features/tools/command-library/constants.ts`
  - Own `emptyCommandForm`.
- Create: `apps/web/src/features/tools/command-library/pages/CommandLibraryPage.tsx`
  - Own command library page state and mutations.
- Create: `apps/web/src/features/tools/command-library/components/CommandForm.tsx`
  - Render command create/edit form.
- Create: `apps/web/src/features/tools/command-library/components/CommandList.tsx`
  - Render command loading/empty/list state.
- Create: `apps/web/src/features/tools/command-library/components/CommandListItem.tsx`
  - Render one command card.
- Create: `apps/web/src/features/tools/ssh-terminal/pages/SshTerminalPage.tsx`
  - Own SSH terminal route page and xterm lifecycle.
- Create: `apps/web/src/features/tools/ssh-terminal/store.ts`
  - Move existing SSH terminal Zustand store.
- Create: `apps/web/src/features/tools/ssh-terminal/utils/commandSuggestions.ts`
  - Own `filterCommandSuggestions`.
- Create: `apps/web/src/features/tools/ssh-terminal/utils/sshStatus.ts`
  - Own `sshStatusLabel`.
- Delete after migration: `apps/web/src/features/tools/ToolPages.tsx`
- Delete after migration: `apps/web/src/features/tools/sshTerminalStore.ts`
- Modify or move tests:
  - `apps/web/src/App.test.tsx`
  - `apps/web/src/features/tools/ToolPages.test.tsx`
  - `apps/web/src/features/execution/TaskPage.test.tsx`

## Task 1: Extract App Shell

**Files:**
- Create: `apps/web/src/app/config.ts`
- Create: `apps/web/src/components/layout/AppShell.tsx`
- Create: `apps/web/src/components/layout/Sidebar.tsx`
- Create: `apps/web/src/components/layout/TopStatusBar.tsx`
- Create: `apps/web/src/components/layout/StatusPill.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Create shared app config**

Create `apps/web/src/app/config.ts`:

```ts
export const backendBaseUrl = 'http://127.0.0.1:8000'
export const websocketUrl = 'ws://127.0.0.1:8000/ws'
```

- [ ] **Step 2: Create `StatusPill`**

Create `apps/web/src/components/layout/StatusPill.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function StatusPill({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: LucideIcon
  label: string
  tone: 'success' | 'warning'
  value: string
}) {
  return (
    <Badge
      className={cn(
        'min-h-8 gap-1.5 rounded-lg px-2.5 font-medium',
        tone === 'success'
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground',
      )}
      variant={tone === 'success' ? 'default' : 'secondary'}
    >
      <Icon aria-hidden="true" size={14} />
      <span className="text-current/70">{label}</span>
      <strong className="font-semibold">{value}</strong>
    </Badge>
  )
}
```

- [ ] **Step 3: Create `TopStatusBar`**

Create `apps/web/src/components/layout/TopStatusBar.tsx` with the status label maps currently in `App.tsx`:

```tsx
import { Cable, Server } from 'lucide-react'

import type { WebSocketStatus } from '@/lib/websocket'
import type { BackendStatus } from '@/testflow'

import { StatusPill } from './StatusPill'

const backendStateLabels: Record<BackendStatus['state'], string> = {
  exited: '已退出',
  failed: '异常',
  running: '运行中',
  starting: '启动中',
  stopped: '已停止',
}

const websocketStateLabels: Record<WebSocketStatus['state'], string> = {
  connected: '已连接',
  connecting: '连接中',
  disconnected: '已断开',
  reconnecting: '重连中',
}

export function TopStatusBar({
  backendStatus,
  websocketStatus,
}: {
  backendStatus: BackendStatus
  websocketStatus: WebSocketStatus
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2.5" aria-label="系统状态">
      <StatusPill
        icon={Server}
        label="后端服务"
        tone={backendStatus.state === 'running' ? 'success' : 'warning'}
        value={backendStateLabels[backendStatus.state]}
      />
      <StatusPill
        icon={Cable}
        label="WebSocket"
        tone={websocketStatus.state === 'connected' ? 'success' : 'warning'}
        value={websocketStateLabels[websocketStatus.state]}
      />
    </div>
  )
}
```

- [ ] **Step 4: Create `Sidebar`**

Create `apps/web/src/components/layout/Sidebar.tsx` by moving the existing aside/nav JSX:

```tsx
import { ChevronRight } from 'lucide-react'
import { NavLink } from 'react-router'

import { appRoutes, navGroups } from '@/app/routes'
import { cn } from '@/lib/utils'

export function Sidebar() {
  return (
    <aside
      className="flex flex-col gap-7 border-r border-sidebar-border bg-sidebar px-3.5 py-5 text-sidebar-foreground max-lg:gap-4"
      aria-label="主导航"
    >
      <div className="flex items-center gap-3 px-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
          TF
        </div>
        <div>
          <strong className="block text-base font-semibold text-sidebar-foreground">
            TestFlow
          </strong>
          <span className="mt-0.5 block text-xs text-sidebar-foreground/60">
            自动化测试工作台
          </span>
        </div>
      </div>

      <nav className="grid gap-2 max-sm:grid-cols-1 max-lg:grid-cols-3">
        {navGroups.map((group) => (
          <div className="grid gap-2 border-t border-sidebar-border pt-4" key={group.id}>
            <div className="flex items-center gap-2 px-2 text-xs font-semibold text-sidebar-foreground/60">
              <group.icon aria-hidden="true" size={14} />
              {group.label}
            </div>
            {appRoutes
              .filter((route) => route.navGroup === group.id && !route.navHidden)
              .map((route) => (
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      'grid min-h-9 grid-cols-[18px_minmax(0,1fr)_14px] items-center gap-2.5 rounded-lg px-2.5 text-sm text-sidebar-foreground/75 no-underline transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      isActive &&
                        'bg-sidebar-accent text-sidebar-accent-foreground font-semibold',
                    )
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
  )
}
```

- [ ] **Step 5: Create `AppShell`**

Create `apps/web/src/components/layout/AppShell.tsx`:

```tsx
import type { ReactNode } from 'react'

import type { WebSocketStatus } from '@/lib/websocket'
import type { BackendStatus } from '@/testflow'

import { Sidebar } from './Sidebar'
import { TopStatusBar } from './TopStatusBar'

export function AppShell({
  backendStatus,
  children,
  websocketStatus,
}: {
  backendStatus: BackendStatus
  children: ReactNode
  websocketStatus: WebSocketStatus
}) {
  return (
    <div className="grid min-h-screen grid-cols-[264px_minmax(0,1fr)] bg-background text-foreground max-lg:grid-cols-1">
      <Sidebar />
      <div className="grid min-w-0 grid-rows-[auto_1fr]">
        <header className="flex min-h-18 items-center justify-between gap-4 border-b bg-card/90 px-7 py-3.5 max-sm:px-4 max-md:flex-col max-md:items-start">
          <TopStatusBar
            backendStatus={backendStatus}
            websocketStatus={websocketStatus}
          />
        </header>
        <main className="grid gap-5 p-3 pb-8 max-sm:px-4">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Simplify `App.tsx`**

Update imports and replace inline layout with `AppShell`:

```tsx
import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'

import { backendBaseUrl, websocketUrl } from '@/app/config'
import { AppShell } from '@/components/layout/AppShell'

import { appRoutes } from './app/routes'
import { createWebSocketClient, type WebSocketStatus } from './lib/websocket'
import type { BackendStatus } from './testflow'
```

The return body should become:

```tsx
return (
  <AppShell backendStatus={backendStatus} websocketStatus={websocketStatus}>
    <Routes>
      <Route element={<Navigate replace to="/scripts" />} path="/" />
      {appRoutes.map((route) => (
        <Route element={route.element} key={route.path} path={route.path} />
      ))}
      <Route element={<Navigate replace to="/scripts" />} path="*" />
    </Routes>
  </AppShell>
)
```

- [ ] **Step 7: Run App tests**

Run:

```bash
pnpm --filter @testflow/web test -- App.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit App shell split**

```bash
git add apps/web/src/app/config.ts apps/web/src/App.tsx apps/web/src/components/layout/AppShell.tsx apps/web/src/components/layout/Sidebar.tsx apps/web/src/components/layout/TopStatusBar.tsx apps/web/src/components/layout/StatusPill.tsx apps/web/src/App.test.tsx
git commit -m "split web app shell"
```

## Task 2: Split Scripts Utilities And Pages

**Files:**
- Create: `apps/web/src/features/scripts/constants.ts`
- Create: `apps/web/src/features/scripts/types.ts`
- Create: `apps/web/src/features/scripts/utils/filters.ts`
- Create: `apps/web/src/features/scripts/utils/keywords.ts`
- Create: `apps/web/src/features/scripts/utils/validation.ts`
- Create: `apps/web/src/features/scripts/components/ScriptFilters.tsx`
- Create: `apps/web/src/features/scripts/components/ScriptListItem.tsx`
- Create: `apps/web/src/features/scripts/components/ParameterInput.tsx`
- Create: `apps/web/src/features/scripts/pages/ScriptListPage.tsx`
- Create: `apps/web/src/features/scripts/pages/ScriptEditorPage.tsx`
- Create: `apps/web/src/features/scripts/index.ts`
- Delete: `apps/web/src/features/scripts/ScriptPages.tsx`
- Modify: `apps/web/src/app/routes.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Move scripts constants and types**

Create `constants.ts`:

```ts
import type { TestScript } from '@/lib/api'

export const emptyScript: TestScript = {
  id: '',
  name: '',
  description: '',
  status: 'draft',
  tags: [],
  group: '',
  variables: [],
  steps: [],
}
```

Create `types.ts`:

```ts
export type ValidationIssue = {
  field: string
  message: string
}
```

- [ ] **Step 2: Move pure scripts utilities**

Create `utils/filters.ts` with `filterScripts` and `uniqueValues` from `ScriptPages.tsx`. Export both functions:

```ts
import type { ScriptSummary } from '@/lib/api'

export function filterScripts({
  groupFilter,
  scripts,
  search,
  statusFilter,
  tagFilter,
}: {
  scripts: ScriptSummary[]
  search: string
  statusFilter: string
  groupFilter: string
  tagFilter: string
}) {
  const normalizedSearch = search.trim().toLowerCase()

  return scripts.filter((script) => {
    const matchesSearch =
      !normalizedSearch ||
      [script.id, script.name, script.description, script.group, ...script.tags]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch))

    const matchesStatus =
      statusFilter === 'all' || script.status === statusFilter
    const matchesGroup = groupFilter === 'all' || script.group === groupFilter
    const matchesTag = tagFilter === 'all' || script.tags.includes(tagFilter)

    return matchesSearch && matchesStatus && matchesGroup && matchesTag
  })
}

export function uniqueValues(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right),
  )
}
```

Create `utils/keywords.ts` with `groupKeywords` from the current file:

```ts
import type { KeywordMetadata } from '@/lib/api'

export function groupKeywords(keywords: KeywordMetadata[]) {
  return keywords.reduce<Record<string, KeywordMetadata[]>>((groups, keyword) => {
    const group = keyword.category || '其他'
    groups[group] = [...(groups[group] ?? []), keyword]
    return groups
  }, {})
}
```

Create `utils/validation.ts` by moving `validateScript`, `matchesType`, `formatIssue`, `normalizeMutationIssues`, and `isValidationIssue`. Preserve the exact validation rules from `ScriptPages.tsx`.

- [ ] **Step 3: Move list UI components**

Create `components/ScriptFilters.tsx` by moving the four filter controls from `ScriptListPage`. Props should be explicit:

```tsx
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function ScriptFilters({
  groupFilter,
  groups,
  search,
  setGroupFilter,
  setSearch,
  setStatusFilter,
  setTagFilter,
  statusFilter,
  tagFilter,
  tags,
}: {
  groupFilter: string
  groups: string[]
  search: string
  setGroupFilter: (value: string) => void
  setSearch: (value: string) => void
  setStatusFilter: (value: string) => void
  setTagFilter: (value: string) => void
  statusFilter: string
  tagFilter: string
  tags: string[]
}) {
  return (
    <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-1">
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">搜索脚本</span>
        <Input
          aria-label="搜索脚本"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="名称、ID、描述、标签"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">状态筛选</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="状态筛选">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="published">已发布</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">分组筛选</span>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger aria-label="分组筛选">
            <SelectValue placeholder="全部分组" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分组</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group} value={group}>
                {group}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">标签筛选</span>
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger aria-label="标签筛选">
            <SelectValue placeholder="全部标签" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部标签</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </div>
  )
}
```

Create `components/ScriptListItem.tsx` from the current `ScriptListItem` function. Keep the same props, labels, links, badges, copy button, delete confirmation behavior, and Tailwind classes; update only imports that now point to sibling utilities or shared components.

- [ ] **Step 4: Move editor UI components**

Create `components/ParameterInput.tsx` from the current `ParameterInput` function. Keep the same props, input types, checkbox handling, textarea handling, and ARIA labels; update only imports.

Do not create `ScriptStepEditor.tsx` in this implementation pass. Leave the step editor block inside `ScriptEditorPage.tsx` so this task focuses on splitting the list page, editor page, parameter input, and pure utilities.

- [ ] **Step 5: Create script pages**

Create `pages/ScriptListPage.tsx` from the list page body. Imports should come from new utilities and components:

```tsx
import { createApiClient } from '@/lib/api'
import { backendBaseUrl } from '@/app/config'

import { ScriptFilters } from '../components/ScriptFilters'
import { ScriptListItem } from '../components/ScriptListItem'
import { filterScripts, uniqueValues } from '../utils/filters'

const api = createApiClient({ baseUrl: backendBaseUrl })
```

Create `pages/ScriptEditorPage.tsx` from the editor page body. Imports should include:

```tsx
import { emptyScript } from '../constants'
import { ParameterInput } from '../components/ParameterInput'
import { groupKeywords } from '../utils/keywords'
import {
  formatIssue,
  normalizeMutationIssues,
  validateScript,
} from '../utils/validation'
```

- [ ] **Step 6: Add script barrel and update routes**

Create `apps/web/src/features/scripts/index.ts`:

```ts
export { ScriptEditorPage } from './pages/ScriptEditorPage'
export { ScriptListPage } from './pages/ScriptListPage'
```

Update `apps/web/src/app/routes.tsx`:

```ts
import { ScriptEditorPage, ScriptListPage } from '@/features/scripts'
```

- [ ] **Step 7: Remove old scripts file**

Delete `apps/web/src/features/scripts/ScriptPages.tsx` after route imports compile.

- [ ] **Step 8: Run scripts-related tests**

Run:

```bash
pnpm --filter @testflow/web test -- App.test.tsx
pnpm check:web
```

Expected: PASS.

- [ ] **Step 9: Commit scripts split**

```bash
git add apps/web/src/features/scripts apps/web/src/app/routes.tsx apps/web/src/App.test.tsx
git commit -m "split scripts web feature"
```

## Task 3: Split Execution Feature

**Files:**
- Create: `apps/web/src/features/execution/constants.ts`
- Create: `apps/web/src/features/execution/utils/taskFormatters.ts`
- Create: `apps/web/src/features/execution/utils/taskGuards.ts`
- Create: `apps/web/src/features/execution/components/SelectedScriptSummary.tsx`
- Create: `apps/web/src/features/execution/components/TaskDetail.tsx`
- Create: `apps/web/src/features/execution/components/TaskSummaryItem.tsx`
- Create: `apps/web/src/features/execution/components/TaskControlPanel.tsx`
- Create: `apps/web/src/features/execution/pages/TaskPage.tsx`
- Create: `apps/web/src/features/execution/index.ts`
- Delete: `apps/web/src/features/execution/TaskPage.tsx`
- Modify: `apps/web/src/app/routes.tsx`
- Test: `apps/web/src/features/execution/TaskPage.test.tsx`

- [ ] **Step 1: Move execution constants and utilities**

Create `constants.ts`:

```ts
import { backendBaseUrl } from '@/app/config'

export const executionWebSocketUrl = backendBaseUrl.replace('http://', 'ws://') + '/ws/executions'
```

Create `utils/taskFormatters.ts` with the current formatting helpers:

```ts
import type { ExecutionTask, ExecutionUpdateEvent, TaskStatus } from '@/lib/api'

export function formatLogEntry(log: ExecutionTask['logs'][number]) {
  return `[${log.timestamp}] ${log.level.toUpperCase()} ${log.message}`
}

export function formatEventLog(event: ExecutionUpdateEvent) {
  return `[${event.timestamp}] ${event.level?.toUpperCase() ?? 'INFO'} ${event.message ?? ''}`
}

export function statusVariant(status: TaskStatus) {
  if (status === 'passed') {
    return 'default'
  }
  if (status === 'failed' || status === 'cancelled') {
    return 'destructive'
  }
  return 'secondary'
}

export function taskStatusLabel(status: TaskStatus) {
  const labels: Record<TaskStatus, string> = {
    cancelled: '已取消',
    created: '已创建',
    failed: '失败',
    passed: '通过',
    running: '运行中',
  }
  return labels[status]
}
```

Create `utils/taskGuards.ts` with `isExecutionEventMessage`, `shouldRefreshTasks`, and `canCancelTask` from the current page. Keep the same accepted message shapes, refresh event types, and cancellable task statuses.

- [ ] **Step 2: Move execution components**

Create component files from the existing rendering functions:

```ts
// SelectedScriptSummary.tsx exports SelectedScriptSummary
// TaskDetail.tsx exports TaskDetail
// TaskSummaryItem.tsx exports TaskSummaryItem
```

Create `TaskControlPanel.tsx` by extracting the control card and passing explicit props:

```tsx
import { Play, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ScriptSummary } from '@/lib/api'

export function TaskControlPanel({
  canCancel,
  cancelPending,
  createPending,
  environment,
  onCancel,
  onEnvironmentChange,
  onScriptChange,
  onStart,
  onTargetDeviceChange,
  publishedScripts,
  selectedScriptId,
  targetDevice,
}: {
  canCancel: boolean
  cancelPending: boolean
  createPending: boolean
  environment: string
  onCancel: () => void
  onEnvironmentChange: (value: string) => void
  onScriptChange: (value: string) => void
  onStart: () => void
  onTargetDeviceChange: (value: string) => void
  publishedScripts: ScriptSummary[]
  selectedScriptId: string
  targetDevice: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>任务控制</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-[minmax(240px,1.2fr)_minmax(160px,0.6fr)_minmax(180px,0.8fr)] gap-3 max-sm:grid-cols-1">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">选择脚本</span>
            <Select value={selectedScriptId} onValueChange={onScriptChange}>
              <SelectTrigger aria-label="选择脚本">
                <SelectValue placeholder="选择已发布脚本" />
              </SelectTrigger>
              <SelectContent>
                {publishedScripts.map((script) => (
                  <SelectItem key={script.id} value={script.id}>
                    {script.name || script.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">执行环境</span>
            <Select value={environment} onValueChange={onEnvironmentChange}>
              <SelectTrigger aria-label="执行环境">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">local</SelectItem>
                <SelectItem value="lab">lab</SelectItem>
                <SelectItem value="ci">ci</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">目标设备</span>
            <Input
              aria-label="目标设备"
              value={targetDevice}
              onChange={(event) => onTargetDeviceChange(event.target.value)}
              placeholder="bench-1"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!selectedScriptId || createPending}
            onClick={onStart}
            type="button"
          >
            <Play aria-hidden="true" data-icon="inline-start" />
            开始执行
          </Button>
          <Button
            disabled={!canCancel || cancelPending}
            onClick={onCancel}
            type="button"
            variant="secondary"
          >
            <Square aria-hidden="true" data-icon="inline-start" />
            取消
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Create new `TaskPage`**

Create `pages/TaskPage.tsx` by moving the current route component and importing extracted helpers:

```tsx
import { executionWebSocketUrl } from '../constants'
import { TaskControlPanel } from '../components/TaskControlPanel'
import { SelectedScriptSummary } from '../components/SelectedScriptSummary'
import { TaskDetail } from '../components/TaskDetail'
import { TaskSummaryItem } from '../components/TaskSummaryItem'
import { formatEventLog, formatLogEntry, statusVariant, taskStatusLabel } from '../utils/taskFormatters'
import { canCancelTask, isExecutionEventMessage, shouldRefreshTasks } from '../utils/taskGuards'
```

- [ ] **Step 4: Add execution barrel and update routes**

Create `apps/web/src/features/execution/index.ts`:

```ts
export { TaskPage } from './pages/TaskPage'
```

Update `apps/web/src/app/routes.tsx`:

```ts
import { TaskPage } from '@/features/execution'
```

- [ ] **Step 5: Remove old execution file**

Delete `apps/web/src/features/execution/TaskPage.tsx` after imports compile.

- [ ] **Step 6: Run execution tests**

Run:

```bash
pnpm --filter @testflow/web test -- TaskPage.test.tsx
pnpm check:web
```

Expected: PASS.

- [ ] **Step 7: Commit execution split**

```bash
git add apps/web/src/features/execution apps/web/src/app/routes.tsx
git commit -m "split execution web feature"
```

## Task 4: Split Tools Feature

**Files:**
- Create: `apps/web/src/features/tools/index.ts`
- Create: `apps/web/src/features/tools/command-library/constants.ts`
- Create: `apps/web/src/features/tools/command-library/pages/CommandLibraryPage.tsx`
- Create: `apps/web/src/features/tools/command-library/components/CommandForm.tsx`
- Create: `apps/web/src/features/tools/command-library/components/CommandList.tsx`
- Create: `apps/web/src/features/tools/command-library/components/CommandListItem.tsx`
- Create: `apps/web/src/features/tools/ssh-terminal/pages/SshTerminalPage.tsx`
- Create: `apps/web/src/features/tools/ssh-terminal/store.ts`
- Create: `apps/web/src/features/tools/ssh-terminal/utils/commandSuggestions.ts`
- Create: `apps/web/src/features/tools/ssh-terminal/utils/sshStatus.ts`
- Delete: `apps/web/src/features/tools/ToolPages.tsx`
- Delete: `apps/web/src/features/tools/sshTerminalStore.ts`
- Modify: `apps/web/src/app/routes.tsx`
- Test: `apps/web/src/features/tools/ToolPages.test.tsx`

- [ ] **Step 1: Move command constants**

Create `apps/web/src/features/tools/command-library/constants.ts`:

```ts
import type { CommandTemplatePayload } from '@/lib/api'

export const emptyCommandForm: CommandTemplatePayload = {
  name: '',
  command: '',
  description: '',
  group: '',
  tags: [],
}
```

- [ ] **Step 2: Move command library page and components**

Create `pages/CommandLibraryPage.tsx` from the current `CommandLibraryPage`.

Create `components/CommandListItem.tsx` by extracting one command card from the list. Keep `CommandForm` and `CommandList` out of this implementation pass; `CommandLibraryPage.tsx` should continue to own the form and loading/empty/list state after `CommandListItem` is extracted.

The page should use shared config:

```tsx
import { backendBaseUrl } from '@/app/config'
import { createApiClient } from '@/lib/api'

const api = createApiClient({ baseUrl: backendBaseUrl })
```

- [ ] **Step 3: Move SSH store and utilities**

Move `apps/web/src/features/tools/sshTerminalStore.ts` to `apps/web/src/features/tools/ssh-terminal/store.ts`.

Create `utils/commandSuggestions.ts` with `filterCommandSuggestions` from `ToolPages.tsx`.

Create `utils/sshStatus.ts`:

```ts
export function sshStatusLabel(status: string) {
  const labels: Record<string, string> = {
    closed: '已断开',
    connected: '已连接',
    connecting: '连接中',
    error: '异常',
  }
  return labels[status] ?? status
}
```

- [ ] **Step 4: Move SSH terminal page**

Create `ssh-terminal/pages/SshTerminalPage.tsx` from the current `SshTerminalPage`. Update imports:

```tsx
import { sshWebSocketUrl, useSshTerminalStore } from '../store'
import { filterCommandSuggestions } from '../utils/commandSuggestions'
import { sshStatusLabel } from '../utils/sshStatus'
```

- [ ] **Step 5: Add tools barrel and update routes**

Create `apps/web/src/features/tools/index.ts`:

```ts
export { CommandLibraryPage } from './command-library/pages/CommandLibraryPage'
export { SshTerminalPage } from './ssh-terminal/pages/SshTerminalPage'
```

Update `apps/web/src/app/routes.tsx`:

```ts
import { CommandLibraryPage, SshTerminalPage } from '@/features/tools'
```

- [ ] **Step 6: Remove old tools files**

Delete:

```txt
apps/web/src/features/tools/ToolPages.tsx
apps/web/src/features/tools/sshTerminalStore.ts
```

- [ ] **Step 7: Run tools tests**

Run:

```bash
pnpm --filter @testflow/web test -- ToolPages.test.tsx
pnpm check:web
```

Expected: PASS. Keep `ToolPages.test.tsx` in place during this pass unless the test imports require a filename change.

- [ ] **Step 8: Commit tools split**

```bash
git add apps/web/src/features/tools apps/web/src/app/routes.tsx
git commit -m "split tools web feature"
```

## Task 5: Final Verification

**Files:**
- Modify only if tests reveal stale imports or broken assumptions.

- [ ] **Step 1: Search for stale imports**

Run:

```bash
rg "ScriptPages|ToolPages|features/execution/TaskPage|sshTerminalStore" apps/web/src
```

Expected: no matches except renamed test filenames if intentionally retained.

- [ ] **Step 2: Run full Web validation**

Run:

```bash
pnpm check:web
pnpm --filter @testflow/web test
```

Expected: both commands PASS.

- [ ] **Step 3: Browser smoke test visible routes**

Start Web dev server:

```bash
pnpm dev:web
```

Open `http://127.0.0.1:5174` and verify these routes render without blank pages or console errors:

```txt
http://127.0.0.1:5174/scripts
http://127.0.0.1:5174/scripts/new
http://127.0.0.1:5174/tasks
http://127.0.0.1:5174/commands
http://127.0.0.1:5174/ssh
```

- [ ] **Step 4: Commit any final import/test cleanup**

Only commit if Step 1-3 required cleanup:

```bash
git add apps/web/src
git commit -m "clean up web module imports"
```
