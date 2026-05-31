import { describe, expect, it, vi } from 'vitest'

import { ApiError, createApiClient } from './api'

describe('createApiClient', () => {
  it('returns health data from the backend', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data_dir: '/tmp/testflow',
          service: 'testflow-backend',
          status: 'ok',
          version: '0.1.0',
        }),
      ),
    )
    const api = createApiClient({ baseUrl: 'http://backend.test', fetcher })

    await expect(api.getHealth()).resolves.toMatchObject({
      service: 'testflow-backend',
      status: 'ok',
    })
    expect(fetcher).toHaveBeenCalledWith('http://backend.test/health', {
      headers: { Accept: 'application/json' },
    })
  })

  it('normalizes failed responses into ApiError', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ detail: 'No route' }), { status: 404 }),
      )
    const api = createApiClient({ baseUrl: 'http://backend.test', fetcher })

    await expect(api.listItems('/api/scripts')).rejects.toMatchObject({
      message: 'No route',
      status: 404,
    })
    await expect(api.listItems('/api/scripts')).rejects.toBeInstanceOf(ApiError)
  })
})
