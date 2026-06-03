# Task Page Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the execution task page into a monitoring page that removes the task control card, restores the active task from `taskId` or the latest active task, and keeps realtime logs working for tasks launched from script pages.

**Architecture:** Script pages remain the execution launch points and navigate to `/tasks?taskId=<id>` after `api.createTask` succeeds. `TaskPage` becomes a monitor: it loads task summaries, selects the URL task when present, otherwise selects the newest `pending` or `running` task, fetches full task details with `api.getTask`, and filters WebSocket updates by the selected task id. The recent task list becomes selectable so users can inspect finished tasks manually without treating them as the default current task.

**Tech Stack:** React 19, React Router, TanStack Query, Vitest, Testing Library, Vite.

---

## File Structure

- Modify `apps/web/src/features/execution/pages/TaskPage.tsx`
  - Remove the embedded execution form/control-panel workflow.
  - Read and write `taskId` using React Router search params.
  - Load full task details with `api.getTask(taskId)`.
  - Auto-select latest `pending` or `running` task only when no `taskId` is present.
  - Keep realtime logs scoped to the selected task id.
- Modify `apps/web/src/features/execution/components/TaskSummaryItem.tsx`
  - Add optional selection behavior while keeping the existing static card behavior reusable.
- Modify `apps/web/src/features/scripts/pages/ScriptListPage.tsx`
  - Navigate to `/tasks?taskId=<created id>` after running a script.
- Modify `apps/web/src/features/scripts/pages/ScriptEditorPage.tsx`
  - Navigate to `/tasks?taskId=<created id>` after running a script.
- Modify `apps/web/src/app/routes.tsx`
  - Update the `/tasks` description from launch-oriented wording to monitoring-oriented wording.
- Modify `apps/web/src/features/execution/TaskPage.test.tsx`
  - Replace old control-panel tests with monitoring-page tests.
- Create `apps/web/src/features/scripts/ScriptRunNavigation.test.tsx`
  - Cover script list and script editor run navigation.

---

### Task 1: Rewrite Task Page Tests Around Monitoring Behavior

**Files:**
- Modify: `apps/web/src/features/execution/TaskPage.test.tsx`

- [ ] **Step 1: Replace the render helper so TaskPage has router context**

Update the imports at the top of `apps/web/src/features/execution/TaskPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
```

Replace `renderWithQuery` with this version:

```tsx
function renderWithQuery(
  ui: React.ReactElement,
  initialEntries: string[] = ['/tasks'],
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}
```

- [ ] **Step 2: Add reusable task fixtures**

Keep `pendingTask`, then add these fixtures below it:

```tsx
const runningTask = {
  ...pendingTask,
  id: 'task-running',
  status: 'running',
  started_at: '2026-06-01T00:00:01+00:00',
  logs: [
    {
      timestamp: '2026-06-01T00:00:01+00:00',
      level: 'info',
      message: 'Task started',
    },
  ],
}

const passedTask = {
  ...pendingTask,
  id: 'task-passed',
  status: 'passed',
  started_at: '2026-06-01T00:00:01+00:00',
  finished_at: '2026-06-01T00:00:03+00:00',
  duration_ms: 2000,
  logs: [
    {
      timestamp: '2026-06-01T00:00:03+00:00',
      level: 'info',
      message: 'Task passed',
    },
  ],
}

const taskSummaries = [
  {
    id: 'task-running',
    script_id: 'smoke-cockpit',
    script_name: '座舱冒烟测试',
    script_revision: 1,
    status: 'running',
    environment: 'local',
    target_device: 'bench-1',
    executor: 'local',
    created_at: '2026-06-01T00:00:02+00:00',
    started_at: '2026-06-01T00:00:03+00:00',
    finished_at: null,
    duration_ms: null,
    step_count: 1,
    passed_step_count: 0,
    failed_step_count: 0,
  },
  {
    id: 'task-passed',
    script_id: 'smoke-cockpit',
    script_name: '座舱冒烟测试',
    script_revision: 1,
    status: 'passed',
    environment: 'local',
    target_device: 'bench-1',
    executor: 'local',
    created_at: '2026-06-01T00:00:01+00:00',
    started_at: '2026-06-01T00:00:01+00:00',
    finished_at: '2026-06-01T00:00:03+00:00',
    duration_ms: 2000,
    step_count: 1,
    passed_step_count: 1,
    failed_step_count: 0,
  },
]
```

