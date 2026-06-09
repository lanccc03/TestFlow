import type { ApiRequestClient } from './client'
import type { ItemList } from './types'

export type CaseSummary = {
  id: string
  name: string
  description: string
  test_steps: string[]
}

export function createCasesApi(client: ApiRequestClient) {
  return {
    listCases: () => client.get<ItemList<CaseSummary>>('/api/cases'),
    getCase: (caseId: string) =>
      client.get<CaseSummary>(`/api/cases/${caseId}`),
  }
}
