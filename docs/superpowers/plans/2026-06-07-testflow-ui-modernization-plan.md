# TestFlow UI Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize TestFlow's web UI with a Precision Lab global shell, Control Room execution/log surfaces, and scoped Motion for React transitions.

**Architecture:** Keep the existing React Router, React Query hooks, shadcn/ui primitives, and feature-first folders. Implement the redesign through theme tokens, shared layout primitives, shell/navigation components, and the execution feature UI, without changing API contracts or domain state.

**Tech Stack:** React 19, Vite, Tailwind CSS v4, shadcn/ui, lucide-react, Motion for React (`motion`, imported from `motion/react`), Vitest, Testing Library.

---

## File Structure

- Modify `apps/web/package.json` and `pnpm-lock.yaml`: add the `motion` dependency through pnpm.
- Modify `apps/web/src/App.tsx`: wrap the app shell in `MotionConfig` with user reduced-motion handling.
- Modify `apps/web/src/index.css`: update theme tokens to the approved Precision Lab palette.
- Modify `apps/web/src/components/layout/AppShell.tsx`: add lab workspace background and route-level content entrance animation.
- Modify `apps/web/src/components/layout/Sidebar.tsx`: refine sidebar chrome and add motion-backed active navigation indicator.
- Modify `apps/web/src/components/layout/StatusBar.tsx`: integrate the bottom status bar with the new shell.
- Modify `apps/web/src/components/layout/StatusPill.tsx`: refine status dot, text, and spacing.
- Modify `apps/web/src/components/layout/page.tsx`: polish `PagePanel`, `PageHeader`, and `EmptyState`.
- Modify `apps/web/src/components/layout/list.tsx`: align list toolbar/surface/row primitives with lab surfaces.
- Modify `apps/web/src/components/ui/table.tsx`: refine table container, header, rows, and cells.
- Modify `apps/web/src/features/execution/pages/TaskPage.tsx`: apply Control Room treatment to current task/log panels and add log/recent-task motion.
- Modify `apps/web/src/features/execution/components/TaskDetail.tsx`: strengthen active task status presentation.
- Modify `apps/web/src/features/execution/components/TaskSummaryItem.tsx`: add selected-row clarity and layout animation.
- Modify tests only for semantic regression assertions if implementation breaks or removes existing accessible surfaces. Do not add class-name tests for visual styling.

## Task 1: Motion Dependency And Reduced-Motion Root

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Add Motion for React**

Run:

```bash
pnpm --filter @testflow/web add motion
```

Expected:

```text
apps/web/package.json includes "motion" under dependencies.
pnpm-lock.yaml includes a resolved motion package entry.
```

- [ ] **Step 2: Wrap the app in MotionConfig**

Replace `apps/web/src/App.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { Navigate, Route, Routes } from 'react-router'

import { appRoutes } from './app/routes'
import { backendUrls, createBackendStatusSocket } from './app/backend'
import type { WebSocketStatus } from './lib/websocket'
import { AppShell } from '@/components/layout/AppShell'
import type { BackendStatus } from './testflow'

function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    healthUrl: backendUrls.health,
    state: window.testflow ? 'starting' : 'stopped',
  })
  const [websocketStatus, setWebsocketStatus] = useState<WebSocketStatus>({
    state: 'connecting',
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
    const client = createBackendStatusSocket()
    const unsubscribe = client.subscribe((status) => setWebsocketStatus(status))
    client.connect()

    return () => {
      unsubscribe()
      client.disconnect()
    }
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <AppShell backendStatus={backendStatus} websocketStatus={websocketStatus}>
        <Routes>
          <Route element={<Navigate replace to="/scripts" />} path="/" />
          {appRoutes.map((route) => (
            <Route
              element={route.element}
              key={route.path}
              path={route.path}
            />
          ))}
          <Route element={<Navigate replace to="/scripts" />} path="*" />
        </Routes>
      </AppShell>
    </MotionConfig>
  )
}

export default App
```

- [ ] **Step 3: Run focused app shell tests**

Run:

```bash
pnpm --filter @testflow/web test -- App.test.tsx
```

Expected:

