import type {
  ExecutionEventMessage,
  ExecutionTask,
  ExecutionUpdateEvent,
} from '@/lib/api'

export function isExecutionEventMessage(value: unknown): value is ExecutionEventMessage {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    return false
  }

  return typeof value.type === 'string'
}

export function shouldRefreshTasks(type: ExecutionUpdateEvent['type']) {
  return (
    type === 'task_status' ||
    type === 'step_status' ||
    type === 'task_finished'
  )
}

export function canCancelTask(task: ExecutionTask | null): task is ExecutionTask {
  return task?.status === 'pending' || task?.status === 'running'
}
