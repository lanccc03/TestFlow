import type { ApiRequestClient } from './client'
import type { ItemList } from './types'

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

export function createKeywordsApi(client: ApiRequestClient) {
  return {
    listKeywords: () => client.get<ItemList<KeywordMetadata>>('/api/keywords'),
  }
}