- [ ] **Step 3: Simplify beforeEach defaults**

Replace the existing `beforeEach` body with:

```tsx
  beforeEach(() => {
    apiMock.listScripts.mockResolvedValue({ items: [] })
    apiMock.listTasks.mockResolvedValue({ items: [] })
    apiMock.createTask.mockResolvedValue(pendingTask)
    apiMock.cancelTask.mockResolvedValue({})
    apiMock.getTask.mockResolvedValue(pendingTask)
    webSocketMock.connect.mockClear()
    webSocketMock.disconnect.mockClear()
    webSocketMock.subscribe.mockClear()
    webSocketMock.emit = undefined
  })
```

- [ ] **Step 4: Replace old tests with monitoring tests**

Replace the current `it(...)` cases and the `startTask()` helper with these tests:

```tsx
  it('renders as a monitoring page without the task control card', async () => {
    renderWithQuery(<TaskPage />)

    expect(screen.queryByLabelText('选择脚本')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '开始执行' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument()
    expect(await screen.findByText('启动执行后显示当前任务')).toBeInTheDocument()
  })

  it('auto-selects the newest active task when the URL has no taskId', async () => {
    apiMock.listTasks.mockResolvedValue({ items: taskSummaries })
    apiMock.getTask.mockResolvedValue(runningTask)

    renderWithQuery(<TaskPage />)

    await waitFor(() => expect(apiMock.getTask).toHaveBeenCalledWith('task-running'))
    expect(await screen.findByText('task-running')).toBeInTheDocument()
    expect(screen.getByText(/Task started/)).toBeInTheDocument()
  })

  it('uses taskId from the URL instead of auto-selecting an active task', async () => {
    apiMock.listTasks.mockResolvedValue({ items: taskSummaries })
    apiMock.getTask.mockResolvedValue(passedTask)

    renderWithQuery(<TaskPage />, ['/tasks?taskId=task-passed'])

    await waitFor(() => expect(apiMock.getTask).toHaveBeenCalledWith('task-passed'))
    expect(await screen.findByText('task-passed')).toBeInTheDocument()
    expect(screen.getByText(/Task passed/)).toBeInTheDocument()
  })

  it('selects a recent task when the user clicks it', async () => {
    apiMock.listTasks.mockResolvedValue({ items: taskSummaries })
    apiMock.getTask
      .mockResolvedValueOnce(runningTask)
      .mockResolvedValueOnce(passedTask)

    renderWithQuery(<TaskPage />)

    await screen.findByText('task-running')
    fireEvent.click(screen.getByRole('button', { name: /查看任务 task-passed/ }))

    await waitFor(() => expect(apiMock.getTask).toHaveBeenLastCalledWith('task-passed'))
    expect(await screen.findByText(/Task passed/)).toBeInTheDocument()
  })

  it('appends matching websocket log events to realtime logs', async () => {
    apiMock.listTasks.mockResolvedValue({ items: taskSummaries })
    apiMock.getTask.mockResolvedValue(runningTask)

    renderWithQuery(<TaskPage />)

    await screen.findByText('task-running')

    act(() => {
      webSocketMock.emit?.({
        type: 'log',
        task_id: 'task-running',
        timestamp: '2026-06-01T00:00:04+00:00',
        level: 'info',
        message: 'boot completed',
      })
      webSocketMock.emit?.({
        type: 'log',
        task_id: 'task-passed',
        timestamp: '2026-06-01T00:00:05+00:00',
        level: 'info',
        message: 'unrelated output',
      })
    })

    expect(await screen.findByText(/boot completed/)).toBeInTheDocument()
    expect(screen.queryByText(/unrelated output/)).not.toBeInTheDocument()
  })

  it('updates selected task details from matching websocket task events', async () => {
    apiMock.listTasks.mockResolvedValue({ items: taskSummaries })
    apiMock.getTask.mockResolvedValue(runningTask)

    renderWithQuery(<TaskPage />)

    await screen.findByText('task-running')

    act(() => {
      webSocketMock.emit?.({
        type: 'task_status',
        task_id: 'task-running',
        task: {
          ...runningTask,
          status: 'passed',
          finished_at: '2026-06-01T00:00:10+00:00',
          duration_ms: 9000,
        },
      })
    })

    expect(await screen.findByText('已通过')).toBeInTheDocument()
  })
```

