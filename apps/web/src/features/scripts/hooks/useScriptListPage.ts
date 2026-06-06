import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/app/backend'

export function useScriptListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | undefined>()

  const scriptsQuery = useQuery({
    queryKey: ['scripts'],
    queryFn: api.listScripts,
  })
  const deleteMutation = useMutation({
    mutationFn: api.deleteScript,
    onSuccess: async () => {
      setConfirmDeleteId(undefined)
      await queryClient.invalidateQueries({ queryKey: ['scripts'] })
    },
  })
  const copyMutation = useMutation({
    mutationFn: async (scriptId: string) => {
      const source = await api.getScript(scriptId)
      const nextId = `${source.id}-copy-${Date.now()}`
      return api.saveScript({
        ...source,
        id: nextId,
        name: `${source.name} 副本`,
        status: 'draft',
        version: undefined,
      })
    },
    onSuccess: async (script) => {
      await queryClient.invalidateQueries({ queryKey: ['scripts'] })
      navigate(`/scripts/${script.id}`)
    },
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
        [
          script.id,
          script.name,
          script.description,
          script.group,
          ...script.tags,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
    : scripts

  return {
    confirmDeleteId,
    deleteMutation,
    executeMutation,
    filteredScripts,
    copyMutation,
    search,
    scripts,
    scriptsQuery,
    setConfirmDeleteId,
    setSearch,
  }
}