```text
PASS apps/web/src/App.test.tsx
```

- [ ] **Step 4: Commit**

Run:

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/App.tsx
git commit -m "add motion root config"
```

Expected:

```text
[branch <sha>] add motion root config
```

## Task 2: Precision Lab Theme Tokens

**Files:**
- Modify: `apps/web/src/index.css`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Replace the root light theme tokens**

In `apps/web/src/index.css`, keep the import block, global reset, `@theme inline`, `.dark`, and `@layer base` structure. Replace only the `:root` block with:

```css
:root {
  color: #17201d;
  background: #eef2ef;
  font-family:
    'Geist Variable', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  --background: oklch(0.955 0.012 155);
  --foreground: oklch(0.21 0.025 158);
  --card: oklch(0.988 0.006 150);
  --card-foreground: oklch(0.21 0.025 158);
  --popover: oklch(0.992 0.004 150);
  --popover-foreground: oklch(0.21 0.025 158);
  --primary: oklch(0.54 0.145 37);
  --primary-foreground: oklch(0.985 0.006 95);
  --secondary: oklch(0.925 0.014 148);
  --secondary-foreground: oklch(0.265 0.025 158);
  --muted: oklch(0.935 0.011 150);
  --muted-foreground: oklch(0.49 0.018 158);
  --accent: oklch(0.9 0.026 150);
  --accent-foreground: oklch(0.245 0.034 158);
  --destructive: oklch(0.55 0.18 28);
  --border: oklch(0.845 0.016 150);
  --input: oklch(0.845 0.016 150);
  --ring: oklch(0.42 0.075 158);
  --chart-1: oklch(0.64 0.13 37);
  --chart-2: oklch(0.52 0.09 158);
  --chart-3: oklch(0.6 0.11 196);
  --chart-4: oklch(0.72 0.12 95);
  --chart-5: oklch(0.47 0.08 250);
  --radius: 0.45rem;
  --sidebar: oklch(0.925 0.014 150);
  --sidebar-foreground: oklch(0.235 0.026 158);
  --sidebar-primary: oklch(0.31 0.065 158);
  --sidebar-primary-foreground: oklch(0.982 0.006 140);
  --sidebar-accent: oklch(0.885 0.026 150);
  --sidebar-accent-foreground: oklch(0.245 0.034 158);
  --sidebar-border: oklch(0.815 0.018 150);
  --sidebar-ring: oklch(0.42 0.075 158);
}
```

- [ ] **Step 2: Run app shell semantic tests**

Run:

```bash
pnpm --filter @testflow/web test -- App.test.tsx
```

Expected:

```text
PASS apps/web/src/App.test.tsx
```

- [ ] **Step 3: Commit**

Run:

```bash
git add apps/web/src/index.css
git commit -m "update web theme tokens"
```

Expected:

```text
[branch <sha>] update web theme tokens
```

## Task 3: Shell, Navigation, And Status Chrome

**Files:**
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx`
- Modify: `apps/web/src/components/layout/StatusBar.tsx`
- Modify: `apps/web/src/components/layout/StatusPill.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Replace AppShell with animated lab workspace shell**

Replace `apps/web/src/components/layout/AppShell.tsx` with:

```tsx
import type React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useLocation } from 'react-router'

import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import type { BackendStatus } from '@/testflow'
import type { WebSocketStatus } from '@/lib/websocket'

