import { motion } from 'motion/react'

import { Badge } from '@/components/ui/badge'
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
          <h3 className="m-0 text-sm font-semibold">{task.case_name}</h3>
          <Badge variant={statusVariant(task.status)}>
            {taskStatusLabel(task.status)}
          </Badge>
        </div>
        {showTaskId && !isSelected ? (
          <p className="m-0 text-xs text-muted-foreground">{task.id}</p>
        ) : null}
      </div>
      <dl className="grid grid-cols-1 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">耗时</dt>
          <dd className="m-0 font-semibold text-foreground">
            {task.duration_ms != null ? `${task.duration_ms} ms` : '-'}
          </dd>
        </div>
      </dl>
    </>
  )

  if (onSelect) {
    return (
      <motion.button
        animate={{ opacity: 1, y: 0 }}
        aria-label={`查看任务 ${task.id}`}
        aria-pressed={isSelected}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-transparent p-3 text-left transition-colors hover:bg-muted/34 data-[selected=true]:border-border/80 data-[selected=true]:bg-accent/55 data-[selected=true]:shadow-[inset_3px_0_0_var(--sidebar-primary)]"
        data-selected={isSelected}
        exit={{ opacity: 0, y: -4 }}
        initial={{ opacity: 0, y: 4 }}
        layout
        onClick={onSelect}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        type="button"
      >
        {content}
      </motion.button>
    )
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border/70 bg-card/62 p-3"
      exit={{ opacity: 0, y: -4 }}
      initial={{ opacity: 0, y: 4 }}
      layout
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
    >
      {content}
    </motion.div>
  )
}
