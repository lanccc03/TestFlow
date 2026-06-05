import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/app/backend'
import type { ExecutionTaskFilters } from '@/lib/api'

export function useHistoryPage() {
  const queryClient = useQueryClient()
  const [scriptId, setScriptId] = useState('')
  const [status, setStatus] = useState('')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [executor, setExecutor] = useState('')

  const appliedFiltersRef = useRef<ExecutionTaskFilters>({})

  const scriptsQuery = useQuery({
    queryKey: ['scripts'],
    queryFn: api.listScripts,
  })

  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.listTasks(appliedFiltersRef.current),
  })

  const scripts = scriptsQuery.data?.items ?? []
  const tasks = tasksQuery.data?.items ?? []

  function applyFilters() {
    appliedFiltersRef.current = {
      script_id: scriptId || undefined,
      status: (status as ExecutionTaskFilters['status']) || undefined,
      created_from: createdFrom || undefined,
      created_to: createdTo || undefined,
      executor: executor || undefined,
    }
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  return {
    applyFilters,
    createdFrom,
    createdTo,
    executor,
    scriptId,
    scripts,
    setCreatedFrom,
    setCreatedTo,
    setExecutor,
    setScriptId,
    setStatus,
    status,
    tasks,
    tasksQuery,
  }
}
