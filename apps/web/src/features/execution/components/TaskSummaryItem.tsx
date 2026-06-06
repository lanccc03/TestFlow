import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { ExecutionTaskSummary } from '@/lib/api'
import { statusVariant, taskStatusLabel } from '../utils/taskFormatters'

export function TaskSummaryItem({
  isSelected = false,
  onSelect,
  showTaskId = true,
  task,
}: {
  isSelected?: boolean
  onSelect?: () => void
  showTaskId?: boolean
  task: ExecutionTaskSummary
}) {
  const content = (
    <>
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-base font-semibold">{task.script_name}</h3>
          <Badge variant={statusVariant(task.status)}>
            {taskStatusLabel(task.status)}
          </Badge>
        </div>
        {showTaskId && !isSelected ? (
          <p className="m-0 text-sm text-muted-foreground">{task.id}</p>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground">步骤</dt>
          <dd className="m-0 font-semibold text-foreground">
            {task.passed_step_count}/{task.step_count}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">耗时</dt>
          <dd className="m-0 font-semibold text-foreground">
            {task.duration_ms != null ? `${task.duration_ms} ms` : '-'}
          </dd>
        </div>
      </dl>
    </>
  )

  if (onSelect) {
    return (
      <Card
        aria-label={`查看任务 ${task.id}`}
        aria-pressed={isSelected}
        asChild
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 text-left transition-colors hover:bg-muted/60 data-[selected=true]:border-ring data-[selected=true]:ring-2 data-[selected=true]:ring-ring/20"
        data-selected={isSelected}
        size="sm"
      >
        <button onClick={onSelect} type="button">
          {content}
        </button>
      </Card>
    )
  }

  return (
    <Card
      size="sm"
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3"
    >
      {content}
    </Card>
  )
}
