import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'

import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { api } from '@/app/backend'

import { statusVariant, taskStatusLabel } from '../utils/taskFormatters'

export function ReportListPage() {
  const reportsQuery = useQuery({
    queryKey: ['reports'],
    queryFn: () => api.listReports(),
  })

  const reports = reportsQuery.data?.items ?? []

  return (
    <PagePanel>
      <PageHeader
        title="测试报告"
        subtitle="查看执行报告汇总"
      />

      <Table aria-label="最近报告">
        <TableHeader>
          <TableRow>
            <TableHead>用例</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">耗时</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reportsQuery.isPending ? (
            <TableRow>
              <TableCell colSpan={4}>
                <EmptyState title="正在加载报告" />
              </TableCell>
            </TableRow>
          ) : reports.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4}>
                <EmptyState title="暂无报告" />
              </TableCell>
            </TableRow>
          ) : (
            reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="max-w-[340px]">
                  <div className="grid gap-1">
                    <div className="font-medium">{report.case_name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {report.id}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(report.status)}>
                    {taskStatusLabel(report.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {report.duration_ms != null ? `${report.duration_ms} ms` : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/reports/${report.id}`}>查看报告</Link>
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
