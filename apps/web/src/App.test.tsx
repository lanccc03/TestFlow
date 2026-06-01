/// <reference types="node" />

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'

const httpGet = vi.hoisted(() => vi.fn())
const httpPost = vi.hoisted(() => vi.fn())
const httpDelete = vi.hoisted(() => vi.fn())

vi.mock('axios', () => ({
  default: {
    create: () => ({
      delete: httpDelete,
      get: httpGet,
      post: httpPost,
    }),
    isAxiosError: (error: unknown) =>
      Boolean(
        error &&
          typeof error === 'object' &&
          'isAxiosError' in error &&
          error.isAxiosError,
      ),
  },
}))

import App from './App'

function renderApp(initialEntries = ['/scripts']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'WebSocket',
      class FakeWebSocket {
        onclose: ((event: CloseEvent) => void) | null = null
        onerror: ((event: Event) => void) | null = null
        onmessage: ((event: MessageEvent<string>) => void) | null = null
        onopen: ((event: Event) => void) | null = null

        close() {
          this.onclose?.(new Event('close') as CloseEvent)
        }
      },
    )
    httpGet.mockImplementation((path: string) => {
      if (path === '/health') {
        return Promise.resolve({
          data: {
            data_dir: '/tmp/testflow',
            service: 'testflow-backend',
            status: 'ok',
            version: '0.1.0',
          },
        })
      }

      if (path === '/api/scripts') {
        return Promise.resolve({
          data: {
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
          },
        })
      }

      if (path === '/api/scripts/smoke-cockpit') {
        return Promise.resolve({
          data: {
            id: 'smoke-cockpit',
            name: '座舱冒烟测试',
            description: '基础稳定性巡检',
            status: 'published',
            tags: ['smoke', 'cockpit'],
            group: 'stability',
            variables: [],
            steps: [
              {
                id: 'step-1',
                keyword: 'wait',
                description: '等待系统稳定',
                enabled: true,
                params: { seconds: 3 },
              },
            ],
            version: {
              revision: 1,
              updated_at: '2026-05-31T12:00:00+00:00',
            },
          },
        })
      }

      if (path === '/api/keywords') {
        return Promise.resolve({
          data: {
            items: [
              {
                name: 'wait',
                description: '等待指定秒数',
                module: 'flow',
                parameters: [
                  {
                    name: 'seconds',
                    description: '等待时长，单位秒',
                    type: 'integer',
                    default: 1,
                    required: true,
                    example: 5,
                  },
                ],
                example: { seconds: 5 },
                enabled: true,
              },
            ],
          },
        })
      }

      return Promise.reject(new Error(`Unexpected path: ${path}`))
    })
    httpPost.mockImplementation((_path: string, payload: unknown) =>
      Promise.resolve({
        data: {
          ...(payload as object),
          version: {
            revision: 1,
            updated_at: '2026-05-31T12:00:00+00:00',
          },
        },
      }),
    )
    httpDelete.mockResolvedValue({ data: undefined })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    httpGet.mockReset()
    httpPost.mockReset()
    httpDelete.mockReset()
  })

  it('renders the phase three application shell', () => {
    renderApp()

    expect(
      screen.getByRole('heading', { name: '脚本管理' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /脚本管理/ })).toBeInTheDocument()
    expect(screen.getByLabelText('系统状态')).toHaveTextContent('后端服务')
    expect(screen.getByLabelText('系统状态')).toHaveTextContent('WebSocket')
    expect(screen.queryByLabelText('运行状态')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('renders scripts and keyword metadata from the backend', async () => {
    renderApp()

    expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()
    expect(screen.getByText('基础稳定性巡检')).toBeInTheDocument()
    expect(screen.getByText('wait')).toBeInTheDocument()
    expect(screen.getByText('等待指定秒数')).toBeInTheDocument()
  })

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

  it('filters scripts and deletes a listed script', async () => {
    renderApp()

    expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('搜索脚本'), {
      target: { value: '不存在' },
    })
    expect(screen.getByText('没有匹配的脚本')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('搜索脚本'), {
      target: { value: '座舱' },
    })
    fireEvent.change(screen.getByLabelText('状态筛选'), {
      target: { value: 'published' },
    })
    fireEvent.change(screen.getByLabelText('分组筛选'), {
      target: { value: 'stability' },
    })
    expect(screen.getByText('座舱冒烟测试')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '删除 座舱冒烟测试' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除 座舱冒烟测试' }))

    await waitFor(() =>
      expect(httpDelete).toHaveBeenCalledWith('/api/scripts/smoke-cockpit'),
    )
  })

  it('saves a draft script with a generated keyword step', async () => {
    renderApp(['/scripts/new'])

    expect(await screen.findByRole('heading', { name: '脚本编辑器' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('脚本 ID'), {
      target: { value: 'draft-smoke' },
    })
    fireEvent.change(screen.getByLabelText('脚本名称'), {
      target: { value: '草稿冒烟测试' },
    })
    fireEvent.change(screen.getByLabelText('分组'), {
      target: { value: 'stability' },
    })
    fireEvent.change(screen.getByLabelText('标签'), {
      target: { value: 'smoke, cockpit' },
    })
    fireEvent.click(screen.getByRole('button', { name: '添加步骤' }))
    fireEvent.change(screen.getByLabelText('关键字'), {
      target: { value: 'wait' },
    })
    fireEvent.change(screen.getByLabelText('参数 seconds'), {
      target: { value: '5' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))

    await waitFor(() =>
      expect(httpPost).toHaveBeenCalledWith('/api/scripts', {
        id: 'draft-smoke',
        name: '草稿冒烟测试',
        description: '',
        status: 'draft',
        tags: ['smoke', 'cockpit'],
        group: 'stability',
        variables: [],
        steps: [
          expect.objectContaining({
            keyword: 'wait',
            params: { seconds: 5 },
          }),
        ],
      }),
    )
  })

  it('blocks publishing when required keyword parameters are missing', async () => {
    renderApp(['/scripts/new'])

    expect(await screen.findByRole('heading', { name: '脚本编辑器' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('脚本 ID'), {
      target: { value: 'missing-param' },
    })
    fireEvent.change(screen.getByLabelText('脚本名称'), {
      target: { value: '缺少参数' },
    })
    fireEvent.click(screen.getByRole('button', { name: '添加步骤' }))
    fireEvent.change(screen.getByLabelText('关键字'), {
      target: { value: 'wait' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发布' }))

    expect(await screen.findByText('步骤 1 参数 seconds：Missing required parameter')).toBeInTheDocument()
    expect(httpPost).not.toHaveBeenCalled()
  })
})
