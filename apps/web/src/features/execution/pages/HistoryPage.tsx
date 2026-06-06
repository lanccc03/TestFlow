import { Link } from 'react-router'

import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
    search,
    setSearch,
    tasks,
    tasksQuery,
  } = useHistoryPage()

  return (
    <PagePanel>
      <PageHeader
        title="执行历史"
        subtitle="查看历史执行记录和报告"
      />

      <Input
        aria-label="搜索执行历史"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="搜索执行历史"
      />

      <Table aria-label="任务记录">
        <TableHeader>
          <TableRow>
            <TableHead>脚本</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">步骤</TableHead>
            <TableHead className="text-right">耗时</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasksQuery.isPending ? (
            <TableRow>
              <TableCell colSpan={5}>
                <EmptyState title="正在加载任务" />
              </TableCell>
            </TableRow>
          ) : tasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5}>
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
    </PagePanel>
  )
}
