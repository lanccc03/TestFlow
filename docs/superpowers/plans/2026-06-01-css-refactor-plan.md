# CSS Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `apps/web` from business CSS classes to shadcn/ui components plus Tailwind utilities, accepting the shadcn neutral visual direction.

**Architecture:** Add missing shadcn form primitives first, then migrate shell, shared page structure, feature pages, and finally delete unused CSS. Keep behavior and routing intact while moving visual styling into shadcn components and local Tailwind class strings.

**Tech Stack:** React 19, React Router 7, Vite 8, Tailwind CSS 4, shadcn/ui, Vitest, Testing Library.

---

## Source Spec

Implement the approved spec in `docs/superpowers/specs/2026-06-01-css-refactor-design.md`.

Important decisions from the spec:

- Use shadcn default neutral styling; do not preserve the old teal/dark-sidebar brand look.
- Delete all business CSS classes. Do not keep `.content-panel`, `.nav-link-active`, `.catalog-placeholder`, `.validation-panel`, or similar classes as compatibility markers.
- Add shadcn-style `Input`, `Textarea`, `Select`, and `Checkbox`.
- Do not include dark mode visual QA in this implementation.
- Verify with automated checks plus browser sampling of core desktop routes.

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `apps/web/src/components/ui/input.tsx` | Create | shadcn-style text input primitive |
| `apps/web/src/components/ui/textarea.tsx` | Create | shadcn-style textarea primitive |
| `apps/web/src/components/ui/select.tsx` | Create | shadcn-style select primitive |
| `apps/web/src/components/ui/checkbox.tsx` | Create | shadcn-style checkbox primitive |
| `apps/web/src/components/layout/page.tsx` | Create | Small shared page layout primitives only: panel, header, empty state |
| `apps/web/src/lib/utils.ts` | Modify | Keep `cn()`, add shared `parseTags()` |
| `apps/web/src/lib/utils.test.ts` | Create | Unit tests for `parseTags()` |
| `apps/web/src/App.tsx` | Modify | Tailwind/shadcn shell, navigation, topbar, status badges |
| `apps/web/src/App.test.tsx` | Modify | Remove CSS text assertions; assert semantic nav state |
| `apps/web/src/app/routes.tsx` | Modify | Replace placeholder page business classes with layout primitives |
| `apps/web/src/features/scripts/ScriptPages.tsx` | Modify | Migrate script list/editor to shadcn form primitives and cards |
| `apps/web/src/features/execution/TaskPage.tsx` | Modify | Migrate execution task UI, logs, alerts, forms |
| `apps/web/src/features/tools/ToolPages.tsx` | Modify | Migrate command library and SSH terminal UI |
| `apps/web/src/index.css` | Modify | Delete business CSS after each migration phase; leave tokens/base/reset only |

Do not change backend code, desktop Electron code, API client behavior, WebSocket behavior, or route definitions except for styling and shared layout component usage.

## Shared Rules For Every Task

- Use `rg` before deleting CSS to confirm the corresponding class names are no longer referenced.
- Use `cn()` for conditional class strings.
- Use role/label/ARIA assertions in tests; do not assert old business classes.
- Keep generated shadcn component style consistent with existing `apps/web/src/components/ui/button.tsx`, `badge.tsx`, `card.tsx`, and `alert.tsx`.
- Commit after each task if executing interactively. Commit messages in this plan are suggestions; keep them short and imperative if local history prefers that.

---

### Task 1: Add Form Primitives And `parseTags`

**Files:**
- Create: `apps/web/src/components/ui/input.tsx`
- Create: `apps/web/src/components/ui/textarea.tsx`
- Create: `apps/web/src/components/ui/select.tsx`
- Create: `apps/web/src/components/ui/checkbox.tsx`
- Create: `apps/web/src/lib/utils.test.ts`
- Modify: `apps/web/src/lib/utils.ts`

- [ ] **Step 1: Add the failing `parseTags` test**

Create `apps/web/src/lib/utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { parseTags } from './utils'

describe('parseTags', () => {
  it('splits comma-separated tags, trims whitespace, removes blanks, and deduplicates', () => {
    expect(parseTags(' smoke, regression, smoke, , nightly ')).toEqual([
      'smoke',
      'regression',
      'nightly',
    ])
  })

  it('returns an empty array for blank input', () => {
    expect(parseTags(' ,  , ')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
pnpm --dir apps/web test src/lib/utils.test.ts
```