export function AppShell({
  backendStatus,
  children,
  websocketStatus,
}: {
  backendStatus: BackendStatus
  children: React.ReactNode
  websocketStatus: WebSocketStatus
}) {
  const location = useLocation()

  return (
    <>
      <div className="grid min-h-screen grid-cols-[248px_minmax(0,1fr)] bg-background pb-9 text-foreground max-lg:grid-cols-1">
        <Sidebar />
        <div className="min-w-0 bg-[linear-gradient(90deg,rgb(23_32_29_/_0.045)_1px,transparent_1px),linear-gradient(180deg,rgb(255_255_255_/_0.72),transparent_260px)] bg-[length:24px_24px,100%_100%]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.main
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto grid w-full max-w-[1480px] gap-5 px-5 py-5 pb-8 max-sm:px-4"
              exit={{ opacity: 0, y: 4 }}
              initial={{ opacity: 0, y: 8 }}
              key={location.pathname}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
      <StatusBar
        backendStatus={backendStatus}
        websocketStatus={websocketStatus}
      />
    </>
  )
}
```

- [ ] **Step 2: Replace Sidebar with the Precision Lab navigation rail**

Replace `apps/web/src/components/layout/Sidebar.tsx` with:

```tsx
import { ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { NavLink } from 'react-router'

import { appRoutes, navGroups } from '@/app/routes'
import { cn } from '@/lib/utils'

export function Sidebar() {
  return (
    <aside
      className="sticky top-0 flex h-screen flex-col gap-5 border-r border-sidebar-border bg-sidebar/95 px-3 py-4 text-sidebar-foreground shadow-[inset_-1px_0_0_rgb(255_255_255_/_0.38)] max-lg:static max-lg:h-auto max-lg:gap-4"
      aria-label="主导航"
    >
      <div className="grid grid-cols-[34px_minmax(0,1fr)] items-center gap-3 border-b border-sidebar-border/70 px-1 pb-4">
        <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.22),0_10px_22px_rgb(31_65_56_/_0.16)]">
          TF
        </div>
        <div className="min-w-0">
          <strong className="block truncate text-base font-semibold text-sidebar-foreground">
            TestFlow
          </strong>
          <span className="mt-0.5 block truncate text-xs text-sidebar-foreground/58">
            自动化测试工作台
          </span>
        </div>
      </div>

      <nav className="grid gap-4 max-sm:grid-cols-1 max-lg:grid-cols-3">
        {navGroups.map((group) => (
          <div className="grid gap-1.5" key={group.id}>
            <div className="flex items-center gap-2 px-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-sidebar-foreground/48">
              <group.icon aria-hidden="true" size={13} />
              {group.label}
            </div>
            {appRoutes
              .filter((route) => route.navGroup === group.id && !route.navHidden)
              .map((route) => (
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      'relative grid min-h-9 grid-cols-[18px_minmax(0,1fr)_14px] items-center gap-2.5 overflow-hidden rounded-md border border-transparent px-2.5 text-sm text-sidebar-foreground/70 no-underline transition-colors hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground',
                      isActive &&
                      'border-sidebar-border/70 text-sidebar-primary-foreground shadow-[0_10px_24px_rgb(31_65_56_/_0.14)]',
                    )
                  }
                  end
                  key={route.path}
                  to={route.path}
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <motion.span
                          aria-hidden="true"
                          className="absolute inset-0 rounded-md bg-sidebar-primary"
                          layoutId="sidebar-active-route"
                          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        />
                      ) : null}
                      <route.icon aria-hidden="true" className="relative z-10" size={17} />
                      <span className="relative z-10 truncate">{route.label}</span>
                      <ChevronRight aria-hidden="true" className="relative z-10" size={14} />
                    </>
                  )}
                </NavLink>
              ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 3: Replace StatusBar with integrated bottom chrome**

Replace `apps/web/src/components/layout/StatusBar.tsx` with:

```tsx
import { Cable, Server } from 'lucide-react'

import { StatusPill } from './StatusPill'
import type { BackendStatus } from '@/testflow'
import type { WebSocketStatus } from '@/lib/websocket'

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

export function StatusBar({
  backendStatus,
  websocketStatus,
}: {
  backendStatus: BackendStatus
  websocketStatus: WebSocketStatus
}) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 flex h-8 items-center justify-between border-t border-sidebar-border/85 bg-sidebar/90 px-2 text-xs text-sidebar-foreground shadow-[0_-10px_28px_rgb(23_32_29_/_0.08)] backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-1 px-1 text-[11px] text-sidebar-foreground/58 max-sm:hidden">
        <span className="font-semibold text-sidebar-foreground/78">TestFlow</span>
        <span aria-hidden="true">/</span>
        <span>Precision Lab</span>
      </div>
      <div
        className="flex min-w-0 items-center divide-x divide-sidebar-border/80 max-sm:ml-auto"
        aria-label="系统状态"
      >
        <StatusPill
          icon={Server}
          label="后端服务"
          tone={backendStatus.state === 'running' ? 'success' : 'warning'}
          value={backendStateLabels[backendStatus.state]}
        />
        <StatusPill
          icon={Cable}
          label="WebSocket"
          tone={
            websocketStatus.state === 'connected' ? 'success' : 'warning'
          }
          value={websocketStateLabels[websocketStatus.state]}
        />
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Replace StatusPill styling**

Replace `apps/web/src/components/layout/StatusPill.tsx` with:

```tsx
import type { LucideIcon } from 'lucide-react'

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
    <span
      className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap px-2 text-[11px] leading-none text-sidebar-foreground/75"
    >
      <Icon aria-hidden="true" className="text-sidebar-foreground/45" size={13} />
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full ring-2 ring-sidebar/90',
          tone === 'success' ? 'bg-emerald-400' : 'bg-amber-400',
        )}
      />
      <span className="text-sidebar-foreground/52 max-sm:hidden">{label}</span>
      <strong className="font-semibold text-sidebar-foreground">{value}</strong>
    </span>
  )
}
```

- [ ] **Step 5: Run app shell tests**

Run:

```bash
pnpm --filter @testflow/web test -- App.test.tsx
```

Expected:

```text
PASS apps/web/src/App.test.tsx
```

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/src/components/layout/AppShell.tsx apps/web/src/components/layout/Sidebar.tsx apps/web/src/components/layout/StatusBar.tsx apps/web/src/components/layout/StatusPill.tsx
git commit -m "modernize app shell chrome"
```