- [ ] **Step 5: Run the failing task page tests**

Run:

```powershell
pnpm --filter @testflow/web test -- TaskPage.test.tsx
```

Expected: FAIL because `TaskPage` still renders the control panel and does not read `taskId` from the URL.

---

### Task 2: Make Recent Task Items Selectable

**Files:**
- Modify: `apps/web/src/features/execution/components/TaskSummaryItem.tsx`

- [ ] **Step 1: Update TaskSummaryItem props**

Replace the function signature with:

```tsx
export function TaskSummaryItem({
  isSelected = false,
  onSelect,
  task,
}: {
  isSelected?: boolean
  onSelect?: () => void
  task: ExecutionTaskSummary
}) {
```

- [ ] **Step 2: Add a shared content block**

Inside `TaskSummaryItem`, before `return`, add:

```tsx
  const content = (
    <>
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-base font-semibold">{task.script_name}</h3>
          <Badge variant={statusVariant(task.status)}>
            {taskStatusLabel(task.status)}
          </Badge>
        </div>
        <p className="m-0 text-sm text-muted-foreground">{task.id}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground">步骤</dt>
          <dd className="m-0 font-semibold text-foreground">
            {task.passed_step_count}/{task.step_count}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">环境</dt>
          <dd className="m-0 font-semibold text-foreground">{task.environment}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">耗时</dt>
          <dd className="m-0 font-semibold text-foreground">
            {task.duration_ms != null ? `${task.duration_ms} ms` : '-'}
          </dd>
        </div>
      </dl>
    </>
  )
```

- [ ] **Step 3: Return a button-backed Card when selectable**

Replace the existing `return (...)` with:

```tsx
  if (onSelect) {
    return (
      <Card
        aria-label={`查看任务 ${task.id}`}
        aria-pressed={isSelected}
        asChild
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 text-left transition-colors hover:bg-muted/60 data-[selected=true]:border-ring data-[selected=true]:ring-2 data-[selected=true]:ring-ring/20"
        data-selected={isSelected}
        size="sm"
      >
        <button onClick={onSelect} type="button">
          {content}
        </button>
      </Card>
    )
  }

  return (
    <Card
      size="sm"
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3"
    >
      {content}
    </Card>
  )
```

- [ ] **Step 4: Run the focused task page tests**

Run:

```powershell
pnpm --filter @testflow/web test -- TaskPage.test.tsx
```

Expected: still FAIL until `TaskPage` is updated, but TypeScript syntax should be valid.

---

### Task 3: Convert TaskPage Into a Monitoring Page

**Files:**
- Modify: `apps/web/src/features/execution/pages/TaskPage.tsx`

- [ ] **Step 1: Update imports**

Replace the first import and remove mutation/control-panel-related imports:

```tsx
import { useEffect, useRef, useState } from 'react'
import {
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
```

Remove these imports:

```tsx
import { useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { TaskControlPanel } from '../components/TaskControlPanel'
import { canCancelTask } from '../utils/taskGuards'
```

Keep `isExecutionEventMessage` and `shouldRefreshTasks`:

```tsx
import { isExecutionEventMessage, shouldRefreshTasks } from '../utils/taskGuards'
```

- [ ] **Step 2: Replace launch state with selected task state**

Inside `TaskPage`, replace the state declarations for selected script, environment, target device, active task, and mutation refs with:

```tsx
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedTaskId, setSelectedTaskId] = useState(
    () => searchParams.get('taskId') ?? '',
  )
  const [liveLogs, setLiveLogs] = useState<string[]>([])
  const activeTaskIdRef = useRef<string | null>(selectedTaskId || null)
```

- [ ] **Step 3: Remove scripts query, published scripts, selected script, create mutation, and cancel mutation**

Delete these blocks from `TaskPage`:

```tsx
  const [selectedScriptId, setSelectedScriptId] = useState('')
  const [environment, setEnvironment] = useState('local')
  const [targetDevice, setTargetDevice] = useState('')
  const [activeTask, setActiveTask] = useState<ExecutionTask | null>(null)
```

