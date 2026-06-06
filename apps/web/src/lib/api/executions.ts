import { compactParams, type ApiRequestClient } from './client'
import type { ItemList } from './types'

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'canceled'
  | 'error'

export type StepStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'canceled'
  | 'error'
  | 'skipped'

export type ExecutionTaskCreate = {
  script_id: string
  environment?: string
  target_device?: string
  variables?: Record<string, unknown>
  executor?: string
}

export type ExecutionLogEntry = {
  timestamp: string
  level: string
  message: string
  step_id: string | null
}

export type ExecutionStepResult = {
  id: string
  index: number
  keyword: string
  description: string
  status: StepStatus
  started_at: string | null
  finished_at: string | null
  duration_ms: number | null
  input: Record<string, unknown>
  output: Record<string, unknown>
  error_message: string
  error_detail: string
  attachments: string[]
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
  script_id: string
  script_name: string
  script_revision: number
  status: TaskStatus
  environment: string
  target_device: string
  variables: Record<string, unknown>
  executor: string
  created_at: string
  started_at: string | null
  finished_at: string | null
  duration_ms: number | null
  log_path: string
  report_dir: string
  framework_report?: ExecutionFrameworkReport | null
  steps: ExecutionStepResult[]
  logs: ExecutionLogEntry[]
  error_message: string
}

export type ExecutionTaskSummary = {
  id: string
  script_id: string
  script_name: string
  script_revision: number
  status: TaskStatus
  environment: string
  target_device: string
  executor: string
  created_at: string
  started_at: string | null
  finished_at: string | null
  duration_ms: number | null
  step_count: number
  passed_step_count: number
  failed_step_count: number
}

export type ExecutionTaskFilters = {
  script_id?: string
  status?: TaskStatus
  created_from?: string
  created_to?: string
  executor?: string
}

export type ExecutionUpdateEvent = {
  type: 'task_status' | 'step_status' | 'log' | 'task_finished'
  task_id?: string
  status?: TaskStatus | StepStatus | null
  step_id?: string | null
  message?: string
  level?: string
  timestamp?: string
  task?: ExecutionTask | null
  step?: ExecutionStepResult | null
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
