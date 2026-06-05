# List Page Container Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace nested card-heavy list pages with compact desktop-workbench list surfaces for scripts, execution history, and reports.

**Architecture:** Add small layout primitives for list toolbars, list surfaces, and list rows, then refactor the three approved pages to use them. Keep feature-specific row content inside feature folders, preserve existing hooks/API calls, and avoid changing editor, terminal, report detail, backend, or route behavior.

**Tech Stack:** React 19, React Router 7, TanStack Query, Tailwind CSS v4, shadcn/ui primitives, Vitest, Testing Library.

---

## Scope Check

The approved spec covers one visual subsystem: list-page container structure in the Web app. It does not require separate subsystem plans because all affected work shares the same React layout primitives and page-level list patterns.

## File Structure

- Create `apps/web/src/components/layout/list.tsx`
  - Owns generic list-page layout primitives: `ListToolbar`, `ListSurface`, and `ListRow`.
  - Depends only on `React`, `radix-ui` `Slot`, and `cn()`.

- Create `apps/web/src/components/layout/list.test.tsx`
  - Verifies the new primitives expose semantic regions/groups and render children.

- Modify `apps/web/src/components/layout/page.tsx`
  - Softens `PagePanel` from a large card wrapper into an open page workspace.
  - Keeps `PageHeader` and `EmptyState` behavior intact.

- Modify `apps/web/src/features/scripts/components/ScriptFilters.tsx`
  - Wraps existing controls in `ListToolbar`.
  - Keeps labels, values, and callbacks unchanged.

- Modify `apps/web/src/features/scripts/components/ScriptListItem.tsx`
  - Replaces per-row `Card` with `ListRow`.
  - Keeps run/edit/copy/delete actions and inline delete confirmation unchanged.

- Modify `apps/web/src/features/scripts/pages/ScriptListPage.tsx`
  - Replaces the `Card` list container with `ListSurface`.
  - Keeps loading, error, empty, and mutation behavior unchanged.

- Modify `apps/web/src/features/scripts/ScriptRunNavigation.test.tsx`
  - Adds semantic assertions for the new script filter group and script list region while preserving run navigation coverage.

- Create `apps/web/src/features/execution/components/ExecutionSummaryRow.tsx`
  - Owns the shared execution/report summary row used by history and report list pages.
  - Keeps row content domain-specific to execution.

- Modify `apps/web/src/features/execution/pages/HistoryPage.tsx`
  - Replaces filter and task-record cards with `ListToolbar`, `ListSurface`, and `ExecutionSummaryRow`.
  - Keeps filter query behavior unchanged.

- Modify `apps/web/src/features/execution/pages/ReportListPage.tsx`
  - Replaces report list cards with `ListSurface` and `ExecutionSummaryRow`.
  - Keeps report query and report-detail links unchanged.

- Modify `apps/web/src/features/execution/HistoryAndReports.test.tsx`
  - Adds semantic assertions for history filter/list regions and report list region while preserving behavior coverage.

---

### Task 1: Add List Layout Primitives And Open Page Workspace

**Files:**
- Create: `apps/web/src/components/layout/list.test.tsx`
- Create: `apps/web/src/components/layout/list.tsx`
- Modify: `apps/web/src/components/layout/page.tsx`

- [ ] **Step 1: Write the failing primitive test**

Create `apps/web/src/components/layout/list.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ListRow, ListSurface, ListToolbar } from './list'

describe('list layout primitives', () => {
  it('renders a labeled toolbar, list surface, and row content', () => {
    render(
      <>
        <ListToolbar aria-label="脚本筛选">
          <label>
            搜索脚本
            <input aria-label="搜索脚本" />
          </label>
        </ListToolbar>

        <ListSurface
          description="共 1 条"
          title="脚本列表"
        >
          <ListRow>
            <span>座舱冒烟测试</span>
          </ListRow>
        </ListSurface>
      </>,
    )

    expect(screen.getByRole('group', { name: '脚本筛选' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '脚本列表' })).toBeInTheDocument()
    expect(screen.getByText('共 1 条')).toBeInTheDocument()
    expect(screen.getByText('座舱冒烟测试')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the primitive test to verify it fails**

Run:

```bash
pnpm --filter @testflow/web test -- src/components/layout/list.test.tsx
```

Expected: FAIL because `./list` does not exist yet.

- [ ] **Step 3: Implement the list primitives**

Create `apps/web/src/components/layout/list.tsx`:

```tsx
import * as React from 'react'

