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
  fetcher?: typeof fetch
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
  fetcher = fetch,
}: ApiClientOptions) {
  async function request<T>(path: string): Promise<T> {
    const response = await fetcher(`${baseUrl}${path}`, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new ApiError(await readErrorMessage(response), response.status)
    }

    return (await response.json()) as T
  }

  return {
    getHealth: () => request<HealthResponse>('/health'),
    listItems: <T = unknown>(path: string) => request<ItemList<T>>(path),
  }
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: unknown }
    if (typeof payload.detail === 'string') {
      return payload.detail
    }
  } catch {
    // Fall through to the status text when the backend did not return JSON.
  }

  return response.statusText || `Request failed with ${response.status}`
}
