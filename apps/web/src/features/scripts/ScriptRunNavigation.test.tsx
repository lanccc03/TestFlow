import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({
  createTask: vi.fn(),
  listCases: vi.fn(),
}))

vi.mock('@/app/backend', () => ({
  api: apiMock,
}))

import { ScriptListPage } from '@/features/scripts'

const caseSummary = {
  id: 'case.smoke_cockpit',
  name: '座舱冒烟测试',
  description: '基础稳定性巡检',
  tag: 'smoke',
  test_steps: [
    '启动系统',
    '确认首页加载并检查关键状态正常',
    '采集运行状态',
  ],
}

function LocationProbe() {
  const location = useLocation()
  return <div aria-label="location">{location.pathname}{location.search}</div>
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
          <Route path="/tasks" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('script run navigation', () => {
  beforeEach(() => {
    apiMock.createTask.mockResolvedValue({ id: 'exec-123' })
    apiMock.listCases.mockResolvedValue({ items: [caseSummary] })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('navigates from framework case catalog run action to tasks with taskId', async () => {
    renderWithQuery(<ScriptListPage />, ['/scripts'])

    expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: '用例列表' })).toBeInTheDocument()
    expect(screen.getByText('基础稳定性巡检')).toBeInTheDocument()
    expect(screen.getByText('smoke')).toBeInTheDocument()
    expect(screen.getByText('启动系统')).toBeInTheDocument()
    expect(screen.queryByText('确认首页加载并检查关键状态正常')).not.toBeInTheDocument()
    expect(screen.getByText('共 3 步')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看 座舱冒烟测试 的全部测试步骤' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /新建脚本/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /删除/ })).not.toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: '运行 座舱冒烟测试' }))

    await waitFor(() =>
      expect(apiMock.createTask).toHaveBeenCalledWith({
        case_id: 'case.smoke_cockpit',
      }),
    )
    expect(await screen.findByLabelText('location')).toHaveTextContent('/tasks?taskId=exec-123')
  })

  it('shows only the first test step until the row is expanded', async () => {
    renderWithQuery(<ScriptListPage />, ['/scripts'])

    expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()
    expect(screen.getByText('启动系统')).toBeInTheDocument()
    expect(screen.queryByText('确认首页加载并检查关键状态正常')).not.toBeInTheDocument()
    expect(screen.queryByText('采集运行状态')).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: '查看 座舱冒烟测试 的全部测试步骤' }),
    )

    expect(screen.getByText('确认首页加载并检查关键状态正常')).toBeInTheDocument()
    expect(screen.getByText('采集运行状态')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '收起 座舱冒烟测试 的测试步骤' })).toBeInTheDocument()
  })
})