import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

export function ListToolbar({
  className,
  role = 'group',
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'grid gap-3 rounded-lg border bg-background/80 p-3 text-sm shadow-xs',
        className,
      )}
      role={role}
      {...props}
    />
  )
}

export function ListSurface({
  actions,
  children,
  className,
  description,
  title,
  ...props
}: React.ComponentProps<'section'> & {
  actions?: React.ReactNode
  description?: React.ReactNode
  title: React.ReactNode
}) {
  const titleId = React.useId()

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'overflow-hidden rounded-lg border bg-background text-foreground',
        className,
      )}
      {...props}
    >
      <div className="flex min-h-11 items-center justify-between gap-3 border-b bg-muted/30 px-3 py-2">
        <div className="grid gap-0.5">
          <h2 id={titleId} className="m-0 text-sm font-semibold">
            {title}
          </h2>
          {description ? (
            <p className="m-0 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

export function ListRow({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'div'

  return (
    <Comp
      className={cn(
        'grid min-w-0 items-center gap-3 px-3 py-3 text-sm transition-colors hover:bg-muted/40 data-[selected=true]:bg-muted/50',
        className,
      )}
      {...props}
    />
  )
}
```

- [ ] **Step 4: Soften `PagePanel` into an open workspace**

Modify only `PagePanel` in `apps/web/src/components/layout/page.tsx`:

```tsx
export function PagePanel({
  className,
  ...props
}: React.ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'grid min-h-[360px] content-start gap-5 text-foreground',
        className,
      )}
      {...props}
    />
  )
}
```

Keep `PageHeader` and `EmptyState` unchanged.

- [ ] **Step 5: Run the primitive test to verify it passes**

Run:

```bash
pnpm --filter @testflow/web test -- src/components/layout/list.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add apps/web/src/components/layout/list.test.tsx apps/web/src/components/layout/list.tsx apps/web/src/components/layout/page.tsx
git commit -m "add list layout primitives"
```

---

### Task 2: Refactor Script List To Toolbar And Row List

**Files:**
- Modify: `apps/web/src/features/scripts/ScriptRunNavigation.test.tsx`
- Modify: `apps/web/src/features/scripts/components/ScriptFilters.tsx`
- Modify: `apps/web/src/features/scripts/components/ScriptListItem.tsx`
- Modify: `apps/web/src/features/scripts/pages/ScriptListPage.tsx`

- [ ] **Step 1: Extend the script list test before implementation**

In `apps/web/src/features/scripts/ScriptRunNavigation.test.tsx`, add these assertions at the start of `it('navigates from script list run action to tasks with taskId', ...)`, immediately after the `renderWithQuery(<ScriptListPage />, ['/scripts'])` line:

```tsx
expect(await screen.findByRole('group', { name: '脚本筛选' })).toBeInTheDocument()
expect(screen.getByRole('region', { name: '脚本列表' })).toBeInTheDocument()
```

- [ ] **Step 2: Run the script navigation test to verify it fails**

Run:

```bash
pnpm --filter @testflow/web test -- src/features/scripts/ScriptRunNavigation.test.tsx
```

Expected: FAIL because the current filters do not expose a `脚本筛选` group and the current card list does not expose a `脚本列表` region.

- [ ] **Step 3: Convert `ScriptFilters` to a toolbar**

Modify imports in `apps/web/src/features/scripts/components/ScriptFilters.tsx`:

```tsx
import { ListToolbar } from '@/components/layout/list'
import { Input } from '@/components/ui/input'
```

Replace the root `<div className="grid grid-cols-4 gap-3 max-sm:grid-cols-1">` with:

```tsx
<ListToolbar
  aria-label="脚本筛选"
  className="grid-cols-4 max-sm:grid-cols-1"
>
```

Replace the closing root `</div>` with:

```tsx
</ListToolbar>
```

Do not change any label text, select values, callbacks, or placeholders.

- [ ] **Step 4: Convert `ScriptListItem` from `Card` to `ListRow`**

Modify imports in `apps/web/src/features/scripts/components/ScriptListItem.tsx`:

```tsx
import { Copy, Edit3, Play, Trash2 } from 'lucide-react'
import { Link } from 'react-router'