```tsx
  const scriptsQuery = useQuery({
    queryKey: ['scripts'],
    queryFn: api.listScripts,
  })
```

```tsx
  const publishedScripts = useMemo(
    () =>
      (scriptsQuery.data?.items ?? []).filter(
        (script) => script.status === 'published',
      ),
    [scriptsQuery.data?.items],
  )
  const selectedScript = publishedScripts.find(
    (script) => script.id === selectedScriptId,
  )
```

```tsx
  useEffect(() => {
    if (!selectedScriptId && publishedScripts.length > 0) {
      setSelectedScriptId(publishedScripts[0].id)
    }
  }, [publishedScripts, selectedScriptId])
```

```tsx
  const createMutation = useMutation({
    mutationFn: () =>
      api.createTask({
        script_id: selectedScriptId,
        environment,
        target_device: targetDevice,
        variables: {},
      }),
    onSuccess: async (task) => {
      activeTaskIdRef.current = task.id
      setActiveTask(task)
      setLiveLogs(task.logs.map(formatLogEntry))
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
  const cancelMutation = useMutation({
    mutationFn: (taskId: string) => api.cancelTask(taskId),
    onSuccess: async (task) => {
      setActiveTask(task)
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
```

- [ ] **Step 4: Add task detail query and active task selection effects**

After `tasksQuery`, add:

```tsx
  const recentTasks = tasksQuery.data?.items ?? []
  const activeTask = useQuery({
    queryKey: ['task', selectedTaskId],
    queryFn: () => api.getTask(selectedTaskId),
    enabled: Boolean(selectedTaskId),
  }).data ?? null

  useEffect(() => {
    const taskId = searchParams.get('taskId') ?? ''
    setSelectedTaskId(taskId)
    activeTaskIdRef.current = taskId || null
  }, [searchParams])

  useEffect(() => {
    if (selectedTaskId || searchParams.has('taskId')) {
      return
    }
    const activeSummary = recentTasks.find(
      (task) => task.status === 'pending' || task.status === 'running',
    )
    if (activeSummary) {
      setSearchParams({ taskId: activeSummary.id }, { replace: true })
    }
  }, [recentTasks, searchParams, selectedTaskId, setSearchParams])

  useEffect(() => {
    activeTaskIdRef.current = activeTask?.id ?? selectedTaskId || null
    setLiveLogs(activeTask ? activeTask.logs.map(formatLogEntry) : [])
  }, [activeTask, selectedTaskId])
```

- [ ] **Step 5: Update websocket handling to write selected task data into query cache**

Inside the WebSocket message handler, replace:

```tsx
        if (isPageTask && message.task) {
          setActiveTask(message.task)
        }
```

with:

```tsx
        if (isPageTask && message.task) {
          queryClient.setQueryData(['task', messageTaskId], message.task)
        }
```

Keep the matching log append:

```tsx
        if (isPageTask && message.type === 'log' && message.message) {
          setLiveLogs((current) => [...current, formatEventLog(message)])
        }
```

- [ ] **Step 6: Remove start and cancel handlers**

Delete:

```tsx
  function startExecution() {
    if (!selectedScriptId) {
      return
    }
    createMutation.mutate()
  }

  function cancelExecution() {
    const task = activeTask
    if (canCancelTask(task)) {
      cancelMutation.mutate(task.id)
    }
  }
```

- [ ] **Step 7: Add a recent task selection handler**

Add this function before `return`:

```tsx
  function selectTask(taskId: string) {
    setSearchParams({ taskId })
  }
```

- [ ] **Step 8: Update the page header subtitle**

Replace the `PageHeader` subtitle with:

```tsx
        subtitle="查看当前执行任务、实时输出和最近任务状态。"
```

- [ ] **Step 9: Remove the TaskControlPanel JSX**

Delete this block:

```tsx
      <TaskControlPanel
        selectedScriptId={selectedScriptId}
        onSelectedScriptIdChange={setSelectedScriptId}
        environment={environment}
        onEnvironmentChange={setEnvironment}
        targetDevice={targetDevice}
        onTargetDeviceChange={setTargetDevice}
        publishedScripts={publishedScripts}
        selectedScript={selectedScript}
        activeTask={activeTask}
        createMutationIsPending={createMutation.isPending}
        cancelMutationIsPending={cancelMutation.isPending}
        scriptsQueryIsError={scriptsQuery.isError}
        scriptsQueryIsPending={scriptsQuery.isPending}
        onStartExecution={startExecution}
        onCancelExecution={cancelExecution}
      />
```

