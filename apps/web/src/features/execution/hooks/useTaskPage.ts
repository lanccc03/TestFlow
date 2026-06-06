import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import { api, createExecutionSocket } from '@/app/backend'

import { formatEventLog, formatLogEntry } from '../utils/taskFormatters'
import { canCancelTask, isExecutionEventMessage, shouldRefreshTasks } from '../utils/taskGuards'

export function useTaskPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedTaskId, setSelectedTaskId] = useState(
    () => searchParams.get('taskId') ?? '',
  )
  const [liveLogs, setLiveLogs] = useState<string[]>([])
  const activeTaskIdRef = useRef<string | null>(selectedTaskId || null)

  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.listTasks(),
  })

  const activeTask = useQuery({
    queryKey: ['task', selectedTaskId],
    queryFn: () => api.getTask(selectedTaskId),
    enabled: Boolean(selectedTaskId),
  }).data ?? null

  const recentTasks = tasksQuery.data?.items ?? []

  const cancelMutation = useMutation({
    mutationFn: (taskId: string) => api.cancelTask(taskId),
    onSuccess: async (task) => {
      queryClient.setQueryData(['task', task.id], task)
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  useEffect(() => {
    const taskId = searchParams.get('taskId') ?? ''
    setSelectedTaskId(taskId)
    activeTaskIdRef.current = taskId || null
  }, [searchParams])

  useEffect(() => {
    if (selectedTaskId || searchParams.has('taskId')) {
      return
    }
    const activeSummary = recentTasks.find(
      (task) => task.status === 'pending' || task.status === 'running',
    )
    if (activeSummary) {
      activeTaskIdRef.current = activeSummary.id
      setSearchParams({ taskId: activeSummary.id }, { replace: true })
    }
  }, [recentTasks, searchParams, selectedTaskId, setSearchParams])

  useEffect(() => {
    activeTaskIdRef.current = activeTask?.id ?? (selectedTaskId || null)
    setLiveLogs(activeTask ? activeTask.logs.map(formatLogEntry) : [])
  }, [activeTask, selectedTaskId])

  useEffect(() => {
    const client = createExecutionSocket()
    const unsubscribe = client.subscribe(
      () => undefined,
      (message) => {
        if (!isExecutionEventMessage(message) || message.type === 'connection') {
          return
        }

        const activeTaskId = activeTaskIdRef.current
        const messageTaskId = message.task_id ?? message.task?.id
        const isPageTask = Boolean(activeTaskId && messageTaskId === activeTaskId)

        if (isPageTask && message.task) {
          queryClient.setQueryData(['task', messageTaskId], message.task)
        }
        if (isPageTask && message.type === 'log' && message.message) {
          setLiveLogs((current) => [...current, formatEventLog(message)])
        }
        if (shouldRefreshTasks(message.type)) {
          void queryClient.invalidateQueries({ queryKey: ['tasks'] })
        }
      },
    )

    client.connect()

    return () => {
      unsubscribe()
      client.disconnect()
    }
  }, [queryClient])

  function selectTask(taskId: string) {
    setSearchParams({ taskId })
  }

  function stopActiveTask() {
    if (!canCancelTask(activeTask) || cancelMutation.isPending) {
      return
    }

    cancelMutation.mutate(activeTask.id)
  }

  return {
    activeTask,
    cancelMutationIsPending: cancelMutation.isPending,
    liveLogs,
    recentTasks,
    selectTask,
    selectedTaskId,
    stopActiveTask,
    tasksQuery,
  }
}
