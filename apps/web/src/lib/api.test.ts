import { describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'

import { ApiError, createApiClient } from './api'

describe('createApiClient', () => {
  it('returns health data from the backend', async () => {
    const httpClient = {
      get: vi.fn().mockResolvedValue({
        data: {
          data_dir: '/tmp/testflow',
          service: 'testflow-backend',
          status: 'ok',
          version: '0.1.0',
        },
      }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.getHealth()).resolves.toMatchObject({
      service: 'testflow-backend',
      status: 'ok',
    })
    expect(httpClient.get).toHaveBeenCalledWith('/health')
  })

  it('returns keyword metadata from the backend', async () => {
    const httpClient = {
      get: vi.fn().mockResolvedValue({
        data: {
          items: [
            {
              name: 'wait',
              description: '等待指定秒数',
              module: 'flow',
              parameters: [],
              example: {},
              enabled: true,
            },
          ],
        },
      }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.listKeywords()).resolves.toEqual({
      items: [
        {
          name: 'wait',
          description: '等待指定秒数',
          module: 'flow',
          parameters: [],
          example: {},
          enabled: true,
        },
      ],
    })
    expect(httpClient.get).toHaveBeenCalledWith('/api/keywords')
  })

  it('returns script summaries from the backend', async () => {
    const httpClient = {
      get: vi.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'smoke-cockpit',
              name: '座舱冒烟测试',
              description: '基础稳定性巡检',
              step_count: 1,
              enabled_step_count: 1,
              revision: 2,
              updated_at: '2026-05-31T12:00:00+00:00',
            },
          ],
        },
      }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.listScripts()).resolves.toMatchObject({
      items: [
        {
          id: 'smoke-cockpit',
          name: '座舱冒烟测试',
          revision: 2,
        },
      ],
    })
    expect(httpClient.get).toHaveBeenCalledWith('/api/scripts')
  })

  it('normalizes axios failed responses into ApiError', async () => {
    const httpClient = {
      get: vi.fn().mockRejectedValue({
        isAxiosError: true,
        response: {
          data: { detail: 'No route' },
          status: 404,
          statusText: 'Not Found',
        },
      }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.listItems('/api/scripts')).rejects.toMatchObject({
      message: 'No route',
      status: 404,
    })
    await expect(api.listItems('/api/scripts')).rejects.toBeInstanceOf(ApiError)
  })

  it('normalizes common backend error responses into ApiError', async () => {
    const httpClient = {
      get: vi.fn().mockRejectedValue({
        isAxiosError: true,
        response: {
          data: {
            error: {
              code: 'script_validation_error',
              message: 'Script validation failed',
              details: [],
            },
          },
          status: 422,
          statusText: 'Unprocessable Entity',
        },
      }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.listScripts()).rejects.toMatchObject({
      message: 'Script validation failed',
      status: 422,
    })
  })
})