Expected: FAIL because `parseTags` is not exported from `src/lib/utils.ts`.

- [ ] **Step 3: Implement `parseTags`**

Modify `apps/web/src/lib/utils.ts` so it contains:

```ts
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

- [ ] **Step 4: Run the `parseTags` test and verify it passes**

Run:

```bash
pnpm --dir apps/web test src/lib/utils.test.ts
```

Expected: PASS, 2 tests passing.

- [ ] **Step 5: Add shadcn form primitives with the CLI**

Run from the repo root:

```bash
pnpm --dir apps/web exec shadcn add input textarea select checkbox
```

Expected: `apps/web/src/components/ui/input.tsx`, `textarea.tsx`, `select.tsx`, and `checkbox.tsx` are created or confirmed.

If the workspace command cannot find the shadcn executable, run the documented monorepo form:

```bash
pnpm dlx shadcn@latest add input textarea select checkbox -c apps/web
```

- [ ] **Step 6: Verify imports and generated component style**

Run:

```bash
rg -n 'from "radix-ui"|from "@/lib/utils"|data-slot=' apps/web/src/components/ui
pnpm --dir apps/web exec tsc -p tsconfig.app.json --noEmit
```

Expected:

- UI files import `cn` from `@/lib/utils`.
- Radix-based components import primitives from the package style already used in this repo, for example `import { Slot } from "radix-ui"` in `button.tsx`.
- TypeScript exits with code 0.

- [ ] **Step 7: Commit Task 1**

Run:

```bash
git add apps/web/src/components/ui/input.tsx apps/web/src/components/ui/textarea.tsx apps/web/src/components/ui/select.tsx apps/web/src/components/ui/checkbox.tsx apps/web/src/lib/utils.ts apps/web/src/lib/utils.test.ts
git commit -m "add web form primitives"
```

---

### Task 2: Migrate App Shell And Navigation Tests

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Replace class-coupled navigation tests with semantic tests**

In `apps/web/src/App.test.tsx`:

- Remove these imports:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
```

- Replace the `only marks the exact navigation route as active` test with:

```ts
  it('only marks the exact navigation route as current', async () => {
    renderApp(['/scripts/new'])

    expect(await screen.findByRole('heading', { name: '脚本编辑器' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /脚本管理/ })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: /脚本编辑器/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
```

- Delete the entire `keeps the selected navigation item styling while hovered` test.

- Add this test after the current-route test:

```ts
  it('does not render legacy navigation styling classes', async () => {
    renderApp(['/scripts/new'])

    expect(await screen.findByRole('heading', { name: '脚本编辑器' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /脚本管理/ }).className).not.toContain(
      'nav-link',
    )
    expect(screen.getByRole('link', { name: /脚本编辑器/ }).className).not.toContain(
      'nav-link',
    )
  })
```

- [ ] **Step 2: Run App tests and verify the new legacy-class test fails**

Run:

```bash
pnpm --dir apps/web test src/App.test.tsx
```

Expected: FAIL because `App.tsx` still renders `nav-link` and `nav-link-active`.

- [ ] **Step 3: Migrate `App.tsx` imports**

Update the imports at the top of `apps/web/src/App.tsx`:

```ts
import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router'
import { Cable, ChevronRight, Server } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { appRoutes, navGroups } from './app/routes'
import { createWebSocketClient, type WebSocketStatus } from './lib/websocket'
import type { BackendStatus } from './testflow'
```

- [ ] **Step 4: Migrate `App.tsx` shell classes**

Replace the top-level JSX shape in `App.tsx` with Tailwind classes. Keep existing state/effects/routes unchanged.

Use these class strings:

```tsx
<div className="grid min-h-screen grid-cols-[264px_minmax(0,1fr)] bg-background text-foreground max-lg:grid-cols-1">
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
      {/* keep navGroups mapping here */}
    </nav>
  </aside>

  <div className="grid min-w-0 grid-rows-[auto_1fr]">
    <header className="flex min-h-18 items-center justify-between gap-4 border-b bg-card/90 px-7 py-3.5 max-sm:px-4 max-md:flex-col max-md:items-start">
      {/* keep title and status strip here */}
    </header>

    <main className="grid gap-5 p-7 pb-8 max-sm:px-4">
      {/* keep Routes here */}
    </main>
  </div>
</div>
```

