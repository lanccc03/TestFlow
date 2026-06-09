import { compactParams, type ApiRequestClient } from './client'
import type {
  ExecutionTask,
  ExecutionTaskFilters,
  ExecutionTaskSummary,
} from './executions'
import type { ItemList } from './types'

export function createReportsApi(client: ApiRequestClient) {
  return {
    listReports: (filters: ExecutionTaskFilters = {}) =>
      client.get<ItemList<ExecutionTaskSummary>>('/api/reports', {
        params: compactParams(filters),
      }),
    getReport: (taskId: string) =>
      client.get<ExecutionTask>(`/api/reports/${taskId}`),
  }
}
