import type { ApiRequestClient } from './client'

export type HealthResponse = {
  data_dir: string
  service: string
  status: string
  version: string
}

export function createHealthApi(client: ApiRequestClient) {
  return {
    getHealth: () => client.get<HealthResponse>('/health'),
  }
}