Expected:

```text
[branch <sha>] modernize app shell chrome
```

## Task 4: Shared Page, List, Empty, And Table Surfaces

**Files:**
- Modify: `apps/web/src/components/layout/page.tsx`
- Modify: `apps/web/src/components/layout/list.tsx`
- Modify: `apps/web/src/components/ui/table.tsx`
- Test: `apps/web/src/App.test.tsx`
- Test: `apps/web/src/features/execution/HistoryAndReports.test.tsx`
- Test: `apps/web/src/features/tools/ToolPages.test.tsx`

- [ ] **Step 1: Replace shared page primitives**

Replace `apps/web/src/components/layout/page.tsx` with:

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
        'grid min-h-[360px] content-start gap-5 text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function PageHeader({
  actions,
  subtitle,
  title,
}: {
  actions?: React.ReactNode
  subtitle?: React.ReactNode
  title: React.ReactNode
}) {
  return (
    <div className="flex min-h-14 items-start justify-between gap-4 border-b border-border/70 pb-4 max-sm:flex-col">
      <div className="grid gap-1.5">
        <h1 className="m-0 text-[1.55rem] font-bold leading-tight tracking-normal text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="m-0 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-0.5">
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
    <Empty className="min-h-18 rounded-md border border-dashed border-border/80 bg-muted/20">
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

- [ ] **Step 2: Replace shared list primitives**

Replace `apps/web/src/components/layout/list.tsx` with:

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
        'grid gap-3 rounded-md border border-border/75 bg-card/72 p-3 text-sm shadow-[0_14px_40px_rgb(23_32_29_/_0.06)]',
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
}: Omit<React.ComponentProps<'section'>, 'title'> & {
  actions?: React.ReactNode
  description?: React.ReactNode
  title: React.ReactNode
}) {
  const titleId = React.useId()

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'overflow-hidden rounded-md border border-border/75 bg-card/72 text-foreground shadow-[0_14px_40px_rgb(23_32_29_/_0.06)]',
        className,
      )}
      {...props}
    >
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border/70 bg-muted/22 px-3 py-2">
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
      <div className="divide-y divide-border/65">{children}</div>
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
        'grid min-w-0 items-center gap-3 px-3 py-3 text-sm transition-colors hover:bg-muted/30 data-[selected=true]:bg-accent/55 data-[selected=true]:shadow-[inset_3px_0_0_var(--sidebar-primary)]',
        className,
      )}
      {...props}
    />
  )
}
```

- [ ] **Step 3: Replace table primitive styling**

Replace `apps/web/src/components/ui/table.tsx` with:

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto rounded-md border border-border/75 bg-card/78 shadow-[0_14px_40px_rgb(23_32_29_/_0.06)]"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-muted/32 [&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/45 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border/65 transition-colors hover:bg-muted/28 has-aria-expanded:bg-muted/40 data-[state=selected]:bg-accent/45",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-9 px-3 text-left align-middle text-[11px] font-bold uppercase tracking-wide whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-2.5 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
```

