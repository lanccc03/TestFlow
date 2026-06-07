import type { AxiosInstance } from 'axios'

import {
  createDefaultHttpClient,
  createRequestClient,
  type ApiRequestClient,
} from './client'
import { createCommandsApi } from './commands'
import { createExecutionsApi } from './executions'
import { createFrameworkApi } from './framework'
import { createHealthApi } from './health'
import { createKeywordsApi } from './keywords'
import { createReportsApi } from './reports'
import { createScpApi } from './scp'
import { createScriptsApi } from './scripts'
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
    ...createKeywordsApi(client),
    ...createScriptsApi(client),
    ...createCommandsApi(client),
    ...createExecutionsApi(client),
    ...createReportsApi(client),
    ...createScpApi(client),
    listItems: <T = unknown>(path: string) => client.get<ItemList<T>>(path),
  }
}

export type { ApiRequestClient }
export { ApiError, compactParams, createRequestClient } from './client'
export type { CommandTemplate, CommandTemplatePayload } from './commands'
export type {
  ConnectionExecutionEvent,
  ExecutionEventMessage,
  ExecutionFrameworkReport,
  ExecutionLogEntry,
  ExecutionStepResult,
  ExecutionTask,
  ExecutionTaskCreate,
  ExecutionTaskFilters,
  ExecutionTaskSummary,
  ExecutionUpdateEvent,
  StepStatus,
  TaskStatus,
} from './executions'
export type { HealthResponse } from './health'
export type { KeywordMetadata, KeywordParameter } from './keywords'
export type { ExecutionReport, ExecutionReportAttachment } from './reports'
export type {
  ScpFileNode,
  ScpFileTree,
  ScpTransferEvent,
  ScpTransferPayload,
  ScpTransferTask,
} from './scp'
export type {
  ScriptStep,
  ScriptSummary,
  ScriptVariable,
  TestScript,
} from './scripts'
export type { ItemList, JsonValue } from './types'
export { frameworkReportUrl } from './urls'
