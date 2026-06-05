import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
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

    expect(await screen.findByRole('table', { name: '脚本列表' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '脚本' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '状态' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '操作' })).toBeInTheDocument()

    expect(await screen.findByLabelText('搜索脚本')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: '脚本列表' })).toBeInTheDocument()

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
