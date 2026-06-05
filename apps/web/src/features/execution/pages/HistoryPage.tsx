import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'

import { useHistoryPage } from '../hooks/useHistoryPage'
import { statusVariant, taskStatusLabel } from '../utils/taskFormatters'

export function HistoryPage() {
  const {
    applyFilters,
    createdFrom,
    createdTo,
    executor,
    scriptId,
    scripts,
    setCreatedFrom,
    setCreatedTo,
    setExecutor,
    setScriptId,
    setStatus,
    status,
    tasks,
    tasksQuery,
  } = useHistoryPage()

  return (
    <PagePanel>
      <PageHeader
        title="执行历史"
        subtitle="查看历史执行记录和报告"
      />

      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[minmax(160px,1fr)_minmax(120px,0.5fr)_minmax(140px,0.5fr)_minmax(140px,0.5fr)_minmax(120px,0.4fr)_auto] gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">脚本</span>
              <Select value={scriptId} onValueChange={setScriptId}>
                <SelectTrigger aria-label="脚本">
                  <SelectValue placeholder="全部脚本" />
                </SelectTrigger>
                <SelectContent>
                  {scripts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name || s.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">状态</span>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger aria-label="状态">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">等待中</SelectItem>
                  <SelectItem value="running">运行中</SelectItem>
                  <SelectItem value="passed">通过</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                  <SelectItem value="canceled">已取消</SelectItem>
                  <SelectItem value="error">异常</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">开始时间从</span>
              <Input
                type="datetime-local"
                aria-label="开始时间从"
                value={createdFrom}
                onChange={(e) => setCreatedFrom(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">开始时间到</span>
              <Input
                type="datetime-local"
                aria-label="开始时间到"
                value={createdTo}
                onChange={(e) => setCreatedTo(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">执行人</span>
              <Input
                aria-label="执行人"
                value={executor}
                onChange={(e) => setExecutor(e.target.value)}
                placeholder="alice"
              />
            </label>
            <div className="flex items-end">
              <Button onClick={applyFilters} type="button">
                查询历史
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>任务记录</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2.5">
          {tasksQuery.isPending ? (
            <EmptyState title="正在加载任务" />
          ) : tasks.length === 0 ? (
            <EmptyState title="暂无执行记录" />
          ) : (
            tasks.map((task) => (
              <Card key={task.id} size="sm" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 max-sm:grid-cols-1">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="m-0 text-base font-semibold">{task.script_name}</h3>
                    <Badge variant={statusVariant(task.status)}>
                      {taskStatusLabel(task.status)}
                    </Badge>
                  </div>
                  <p className="m-0 text-sm text-muted-foreground">
                    {task.id} — {task.executor}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <dl className="flex gap-2">
                    <div className="min-w-14 rounded-lg bg-muted px-2 py-1.5">
                      <dt className="text-xs text-muted-foreground">步骤</dt>
                      <dd className="m-0 text-sm font-semibold text-foreground">
                        {task.passed_step_count}/{task.step_count}
                      </dd>
                    </div>
                  </dl>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/reports/${task.id}`}>查看报告</Link>
                  </Button>
                </div>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </PagePanel>
  )
}
