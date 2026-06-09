/// <reference types="node" />

import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'

const httpGet = vi.hoisted(() => vi.fn())

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: httpGet,
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

function renderApp(initialEntries = ['/cases']) {
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

      if (path === '/api/cases') {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'case.smoke_cockpit',
                name: '座舱冒烟测试',
                description: '基础稳定性巡检',
                test_steps: ['启动系统', '确认首页加载', '检查关键状态正常'],
              },
            ],
          },
        })
      }

      return Promise.reject(new Error(`Unexpected path: ${path}`))
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    httpGet.mockReset()
  })

  it('renders the phase three application shell', () => {
    renderApp()

    expect(
      screen.getByRole('heading', { name: '框架用例库' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /框架用例库/ })).toBeInTheDocument()
    expect(screen.getByLabelText('系统状态')).toHaveTextContent('后端服务')
    expect(screen.getByLabelText('系统状态')).toHaveTextContent('WebSocket')
    expect(screen.queryByLabelText('运行状态')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('renders scripts from the backend', async () => {
    renderApp()

    expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()
    expect(screen.getByText('基础稳定性巡检')).toBeInTheDocument()
  })

  it('renders framework case catalog without script maintenance controls', async () => {
    renderApp()

    expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()
    expect(screen.getByText('基础稳定性巡检')).toBeInTheDocument()
    expect(screen.getByText('启动系统')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /新建脚本/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /删除/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /复制/ })).not.toBeInTheDocument()
  })
})