Inside the `navGroups.map` block, use this structure:

```tsx
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
```

For the status strip:

```tsx
<div className="flex flex-wrap justify-end gap-2.5" aria-label="系统状态">
  {/* existing StatusPill calls */}
</div>
```

Replace `StatusPill` with:

```tsx
function StatusPill({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof Server
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

- [ ] **Step 5: Delete app-shell CSS after references are gone**

Run:

```bash
rg -n 'app-frame|sidebar|brand|brand-mark|nav-list|nav-group|nav-group-label|nav-link|workspace|topbar|status-strip|status-pill|main-content' apps/web/src
```

Expected: no matches outside `apps/web/src/index.css`.

Then delete these selector blocks from `apps/web/src/index.css`:

- `.app-frame`
- `.sidebar`
- `.brand`
- `.brand-mark`
- `.nav-list`
- `.nav-group`
- `.nav-group-label`
- `.nav-link`
- `.nav-link:hover`
- `.nav-link-active`
- `.nav-link-active:hover`
- `.workspace`
- `.topbar`
- `.topbar p`
- `.topbar strong`
- `.status-strip`
- `.status-pill`
- `.status-pill-success`
- `.status-pill-warning`
- `.main-content`

- [ ] **Step 6: Run App tests**

Run:

```bash
pnpm --dir apps/web test src/App.test.tsx
```

Expected: PASS. The new semantic navigation tests pass, and no test reads `index.css`.

- [ ] **Step 7: Commit Task 2**

Run:

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx apps/web/src/index.css
git commit -m "migrate web app shell styling"
```

---

### Task 3: Add Shared Page Layout Primitives And Migrate Placeholder Routes

**Files:**
- Create: `apps/web/src/components/layout/page.tsx`
- Modify: `apps/web/src/app/routes.tsx`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Create shared layout primitives**

Create `apps/web/src/components/layout/page.tsx`:

```tsx
import type React from 'react'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { cn } from '@/lib/utils'

export function PagePanel({
  className,
  ...props
}: React.ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'grid min-h-[360px] content-start gap-6 rounded-lg border bg-card p-6 text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

export function PageHeader({
  actions,
  eyebrow,
  subtitle,
  title,
}: {
  actions?: React.ReactNode
  eyebrow?: React.ReactNode
  subtitle?: React.ReactNode
  title: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 max-sm:flex-col">
      <div className="grid gap-1.5">
        {eyebrow ? (
          <p className="m-0 text-xs font-bold text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="m-0 text-3xl font-semibold leading-tight text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="m-0 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export function EmptyState({
  description,
  icon,
  title,
}: {
  description?: React.ReactNode
  icon?: React.ReactNode
  title: React.ReactNode
}) {
  return (
    <Empty className="min-h-18 rounded-lg border border-dashed bg-muted/30">
      <EmptyHeader>
        {icon ? <EmptyMedia variant="icon">{icon}</EmptyMedia> : null}
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
    </Empty>
  )
}
```

- [ ] **Step 2: Migrate `PlaceholderPage` in `routes.tsx`**

Update `apps/web/src/app/routes.tsx` imports:

```tsx
import { PageHeader, PagePanel, EmptyState } from '@/components/layout/page'
```

Remove direct imports of `Empty`, `EmptyDescription`, `EmptyHeader`, `EmptyMedia`, and `EmptyTitle`.

Replace `PlaceholderPage` JSX with:

```tsx
  return (
    <PagePanel>
      <PageHeader
        eyebrow={upcomingLabel}
        title={title}
        subtitle={description}
      />
      <EmptyState
        icon={<FileCode2 aria-hidden="true" />}
        title={action}
        description="阶段三先提供稳定路由、布局和状态框架；业务表单、执行器和报告数据会在后续阶段逐步接入。"
      />
    </PagePanel>
  )
```

- [ ] **Step 3: Delete shared placeholder CSS after references are gone**

Run:

```bash
rg -n 'content-panel|section-heading|state-box' apps/web/src
```

Expected: remaining matches are in feature pages and `index.css`, not `app/routes.tsx`.

