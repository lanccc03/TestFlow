import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({
  cancelTask: vi.fn(),
  createTask: vi.fn(),
  getTask: vi.fn(),
  listTasks: vi.fn(),
}))
const webSocketMock = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  emit: undefined as ((message: unknown) => void) | undefined,
  subscribe: vi.fn((_onStatus: unknown, onMessage?: (message: unknown) => void) => {
    webSocketMock.emit = onMessage
    return vi.fn()
  }),
}))

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    createApiClient: vi.fn(() => apiMock),
  }
})

vi.mock('@/lib/websocket', () => ({
  createWebSocketClient: vi.fn(() => webSocketMock),
}))

import { TaskPage } from '@/features/execution'

const pendingTask = {
  id: 'task-1',
  case_id: 'smoke-cockpit',
  case_name: '座舱冒烟测试',
  case_revision: 1,
  status: 'pending',
  created_at: '2026-06-01T00:00:00+00:00',
  started_at: null,
  finished_at: null,
  duration_ms: null,
  log_path: '',
  report_dir: '',
  logs: [],
  error_message: '',
}

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

const canceledTask = {
  ...runningTask,
  status: 'canceled',
  finished_at: '2026-06-01T00:00:10+00:00',
  duration_ms: 9000,
}

const taskSummaries = [
  {
    id: 'task-running',
    case_id: 'smoke-cockpit',
    case_name: '座舱冒烟测试',
    case_revision: 1,
    status: 'running',
    created_at: '2026-06-01T00:00:02+00:00',
    started_at: '2026-06-01T00:00:03+00:00',
    finished_at: null,
    duration_ms: null,
  },
  {
    id: 'task-passed',
    case_id: 'smoke-cockpit',
    case_name: '座舱冒烟测试',
    case_revision: 1,
    status: 'passed',
    created_at: '2026-06-01T00:00:01+00:00',
    started_at: '2026-06-01T00:00:01+00:00',
    finished_at: '2026-06-01T00:00:03+00:00',
    duration_ms: 2000,
  },
]

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

describe('TaskPage', () => {
  beforeEach(() => {
    apiMock.listTasks.mockResolvedValue({ items: [] })
    apiMock.createTask.mockResolvedValue(pendingTask)
    apiMock.cancelTask.mockResolvedValue({})
    apiMock.getTask.mockResolvedValue(pendingTask)
    webSocketMock.connect.mockClear()
    webSocketMock.disconnect.mockClear()
    webSocketMock.subscribe.mockClear()
    webSocketMock.emit = undefined
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders as a monitoring page without the task control card', async () => {
    renderWithQuery(<TaskPage />)

    expect(screen.queryByLabelText('选择脚本')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '开始执行' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '停止' })).toBeDisabled()
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

  it('stops a running task and updates the selected task status', async () => {
    apiMock.listTasks.mockResolvedValue({ items: taskSummaries })
    apiMock.getTask.mockResolvedValue(runningTask)
    apiMock.cancelTask.mockResolvedValue(canceledTask)

    renderWithQuery(<TaskPage />)

    await screen.findByText('task-running')
    fireEvent.click(screen.getByRole('button', { name: '停止' }))

    await waitFor(() => expect(apiMock.cancelTask).toHaveBeenCalledWith('task-running'))
    expect(await screen.findAllByText('已取消')).not.toHaveLength(0)
  })

  it('does not stop a finished task', async () => {
    apiMock.listTasks.mockResolvedValue({ items: taskSummaries })
    apiMock.getTask.mockResolvedValue(passedTask)

    renderWithQuery(<TaskPage />, ['/tasks?taskId=task-passed'])

    await screen.findByText('task-passed')
    const stopButton = screen.getByRole('button', { name: '停止' })

    expect(stopButton).toBeDisabled()
    fireEvent.click(stopButton)
    expect(apiMock.cancelTask).not.toHaveBeenCalled()
  })

  it('does not handle log-type websocket events', async () => {
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
    })

    expect(screen.queryByText(/boot completed/)).not.toBeInTheDocument()
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
})
