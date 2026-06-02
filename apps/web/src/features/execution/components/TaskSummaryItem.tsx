import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { ExecutionTaskSummary } from '@/lib/api'
import { statusVariant, taskStatusLabel } from '../utils/taskFormatters'

export function TaskSummaryItem({ task }: { task: ExecutionTaskSummary }) {
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
