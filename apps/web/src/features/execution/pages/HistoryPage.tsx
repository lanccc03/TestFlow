import { Link } from 'react-router'

import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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

      <div
        aria-label="历史筛选"
        className="grid grid-cols-[minmax(160px,1fr)_minmax(120px,0.5fr)_minmax(140px,0.5fr)_minmax(140px,0.5fr)_minmax(120px,0.4fr)_auto] gap-3 rounded-lg border bg-background/80 p-3 text-sm shadow-xs max-lg:grid-cols-2 max-sm:grid-cols-1"
        role="group"
      >
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

      <div className="overflow-hidden rounded-lg border bg-background">
        <Table aria-label="任务记录">
          <TableHeader>
            <TableRow>
              <TableHead>脚本</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>执行人</TableHead>
              <TableHead>环境</TableHead>
              <TableHead className="text-right">步骤</TableHead>
              <TableHead className="text-right">耗时</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasksQuery.isPending ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState title="正在加载任务" />
                </TableCell>
              </TableRow>
            ) : tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState title="暂无执行记录" />
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="max-w-[340px]">
                    <div className="grid gap-1">
                      <div className="font-medium">{task.script_name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {task.id}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(task.status)}>
                      {taskStatusLabel(task.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{task.executor}</TableCell>
                  <TableCell>{task.environment}</TableCell>
                  <TableCell className="text-right font-medium">
                    {task.passed_step_count}/{task.step_count}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {task.duration_ms != null ? `${task.duration_ms} ms` : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/reports/${task.id}`}>查看报告</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </PagePanel>
  )
}
