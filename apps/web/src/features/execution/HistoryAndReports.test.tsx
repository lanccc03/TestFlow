import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({
  getReport: vi.fn(),
  listCases: vi.fn(),
  listReports: vi.fn(),
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
    apiMock.listCases.mockResolvedValue({
      items: [
        {
          id: 'smoke-cockpit',
          name: '座舱冒烟测试',
          description: '基础稳定性巡检',
          test_steps: ['启动系统', '确认首页加载'],
        },
      ],
    })
    apiMock.listTasks.mockResolvedValue({
      items: [
        {
          id: 'exec-1',
          case_id: 'smoke-cockpit',
          case_name: '座舱冒烟测试',
          status: 'failed',
          created_at: '2026-06-01T00:00:00+00:00',
          started_at: '2026-06-01T00:00:01+00:00',
          finished_at: '2026-06-01T00:00:02+00:00',
          duration_ms: 1000,
        },
      ],
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  it('filters execution history and links to report details', async () => {
    renderWithProviders(<HistoryPage />)

    expect(await screen.findByLabelText('搜索执行历史')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: '任务记录' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '用例' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '耗时' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: '步骤' })).not.toBeInTheDocument()

    expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('搜索执行历史'), {
      target: { value: 'bob' },
    })
    expect(screen.getByText('暂无执行记录')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('搜索执行历史'), {
      target: { value: '座舱' },
    })
    expect(screen.getByText('座舱冒烟测试')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查看报告' })).toHaveAttribute(
      'href',
      '/reports/exec-1',
    )
  })
})

const reportTask = {
  id: 'exec-1',
  case_id: 'smoke-cockpit',
  case_name: '座舱冒烟测试',
  status: 'failed',
  created_at: '2026-06-01T00:00:00+00:00',
  started_at: '2026-06-01T00:00:01+00:00',
  finished_at: '2026-06-01T00:00:02+00:00',
  duration_ms: 1000,
  log_path: 'data/logs/executions/exec-1.log',
  report_dir: 'data/reports/exec-1',
  logs: [
    {
      timestamp: '2026-06-01T00:00:01+00:00',
      level: 'error',
      message: 'wait.seconds must be greater than or equal to 0',
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
          case_id: 'smoke-cockpit',
          case_name: '座舱冒烟测试',
          status: 'failed',
          created_at: '2026-06-01T00:00:00+00:00',
          started_at: '2026-06-01T00:00:01+00:00',
          finished_at: '2026-06-01T00:00:02+00:00',
          duration_ms: 1000,
        },
      ],
    })
    apiMock.getReport.mockResolvedValue(reportTask)
  })

  afterEach(() => {
    cleanup()
  })

  it('lists recent reports', async () => {
    renderWithProviders(<ReportListPage />)

    expect(await screen.findByRole('table', { name: '最近报告' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '用例' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '操作' })).toBeInTheDocument()
    expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查看报告' })).toHaveAttribute(
      'href',
      '/reports/exec-1',
    )
  })

  it('shows report summary and logs without step results or attachments', async () => {
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
    expect(screen.queryByText('目标设备:')).not.toBeInTheDocument()
    expect(screen.queryByText('执行人:')).not.toBeInTheDocument()
    expect(screen.getByText(/wait\.seconds must be greater than or equal to 0/)).toBeInTheDocument()
    expect(screen.queryByText('failure.txt')).not.toBeInTheDocument()
    expect(screen.queryByText('步骤结果')).not.toBeInTheDocument()
  })

  it('prefers the framework HTML report when one is available', async () => {
    apiMock.getReport.mockResolvedValue({
      ...reportTask,
      framework_report: {
        kind: 'html',
        title: '自动化框架报告',
        source: 'file',
        root_dir: 'C:/framework/reports/exec-1',
        entry: 'index.html',
      },
    })

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

    expect(await screen.findByText('自动化框架报告')).toBeInTheDocument()
    expect(screen.getByTitle('框架 HTML 报告')).toHaveAttribute(
      'src',
      'http://127.0.0.1:8000/api/reports/exec-1/framework-report',
    )
    expect(screen.getByRole('link', { name: '打开框架报告' })).toHaveAttribute(
      'href',
      'http://127.0.0.1:8000/api/reports/exec-1/framework-report',
    )
  })
})
