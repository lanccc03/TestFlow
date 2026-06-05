import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/app/backend'

import { filterScripts, uniqueValues } from '../utils/filters'

export function useScriptListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
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
  const groups = uniqueValues(
    scripts.map((script) => script.group).filter(Boolean),
  )
  const tags = uniqueValues(scripts.flatMap((script) => script.tags))
  const filteredScripts = filterScripts({
    scripts,
    search,
    statusFilter,
    groupFilter,
    tagFilter,
  })

  return {
    confirmDeleteId,
    deleteMutation,
    executeMutation,
    filteredScripts,
    groupFilter,
    groups,
    copyMutation,
    scriptsQuery,
    search,
    setConfirmDeleteId,
    setGroupFilter,
    setSearch,
    setStatusFilter,
    setTagFilter,
    statusFilter,
    tagFilter,
    tags,
  }
}
