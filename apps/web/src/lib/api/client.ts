import axios, { type AxiosInstance } from 'axios'

type RequestConfig = Parameters<AxiosInstance['get']>[1]

export type ApiRequestClient = {
  get<T>(path: string, config?: RequestConfig): Promise<T>
  post<TResponse, TPayload>(
    path: string,
    payload: TPayload,
  ): Promise<TResponse>
  postEmpty<TResponse>(path: string): Promise<TResponse>
  put<TResponse, TPayload>(path: string, payload: TPayload): Promise<TResponse>
  remove(path: string): Promise<void>
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

export function createDefaultHttpClient(baseUrl: string) {
  return axios.create({
    baseURL: baseUrl,
    headers: {
      Accept: 'application/json',
    },
  })
}

export function createRequestClient(
  httpClient: AxiosInstance,
): ApiRequestClient {
  return {
    async get<T>(path: string, config?: RequestConfig) {
      try {
        const response = config
          ? await httpClient.get<T>(path, config)
          : await httpClient.get<T>(path)
        return response.data
      } catch (error) {
        throw normalizeApiError(error)
      }
    },
    async post<TResponse, TPayload>(path: string, payload: TPayload) {
      try {
        const response = await httpClient.post<TResponse>(path, payload)
        return response.data
      } catch (error) {
        throw normalizeApiError(error)
      }
    },
    async postEmpty<TResponse>(path: string) {
      try {
        const response = await httpClient.post<TResponse>(path, {})
        return response.data
      } catch (error) {
        throw normalizeApiError(error)
      }
    },
    async put<TResponse, TPayload>(path: string, payload: TPayload) {
      try {
        const response = await httpClient.put<TResponse>(path, payload)
        return response.data
      } catch (error) {
        throw normalizeApiError(error)
      }
    },
    async remove(path: string) {
      try {
        await httpClient.delete(path)
      } catch (error) {
        throw normalizeApiError(error)
      }
    },
  }
}

export function compactParams<T extends Record<string, unknown>>(params: T) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value != null),
  )
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
