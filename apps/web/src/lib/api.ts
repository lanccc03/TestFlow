import axios, { type AxiosInstance } from 'axios'

export type HealthResponse = {
  data_dir: string
  service: string
  status: string
  version: string
}

export type ItemList<T = unknown> = {
  items: T[]
}

export type KeywordParameter = {
  name: string
  description: string
  type: 'array' | 'boolean' | 'integer' | 'number' | 'object' | 'string'
  default: unknown
  required: boolean
  example: unknown
}

export type KeywordMetadata = {
  name: string
  description: string
  module: string
  parameters: KeywordParameter[]
  example: Record<string, unknown>
  enabled: boolean
}

export type ScriptSummary = {
  id: string
  name: string
  description: string
  step_count: number
  enabled_step_count: number
  revision: number
  updated_at: string
  status: 'draft' | 'published'
  tags: string[]
  group: string
}

export type ScriptVariable = {
  name: string
  description: string
  type: KeywordParameter['type']
  default: unknown
  required: boolean
}

export type ScriptStep = {
  id: string
  keyword: string
  params: Record<string, unknown>
  description: string
  enabled: boolean
}

export type TestScript = {
  schema_version?: number
  id: string
  name: string
  description: string
  status: 'draft' | 'published'
  tags: string[]
  group: string
  variables: ScriptVariable[]
  steps: ScriptStep[]
  version?: {
    revision: number
    updated_at: string
  }
}

export type CommandTemplatePayload = {
  name: string
  command: string
  description: string
  group: string
  tags: string[]
}

export type CommandTemplate = CommandTemplatePayload & {
  id: string
  created_at: string
  updated_at: string
}

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

type ApiClientOptions = {
  baseUrl: string
  httpClient?: AxiosInstance
}

export class ApiError extends Error {
  readonly details: unknown
  readonly status: number

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.details = details
    this.status = status
  }
}

export function createApiClient({
  baseUrl,
  httpClient = axios.create({
    baseURL: baseUrl,
    headers: {
      Accept: 'application/json',
    },
  }),
}: ApiClientOptions) {
  async function request<T>(
    path: string,
    config?: Parameters<AxiosInstance['get']>[1],
  ): Promise<T> {
    try {
      const response = config
        ? await httpClient.get<T>(path, config)
        : await httpClient.get<T>(path)
      return response.data
    } catch (error) {
      throw normalizeApiError(error)
    }
  }

  async function post<TResponse, TPayload>(
    path: string,
    payload: TPayload,
  ): Promise<TResponse> {
    try {
      const response = await httpClient.post<TResponse>(path, payload)
      return response.data
    } catch (error) {
      throw normalizeApiError(error)
    }
  }

  async function postEmpty<TResponse>(path: string): Promise<TResponse> {
    try {
      const response = await httpClient.post<TResponse>(path, {})
      return response.data
    } catch (error) {
      throw normalizeApiError(error)
    }
  }

  async function put<TResponse, TPayload>(
    path: string,
    payload: TPayload,
  ): Promise<TResponse> {
    try {
      const response = await httpClient.put<TResponse>(path, payload)
      return response.data
    } catch (error) {
      throw normalizeApiError(error)
    }
  }

  async function remove(path: string): Promise<void> {
    try {
      await httpClient.delete(path)
    } catch (error) {
      throw normalizeApiError(error)
    }
  }

  return {
    getHealth: () => request<HealthResponse>('/health'),
    listKeywords: () => request<ItemList<KeywordMetadata>>('/api/keywords'),
    listScripts: () => request<ItemList<ScriptSummary>>('/api/scripts'),
    getScript: (scriptId: string) =>
      request<TestScript>(`/api/scripts/${scriptId}`),
    saveScript: (script: TestScript) =>
      post<TestScript, TestScript>('/api/scripts', script),
    deleteScript: (scriptId: string) => remove(`/api/scripts/${scriptId}`),
    listCommands: (search = '') =>
      request<ItemList<CommandTemplate>>('/api/commands', {
        params: { search },
      }),
    createCommand: (command: CommandTemplatePayload) =>
      post<CommandTemplate, CommandTemplatePayload>('/api/commands', command),
    updateCommand: (commandId: string, command: CommandTemplatePayload) =>
      put<CommandTemplate, CommandTemplatePayload>(
        `/api/commands/${commandId}`,
        command,
      ),
    deleteCommand: (commandId: string) =>
      remove(`/api/commands/${commandId}`),
    listTasks: () => request<ItemList<ExecutionTaskSummary>>('/api/tasks'),
    getTask: (taskId: string) =>
      request<ExecutionTask>(`/api/tasks/${taskId}`),
    createTask: (task: ExecutionTaskCreate) =>
      post<ExecutionTask, ExecutionTaskCreate>('/api/tasks', task),
    cancelTask: (taskId: string) =>
      postEmpty<ExecutionTask>(`/api/tasks/${taskId}/cancel`),
    listItems: <T = unknown>(path: string) => request<ItemList<T>>(path),
  }
}

function normalizeApiError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0
    const message = readAxiosErrorMessage(error.response?.data)

    return new ApiError(
      message ?? error.response?.statusText ?? error.message,
      status,
      readAxiosErrorDetails(error.response?.data),
    )
  }

  return error
}

function readAxiosErrorDetails(data: unknown) {
  if (
    data &&
    typeof data === 'object' &&
    'error' in data &&
    data.error &&
    typeof data.error === 'object' &&
    'details' in data.error
  ) {
    return data.error.details
  }

  return undefined
}

function readAxiosErrorMessage(data: unknown) {
  if (
    data &&
    typeof data === 'object' &&
    'error' in data &&
    data.error &&
    typeof data.error === 'object' &&
    'message' in data.error &&
    typeof data.error.message === 'string'
  ) {
    return data.error.message
  }

  if (
    data &&
    typeof data === 'object' &&
    'detail' in data &&
    typeof data.detail === 'string'
  ) {
    return data.detail
  }

  return undefined
}