- [ ] **Step 4: Run shared-surface tests**

Run:

```bash
pnpm --filter @testflow/web test -- App.test.tsx HistoryAndReports.test.tsx ToolPages.test.tsx
```

Expected:

```text
PASS apps/web/src/App.test.tsx
PASS apps/web/src/features/execution/HistoryAndReports.test.tsx
PASS apps/web/src/features/tools/ToolPages.test.tsx
```

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src/components/layout/page.tsx apps/web/src/components/layout/list.tsx apps/web/src/components/ui/table.tsx
git commit -m "refine shared work surfaces"
```

Expected:

```text
[branch <sha>] refine shared work surfaces
```

## Task 5: Control Room Execution Page

**Files:**
- Modify: `apps/web/src/features/execution/pages/TaskPage.tsx`
- Modify: `apps/web/src/features/execution/components/TaskDetail.tsx`
- Modify: `apps/web/src/features/execution/components/TaskSummaryItem.tsx`
- Test: `apps/web/src/features/execution/TaskPage.test.tsx`

- [ ] **Step 1: Replace TaskDetail with stronger monitoring detail**

Replace `apps/web/src/features/execution/components/TaskDetail.tsx` with:

```tsx
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import type { ExecutionTask } from '@/lib/api'
import { statusVariant, taskStatusLabel } from '../utils/taskFormatters'