import { ListRow } from '@/components/layout/list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ScriptSummary } from '@/lib/api'
```

Replace the root `<Card ...>` opening with:

```tsx
<ListRow className="grid-cols-[minmax(0,1.3fr)_minmax(180px,0.5fr)_auto] max-lg:grid-cols-[minmax(0,1fr)_auto] max-sm:grid-cols-1">
```

Replace the root closing `</Card>` with:

```tsx
</ListRow>
```

Replace the metadata block:

```tsx
<dl className="flex gap-2">
  <div className="min-w-16 rounded-lg bg-muted px-2 py-1.5">
    <dt className="text-xs text-muted-foreground">步骤</dt>
    <dd className="m-0 text-sm font-semibold text-foreground">
      {script.enabled_step_count}/{script.step_count}
    </dd>
  </div>
  <div className="min-w-16 rounded-lg bg-muted px-2 py-1.5">
    <dt className="text-xs text-muted-foreground">版本</dt>
    <dd className="m-0 text-sm font-semibold text-foreground">
      v{script.revision}
    </dd>
  </div>
</dl>
```

with:

```tsx
<dl className="grid grid-cols-2 gap-3 text-sm max-lg:hidden">
  <div>
    <dt className="text-xs text-muted-foreground">步骤</dt>
    <dd className="m-0 font-semibold text-foreground">
      {script.enabled_step_count}/{script.step_count}
    </dd>
  </div>
  <div>
    <dt className="text-xs text-muted-foreground">版本</dt>
    <dd className="m-0 font-semibold text-foreground">v{script.revision}</dd>
  </div>
</dl>
```

- [ ] **Step 5: Convert `ScriptListPage` to `ListSurface`**

Modify imports in `apps/web/src/features/scripts/pages/ScriptListPage.tsx`:

```tsx
import { FilePlus2 } from 'lucide-react'
import { Link } from 'react-router'

import { ListSurface } from '@/components/layout/list'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
```

Remove imports for `Card`, `CardContent`, `CardHeader`, and `CardTitle`.

Replace the whole list container:

```tsx
<Card className="gap-3">
  <CardHeader>
    <CardTitle>脚本列表</CardTitle>
  </CardHeader>
  <CardContent className="grid gap-2.5">
    ...
  </CardContent>
</Card>
```

with:

```tsx
<ListSurface
  description={`${filteredScripts.length} 个匹配脚本`}
  title="脚本列表"
>
  {scriptsQuery.isPending ? (
    <div className="p-3">
      <EmptyState title="正在加载" />
    </div>
  ) : scriptsQuery.isError ? (
    <div className="p-3">
      <Alert variant="destructive">
        <AlertDescription>后端脚本数据不可用</AlertDescription>
      </Alert>
    </div>
  ) : filteredScripts.length === 0 ? (
    <div className="p-3">
      <EmptyState title="没有匹配的脚本" />
    </div>
  ) : (
    filteredScripts.map((script) => (
      <ScriptListItem
        confirmDeleteId={confirmDeleteId}
        key={script.id}
        onCopy={() => copyMutation.mutate(script.id)}
        onDelete={() => deleteMutation.mutate(script.id)}
        onPrepareDelete={() => setConfirmDeleteId(script.id)}
        onRun={() => executeMutation.mutate(script.id)}
        script={script}
      />
    ))
  )}
