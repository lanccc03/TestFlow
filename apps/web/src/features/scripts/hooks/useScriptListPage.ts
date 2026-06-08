import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'

import { api } from '@/app/backend'

export function useScriptListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const scriptsQuery = useQuery({
    queryKey: ['scripts'],
    queryFn: api.listScripts,
  })
  const executeMutation = useMutation({
    mutationFn: (scriptId: string) => api.createTask({ script_id: scriptId }),
    onSuccess: (task) => {
      navigate(`/tasks?taskId=${encodeURIComponent(task.id)}`)
    },
  })

  const scripts = scriptsQuery.data?.items ?? []
  const query = search.trim().toLowerCase()
  const filteredScripts = query
    ? scripts.filter((script) =>
        [script.id, script.name, script.description, ...script.steps]
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
    : scripts

  return {
    executeMutation,
    filteredScripts,
    search,
    scripts,
    scriptsQuery,
    setSearch,
  }
}