Do not delete `.content-panel` and `.section-heading` yet if feature pages still reference them. Delete `.state-box` only after no references remain outside `index.css`.

- [ ] **Step 4: Run route and App tests**

Run:

```bash
pnpm --dir apps/web test src/app/routes.test.ts src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add apps/web/src/components/layout/page.tsx apps/web/src/app/routes.tsx apps/web/src/index.css
git commit -m "add web page layout primitives"
```

---

### Task 4: Migrate Script Pages

**Files:**
- Modify: `apps/web/src/features/scripts/ScriptPages.tsx`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Update imports in `ScriptPages.tsx`**

Add:

```tsx
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { cn, parseTags } from '@/lib/utils'
```

Remove the local `parseTags` function at the bottom of the file after usages import from `@/lib/utils`.

- [ ] **Step 2: Migrate the script list page shell**

Use this structure for `ScriptListPage`:

```tsx
return (
  <PagePanel>
    <PageHeader
      eyebrow="阶段五"
      title="脚本管理"
      subtitle="管理 YAML 测试脚本、筛选分组标签，并进入可视化编辑。"
      actions={
        <Button asChild>
          <Link to="/scripts/new">
            <FilePlus2 aria-hidden="true" data-icon="inline-start" />
            新建脚本
          </Link>
        </Button>
      }
    />

    <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-1">
      {/* filter fields */}
    </div>

    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] gap-4 max-xl:grid-cols-1">
      {/* script list card and keyword card */}
    </div>
  </PagePanel>
)
```

For each filter `label`, use:

```tsx
<label className="grid gap-1.5">
  <span className="text-xs font-semibold text-muted-foreground">搜索脚本</span>
  <Input
    aria-label="搜索脚本"
    value={search}
    onChange={(event) => setSearch(event.target.value)}
    placeholder="名称、ID、描述、标签"
  />
</label>
```

For native `select` filter fields, use shadcn `Select`:

```tsx
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
```

- [ ] **Step 3: Migrate script and keyword list surfaces**

Use `Card` for the list section:

```tsx
<Card className="gap-3">
  <CardHeader>
    <CardTitle>脚本列表</CardTitle>
  </CardHeader>
  <CardContent className="grid gap-2.5">
    {/* loading/error/empty/list */}
  </CardContent>
</Card>
```

Replace loading/empty states:

```tsx
<EmptyState title="正在加载" />
<EmptyState title="没有匹配的脚本" />
```

Replace error state:

```tsx
<Alert variant="destructive">
  <AlertDescription>后端脚本数据不可用</AlertDescription>
</Alert>
```

For keyword cards:

```tsx
<Card size="sm" key={keyword.name}>
  <CardHeader className="border-b">
    <CardTitle>{keyword.name}</CardTitle>
    <Badge variant={keyword.enabled ? 'default' : 'secondary'}>
      {keyword.module}
    </Badge>
  </CardHeader>
  <CardContent className="grid gap-2">
    <CardDescription>{keyword.description}</CardDescription>
    <span className="text-xs text-muted-foreground">
      {keyword.parameters.length > 0
        ? `${keyword.parameters.length} 个参数`
        : '无参数'}
    </span>
  </CardContent>
</Card>
```

- [ ] **Step 4: Migrate `ScriptListItem`**

Replace the root article with:

```tsx
<Card size="sm" className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-3 max-sm:grid-cols-1">
  {/* existing content */}
</Card>
```

Use this metadata pattern:

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
    <dd className="m-0 text-sm font-semibold text-foreground">v{script.revision}</dd>
  </div>
</dl>
```

Replace tag spans with `Badge variant="secondary"`:

```tsx
<div className="mt-2 flex flex-wrap gap-1.5">
  {script.group ? <Badge variant="secondary">{script.group}</Badge> : null}
  {script.tags.map((tag) => (
    <Badge key={tag} variant="secondary">
      {tag}
    </Badge>
  ))}
</div>
```

- [ ] **Step 5: Migrate script editor form surfaces**

Use `PagePanel` and `PageHeader` for the editor shell. Use this form grid pattern:

```tsx
<div className="grid grid-cols-4 gap-3 max-sm:grid-cols-1">
  <label className="grid gap-1.5">
    <span className="text-xs font-semibold text-muted-foreground">脚本 ID</span>
    <Input
      aria-label="脚本 ID"
      disabled={Boolean(scriptId)}
      value={script.id}
      onChange={(event) => updateScript({ id: event.target.value })}
    />
  </label>
  {/* repeat for fields */}
  <label className="col-span-full grid gap-1.5">
    <span className="text-xs font-semibold text-muted-foreground">描述</span>
    <Textarea
      aria-label="描述"
      value={script.description}
      onChange={(event) => updateScript({ description: event.target.value })}
    />
  </label>
