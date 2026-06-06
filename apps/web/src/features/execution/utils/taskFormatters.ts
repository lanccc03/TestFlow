import type {
  ExecutionTask,
  ExecutionUpdateEvent,
  StepStatus,
  TaskStatus,
} from '@/lib/api'

export function formatLogEntry(log: ExecutionTask['logs'][number]) {
  return `${log.timestamp} [${log.level}] ${log.message}`
}

export function formatEventLog(event: ExecutionUpdateEvent) {
  const timestamp = event.timestamp ?? new Date().toISOString()
  const level = event.level ?? 'info'
  return `${timestamp} [${level}] ${event.message ?? ''}`
}

export function statusVariant(status: TaskStatus | StepStatus) {
  if (status === 'passed') return 'success'
  if (status === 'failed' || status === 'error') return 'destructive'
  return 'secondary'
}

export function taskStatusLabel(status: TaskStatus | StepStatus) {
  if (status === 'pending') return '等待中'
  if (status === 'running') return '运行中'
  if (status === 'passed') return '已通过'
  if (status === 'failed') return '失败'
  if (status === 'skipped') return '已跳过'
  if (status === 'canceled') return '已取消'
  return '异常'
}
