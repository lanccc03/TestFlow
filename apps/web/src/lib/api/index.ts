import type { AxiosInstance } from 'axios'

import {
  createDefaultHttpClient,
  createRequestClient,
  type ApiRequestClient,
} from './client'
import { createCasesApi } from './cases'
import { createCommandsApi } from './commands'
import { createExecutionsApi } from './executions'
import { createFrameworkApi } from './framework'
import { createHealthApi } from './health'
import { createReportsApi } from './reports'
import { createScpApi } from './scp'
import type { ItemList } from './types'

export type ApiClientOptions = {
  baseUrl: string
  httpClient?: AxiosInstance
}

export function createApiClient({
  baseUrl,
  httpClient = createDefaultHttpClient(baseUrl),
}: ApiClientOptions) {
  const client = createRequestClient(httpClient)

  return {
    ...createHealthApi(client),
    ...createFrameworkApi(client),
    ...createCasesApi(client),
    ...createCommandsApi(client),
    ...createExecutionsApi(client),
    ...createReportsApi(client),
    ...createScpApi(client),
    listItems: <T = unknown>(path: string) => client.get<ItemList<T>>(path),
  }
}

export type { ApiRequestClient }
export { ApiError, compactParams, createRequestClient } from './client'
export type { CaseSummary } from './cases'
export type { CommandTemplate, CommandTemplatePayload } from './commands'
export type {
  ConnectionExecutionEvent,
  ExecutionEventMessage,
  ExecutionFrameworkReport,
  ExecutionLogEntry,
  ExecutionTask,
  ExecutionTaskCreate,
  ExecutionTaskFilters,
  ExecutionTaskSummary,
  ExecutionUpdateEvent,
  TaskStatus,
} from './executions'
export type { HealthResponse } from './health'
export type {
  ScpFileNode,
  ScpFileTree,
  ScpTransferEvent,
  ScpTransferPayload,
  ScpTransferTask,
} from './scp'
export type { ItemList, JsonValue } from './types'
export { frameworkReportUrl } from './urls'
