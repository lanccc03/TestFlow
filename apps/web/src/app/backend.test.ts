import { describe, expect, it, vi } from 'vitest'

const webSocketClientMock = vi.hoisted(() => ({ connect: vi.fn() }))
const createWebSocketClientMock = vi.hoisted(() => vi.fn(() => webSocketClientMock))

vi.mock('@/lib/websocket', () => ({
  createWebSocketClient: createWebSocketClientMock,
}))

describe('backend facade', () => {
  it('creates websocket clients from the configured backend origin', async () => {
    const { createBackendStatusSocket, createExecutionSocket } = await import('./backend')

    expect(createBackendStatusSocket()).toBe(webSocketClientMock)
    expect(createExecutionSocket()).toBe(webSocketClientMock)
    expect(createWebSocketClientMock).toHaveBeenNthCalledWith(1, {
      url: 'ws://127.0.0.1:8000/ws',
    })
    expect(createWebSocketClientMock).toHaveBeenNthCalledWith(2, {
      url: 'ws://127.0.0.1:8000/ws/executions',
    })
  })

  it('exposes backend URLs without page-level base URL imports', async () => {
    const { backendUrls } = await import('./backend')

    expect(backendUrls.health).toBe('http://127.0.0.1:8000/health')
    expect(backendUrls.frameworkReport('task 1')).toBe(
      'http://127.0.0.1:8000/api/reports/task%201/framework-report',
    )
  })
})
