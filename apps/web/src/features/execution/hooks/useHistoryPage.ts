import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/app/backend'

export function useHistoryPage() {
  const [search, setSearch] = useState('')

  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.listTasks({}),
  })

  const tasks = useMemo(() => {
    const items = tasksQuery.data?.items ?? []
    const term = search.trim().toLowerCase()

    if (!term) {
      return items
    }

    return items.filter((task) =>
      [
        task.id,
        task.case_id,
        task.case_name,
        task.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    )
  }, [search, tasksQuery.data?.items])

  return {
    search,
    setSearch,
    tasks,
    tasksQuery,
  }
}
