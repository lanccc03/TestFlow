import { compactParams, type ApiRequestClient } from './client'
import type { ItemList } from './types'

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'canceled'
  | 'error'

export type ExecutionTaskCreate = {
  case_id: string
}

export type ExecutionLogEntry = {
  timestamp: string
  level: string
  message: string
}

export type ExecutionFrameworkReport = {
  kind: 'html'
  title: string
  source: 'file' | 'url'
  entry: string
  root_dir: string
}

export type ExecutionTask = {
  id: string
  case_id: string
  case_name: string
  case_revision: number
  status: TaskStatus
  created_at: string
  started_at: string | null
  finished_at: string | null
  duration_ms: number | null
  log_path: string
  report_dir: string
  framework_report?: ExecutionFrameworkReport | null
  logs: ExecutionLogEntry[]
  error_message: string
}

export type ExecutionTaskSummary = {
  id: string
  case_id: string
  case_name: string
  case_revision: number
  status: TaskStatus
  created_at: string
  started_at: string | null
  finished_at: string | null
  duration_ms: number | null
}

export type ExecutionTaskFilters = {
  case_id?: string
  status?: TaskStatus
  created_from?: string
  created_to?: string
}

export type ExecutionUpdateEvent = {
  type: 'task_status' | 'task_finished'
  task_id?: string
  status?: TaskStatus | null
  message?: string
  level?: string
  timestamp?: string
  task?: ExecutionTask | null
}

export type ConnectionExecutionEvent = {
  type: 'connection'
  status: 'connected'
}

export type ExecutionEventMessage =
  | ExecutionUpdateEvent
  | ConnectionExecutionEvent

export function createExecutionsApi(client: ApiRequestClient) {
  return {
    listTasks: (filters: ExecutionTaskFilters = {}) =>
      client.get<ItemList<ExecutionTaskSummary>>('/api/tasks', {
        params: compactParams(filters),
      }),
    getTask: (taskId: string) =>
      client.get<ExecutionTask>(`/api/tasks/${taskId}`),
    createTask: (task: ExecutionTaskCreate) =>
      client.post<ExecutionTask, ExecutionTaskCreate>('/api/tasks', task),
    cancelTask: (taskId: string) =>
      client.postEmpty<ExecutionTask>(`/api/tasks/${taskId}/cancel`),
  }
}
