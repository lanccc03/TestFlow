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
    const keyword = search.trim().toLowerCase()

    if (!keyword) {
      return items
    }

    return items.filter((task) =>
      [
        task.id,
        task.script_id,
        task.script_name,
        task.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    )
  }, [search, tasksQuery.data?.items])

  return {
    search,
    setSearch,
    tasks,
    tasksQuery,
  }
}