</ListSurface>
```

- [ ] **Step 6: Run the script test to verify it passes**

Run:

```bash
pnpm --filter @testflow/web test -- src/features/scripts/ScriptRunNavigation.test.tsx
```

Expected: PASS, including the existing navigation assertions and the new semantic region/group assertions.

- [ ] **Step 7: Commit Task 2**

```bash
git add apps/web/src/features/scripts/ScriptRunNavigation.test.tsx apps/web/src/features/scripts/components/ScriptFilters.tsx apps/web/src/features/scripts/components/ScriptListItem.tsx apps/web/src/features/scripts/pages/ScriptListPage.tsx
git commit -m "redesign script list layout"
```

---

### Task 3: Refactor History Page With Execution Summary Rows

**Files:**
- Modify: `apps/web/src/features/execution/HistoryAndReports.test.tsx`
- Create: `apps/web/src/features/execution/components/ExecutionSummaryRow.tsx`
- Modify: `apps/web/src/features/execution/pages/HistoryPage.tsx`

- [ ] **Step 1: Extend the history test before implementation**

In `apps/web/src/features/execution/HistoryAndReports.test.tsx`, add these assertions inside `it('filters execution history and links to report details', ...)`, immediately after `renderWithProviders(<HistoryPage />)`:

```tsx
expect(await screen.findByRole('group', { name: '历史筛选' })).toBeInTheDocument()
expect(screen.getByRole('region', { name: '任务记录' })).toBeInTheDocument()
```

- [ ] **Step 2: Run the history/report test to verify it fails**

Run:

```bash
pnpm --filter @testflow/web test -- src/features/execution/HistoryAndReports.test.tsx
```

Expected: FAIL because the current history page uses `Card` wrappers rather than a `历史筛选` group and `任务记录` region.

- [ ] **Step 3: Create the execution summary row component**

Create `apps/web/src/features/execution/components/ExecutionSummaryRow.tsx`:

```tsx
import { Link } from 'react-router'

import { ListRow } from '@/components/layout/list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ExecutionTaskSummary } from '@/lib/api'

import { statusVariant, taskStatusLabel } from '../utils/taskFormatters'

function formatDuration(durationMs: number | null) {
  return durationMs != null ? `${durationMs} ms` : '-'
}

function formatDateTime(value: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
  }).format(date)
}

