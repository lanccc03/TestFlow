import { ExternalLink } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { api, backendUrls } from '@/app/backend'
import {
  type ExecutionFrameworkReport,
  type ExecutionTask,
} from '@/lib/api'

import { formatLogEntry, statusVariant, taskStatusLabel } from '../utils/taskFormatters'

export function ReportDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()

  const reportQuery = useQuery({
    queryKey: ['report', taskId],
    queryFn: () => api.getReport(taskId!),
    enabled: Boolean(taskId),
  })

  if (reportQuery.isPending) {
    return (
      <PagePanel>
        <EmptyState title="正在加载报告" />
      </PagePanel>
    )
  }

  if (reportQuery.error || !reportQuery.data) {
    return (
      <PagePanel>
        <EmptyState title="报告不存在" />
      </PagePanel>
    )
  }

  const task: ExecutionTask = reportQuery.data
  const frameworkReport = task.framework_report ?? null

  return (
    <PagePanel>
      <PageHeader
        title={task.case_name}
        subtitle={`任务 ${task.id}`}
      />

      {frameworkReport?.kind === 'html' ? (
        <FrameworkHtmlReport taskId={task.id} report={frameworkReport} />
      ) : null}

      {frameworkReport?.kind === 'html' ? (
        <div className="text-sm font-medium text-muted-foreground">平台记录</div>
      ) : null}

      <StructuredReportDetail task={task} />
    </PagePanel>
  )
}

function FrameworkHtmlReport({
  taskId,
  report,
}: {
  taskId: string
  report: ExecutionFrameworkReport
}) {
  const reportUrl = report.source === 'url'
    ? report.entry
    : backendUrls.frameworkReport(taskId)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{report.title || '框架报告'}</CardTitle>
        <Button asChild variant="outline" size="sm">
          <a href={reportUrl} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" />
            打开框架报告
          </a>
        </Button>
      </CardHeader>
      <CardContent>
        {report.source === 'file' ? (
          <iframe
            title="框架 HTML 报告"
            src={reportUrl}
            className="h-[calc(100vh-18rem)] min-h-[520px] w-full rounded-md border bg-background"
          />
        ) : (
          <div className="rounded-md border bg-muted p-3 text-sm [overflow-wrap:anywhere]">
            {report.entry}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StructuredReportDetail({
  task,
}: {
  task: ExecutionTask
}) {
  return (
    <div className="grid grid-cols-[minmax(280px,0.78fr)_minmax(0,1.22fr)] gap-5 max-lg:grid-cols-1">
      <div className="grid content-start gap-4">
        <section className="rounded-lg border border-border/80 bg-card/60 p-4">
          <h2 className="m-0 mb-3 text-sm font-semibold">执行摘要</h2>
          <dl className="grid gap-2 text-sm">
            <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2">
              <dt className="text-muted-foreground">状态</dt>
              <dd className="m-0">
                <Badge variant={statusVariant(task.status)}>
                  {taskStatusLabel(task.status)}
                </Badge>
              </dd>
            </div>
            <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">耗时</dt>
              <dd className="m-0 font-medium">
                {task.duration_ms != null ? `${task.duration_ms} ms` : '-'}
              </dd>
            </div>
            <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">报告目录</dt>
              <dd className="m-0 min-w-0 [overflow-wrap:anywhere]">
                {task.report_dir}
              </dd>
            </div>
          </dl>
        </section>

        {task.logs.length > 0 && (
          <section className="rounded-lg border border-border/80 bg-card/60 p-4">
            <h2 className="m-0 mb-3 text-sm font-semibold">执行日志</h2>
              <div className="max-h-80 overflow-auto rounded-md border border-slate-900/10 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-200">
                {task.logs.map((log, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all border-b border-white/5 py-1 last:border-b-0">
                    {formatLogEntry(log)}
                  </div>
                ))}
              </div>
          </section>
        )}
      </div>

      <div className="grid content-start gap-4">
        {/* Step results and attachments removed */}
      </div>
    </div>
  )
}