- [ ] **Step 10: Make recent task rows selectable**

Replace the `recentTasks.map` block with:

```tsx
              recentTasks.map((task) => (
                <TaskSummaryItem
                  isSelected={task.id === selectedTaskId}
                  key={task.id}
                  onSelect={() => selectTask(task.id)}
                  task={task}
                />
              ))
```

- [ ] **Step 11: Run the focused task page tests**

Run:

```powershell
pnpm --filter @testflow/web test -- TaskPage.test.tsx
```

Expected: PASS.

---

### Task 4: Navigate Script Run Entrypoints With taskId

**Files:**
- Modify: `apps/web/src/features/scripts/pages/ScriptListPage.tsx`
- Modify: `apps/web/src/features/scripts/pages/ScriptEditorPage.tsx`
- Create: `apps/web/src/features/scripts/ScriptRunNavigation.test.tsx`

- [ ] **Step 1: Update ScriptListPage run success navigation**

In `apps/web/src/features/scripts/pages/ScriptListPage.tsx`, replace:

```tsx
  const executeMutation = useMutation({
    mutationFn: (scriptId: string) => api.createTask({ script_id: scriptId }),
    onSuccess: () => {
      navigate('/tasks')
    },
  })
```

with:

```tsx
  const executeMutation = useMutation({
    mutationFn: (scriptId: string) => api.createTask({ script_id: scriptId }),
    onSuccess: (task) => {
      navigate(`/tasks?taskId=${encodeURIComponent(task.id)}`)
    },
  })
```

- [ ] **Step 2: Update ScriptEditorPage run success navigation**

In `apps/web/src/features/scripts/pages/ScriptEditorPage.tsx`, replace:

```tsx
  const executeMutation = useMutation({
    mutationFn: () => api.createTask({ script_id: script.id }),
    onSuccess: (_task) => {
      navigate(`/tasks`)
    },
    onError: (error) => {
      setIssues(normalizeMutationIssues(error))
    },
  })
```

with:

```tsx
  const executeMutation = useMutation({
    mutationFn: () => api.createTask({ script_id: script.id }),
    onSuccess: (task) => {
      navigate(`/tasks?taskId=${encodeURIComponent(task.id)}`)
    },
    onError: (error) => {
      setIssues(normalizeMutationIssues(error))
    },
  })
```

- [ ] **Step 3: Create script run navigation tests**

Create `apps/web/src/features/scripts/ScriptRunNavigation.test.tsx` with:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({
  createTask: vi.fn(),
  deleteScript: vi.fn(),
  getScript: vi.fn(),
  listKeywords: vi.fn(),
  listScripts: vi.fn(),
  saveScript: vi.fn(),
}))

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    createApiClient: vi.fn(() => apiMock),
  }
})

import { ScriptEditorPage, ScriptListPage } from '@/features/scripts'

const scriptSummary = {
  id: 'smoke-cockpit',
  name: '座舱冒烟测试',
  description: '基础稳定性巡检',
  step_count: 1,
  enabled_step_count: 1,
  revision: 1,
  updated_at: '2026-05-31T12:00:00+00:00',
  status: 'published',
  tags: ['smoke'],
  group: 'stability',
}

const scriptDetail = {
  ...scriptSummary,
  version: '1.0.0',
  variables: {},
  steps: [
    {
      id: 'step-1',
      keyword: 'noop',
      description: 'No operation',
      enabled: true,
      params: {},
    },
  ],
}

function LocationProbe() {
  return <div aria-label="location">{window.location.pathname}{window.location.search}</div>
}

