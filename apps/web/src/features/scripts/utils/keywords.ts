import type { KeywordMetadata } from '@/lib/api'

export function groupKeywords(keywords: KeywordMetadata[]) {
  const groups = new Map<string, KeywordMetadata[]>()
  keywords.forEach((keyword) => {
    const items = groups.get(keyword.module) ?? []
    items.push(keyword)
    groups.set(keyword.module, items)
  })
  return Array.from(groups.entries())
}
