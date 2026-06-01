import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({
  cancelTask: vi.fn(),
  createTask: vi.fn(),
  getTask: vi.fn(),
  listScripts: vi.fn(),
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

import { TaskPage } from './TaskPage'

const pendingTask = {
  id: 'task-1',
  script_id: 'smoke-cockpit',
  script_name: '座舱冒烟测试',
  script_revision: 1,
  status: 'pending',
  environment: 'local',
  target_device: 'bench-1',
  variables: {},
  executor: 'local',
  created_at: '2026-06-01T00:00:00+00:00',
  started_at: null,
  finished_at: null,
  duration_ms: null,
  log_path: '',
  report_dir: '',
  steps: [],
  logs: [],
  error_message: '',
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

describe('TaskPage', () => {
  beforeEach(() => {
    apiMock.listScripts.mockResolvedValue({
      items: [
        {
          id: 'smoke-cockpit',
          name: '座舱冒烟测试',
          description: '基础稳定性巡检',
          step_count: 1,
          enabled_step_count: 1,
          revision: 1,
          updated_at: '2026-05-31T12:00:00+00:00',
          status: 'published',
          tags: ['smoke', 'cockpit'],
          group: 'stability',
        },
      ],
    })
    apiMock.listTasks.mockResolvedValue({ items: [] })
    apiMock.createTask.mockResolvedValue(pendingTask)
    apiMock.cancelTask.mockResolvedValue({})
    apiMock.getTask.mockResolvedValue({})
    webSocketMock.connect.mockClear()
    webSocketMock.disconnect.mockClear()
    webSocketMock.subscribe.mockClear()
    webSocketMock.emit = undefined
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('starts execution for a selected published script', async () => {
    renderWithQuery(<TaskPage />)

    fireEvent.change(await screen.findByLabelText('选择脚本'), {
      target: { value: 'smoke-cockpit' },
    })
    fireEvent.change(screen.getByLabelText('目标设备'), {
      target: { value: 'bench-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: '开始执行' }))

    await waitFor(() =>
      expect(apiMock.createTask).toHaveBeenCalledWith({
        script_id: 'smoke-cockpit',
        environment: 'local',
        target_device: 'bench-1',
        variables: {},
      }),
    )
  })

  it('ignores unrelated task websocket events for active task and logs', async () => {
    renderWithQuery(<TaskPage />)

    await startTask()

    act(() => {
      webSocketMock.emit?.({
        type: 'task_status',
        task_id: 'task-2',
        task: {
          ...pendingTask,
          id: 'task-2',
          script_name: '其他任务',
          target_device: 'bench-2',
        },
      })
      webSocketMock.emit?.({
        type: 'log',
        task_id: 'task-2',
        timestamp: '2026-06-01T00:00:01+00:00',
        level: 'info',
        message: 'unrelated output',
      })
    })

    expect(screen.getByText('task-1')).toBeInTheDocument()
    expect(screen.queryByText('其他任务')).not.toBeInTheDocument()
    expect(screen.queryByText(/unrelated output/)).not.toBeInTheDocument()
  })

  it('appends matching websocket log events to realtime logs', async () => {
    renderWithQuery(<TaskPage />)

    await startTask()

    act(() => {
      webSocketMock.emit?.({
        type: 'log',
        task_id: 'task-1',
        timestamp: '2026-06-01T00:00:01+00:00',
        level: 'info',
        message: 'boot completed',
      })
    })

    expect(await screen.findByText(/boot completed/)).toBeInTheDocument()
  })

  it('does not cancel terminal active tasks', async () => {
    apiMock.createTask.mockResolvedValue({
      ...pendingTask,
      status: 'passed',
      finished_at: '2026-06-01T00:00:03+00:00',
    })
    renderWithQuery(<TaskPage />)

    await startTask()

    const cancelButton = screen.getByRole('button', { name: '取消' })
    expect(cancelButton).toBeDisabled()
    fireEvent.click(cancelButton)

    expect(apiMock.cancelTask).not.toHaveBeenCalled()
  })
})

async function startTask() {
  fireEvent.change(await screen.findByLabelText('选择脚本'), {
    target: { value: 'smoke-cockpit' },
  })
  fireEvent.change(screen.getByLabelText('目标设备'), {
    target: { value: 'bench-1' },
  })
  fireEvent.click(screen.getByRole('button', { name: '开始执行' }))
  await waitFor(() => expect(apiMock.createTask).toHaveBeenCalled())
}
