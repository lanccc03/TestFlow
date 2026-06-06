import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import type { ExecutionTask } from '@/lib/api'
import { statusVariant, taskStatusLabel } from '../utils/taskFormatters'

export function TaskDetail({ task }: { task: ExecutionTask }) {
  return (
    <div className="grid gap-3">
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
      </dl>
      {task.error_message ? (
        <Alert variant="destructive">
          <AlertDescription>{task.error_message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