</div>
```

Use shadcn `Checkbox` for boolean fields:

```tsx
<label className="grid gap-1.5">
  <span className="text-xs font-semibold text-muted-foreground">启用步骤</span>
  <Checkbox
    aria-label="启用步骤"
    checked={selectedStep.enabled}
    onCheckedChange={(checked) =>
      updateStep(selectedStep.id, { enabled: checked === true })
    }
  />
</label>
```

Use shadcn `Select` for keyword selection. Because the options are grouped by module, use the generated `SelectGroup` and `SelectLabel` exports if present; otherwise use a flat list with label text included in the item text.

- [ ] **Step 6: Migrate step list and validation/save states**

Use this step button pattern:

```tsx
<button
  className={cn(
    'grid gap-1 rounded-lg border bg-card p-2.5 text-left text-card-foreground transition-colors hover:bg-muted/60',
    step.id === selectedStep?.id && 'border-ring ring-2 ring-ring/20',
  )}
  key={step.id}
  onClick={() => setSelectedStepId(step.id)}
  type="button"
>
  <span className="text-xs text-muted-foreground">步骤 {index + 1}</span>
  <strong className="text-sm font-semibold">{step.keyword || '未选择关键字'}</strong>
  <em className="text-xs not-italic text-muted-foreground">
    {step.enabled ? '启用' : '禁用'}
  </em>
</button>
```

Use `Alert` for validation:

```tsx
<Alert variant="destructive">
  <AlertDescription className="grid gap-1">
    {issues.map((issue) => (
      <p className="m-0" key={`${issue.field}-${issue.message}`}>
        {formatIssue(issue)}
      </p>
    ))}
  </AlertDescription>
</Alert>
```

Use default `Alert` for save messages:

```tsx
<Alert>
  <AlertDescription>{saveMessage}</AlertDescription>
</Alert>
```

- [ ] **Step 7: Verify script page tests and class references**

Run:

```bash
pnpm --dir apps/web test src/App.test.tsx
rg -n 'content-panel|script-workspace|script-page-heading|script-filters|script-layout|script-list-section|keyword-sidebar|catalog-placeholder|catalog-error|script-list-item|script-tags|compact-meta|script-actions|editor-section|editor-grid|form-grid|form-wide|step-list|step-list-item|step-list-item-active|step-toolbar|param-list|validation-panel|save-message' apps/web/src/features/scripts apps/web/src/app apps/web/src/App.tsx
```

Expected: tests pass. The `rg` command prints no matches in `features/scripts`, `app/routes.tsx`, or `App.tsx`.

- [ ] **Step 8: Delete script-page CSS blocks**

After Step 7 has no references, delete corresponding blocks from `apps/web/src/index.css`. Keep blocks still referenced by `TaskPage.tsx` or `ToolPages.tsx`.

- [ ] **Step 9: Commit Task 4**

Run:

```bash
git add apps/web/src/features/scripts/ScriptPages.tsx apps/web/src/index.css apps/web/src/lib/utils.ts
git commit -m "migrate script pages styling"
```

---

### Task 5: Migrate Execution Page

**Files:**
- Modify: `apps/web/src/features/execution/TaskPage.tsx`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Update execution page imports**

Add:

```tsx
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
```

- [ ] **Step 2: Migrate page shell and task control form**

Use:

```tsx
<PagePanel>
  <PageHeader
    eyebrow="阶段六"
    title="执行任务"
    subtitle="选择已发布脚本，启动本地执行并查看实时任务输出。"
    actions={
      <Badge variant={activeTask ? statusVariant(activeTask.status) : 'secondary'}>
        {activeTask ? taskStatusLabel(activeTask.status) : '未启动'}
      </Badge>
    }
  />

  <Card>
    <CardHeader>
      <CardTitle>任务控制</CardTitle>
    </CardHeader>
    <CardContent className="grid gap-4">
      {/* form grid, actions, states, selected script summary */}
    </CardContent>
  </Card>
