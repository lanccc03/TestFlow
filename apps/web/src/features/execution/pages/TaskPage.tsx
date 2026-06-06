import { Square } from 'lucide-react'

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
        <section className="overflow-hidden rounded-lg border border-border/80 bg-card/60">
          <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border/75 bg-muted/25 px-4 py-2">
            <h2 className="m-0 text-sm font-semibold">当前任务</h2>
            <div>
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
          </div>
          <div className="p-4">
            {activeTask ? (
              <TaskDetail task={activeTask} />
            ) : (
              <EmptyState title="启动执行后显示当前任务" />
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-border/80 bg-card/70">
          <div className="flex min-h-12 items-center border-b border-border/75 bg-muted/25 px-4 py-2">
            <h2 className="m-0 text-sm font-semibold">实时日志</h2>
          </div>
          <div className="p-4">
            {liveLogs.length === 0 ? (
              <EmptyState title="等待执行日志" />
            ) : (
              <div className="grid max-h-[420px] content-start gap-1.5 overflow-auto rounded-md border border-slate-900/10 bg-slate-950 px-3 py-2" aria-label="实时日志">
                {liveLogs.map((log, index) => (
                  <code
                    className="block overflow-wrap-anywhere border-b border-white/5 py-1.5 font-mono text-xs leading-relaxed text-slate-200 last:border-b-0"
                    key={`${log}-${index}`}
                  >
                    {log}
                  </code>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="col-span-full overflow-hidden rounded-lg border border-border/80 bg-card/55">
          <div className="flex min-h-12 items-center border-b border-border/75 bg-muted/25 px-4 py-2">
            <h2 className="m-0 text-sm font-semibold">最近任务</h2>
          </div>
          <div className="grid gap-1 p-2">
            {tasksQuery.isPending ? (
              <EmptyState title="正在加载任务" />
            ) : recentTasks.length === 0 ? (
              <EmptyState title="暂无执行任务" />
            ) : (
              recentTasks.map((task) => (
                <TaskSummaryItem
                  isSelected={task.id === selectedTaskId}
                  key={task.id}
                  onSelect={() => selectTask(task.id)}
                  showTaskId={Boolean(selectedTaskId)}
                  task={task}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </PagePanel>
  )
}
