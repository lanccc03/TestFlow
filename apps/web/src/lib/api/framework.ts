import type { ApiRequestClient } from './client'
import type { JsonValue } from './types'

export function createFrameworkApi(client: ApiRequestClient) {
  return {
    getFrameworkConfig: () => client.get<JsonValue>('/api/framework/config'),
    updateFrameworkConfig: (config: JsonValue) =>
      client.put<JsonValue, JsonValue>('/api/framework/config', config),
  }
}