export function TaskDetail({ task }: { task: ExecutionTask }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 text-base font-semibold">{task.script_name}</h3>
        <Badge variant={statusVariant(task.status)}>
          {taskStatusLabel(task.status)}
        </Badge>
      </div>
      <dl className="grid gap-2 rounded-md border border-border/65 bg-muted/18 p-3">
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
          <dt className="text-xs font-medium text-muted-foreground">任务 ID</dt>
          <dd className="m-0 min-w-0 text-sm [overflow-wrap:anywhere]">{task.id}</dd>
        </div>
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
          <dt className="text-xs font-medium text-muted-foreground">执行器</dt>
          <dd className="m-0 min-w-0 text-sm">{task.executor}</dd>
        </div>
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
          <dt className="text-xs font-medium text-muted-foreground">环境</dt>
          <dd className="m-0 min-w-0 text-sm">{task.environment}</dd>
        </div>
      </dl>
      {task.error_message ? (
        <Alert variant="destructive">
          <AlertDescription>{task.error_message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Replace TaskSummaryItem with motion-aware selected rows**

Replace `apps/web/src/features/execution/components/TaskSummaryItem.tsx` with:

```tsx
import { motion } from 'motion/react'

import { Badge } from '@/components/ui/badge'
import type { ExecutionTaskSummary } from '@/lib/api'
import { statusVariant, taskStatusLabel } from '../utils/taskFormatters'

export function TaskSummaryItem({
  isSelected = false,
  onSelect,
  showTaskId = true,
  task,
}: {
  isSelected?: boolean
  onSelect?: () => void
  showTaskId?: boolean
  task: ExecutionTaskSummary
}) {
  const content = (
    <>
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-sm font-semibold">{task.script_name}</h3>
          <Badge variant={statusVariant(task.status)}>
            {taskStatusLabel(task.status)}
          </Badge>
        </div>
        {showTaskId && !isSelected ? (
          <p className="m-0 text-xs text-muted-foreground">{task.id}</p>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">步骤</dt>
          <dd className="m-0 font-semibold text-foreground">
            {task.passed_step_count}/{task.step_count}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">耗时</dt>
          <dd className="m-0 font-semibold text-foreground">
            {task.duration_ms != null ? `${task.duration_ms} ms` : '-'}
          </dd>
        </div>
      </dl>
    </>
  )

  if (onSelect) {
    return (
      <motion.button
        animate={{ opacity: 1, y: 0 }}
        aria-label={`查看任务 ${task.id}`}
        aria-pressed={isSelected}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-transparent p-3 text-left transition-colors hover:bg-muted/34 data-[selected=true]:border-border/80 data-[selected=true]:bg-accent/55 data-[selected=true]:shadow-[inset_3px_0_0_var(--sidebar-primary)]"
        data-selected={isSelected}
        exit={{ opacity: 0, y: -4 }}
        initial={{ opacity: 0, y: 4 }}
        layout
        onClick={onSelect}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        type="button"
      >
        {content}
      </motion.button>
    )
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border/70 bg-card/62 p-3"
      exit={{ opacity: 0, y: -4 }}
      initial={{ opacity: 0, y: 4 }}
      layout
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
    >
      {content}
    </motion.div>
  )
}
```

- [ ] **Step 3: Replace TaskPage with Control Room panels**

Replace `apps/web/src/features/execution/pages/TaskPage.tsx` with:

```tsx
import { Square } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'

import { TaskDetail } from '../components/TaskDetail'
import { TaskSummaryItem } from '../components/TaskSummaryItem'
import { useTaskPage } from '../hooks/useTaskPage'
import { canCancelTask } from '../utils/taskGuards'
import { statusVariant, taskStatusLabel } from '../utils/taskFormatters'

export function TaskPage() {
  const {
    activeTask,
    cancelMutationIsPending,
    liveLogs,
    recentTasks,
    selectTask,
    selectedTaskId,
    stopActiveTask,
    tasksQuery,
  } = useTaskPage()

  return (
    <PagePanel>
      <PageHeader
        title="执行任务"
        subtitle="查看当前执行任务、实时输出和最近任务状态。"
        actions={
          <Badge variant={activeTask ? statusVariant(activeTask.status) : 'secondary'}>
            {activeTask ? taskStatusLabel(activeTask.status) : '未启动'}
          </Badge>
        }
      />

      <div className="grid grid-cols-[minmax(300px,0.78fr)_minmax(0,1.22fr)] gap-4 max-xl:grid-cols-1">
        <section className="overflow-hidden rounded-md border border-border/80 bg-card/76 shadow-[0_14px_40px_rgb(23_32_29_/_0.06)]">
          <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border/70 bg-muted/24 px-4 py-2">
            <h2 className="m-0 text-sm font-semibold">当前任务</h2>
            <Button
              disabled={!canCancelTask(activeTask) || cancelMutationIsPending}
              onClick={stopActiveTask}
              size="sm"
              type="button"
              variant="destructive"
            >
              <Square aria-hidden="true" data-icon="inline-start" />
              停止
            </Button>
          </div>
          <div className="p-4">
            {activeTask ? (
              <TaskDetail task={activeTask} />
            ) : (
              <EmptyState title="启动执行后显示当前任务" />
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-emerald-300/20 bg-slate-950 text-slate-100 shadow-[0_18px_54px_rgb(10_17_21_/_0.20)]">
          <div className="flex min-h-12 items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-2">
            <h2 className="m-0 text-sm font-semibold">实时日志</h2>
            <span className="rounded-full bg-emerald-300 px-2 py-0.5 text-[11px] font-bold text-slate-950">
              Control Room
            </span>
          </div>
          <div className="p-4">
            {liveLogs.length === 0 ? (
              <EmptyState
                className="border-white/10 bg-white/[0.03] text-slate-200"
                title="等待执行日志"
              />
            ) : (
              <div className="grid max-h-[420px] content-start gap-1.5 overflow-auto rounded-md border border-white/10 bg-black/24 px-3 py-2" aria-label="实时日志">
                <AnimatePresence initial={false}>
                  {liveLogs.map((log, index) => (
                    <motion.code
                      animate={{ opacity: 1, y: 0 }}
                      className="block overflow-wrap-anywhere border-b border-white/5 py-1.5 font-mono text-xs leading-relaxed text-slate-200 last:border-b-0"
                      exit={{ opacity: 0, y: -3 }}
                      initial={{ opacity: 0, y: 4 }}
                      key={`${log}-${index}`}
                      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {log}
                    </motion.code>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </section>

        <section className="col-span-full overflow-hidden rounded-md border border-border/80 bg-card/72 shadow-[0_14px_40px_rgb(23_32_29_/_0.06)]">
          <div className="flex min-h-12 items-center border-b border-border/70 bg-muted/24 px-4 py-2">
            <h2 className="m-0 text-sm font-semibold">最近任务</h2>
          </div>
          <div className="grid gap-1 p-2">
            {tasksQuery.isPending ? (
              <EmptyState title="正在加载任务" />
            ) : recentTasks.length === 0 ? (
              <EmptyState title="暂无执行任务" />
            ) : (
              <AnimatePresence initial={false}>
                {recentTasks.map((task) => (
                  <TaskSummaryItem
                    isSelected={task.id === selectedTaskId}
                    key={task.id}
                    onSelect={() => selectTask(task.id)}
                    showTaskId={Boolean(selectedTaskId)}
                    task={task}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>
      </div>
    </PagePanel>
  )
}
```

- [ ] **Step 4: Run task page tests**

Run:

```bash
pnpm --filter @testflow/web test -- TaskPage.test.tsx
```

Expected:

```text
PASS apps/web/src/features/execution/TaskPage.test.tsx
```

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src/features/execution/pages/TaskPage.tsx apps/web/src/features/execution/components/TaskDetail.tsx apps/web/src/features/execution/components/TaskSummaryItem.tsx
git commit -m "refresh execution monitoring ui"
```

Expected:

```text
[branch <sha>] refresh execution monitoring ui
```

## Task 6: Full Web Verification And Browser QA

**Files:**
- Verify: `apps/web/src/**/*`

- [ ] **Step 1: Run full web check**

Run:

```bash
pnpm check:web
```

Expected:

```text
vite build completes successfully.
```

- [ ] **Step 2: Run full web test suite**

Run:

```bash
pnpm --filter @testflow/web test
```

Expected:

```text
All Vitest files pass.
```

- [ ] **Step 3: Start or reuse the web dev server**

Run:

```bash
pnpm dev:web
```

Expected if no server is running:

```text
Local:   http://127.0.0.1:5174/
```

Expected if the strict port is already in use:

```text
Port 5174 is already in use
```

When the port is already in use, use the existing `http://127.0.0.1:5174/` server for browser verification.

- [ ] **Step 4: Verify `/scripts` in the browser**

Open:

```text
http://127.0.0.1:5174/scripts
```

Check:

```text
The sidebar, script table, search field, and "新建脚本" button render without overlap.
The active "脚本管理" nav item is visually selected and still has aria-current="page".
```

- [ ] **Step 5: Verify `/tasks` in the browser**

Open:

```text
http://127.0.0.1:5174/tasks
```

Check:

```text
The current task panel remains light.
The live log panel uses dark Control Room styling and readable text.
The Stop button remains disabled when there is no cancellable task.
Recent task rows keep clear selected and hover states.
```

- [ ] **Step 6: Verify one secondary route in the browser**

Open:

```text
http://127.0.0.1:5174/commands
```

Check:

```text
The shared shell, cards, inputs, and status bar still align with the Precision Lab theme.
No text overlaps in command form labels, inputs, or command list items.
```

- [ ] **Step 7: Commit verification fixes if any were needed**

If browser QA required code changes, run the relevant focused test again, then commit:

```bash
git add apps/web/src
git commit -m "polish ui modernization"
```

Expected when code fixes were made:

```text
[branch <sha>] polish ui modernization
```

If no code fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: Task 1 covers Motion and reduced-motion root config; Task 2 covers Precision Lab tokens; Task 3 covers shell, sidebar, active nav, and status bar; Task 4 covers shared page/list/table surfaces; Task 5 covers Control Room execution/log UI and motion for logs/recent tasks; Task 6 covers required checks and browser routes.
- Placeholder scan: The plan contains no unresolved placeholders, deferred implementation notes, or unspecified code steps.
- Type consistency: Motion imports use `motion/react`; changed React component props preserve existing accessible names, callbacks, and route semantics.