</PagePanel>
```

Use `Select` for `选择脚本` and `执行环境`, and `Input` for `目标设备`.

- [ ] **Step 3: Migrate task cards and logs**

Use this layout for current/log/recent panels:

```tsx
<div className="grid grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)] gap-4 max-xl:grid-cols-1">
  <Card>
    <CardHeader>
      <CardTitle>当前任务</CardTitle>
    </CardHeader>
    <CardContent>{activeTask ? <TaskDetail task={activeTask} /> : <EmptyState title="启动执行后显示当前任务" />}</CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle>实时日志</CardTitle>
    </CardHeader>
    <CardContent>
      {/* logs */}
    </CardContent>
  </Card>

  <Card className="col-span-full">
    <CardHeader>
      <CardTitle>最近任务</CardTitle>
    </CardHeader>
    <CardContent>{/* recent tasks */}</CardContent>
  </Card>
</div>
```

Use this log code style:

```tsx
<div className="grid max-h-[420px] content-start gap-2 overflow-auto" aria-label="实时日志">
  {liveLogs.map((log, index) => (
    <code
      className="block overflow-wrap-anywhere rounded-md bg-muted px-2 py-1.5 font-mono text-xs leading-relaxed text-muted-foreground"
      key={`${log}-${index}`}
    >
      {log}
    </code>
  ))}
</div>
```

If `overflow-wrap-anywhere` is not emitted by Tailwind in this project, use `[overflow-wrap:anywhere]`.

- [ ] **Step 4: Migrate detail metadata and errors**

Use local `dl` classes instead of `compact-meta` or `detail-list`:

```tsx
<dl className="grid gap-2">
  <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
    <dt className="text-xs text-muted-foreground">任务 ID</dt>
    <dd className="m-0 min-w-0 [overflow-wrap:anywhere] text-sm">{task.id}</dd>
  </div>
</dl>
```

Use `Alert variant="destructive"` for `task.error_message` and script list errors.

- [ ] **Step 5: Verify execution tests and class references**

Run:

```bash
pnpm --dir apps/web test src/features/execution/TaskPage.test.tsx
rg -n 'execution-|editor-section|form-grid|catalog-placeholder|catalog-error|compact-meta|detail-list|validation-panel|script-title-row' apps/web/src/features/execution
```

Expected: tests pass. The `rg` command prints no matches.

- [ ] **Step 6: Delete execution CSS blocks**

Delete `execution-*`, `compact-meta`, `detail-list`, and execution-only shared blocks from `apps/web/src/index.css` after Step 5 confirms no references.

- [ ] **Step 7: Commit Task 5**

Run:

```bash
git add apps/web/src/features/execution/TaskPage.tsx apps/web/src/index.css
git commit -m "migrate execution page styling"
```

---

### Task 6: Migrate Tool Pages

**Files:**
- Modify: `apps/web/src/features/tools/ToolPages.tsx`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Update tool page imports**

Add:

```tsx
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { parseTags } from '@/lib/utils'
```

Remove the local `parseTags` function from `ToolPages.tsx`.

- [ ] **Step 2: Migrate command library page**

Use `PagePanel` and `PageHeader`. Use this grid:

```tsx
<div className="grid grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)] gap-4 max-xl:grid-cols-1">
  <Card>
    <CardHeader>
      <CardTitle>{editingId ? '编辑命令' : '新增命令'}</CardTitle>
      {/* reset action */}
    </CardHeader>
    <CardContent className="grid gap-4">
      {/* command form */}
    </CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle>命令列表</CardTitle>
    </CardHeader>
    <CardContent className="grid gap-3">
      {/* search and list */}
    </CardContent>
  </Card>
