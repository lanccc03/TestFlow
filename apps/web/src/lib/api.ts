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

  return {
    getHealth: () => request<HealthResponse>('/health'),
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
    'detail' in data &&
    typeof data.detail === 'string'
  ) {
    return data.detail
  }

  return undefined
}
