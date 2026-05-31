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
  variables: ScriptVariable[]
  steps: ScriptStep[]
  version?: {
    revision: number
    updated_at: string
  }
}

type ApiClientOptions = {
  baseUrl: string
  httpClient?: AxiosInstance
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
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
  async function request<T>(path: string): Promise<T> {
    try {
      const response = await httpClient.get<T>(path)
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

  return {
    getHealth: () => request<HealthResponse>('/health'),
    listKeywords: () => request<ItemList<KeywordMetadata>>('/api/keywords'),
    listScripts: () => request<ItemList<ScriptSummary>>('/api/scripts'),
    saveScript: (script: TestScript) =>
      post<TestScript, TestScript>('/api/scripts', script),
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
    )
  }

  return error
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
