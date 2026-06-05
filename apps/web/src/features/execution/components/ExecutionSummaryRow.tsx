import { Link } from 'react-router'

import { ListRow } from '@/components/layout/list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ExecutionTaskSummary } from '@/lib/api'

import { statusVariant, taskStatusLabel } from '../utils/taskFormatters'

function formatDuration(durationMs: number | null) {
  return durationMs != null ? `${durationMs} ms` : '-'
}

function formatDateTime(value: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
  }).format(date)
}

export function ExecutionSummaryRow({
  actionLabel = '查看报告',
  task,
}: {
  actionLabel?: string
  task: ExecutionTaskSummary
}) {
  return (
    <ListRow className="grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)_minmax(92px,0.3fr)_auto] max-xl:grid-cols-[minmax(0,1fr)_auto] max-sm:grid-cols-1">
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3 className="m-0 truncate text-base font-semibold">
            {task.script_name}
          </h3>
          <Badge variant={statusVariant(task.status)}>
            {taskStatusLabel(task.status)}
          </Badge>
        </div>
        <p className="m-0 truncate text-sm text-muted-foreground">
          {task.id} · {task.executor}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-sm max-xl:hidden">
        <div>
          <dt className="text-xs text-muted-foreground">环境</dt>
          <dd className="m-0 font-semibold text-foreground">
            {task.environment}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">开始</dt>
          <dd className="m-0 font-semibold text-foreground">
            {formatDateTime(task.started_at ?? task.created_at)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">耗时</dt>
          <dd className="m-0 font-semibold text-foreground">
            {formatDuration(task.duration_ms)}
          </dd>
        </div>
      </dl>

      <dl className="text-sm max-xl:hidden">
        <div>
          <dt className="text-xs text-muted-foreground">步骤</dt>
          <dd className="m-0 font-semibold text-foreground">
            {task.passed_step_count}/{task.step_count}
          </dd>
        </div>
      </dl>

      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link to={`/reports/${task.id}`}>{actionLabel}</Link>
        </Button>
      </div>
    </ListRow>
  )
}