</div>
```

Use `Input` for name/group/tags/search and `Textarea` for command/description.

For each command item:

```tsx
<Card size="sm" key={command.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-3 max-sm:grid-cols-1">
  <div className="min-w-0">
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <h3 className="m-0 text-base font-semibold">{command.name}</h3>
      {command.group ? <Badge variant="secondary">{command.group}</Badge> : null}
    </div>
    <code className="block rounded-md bg-muted px-2 py-1.5 font-mono text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
      {command.command}
    </code>
    {command.description ? (
      <CardDescription className="mt-2">{command.description}</CardDescription>
    ) : null}
    <div className="mt-2 flex flex-wrap gap-1.5">
      {command.tags.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
    </div>
  </div>
  {/* actions */}
</Card>
```

- [ ] **Step 3: Migrate SSH terminal page**

Use `PagePanel`, `PageHeader`, `Card`, `Input`, and `Checkbox`.

Use this layout:

```tsx
<div className="grid grid-cols-[320px_minmax(0,1fr)] gap-4 max-xl:grid-cols-1">
  <Card>
    <CardHeader>
      <CardTitle>连接</CardTitle>
    </CardHeader>
    <CardContent className="grid gap-4">
      {/* connection form */}
    </CardContent>
  </Card>

  <section className="grid min-w-0 grid-rows-[auto_minmax(360px,58vh)] overflow-hidden rounded-lg border bg-gray-950">
    <div className="flex min-h-9 items-center gap-2 border-b border-gray-800 bg-gray-900 px-3 text-xs text-gray-300">
      <SquareTerminal aria-hidden="true" size={16} />
      <span>{sshWebSocketUrl}</span>
    </div>
    <div className="min-h-0 p-2.5" ref={terminalContainerRef} />
  </section>

  <Card className="col-span-full">
    <CardHeader>
      <CardTitle>命令联想</CardTitle>
    </CardHeader>
    <CardContent>{/* suggestions */}</CardContent>
  </Card>
</div>
```

Use shadcn `Checkbox` for `skipHostKeyCheck`:

```tsx
<label className="col-span-full flex items-center gap-2 text-xs font-semibold text-muted-foreground">
  <Checkbox
    aria-label="跳过本次主机密钥校验"
    checked={form.skipHostKeyCheck}
    onCheckedChange={(checked) =>
      updateForm({ skipHostKeyCheck: checked === true })
    }
  />
  <span>跳过本次主机密钥校验</span>
</label>
```

- [ ] **Step 4: Migrate suggestion buttons and errors**

Use:

```tsx
<button
  className="grid gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/60"
  key={command.id}
  onClick={() => applySuggestion(command)}
  type="button"
>
  <strong className="text-sm font-semibold">{command.name}</strong>
  <code className="block rounded-md bg-muted px-2 py-1.5 font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">
    {command.command}
  </code>
</button>
```

Use `Alert variant="destructive"` for `errorMessage`.

- [ ] **Step 5: Verify tool tests and class references**

Run:

```bash
pnpm --dir apps/web test src/features/tools/ToolPages.test.tsx
rg -n 'tool-|command-|ssh-|terminal-|suggestion-|editor-section|form-grid|catalog-placeholder|validation-panel|script-title-row|script-tags|script-actions|checkbox-row|form-wide' apps/web/src/features/tools
```

Expected: tests pass. The `rg` command prints no matches except `@xterm/xterm/css/xterm.css`, which is allowed.

- [ ] **Step 6: Delete tool CSS blocks**

Delete `tool-*`, `command-*`, `ssh-*`, `terminal-*`, `suggestion-*`, and remaining tool-only shared blocks from `apps/web/src/index.css` after Step 5 confirms no references.

- [ ] **Step 7: Commit Task 6**

Run:

```bash
git add apps/web/src/features/tools/ToolPages.tsx apps/web/src/index.css
git commit -m "migrate tool pages styling"
```

---

### Task 7: Final CSS Cleanup And Dead-Class Audit

**Files:**
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Scan for remaining business class references**

Run:

```bash
rg -n 'className="[^"]*(app-frame|sidebar|brand|nav-|workspace|topbar|status-|main-content|content-panel|section-heading|state-box|catalog-|script-|editor-|step-|param-|validation-panel|tool-|execution-|ssh-|terminal-|suggestion-|command-|compact-meta|keyword-|form-|save-message|detail-list)' apps/web/src
rg -n "className=\\{`[^`]*(app-frame|sidebar|brand|nav-|workspace|topbar|status-|main-content|content-panel|section-heading|state-box|catalog-|script-|editor-|step-|param-|validation-panel|tool-|execution-|ssh-|terminal-|suggestion-|command-|compact-meta|keyword-|form-|save-message|detail-list)" apps/web/src
```

Expected: no matches. If a match remains, migrate that JSX before editing CSS.

- [ ] **Step 2: Reduce `index.css` to imports, tokens, theme, base, and reset**

Keep the existing import lines:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist";
```

Keep the existing `@custom-variant dark`, `:root`, `@theme inline`, `.dark`, and `@layer base` blocks.

Keep only these global reset blocks outside token/theme/base:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

#root {
  min-height: 100vh;
}
```

Delete:

- global `button, input, select, textarea { font: inherit; }` if shadcn primitives and browser defaults cover all visible controls.
- every business class selector.
- every custom `@media` block.
- global `code` styling.

- [ ] **Step 3: Confirm `index.css` no longer has business selectors**

Run:

```bash
rg -n '^\\.(app-frame|sidebar|brand|nav-|workspace|topbar|status-|main-content|content-panel|section-heading|button|badge|state-box|catalog-|script-|editor-|step-|param-|validation-panel|tool-|execution-|ssh-|terminal-|suggestion-|command-|compact-meta|keyword-|form-|save-message|detail-list)' apps/web/src/index.css
rg -n '^input,|^select,|^textarea|^button,|^code\\s*\\{' apps/web/src/index.css
```

Expected: no matches.

- [ ] **Step 4: Run web check**

Run:

```bash
pnpm check:web
```

Expected: TypeScript check and Vite build pass with exit code 0.

- [ ] **Step 5: Commit Task 7**

Run:

```bash
git add apps/web/src/index.css
git commit -m "remove legacy web css"
```

---

### Task 8: Final Automated And Browser Verification

**Files:**
- No planned source changes unless verification finds a defect.

- [ ] **Step 1: Run full relevant automated checks**

Run:

```bash
pnpm --dir apps/web test
pnpm check:web
```

Expected: both commands pass with exit code 0.

- [ ] **Step 2: Start the web dev server**

Run:

```bash
pnpm dev:web
```

Expected: Vite serves at `http://127.0.0.1:5174`.

Keep the server running for browser verification.

- [ ] **Step 3: Browser sample desktop routes**

Use the in-app Browser plugin when available. Visit:

- `http://127.0.0.1:5174/scripts`
- `http://127.0.0.1:5174/scripts/new`
- `http://127.0.0.1:5174/execution/tasks`
- `http://127.0.0.1:5174/tools/commands`
- `http://127.0.0.1:5174/tools/ssh`

Check each route at a desktop viewport for:

- navigation active state is visible and `aria-current="page"` is present on the active link;
- form controls have visible borders, usable height, and focus styles;
- empty, error, and save states are readable;
- cards and list items do not overflow their containers;
- SSH terminal area is visible and does not collapse.

- [ ] **Step 4: Fix browser defects if found**

If a browser defect is found, make the smallest local Tailwind/component adjustment, then rerun:

```bash
pnpm --dir apps/web test
pnpm check:web
```

Expected: both commands still pass.

- [ ] **Step 5: Final class audit**

Run:

```bash
rg -n 'nav-link-active|content-panel|section-heading|catalog-placeholder|catalog-error|validation-panel|save-message|script-list-item|command-item|execution-task-item|terminal-shell|suggestion-item' apps/web/src
```

Expected: no matches.

- [ ] **Step 6: Final commit**

Run:

```bash
git status --short
git add apps/web/src apps/web/components.json apps/web/package.json pnpm-lock.yaml
git commit -m "complete web css refactor"
```

Only include `apps/web/package.json` and `pnpm-lock.yaml` if the shadcn CLI changed dependencies or lockfile content.

## Self-Review Checklist

- Spec coverage:
  - shadcn neutral styling: Tasks 2-7.
  - strict deletion of business CSS classes: Tasks 2-7 and final audit in Task 8.
  - shadcn form primitives: Task 1.
  - moderate layout cleanup only: Task 3 layout primitives and page-level migrations.
  - dark mode not in scope: verification route list excludes dark mode checks.
  - automated checks plus browser sampling: Task 8.
- No placeholder steps: every task has exact files, commands, and concrete replacement patterns.
- Type consistency:
  - `parseTags(value: string): string[]` is defined once in `lib/utils.ts`.
  - `PagePanel`, `PageHeader`, and `EmptyState` are imported from `@/components/layout/page`.
  - shadcn form primitives are imported from `@/components/ui/*`.
