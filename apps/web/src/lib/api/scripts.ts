import type { ApiRequestClient } from './client'
import type { ItemList } from './types'

export type ScriptSummary = {
  id: string
  name: string
  description: string
  steps: string[]
}

export type TestScript = ScriptSummary

export function createScriptsApi(client: ApiRequestClient) {
  return {
    listScripts: () => client.get<ItemList<ScriptSummary>>('/api/scripts'),
    getScript: (scriptId: string) =>
      client.get<TestScript>(`/api/scripts/${scriptId}`),
  }
}
