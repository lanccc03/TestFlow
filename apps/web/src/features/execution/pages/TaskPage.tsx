import { useEffect, useRef, useState } from 'react'
import {
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useSearchParams } from 'react-router'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import {
  createApiClient,
} from '@/lib/api'
import { createWebSocketClient } from '@/lib/websocket'
import { backendBaseUrl } from '@/app/config'

import { executionWebSocketUrl } from '../constants'
import { formatEventLog, formatLogEntry, statusVariant, taskStatusLabel } from '../utils/taskFormatters'
import { isExecutionEventMessage, shouldRefreshTasks } from '../utils/taskGuards'
import { TaskDetail } from '../components/TaskDetail'
import { TaskSummaryItem } from '../components/TaskSummaryItem'

const api = createApiClient({ baseUrl: backendBaseUrl })

export function TaskPage() {
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
    const client = createWebSocketClient({ url: executionWebSocketUrl })
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

  return (
    <PagePanel>
      <PageHeader
        title="执行任务"
        subtitle="查看当前执行任务、实时输出和最近任务状态。"
        actions={
          <Badge variant={activeTask ? statusVariant(activeTask.status) : 'secondary'}>
            {activeTask ? taskStatusLabel(activeTask.status) : '未启动'}
          </Badge>
        }
      />


      <div className="grid grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)] gap-4 max-xl:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>当前任务</CardTitle>
          </CardHeader>
          <CardContent>
            {activeTask ? (
              <TaskDetail task={activeTask} />
            ) : (
              <EmptyState title="启动执行后显示当前任务" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>实时日志</CardTitle>
          </CardHeader>
          <CardContent>
            {liveLogs.length === 0 ? (
              <EmptyState title="等待执行日志" />
            ) : (
              <div className="grid max-h-[420px] content-start gap-2 overflow-auto" aria-label="实时日志">
                {liveLogs.map((log, index) => (
                  <code
                    className="block overflow-wrap-anywhere rounded-md bg-muted px-2 py-1.5 font-mono text-xs leading-relaxed text-muted-foreground"
                    key={`${log}-${index}`}
                  >
                    {log}
                  </code>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>最近任务</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            {tasksQuery.isPending ? (
              <EmptyState title="正在加载任务" />
            ) : recentTasks.length === 0 ? (
              <EmptyState title="暂无执行任务" />
            ) : (
              recentTasks.map((task) => (
                <TaskSummaryItem
                  isSelected={task.id === selectedTaskId}
                  key={task.id}
                  onSelect={() => selectTask(task.id)}
                  showTaskId={Boolean(selectedTaskId)}
                  task={task}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PagePanel>
  )
}
