import { Square } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'

import { TaskDetail } from '../components/TaskDetail'
import { TaskSummaryItem } from '../components/TaskSummaryItem'
import { useTaskPage } from '../hooks/useTaskPage'
import { canCancelTask } from '../utils/taskGuards'
import { statusVariant, taskStatusLabel } from '../utils/taskFormatters'

export function TaskPage() {
  const {
    activeTask,
    cancelMutationIsPending,
    liveLogs,
    recentTasks,
    selectTask,
    selectedTaskId,
    stopActiveTask,
    tasksQuery,
  } = useTaskPage()

  return (
    <PagePanel>
      <PageHeader
        title="执行任务"
        subtitle="查看当前执行任务、实时输出和最近任务状态。"
        actions={
          <Badge variant={activeTask ? statusVariant(activeTask.status) : 'secondary'}>
            {activeTask ? taskStatusLabel(activeTask.status) : '未启动'}
          </Badge>
        }
      />

      <div className="grid grid-cols-[minmax(300px,0.78fr)_minmax(0,1.22fr)] gap-4 max-xl:grid-cols-1">
        <section className="overflow-hidden rounded-md border border-border/80 bg-card/76 shadow-[0_14px_40px_rgb(23_32_29_/_0.06)]">
          <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border/70 bg-muted/24 px-4 py-2">
            <h2 className="m-0 text-sm font-semibold">当前任务</h2>
            <Button
              disabled={!canCancelTask(activeTask) || cancelMutationIsPending}
              onClick={stopActiveTask}
              size="sm"
              type="button"
              variant="destructive"
            >
              <Square aria-hidden="true" data-icon="inline-start" />
              停止
            </Button>
          </div>
          <div className="p-4">
            {activeTask ? (
              <TaskDetail task={activeTask} />
            ) : (
              <EmptyState title="启动执行后显示当前任务" />
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-emerald-300/20 bg-slate-950 text-slate-100 shadow-[0_18px_54px_rgb(10_17_21_/_0.20)]">
          <div className="flex min-h-12 items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-2">
            <h2 className="m-0 text-sm font-semibold">实时日志</h2>
            <span className="rounded-full bg-emerald-300 px-2 py-0.5 text-[11px] font-bold text-slate-950">
              Control Room
            </span>
          </div>
          <div className="p-4">
            {liveLogs.length === 0 ? (
              <EmptyState
                className="border-white/10 bg-white/[0.03] text-slate-200"
                title="等待执行日志"
              />
            ) : (
              <div className="grid max-h-[420px] content-start gap-1.5 overflow-auto rounded-md border border-white/10 bg-black/24 px-3 py-2" aria-label="实时日志">
                <AnimatePresence initial={false}>
                  {liveLogs.map((log, index) => (
                    <motion.code
                      animate={{ opacity: 1, y: 0 }}
                      className="block overflow-wrap-anywhere border-b border-white/5 py-1.5 font-mono text-xs leading-relaxed text-slate-200 last:border-b-0"
                      exit={{ opacity: 0, y: -3 }}
                      initial={{ opacity: 0, y: 4 }}
                      key={`${log}-${index}`}
                      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {log}
                    </motion.code>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </section>

        <section className="col-span-full overflow-hidden rounded-md border border-border/80 bg-card/72 shadow-[0_14px_40px_rgb(23_32_29_/_0.06)]">
          <div className="flex min-h-12 items-center border-b border-border/70 bg-muted/24 px-4 py-2">
            <h2 className="m-0 text-sm font-semibold">最近任务</h2>
          </div>
          <div className="grid gap-1 p-2">
            {tasksQuery.isPending ? (
              <EmptyState title="正在加载任务" />
            ) : recentTasks.length === 0 ? (
              <EmptyState title="暂无执行任务" />
            ) : (
              <AnimatePresence initial={false}>
                {recentTasks.map((task) => (
                  <TaskSummaryItem
                    isSelected={task.id === selectedTaskId}
                    key={task.id}
                    onSelect={() => selectTask(task.id)}
                    showTaskId={Boolean(selectedTaskId)}
                    task={task}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>
      </div>
    </PagePanel>
  )
}
