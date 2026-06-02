import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

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
  type ExecutionTask,
} from '@/lib/api'
import { createWebSocketClient } from '@/lib/websocket'
import { backendBaseUrl } from '@/app/config'

import { executionWebSocketUrl } from '../constants'
import { formatEventLog, formatLogEntry, statusVariant, taskStatusLabel } from '../utils/taskFormatters'
import { canCancelTask, isExecutionEventMessage, shouldRefreshTasks } from '../utils/taskGuards'
import { TaskControlPanel } from '../components/TaskControlPanel'
import { TaskDetail } from '../components/TaskDetail'
import { TaskSummaryItem } from '../components/TaskSummaryItem'

const api = createApiClient({ baseUrl: backendBaseUrl })

export function TaskPage() {
  const queryClient = useQueryClient()
  const [selectedScriptId, setSelectedScriptId] = useState('')
  const [environment, setEnvironment] = useState('local')
  const [targetDevice, setTargetDevice] = useState('')
  const [activeTask, setActiveTask] = useState<ExecutionTask | null>(null)
  const [liveLogs, setLiveLogs] = useState<string[]>([])
  const activeTaskIdRef = useRef<string | null>(null)

  const scriptsQuery = useQuery({
    queryKey: ['scripts'],
    queryFn: api.listScripts,
  })
  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.listTasks(),
  })

  const publishedScripts = useMemo(
    () =>
      (scriptsQuery.data?.items ?? []).filter(
        (script) => script.status === 'published',
      ),
    [scriptsQuery.data?.items],
  )
  const selectedScript = publishedScripts.find(
    (script) => script.id === selectedScriptId,
  )
  const recentTasks = tasksQuery.data?.items ?? []

  useEffect(() => {
    if (!selectedScriptId && publishedScripts.length > 0) {
      setSelectedScriptId(publishedScripts[0].id)
    }
  }, [publishedScripts, selectedScriptId])

  const createMutation = useMutation({
    mutationFn: () =>
      api.createTask({
        script_id: selectedScriptId,
        environment,
        target_device: targetDevice,
        variables: {},
      }),
    onSuccess: async (task) => {
      activeTaskIdRef.current = task.id
      setActiveTask(task)
      setLiveLogs(task.logs.map(formatLogEntry))
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
  const cancelMutation = useMutation({
    mutationFn: (taskId: string) => api.cancelTask(taskId),
    onSuccess: async (task) => {
      setActiveTask(task)
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

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
          setActiveTask(message.task)
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

  function startExecution() {
    if (!selectedScriptId) {
      return
    }
    createMutation.mutate()
  }

  function cancelExecution() {
    const task = activeTask
    if (canCancelTask(task)) {
      cancelMutation.mutate(task.id)
    }
  }

  return (
    <PagePanel>
      <PageHeader
        title="执行任务"
        subtitle="选择已发布脚本，启动本地执行并查看实时任务输出。"
        actions={
          <Badge variant={activeTask ? statusVariant(activeTask.status) : 'secondary'}>
            {activeTask ? taskStatusLabel(activeTask.status) : '未启动'}
          </Badge>
        }
      />

      <TaskControlPanel
        selectedScriptId={selectedScriptId}
        onSelectedScriptIdChange={setSelectedScriptId}
        environment={environment}
        onEnvironmentChange={setEnvironment}
        targetDevice={targetDevice}
        onTargetDeviceChange={setTargetDevice}
        publishedScripts={publishedScripts}
        selectedScript={selectedScript}
        activeTask={activeTask}
        createMutationIsPending={createMutation.isPending}
        cancelMutationIsPending={cancelMutation.isPending}
        scriptsQueryIsError={scriptsQuery.isError}
        scriptsQueryIsPending={scriptsQuery.isPending}
        onStartExecution={startExecution}
        onCancelExecution={cancelExecution}
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
                <TaskSummaryItem key={task.id} task={task} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PagePanel>
  )
}
