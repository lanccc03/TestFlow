import { Play, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import {
  createApiClient,
  type ExecutionEventMessage,
  type ExecutionUpdateEvent,
  type ExecutionTask,
  type ExecutionTaskSummary,
  type ScriptSummary,
  type TaskStatus,
} from '@/lib/api'
import { createWebSocketClient } from '@/lib/websocket'

const api = createApiClient({ baseUrl: 'http://127.0.0.1:8000' })
const executionWebSocketUrl = 'ws://127.0.0.1:8000/ws/executions'

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
    queryFn: api.listTasks,
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
        eyebrow="阶段六"
        title="执行任务"
        subtitle="选择已发布脚本，启动本地执行并查看实时任务输出。"
        actions={
          <Badge variant={activeTask ? statusVariant(activeTask.status) : 'secondary'}>
            {activeTask ? taskStatusLabel(activeTask.status) : '未启动'}
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>任务控制</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-[minmax(240px,1.2fr)_minmax(160px,0.6fr)_minmax(180px,0.8fr)] gap-3 max-sm:grid-cols-1">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">选择脚本</span>
              <Select value={selectedScriptId} onValueChange={setSelectedScriptId}>
                <SelectTrigger aria-label="选择脚本">
                  <SelectValue placeholder="选择已发布脚本" />
                </SelectTrigger>
                <SelectContent>
                  {publishedScripts.map((script) => (
                    <SelectItem key={script.id} value={script.id}>
                      {script.name || script.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">执行环境</span>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger aria-label="执行环境">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">local</SelectItem>
                  <SelectItem value="lab">lab</SelectItem>
                  <SelectItem value="ci">ci</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">目标设备</span>
              <Input
                aria-label="目标设备"
                value={targetDevice}
                onChange={(event) => setTargetDevice(event.target.value)}
                placeholder="bench-1"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!selectedScriptId || createMutation.isPending}
              onClick={startExecution}
              type="button"
            >
              <Play aria-hidden="true" data-icon="inline-start" />
              开始执行
            </Button>
            <Button
              disabled={!canCancelTask(activeTask) || cancelMutation.isPending}
              onClick={cancelExecution}
              type="button"
              variant="secondary"
            >
              <Square aria-hidden="true" data-icon="inline-start" />
              取消
            </Button>
          </div>
          {scriptsQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>脚本列表不可用</AlertDescription>
            </Alert>
          ) : null}
          {publishedScripts.length === 0 && !scriptsQuery.isPending ? (
            <EmptyState title="暂无已发布脚本" />
          ) : null}
          {selectedScript ? <SelectedScriptSummary script={selectedScript} /> : null}
        </CardContent>
      </Card>

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

function SelectedScriptSummary({ script }: { script: ScriptSummary }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3.5 max-sm:flex-col">
      <strong className="text-sm font-semibold">{script.name}</strong>
      <span className="text-sm text-muted-foreground">{script.description || script.id}</span>
      <Badge variant="secondary" className="max-sm:self-start">v{script.revision}</Badge>
    </div>
  )
}

function TaskDetail({ task }: { task: ExecutionTask }) {
  return (
    <div className="grid gap-3 rounded-lg border bg-card p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 text-base font-semibold">{task.script_name}</h3>
        <Badge variant={statusVariant(task.status)}>
          {taskStatusLabel(task.status)}
        </Badge>
      </div>
      <dl className="grid gap-2">
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
          <dt className="text-xs text-muted-foreground">任务 ID</dt>
          <dd className="m-0 min-w-0 text-sm [overflow-wrap:anywhere]">{task.id}</dd>
        </div>
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
          <dt className="text-xs text-muted-foreground">环境</dt>
          <dd className="m-0 min-w-0 text-sm [overflow-wrap:anywhere]">{task.environment}</dd>
        </div>
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
          <dt className="text-xs text-muted-foreground">设备</dt>
          <dd className="m-0 min-w-0 text-sm [overflow-wrap:anywhere]">{task.target_device || '-'}</dd>
        </div>
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
          <dt className="text-xs text-muted-foreground">执行器</dt>
          <dd className="m-0 min-w-0 text-sm [overflow-wrap:anywhere]">{task.executor}</dd>
        </div>
      </dl>
      {task.error_message ? (
        <Alert variant="destructive">
          <AlertDescription>{task.error_message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}

function TaskSummaryItem({ task }: { task: ExecutionTaskSummary }) {
  return (
    <Card size="sm" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 max-sm:grid-cols-1">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-base font-semibold">{task.script_name}</h3>
          <Badge variant={statusVariant(task.status)}>
            {taskStatusLabel(task.status)}
          </Badge>
        </div>
        <p className="m-0 text-sm text-muted-foreground">{task.id}</p>
      </div>
      <dl className="flex gap-2">
        <div className="min-w-16 rounded-lg bg-muted px-2 py-1.5">
          <dt className="text-xs text-muted-foreground">步骤</dt>
          <dd className="m-0 text-sm font-semibold text-foreground">
            {task.passed_step_count}/{task.step_count}
          </dd>
        </div>
        <div className="min-w-16 rounded-lg bg-muted px-2 py-1.5">
          <dt className="text-xs text-muted-foreground">环境</dt>
          <dd className="m-0 text-sm font-semibold text-foreground">{task.environment}</dd>
        </div>
      </dl>
    </Card>
  )
}

function formatLogEntry(log: ExecutionTask['logs'][number]) {
  return `${log.timestamp} [${log.level}] ${log.message}`
}

function formatEventLog(event: ExecutionUpdateEvent) {
  const timestamp = event.timestamp ?? new Date().toISOString()
  const level = event.level ?? 'info'
  return `${timestamp} [${level}] ${event.message ?? ''}`
}

function isExecutionEventMessage(value: unknown): value is ExecutionEventMessage {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    return false
  }

  return typeof value.type === 'string'
}

function shouldRefreshTasks(type: ExecutionUpdateEvent['type']) {
  return (
    type === 'task_status' ||
    type === 'step_status' ||
    type === 'task_finished'
  )
}

function canCancelTask(task: ExecutionTask | null): task is ExecutionTask {
  return task?.status === 'pending' || task?.status === 'running'
}

function statusVariant(status: TaskStatus) {
  if (status === 'passed') return 'default'
  if (status === 'failed' || status === 'error') return 'destructive'
  return 'secondary'
}

function taskStatusLabel(status: TaskStatus) {
  if (status === 'pending') return '等待中'
  if (status === 'running') return '运行中'
  if (status === 'passed') return '通过'
  if (status === 'failed') return '失败'
  if (status === 'canceled') return '已取消'
  return '异常'
}
