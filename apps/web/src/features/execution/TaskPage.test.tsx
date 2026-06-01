import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({
  cancelTask: vi.fn(),
  createTask: vi.fn(),
  getTask: vi.fn(),
  listScripts: vi.fn(),
  listTasks: vi.fn(),
}))

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    createApiClient: vi.fn(() => apiMock),
  }
})

import { TaskPage } from './TaskPage'

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
    apiMock.createTask.mockResolvedValue({
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
    })
    apiMock.cancelTask.mockResolvedValue({})
    apiMock.getTask.mockResolvedValue({})
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
})
