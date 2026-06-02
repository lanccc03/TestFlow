import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({
  getReport: vi.fn(),
  listReports: vi.fn(),
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

import { HistoryPage, ReportDetailPage, ReportListPage } from '@/features/execution'

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('HistoryPage', () => {
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
          updated_at: '2026-06-01T00:00:00+00:00',
          status: 'published',
          tags: [],
          group: 'stability',
        },
      ],
    })
    apiMock.listTasks.mockResolvedValue({
      items: [
        {
          id: 'exec-1',
          script_id: 'smoke-cockpit',
          script_name: '座舱冒烟测试',
          script_revision: 1,
          status: 'failed',
          environment: 'local',
          target_device: 'bench-1',
          executor: 'alice',
          created_at: '2026-06-01T00:00:00+00:00',
          started_at: '2026-06-01T00:00:01+00:00',
          finished_at: '2026-06-01T00:00:02+00:00',
          duration_ms: 1000,
          step_count: 1,
          passed_step_count: 0,
          failed_step_count: 1,
        },
      ],
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('filters execution history and links to report details', async () => {
    renderWithProviders(<HistoryPage />)

    expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('执行人'), {
      target: { value: 'alice' },
    })
    fireEvent.click(screen.getByRole('button', { name: '查询历史' }))

    await waitFor(() =>
      expect(apiMock.listTasks).toHaveBeenLastCalledWith(
        expect.objectContaining({ executor: 'alice' }),
      ),
    )
    expect(screen.getByRole('link', { name: '查看报告' })).toHaveAttribute(
      'href',
      '/reports/exec-1',
    )
  })
})

const reportTask = {
  id: 'exec-1',
  script_id: 'smoke-cockpit',
  script_name: '座舱冒烟测试',
  script_revision: 1,
  status: 'failed',
  environment: 'local',
  target_device: 'bench-1',
  variables: {},
  executor: 'alice',
  created_at: '2026-06-01T00:00:00+00:00',
  started_at: '2026-06-01T00:00:01+00:00',
  finished_at: '2026-06-01T00:00:02+00:00',
  duration_ms: 1000,
  log_path: 'data/logs/executions/exec-1.log',
  report_dir: 'data/reports/exec-1',
  steps: [
    {
      id: 'step-1',
      index: 0,
      keyword: 'wait',
      description: 'Bad wait',
      status: 'failed',
      started_at: '2026-06-01T00:00:01+00:00',
      finished_at: '2026-06-01T00:00:02+00:00',
      duration_ms: 1000,
      input: { seconds: -1 },
      output: {},
      error_message: 'wait.seconds must be greater than or equal to 0',
      error_detail: '',
      attachments: ['data/reports/exec-1/failure.txt'],
    },
  ],
  logs: [
    {
      timestamp: '2026-06-01T00:00:01+00:00',
      level: 'error',
      message: 'wait.seconds must be greater than or equal to 0',
      step_id: 'step-1',
    },
  ],
  error_message: '',
}

describe('Report pages', () => {
  beforeEach(() => {
    apiMock.listReports.mockResolvedValue({
      items: [
        {
          id: 'exec-1',
          script_id: 'smoke-cockpit',
          script_name: '座舱冒烟测试',
          script_revision: 1,
          status: 'failed',
          environment: 'local',
          target_device: 'bench-1',
          executor: 'alice',
          created_at: '2026-06-01T00:00:00+00:00',
          started_at: '2026-06-01T00:00:01+00:00',
          finished_at: '2026-06-01T00:00:02+00:00',
          duration_ms: 1000,
          step_count: 1,
          passed_step_count: 0,
          failed_step_count: 1,
        },
      ],
    })
    apiMock.getReport.mockResolvedValue({
      task: reportTask,
      attachments: [
        {
          path: 'data/reports/exec-1/failure.txt',
          name: 'failure.txt',
          step_id: 'step-1',
        },
      ],
      raw_framework_report: null,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('lists recent reports', async () => {
    renderWithProviders(<ReportListPage />)

    expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查看报告' })).toHaveAttribute(
      'href',
      '/reports/exec-1',
    )
  })

  it('shows report summary, failed step, logs, and attachments', async () => {
    render(
      <MemoryRouter initialEntries={['/reports/exec-1']}>
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: { queries: { retry: false } },
            })
          }
        >
          <Routes>
            <Route path="/reports/:taskId" element={<ReportDetailPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()
    expect(screen.getByText('wait.seconds must be greater than or equal to 0')).toBeInTheDocument()
    expect(screen.getByText('failure.txt')).toBeInTheDocument()
  })
})
