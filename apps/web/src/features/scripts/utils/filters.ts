import type { ScriptSummary } from '@/lib/api'

export function filterScripts({
  groupFilter,
  scripts,
  search,
  statusFilter,
  tagFilter,
}: {
  groupFilter: string
  scripts: ScriptSummary[]
  search: string
  statusFilter: string
  tagFilter: string
}) {
  const query = search.trim().toLowerCase()
  return scripts.filter((script) => {
    const matchesSearch =
      !query ||
      [
        script.id,
        script.name,
        script.description,
        script.group,
        ...script.tags,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    const matchesStatus =
      statusFilter === 'all' || script.status === statusFilter
    const matchesGroup = groupFilter === 'all' || script.group === groupFilter
    const matchesTag = tagFilter === 'all' || script.tags.includes(tagFilter)
    return matchesSearch && matchesStatus && matchesGroup && matchesTag
  })
}

export function uniqueValues(values: string[]) {
  return Array.from(new Set(values))
}
