import type { ApiRequestClient } from './client'
import type { KeywordParameter } from './keywords'
import type { ItemList } from './types'

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

export function createScriptsApi(client: ApiRequestClient) {
  return {
    listScripts: () => client.get<ItemList<ScriptSummary>>('/api/scripts'),
    getScript: (scriptId: string) =>
      client.get<TestScript>(`/api/scripts/${scriptId}`),
    saveScript: (script: TestScript) =>
      client.post<TestScript, TestScript>('/api/scripts', script),
    deleteScript: (scriptId: string) =>
      client.remove(`/api/scripts/${scriptId}`),
  }
}
