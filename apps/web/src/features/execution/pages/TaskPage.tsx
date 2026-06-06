import { Square } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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


      <div className="grid grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)] gap-4 max-xl:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>当前任务</CardTitle>
            <CardAction>
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
            </CardAction>
          </CardHeader>
          <CardContent>
            {activeTask ? (
              <TaskDetail task={activeTask} />
            ) : (
              <EmptyState title="启动执行后显示当前任务" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>实时日志</CardTitle>
          </CardHeader>
          <CardContent>
            {liveLogs.length === 0 ? (
              <EmptyState title="等待执行日志" />
            ) : (
              <div className="grid max-h-[420px] content-start gap-2 overflow-auto" aria-label="实时日志">
                {liveLogs.map((log, index) => (
                  <code
                    className="block overflow-wrap-anywhere rounded-md bg-muted px-2 py-1.5 font-mono text-xs leading-relaxed text-muted-foreground"
                    key={`${log}-${index}`}
                  >
                    {log}
                  </code>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>最近任务</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2.5">
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
          </CardContent>
        </Card>
      </div>
    </PagePanel>
  )
}
