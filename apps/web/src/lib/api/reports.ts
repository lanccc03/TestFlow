import { compactParams, type ApiRequestClient } from './client'
import type {
  ExecutionFrameworkReport,
  ExecutionTask,
  ExecutionTaskFilters,
  ExecutionTaskSummary,
} from './executions'
import type { ItemList } from './types'

export type ExecutionReportAttachment = {
  path: string
  name: string
  step_id: string | null
}

export type ExecutionReport = {
  task: ExecutionTask
  attachments: ExecutionReportAttachment[]
  raw_framework_report: Record<string, unknown> | null
  framework_report?: ExecutionFrameworkReport | null
}

export function createReportsApi(client: ApiRequestClient) {
  return {
    listReports: (filters: ExecutionTaskFilters = {}) =>
      client.get<ItemList<ExecutionTaskSummary>>('/api/reports', {
        params: compactParams(filters),
      }),
    getReport: (taskId: string) =>
      client.get<ExecutionReport>(`/api/reports/${taskId}`),
  }
}
