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

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
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
              },
            ],
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
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    httpGet.mockReset()
  })

  it('renders the phase three application shell', () => {
    renderApp()

    expect(
      screen.getByRole('heading', { name: '脚本管理' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /脚本管理/ })).toBeInTheDocument()
    expect(screen.getAllByText('后端服务')).toHaveLength(2)
    expect(screen.getAllByText('WebSocket')).toHaveLength(2)
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('renders scripts and keyword metadata from the backend', async () => {
    renderApp()

    expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()
    expect(screen.getByText('基础稳定性巡检')).toBeInTheDocument()
    expect(screen.getByText('wait')).toBeInTheDocument()
    expect(screen.getByText('等待指定秒数')).toBeInTheDocument()
  })
})
