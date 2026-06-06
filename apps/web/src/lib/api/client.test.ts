import { describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'

import { ApiError, createRequestClient } from './client'

describe('createRequestClient', () => {
  it('normalizes common backend error responses into ApiError', async () => {
    const httpClient = {
      get: vi.fn().mockRejectedValue({
        isAxiosError: true,
        response: {
          data: {
            error: {
              code: 'script_validation_error',
              message: 'Script validation failed',
              details: [{ field: 'id', message: 'Required' }],
            },
          },
          status: 422,
          statusText: 'Unprocessable Entity',
        },
      }),
    } as unknown as AxiosInstance
    const client = createRequestClient(httpClient)

    await expect(client.get('/api/scripts')).rejects.toMatchObject({
      details: [{ field: 'id', message: 'Required' }],
      message: 'Script validation failed',
      status: 422,
    })
    await expect(client.get('/api/scripts')).rejects.toBeInstanceOf(ApiError)
  })
})