export function ExecutionSummaryRow({
  actionLabel = '查看报告',
  task,
}: {
  actionLabel?: string
  task: ExecutionTaskSummary
}) {
  return (
    <ListRow className="grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)_minmax(92px,0.3fr)_auto] max-xl:grid-cols-[minmax(0,1fr)_auto] max-sm:grid-cols-1">
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3 className="m-0 truncate text-base font-semibold">
            {task.script_name}
          </h3>
          <Badge variant={statusVariant(task.status)}>
            {taskStatusLabel(task.status)}
          </Badge>
        </div>
        <p className="m-0 truncate text-sm text-muted-foreground">
          {task.id} · {task.executor}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-sm max-xl:hidden">
        <div>
          <dt className="text-xs text-muted-foreground">环境</dt>
          <dd className="m-0 font-semibold text-foreground">
            {task.environment}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">开始</dt>
          <dd className="m-0 font-semibold text-foreground">
            {formatDateTime(task.started_at ?? task.created_at)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">耗时</dt>
          <dd className="m-0 font-semibold text-foreground">
            {formatDuration(task.duration_ms)}
          </dd>
        </div>
      </dl>

      <dl className="text-sm max-xl:hidden">
        <div>
          <dt className="text-xs text-muted-foreground">步骤</dt>
          <dd className="m-0 font-semibold text-foreground">
            {task.passed_step_count}/{task.step_count}
          </dd>
        </div>
      </dl>

      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link to={`/reports/${task.id}`}>{actionLabel}</Link>
        </Button>
      </div>
    </ListRow>
  )
}
```

- [ ] **Step 4: Refactor `HistoryPage`**

Modify imports in `apps/web/src/features/execution/pages/HistoryPage.tsx`:

```tsx
import { ListSurface, ListToolbar } from '@/components/layout/list'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { ExecutionSummaryRow } from '../components/ExecutionSummaryRow'
import { useHistoryPage } from '../hooks/useHistoryPage'
```

Remove imports for `Link`, `Badge`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `statusVariant`, and `taskStatusLabel`.

Replace the filter `Card` with:

```tsx
<ListToolbar
  aria-label="历史筛选"
  className="grid-cols-[minmax(160px,1fr)_minmax(120px,0.5fr)_minmax(140px,0.5fr)_minmax(140px,0.5fr)_minmax(120px,0.4fr)_auto] max-lg:grid-cols-2 max-sm:grid-cols-1"
>
  <label className="grid gap-1.5">
    <span className="text-xs font-semibold text-muted-foreground">脚本</span>
    <Select value={scriptId} onValueChange={setScriptId}>
      <SelectTrigger aria-label="脚本">
        <SelectValue placeholder="全部脚本" />
      </SelectTrigger>
      <SelectContent>
        {scripts.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name || s.id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </label>
  <label className="grid gap-1.5">
    <span className="text-xs font-semibold text-muted-foreground">状态</span>
    <Select value={status} onValueChange={setStatus}>
      <SelectTrigger aria-label="状态">
        <SelectValue placeholder="全部状态" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">等待中</SelectItem>
        <SelectItem value="running">运行中</SelectItem>
        <SelectItem value="passed">通过</SelectItem>
        <SelectItem value="failed">失败</SelectItem>
        <SelectItem value="canceled">已取消</SelectItem>
        <SelectItem value="error">异常</SelectItem>
      </SelectContent>
    </Select>
  </label>
  <label className="grid gap-1.5">
    <span className="text-xs font-semibold text-muted-foreground">开始时间从</span>
    <Input
      type="datetime-local"
      aria-label="开始时间从"
      value={createdFrom}
      onChange={(e) => setCreatedFrom(e.target.value)}
    />
  </label>
  <label className="grid gap-1.5">
    <span className="text-xs font-semibold text-muted-foreground">开始时间到</span>
    <Input
      type="datetime-local"
      aria-label="开始时间到"
      value={createdTo}
      onChange={(e) => setCreatedTo(e.target.value)}
    />
  </label>
  <label className="grid gap-1.5">
    <span className="text-xs font-semibold text-muted-foreground">执行人</span>
    <Input
      aria-label="执行人"
      value={executor}
      onChange={(e) => setExecutor(e.target.value)}
      placeholder="alice"
    />
  </label>
  <div className="flex items-end">
    <Button onClick={applyFilters} type="button">
      查询历史
    </Button>
  </div>
</ListToolbar>
```

Replace the task-record `Card` with:

```tsx
<ListSurface
  description={`${tasks.length} 条执行记录`}
  title="任务记录"
>
  {tasksQuery.isPending ? (
    <div className="p-3">
      <EmptyState title="正在加载任务" />
    </div>
  ) : tasks.length === 0 ? (
    <div className="p-3">
      <EmptyState title="暂无执行记录" />
    </div>
  ) : (
    tasks.map((task) => (
      <ExecutionSummaryRow key={task.id} task={task} />
    ))
  )}
</ListSurface>
```

- [ ] **Step 5: Run the history/report test to verify it passes**

Run:

```bash
pnpm --filter @testflow/web test -- src/features/execution/HistoryAndReports.test.tsx
```

Expected: PASS for history behavior and existing report tests.

- [ ] **Step 6: Commit Task 3**

```bash
git add apps/web/src/features/execution/HistoryAndReports.test.tsx apps/web/src/features/execution/components/ExecutionSummaryRow.tsx apps/web/src/features/execution/pages/HistoryPage.tsx
git commit -m "redesign history list layout"
```

---

### Task 4: Refactor Report List To A Single Report Surface

**Files:**
- Modify: `apps/web/src/features/execution/HistoryAndReports.test.tsx`
- Modify: `apps/web/src/features/execution/pages/ReportListPage.tsx`

- [ ] **Step 1: Extend the report list test before implementation**

In `apps/web/src/features/execution/HistoryAndReports.test.tsx`, add this assertion inside `it('lists recent reports', ...)`, immediately after `renderWithProviders(<ReportListPage />)`:

```tsx
expect(await screen.findByRole('region', { name: '最近报告' })).toBeInTheDocument()
```

Keep the existing `座舱冒烟测试` and `查看报告` assertions.

- [ ] **Step 2: Run the history/report test to verify it fails**

Run:

```bash
pnpm --filter @testflow/web test -- src/features/execution/HistoryAndReports.test.tsx
```

Expected: FAIL because the current report list uses a `Card` title rather than a named list surface region.

- [ ] **Step 3: Refactor `ReportListPage`**

Modify imports in `apps/web/src/features/execution/pages/ReportListPage.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query'

import { ListSurface } from '@/components/layout/list'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { api } from '@/app/backend'

import { ExecutionSummaryRow } from '../components/ExecutionSummaryRow'
```

Remove imports for `Link`, `Badge`, `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `statusVariant`, and `taskStatusLabel`.

Replace the report-list `Card` with:

```tsx
<ListSurface
  description={`${reports.length} 个报告`}
  title="最近报告"
>
  {reportsQuery.isPending ? (
    <div className="p-3">
      <EmptyState title="正在加载报告" />
    </div>
  ) : reports.length === 0 ? (
    <div className="p-3">
      <EmptyState title="暂无报告" />
    </div>
  ) : (
    reports.map((report) => (
      <ExecutionSummaryRow
        actionLabel="查看报告"
        key={report.id}
        task={report}
      />
    ))
  )}
</ListSurface>
```

- [ ] **Step 4: Run the history/report test to verify it passes**

Run:

```bash
pnpm --filter @testflow/web test -- src/features/execution/HistoryAndReports.test.tsx
```

Expected: PASS for history, report list, and report detail tests.

- [ ] **Step 5: Commit Task 4**

```bash
git add apps/web/src/features/execution/HistoryAndReports.test.tsx apps/web/src/features/execution/pages/ReportListPage.tsx
git commit -m "redesign report list layout"
```

---

### Task 5: Full Verification And Visual QA

**Files:**
- Verify only; do not create files unless visual QA reveals a concrete defect.

- [ ] **Step 1: Run the full Web check**

Run:

```bash
pnpm check:web
```

Expected: TypeScript build and Vite build complete successfully.

- [ ] **Step 2: Run the full Web test suite**

Run:

```bash
pnpm --filter @testflow/web test
```

Expected: All Web Vitest tests pass.

- [ ] **Step 3: Start the Web dev server**

Run:

```bash
pnpm dev:web
```

Expected: Vite serves the app at `http://127.0.0.1:5174`.

- [ ] **Step 4: Verify `/scripts` visually in the browser**

Open `http://127.0.0.1:5174/scripts`.

Check:

- Page header remains visible with `脚本管理` and `新建脚本`.
- Filters read as a toolbar, not a card.
- `脚本列表` is one list surface.
- Script rows are separated by row dividers and do not look like independent cards.
- Run/edit/copy/delete buttons keep their labels and actions.
- Long script names, descriptions, tags, and IDs do not clip awkwardly at desktop width.

- [ ] **Step 5: Verify `/history` visually in the browser**

Open `http://127.0.0.1:5174/history`.

Check:

- `历史筛选` controls read as a toolbar.
- `任务记录` is one list surface.
- Task rows emphasize script name, status, ID/executor, environment, start time, duration, steps, and report action.
- `查询历史` still updates the task query.

- [ ] **Step 6: Verify `/reports` visually in the browser**

Open `http://127.0.0.1:5174/reports`.

Check:

- `最近报告` is one list surface.
- Report rows match the history row style.
- Failed/error statuses remain visually distinct through status badge color.
- `查看报告` links still navigate to `/reports/:taskId`.

- [ ] **Step 7: Inspect loading, empty, and error states**

Use mocked data, dev backend state, or test fixtures to confirm:

- `/scripts` still shows `正在加载`, `没有匹配的脚本`, and `后端脚本数据不可用` in padded list-surface content.
- `/history` still shows `正在加载任务` and `暂无执行记录` in padded list-surface content.
- `/reports` still shows `正在加载报告` and `暂无报告` in padded list-surface content.

- [ ] **Step 8: Commit any QA fixes**

If visual QA required changes, commit them:

```bash
git add apps/web/src
git commit -m "polish list page layout"
```

If no QA fixes were needed, do not create an empty commit.

---

## Self-Review Checklist

- Spec coverage:
  - `PagePanel` card softness is covered in Task 1.
  - `ListToolbar`, `ListSurface`, and `ListRow` are covered in Task 1.
  - Script list page is covered in Task 2.
  - History page is covered in Task 3.
  - Report list page is covered in Task 4.
  - Full checks and desktop visual verification are covered in Task 5.

- Placeholder scan:
  - The plan contains no deferred requirements, vague implementation steps, or unresolved file paths.

- Type consistency:
  - `ExecutionSummaryRow` accepts `ExecutionTaskSummary`, which is the item type returned by both `api.listTasks()` and `api.listReports()`.
  - `ListToolbar`, `ListSurface`, and `ListRow` are imported from `@/components/layout/list` in all planned consumers.
  - Planned tests use accessible names introduced by the matching implementation steps.
