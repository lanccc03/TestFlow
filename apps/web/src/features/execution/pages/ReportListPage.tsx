import { useQuery } from '@tanstack/react-query'

import { ListSurface } from '@/components/layout/list'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { api } from '@/app/backend'

import { ExecutionSummaryRow } from '../components/ExecutionSummaryRow'

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

      <ListSurface
        description={`${reports.length} 个报告`}
        title="最近报告"
      >
        {reportsQuery.isPending ? (
          <div className="p-3">
            <EmptyState title="正在加载报告" />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-3">
            <EmptyState title="暂无报告" />
          </div>
        ) : (
          reports.map((report) => (
            <ExecutionSummaryRow
              actionLabel="查看报告"
              key={report.id}
              task={report}
            />
          ))
        )}
      </ListSurface>
    </PagePanel>
  )
}
