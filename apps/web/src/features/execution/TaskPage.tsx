import { Play, Square } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

        if (message.task) {
          setActiveTask(message.task)
        }
        if (message.type === 'log' && message.message) {
          setLiveLogs((current) => [...current, formatEventLog(message)])
        }
        void queryClient.invalidateQueries({ queryKey: ['tasks'] })
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
    if (activeTask) {
      cancelMutation.mutate(activeTask.id)
    }
  }

  return (
    <section className="content-panel execution-workspace">
      <div className="script-page-heading">
        <div className="section-heading">
          <p>阶段六</p>
          <h1>执行任务</h1>
          <span>选择已发布脚本，启动本地执行并查看实时任务输出。</span>
        </div>
        <Badge variant={activeTask ? statusVariant(activeTask.status) : 'secondary'}>
          {activeTask ? taskStatusLabel(activeTask.status) : '未启动'}
        </Badge>
      </div>

      <section className="editor-section execution-controls">
        <h2>任务控制</h2>
        <div className="form-grid execution-form-grid">
          <label>
            <span>选择脚本</span>
            <select
              aria-label="选择脚本"
              value={selectedScriptId}
              onChange={(event) => setSelectedScriptId(event.target.value)}
            >
              <option value="">选择已发布脚本</option>
              {publishedScripts.map((script) => (
                <option key={script.id} value={script.id}>
                  {script.name || script.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>执行环境</span>
            <select
              aria-label="执行环境"
              value={environment}
              onChange={(event) => setEnvironment(event.target.value)}
            >
              <option value="local">local</option>
              <option value="lab">lab</option>
              <option value="ci">ci</option>
            </select>
          </label>
          <label>
            <span>目标设备</span>
            <input
              aria-label="目标设备"
              value={targetDevice}
              onChange={(event) => setTargetDevice(event.target.value)}
              placeholder="bench-1"
            />
          </label>
        </div>
        <div className="editor-actions">
          <Button
            disabled={!selectedScriptId || createMutation.isPending}
            onClick={startExecution}
            type="button"
          >
            <Play aria-hidden="true" data-icon="inline-start" />
            开始执行
          </Button>
          <Button
            disabled={!activeTask || cancelMutation.isPending}
            onClick={cancelExecution}
            type="button"
            variant="secondary"
          >
            <Square aria-hidden="true" data-icon="inline-start" />
            取消
          </Button>
        </div>
        {scriptsQuery.isError ? (
          <div className="catalog-error">脚本列表不可用</div>
        ) : null}
        {publishedScripts.length === 0 && !scriptsQuery.isPending ? (
          <div className="catalog-placeholder">暂无已发布脚本</div>
        ) : null}
        {selectedScript ? <SelectedScriptSummary script={selectedScript} /> : null}
      </section>

      <div className="execution-layout">
        <section className="editor-section execution-current-panel">
          <h2>当前任务</h2>
          {activeTask ? (
            <TaskDetail task={activeTask} />
          ) : (
            <div className="catalog-placeholder">启动执行后显示当前任务</div>
          )}
        </section>

        <section className="editor-section execution-log-panel">
          <h2>实时日志</h2>
          {liveLogs.length === 0 ? (
            <div className="catalog-placeholder">等待执行日志</div>
          ) : (
            <div className="execution-log-list" aria-label="实时日志">
              {liveLogs.map((log, index) => (
                <code key={`${log}-${index}`}>{log}</code>
              ))}
            </div>
          )}
        </section>

        <section className="editor-section execution-recent-panel">
          <h2>最近任务</h2>
          {tasksQuery.isPending ? (
            <div className="catalog-placeholder">正在加载任务</div>
          ) : recentTasks.length === 0 ? (
            <div className="catalog-placeholder">暂无执行任务</div>
          ) : (
            <div className="execution-task-list">
              {recentTasks.map((task) => (
                <TaskSummaryItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

function SelectedScriptSummary({ script }: { script: ScriptSummary }) {
  return (
    <div className="execution-selected-script">
      <strong>{script.name}</strong>
      <span>{script.description || script.id}</span>
      <Badge variant="secondary">v{script.revision}</Badge>
    </div>
  )
}

function TaskDetail({ task }: { task: ExecutionTask }) {
  return (
    <div className="execution-task-card">
      <div className="script-title-row">
        <h3>{task.script_name}</h3>
        <Badge variant={statusVariant(task.status)}>
          {taskStatusLabel(task.status)}
        </Badge>
      </div>
      <dl className="detail-list">
        <div>
          <dt>任务 ID</dt>
          <dd>{task.id}</dd>
        </div>
        <div>
          <dt>环境</dt>
          <dd>{task.environment}</dd>
        </div>
        <div>
          <dt>设备</dt>
          <dd>{task.target_device || '-'}</dd>
        </div>
        <div>
          <dt>执行器</dt>
          <dd>{task.executor}</dd>
        </div>
      </dl>
      {task.error_message ? (
        <div className="validation-panel">
          <p>{task.error_message}</p>
        </div>
      ) : null}
    </div>
  )
}

function TaskSummaryItem({ task }: { task: ExecutionTaskSummary }) {
  return (
    <article className="execution-task-item">
      <div>
        <div className="script-title-row">
          <h3>{task.script_name}</h3>
          <Badge variant={statusVariant(task.status)}>
            {taskStatusLabel(task.status)}
          </Badge>
        </div>
        <p>{task.id}</p>
      </div>
      <dl className="compact-meta">
        <div>
          <dt>步骤</dt>
          <dd>
            {task.passed_step_count}/{task.step_count}
          </dd>
        </div>
        <div>
          <dt>环境</dt>
          <dd>{task.environment}</dd>
        </div>
      </dl>
    </article>
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
