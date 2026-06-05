import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
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

      <Card>
        <CardHeader>
          <CardTitle>最近报告</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2.5">
          {reportsQuery.isPending ? (
            <EmptyState title="正在加载报告" />
          ) : reports.length === 0 ? (
            <EmptyState title="暂无报告" />
          ) : (
            reports.map((report) => (
              <Card
                key={report.id}
                size="sm"
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 max-sm:grid-cols-1"
              >
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="m-0 text-base font-semibold">
                      {report.script_name}
                    </h3>
                    <Badge variant={statusVariant(report.status)}>
                      {taskStatusLabel(report.status)}
                    </Badge>
                  </div>
                  <p className="m-0 text-sm text-muted-foreground">
                    {report.id} — {report.executor}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <dl className="flex gap-2">
                    <div className="min-w-14 rounded-lg bg-muted px-2 py-1.5">
                      <dt className="text-xs text-muted-foreground">步骤</dt>
                      <dd className="m-0 text-sm font-semibold text-foreground">
                        {report.passed_step_count}/{report.step_count}
                      </dd>
                    </div>
                  </dl>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/reports/${report.id}`}>查看报告</Link>
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