function renderWithQuery(ui: React.ReactElement, initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/scripts" element={ui} />
          <Route path="/scripts/:scriptId" element={ui} />
          <Route path="/tasks" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('script run navigation', () => {
  beforeEach(() => {
    apiMock.createTask.mockResolvedValue({ id: 'exec-123' })
    apiMock.deleteScript.mockResolvedValue({})
    apiMock.getScript.mockResolvedValue(scriptDetail)
    apiMock.listKeywords.mockResolvedValue({ items: [] })
    apiMock.listScripts.mockResolvedValue({ items: [scriptSummary] })
    apiMock.saveScript.mockResolvedValue(scriptDetail)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('navigates from script list run action to tasks with taskId', async () => {
    renderWithQuery(<ScriptListPage />, ['/scripts'])

    fireEvent.click(await screen.findByRole('button', { name: '运行 座舱冒烟测试' }))

    await waitFor(() =>
      expect(apiMock.createTask).toHaveBeenCalledWith({ script_id: 'smoke-cockpit' }),
    )
    expect(await screen.findByLabelText('location')).toHaveTextContent('/tasks?taskId=exec-123')
  })

  it('navigates from script editor run action to tasks with taskId', async () => {
    renderWithQuery(<ScriptEditorPage />, ['/scripts/smoke-cockpit'])

    fireEvent.click(await screen.findByRole('button', { name: '运行' }))

    await waitFor(() =>
      expect(apiMock.createTask).toHaveBeenCalledWith({ script_id: 'smoke-cockpit' }),
    )
    expect(await screen.findByLabelText('location')).toHaveTextContent('/tasks?taskId=exec-123')
  })
})
```

- [ ] **Step 4: Run the new script navigation tests**

Run:

```powershell
pnpm --filter @testflow/web test -- ScriptRunNavigation.test.tsx
```

Expected: PASS.

---

### Task 5: Polish Route Copy and Run Full Web Verification

**Files:**
- Modify: `apps/web/src/app/routes.tsx`

- [ ] **Step 1: Update the tasks route description**

In `apps/web/src/app/routes.tsx`, replace the `/tasks` route description:

```tsx
    description: '发起单脚本执行并查看实时进度。',
```

with:

```tsx
    description: '查看当前执行任务、实时日志和最近任务状态。',
```

- [ ] **Step 2: Run focused test suites**

Run:

```powershell
pnpm --filter @testflow/web test -- TaskPage.test.tsx ScriptRunNavigation.test.tsx
```

Expected: PASS for both test files.

- [ ] **Step 3: Run all web tests**

Run:

```powershell
pnpm --filter @testflow/web test
```

Expected: PASS.

- [ ] **Step 4: Run web build/type check**

Run:

```powershell
pnpm check:web
```

Expected: PASS.

- [ ] **Step 5: Browser verification**

Start the web dev server:

```powershell
pnpm dev:web
```

Open `http://127.0.0.1:5174/scripts`, click a script row's run icon, and verify:

- The app navigates to `/tasks?taskId=<new task id>`.
- The task control card is absent.
- “当前任务” shows the launched task.
- “实时日志” shows existing logs from `getTask` and appends matching WebSocket logs.
- Directly opening `/tasks` auto-selects the newest `pending` or `running` task when one exists.
- Directly opening `/tasks` with no active tasks leaves “当前任务” empty and keeps “最近任务” visible.
- Clicking a recent task row loads that task's details and logs.

- [ ] **Step 6: Commit implementation**

Run:

```powershell
git status --short
git add apps/web/src/features/execution/pages/TaskPage.tsx apps/web/src/features/execution/components/TaskSummaryItem.tsx apps/web/src/features/execution/TaskPage.test.tsx apps/web/src/features/scripts/pages/ScriptListPage.tsx apps/web/src/features/scripts/pages/ScriptEditorPage.tsx apps/web/src/features/scripts/ScriptRunNavigation.test.tsx apps/web/src/app/routes.tsx
git commit -m "make task page monitor executions"
```

Expected: commit succeeds with only the task-monitoring changes staged.

---

## Self-Review

- Spec coverage: The plan removes the task control card, makes script pages the launch points, navigates with `taskId`, restores task details from URL, auto-selects newest active task for bare `/tasks`, leaves no active selection when no active task exists, keeps recent tasks visible, and allows manual recent-task selection.
- Placeholder scan: No placeholder tasks remain; every code-changing step includes exact code or an exact replacement.
- Type consistency: The plan consistently uses `selectedTaskId`, `taskId`, `ExecutionTaskSummary`, existing `ExecutionTask`, `api.getTask`, `api.listTasks`, and existing WebSocket event types.
