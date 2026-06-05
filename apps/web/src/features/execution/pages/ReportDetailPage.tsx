import { ExternalLink } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
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
  type ExecutionReportAttachment,
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

  const { task, attachments } = reportQuery.data
  const frameworkReport = reportQuery.data.framework_report ?? task.framework_report ?? null

  return (
    <PagePanel>
      <PageHeader
        title={task.script_name}
        subtitle={`任务 ${task.id}`}
      />

      {frameworkReport?.kind === 'html' ? (
        <FrameworkHtmlReport taskId={task.id} report={frameworkReport} />
      ) : null}

      {frameworkReport?.kind === 'html' ? (
        <div className="text-sm font-medium text-muted-foreground">平台记录</div>
      ) : null}

      <StructuredReportDetail task={task} attachments={attachments} />
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
  attachments,
}: {
  task: ExecutionTask
  attachments: ExecutionReportAttachment[]
}) {
  return (
    <div className="grid grid-cols-[1fr_2fr] gap-6 max-lg:grid-cols-1">
      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>执行摘要</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">状态:</span>
              <Badge variant={statusVariant(task.status)}>
                {taskStatusLabel(task.status)}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">目标设备: </span>
              {task.target_device}
            </div>
            <div>
              <span className="text-muted-foreground">执行人: </span>
              {task.executor}
            </div>
            <div>
              <span className="text-muted-foreground">耗时: </span>
              {task.duration_ms != null ? `${task.duration_ms} ms` : '-'}
            </div>
            <div>
              <span className="text-muted-foreground">报告目录: </span>
              {task.report_dir}
            </div>
          </CardContent>
        </Card>

        {task.logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>执行日志</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
                {task.logs.map((log, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all">
                    {formatLogEntry(log)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid content-start gap-6">
        {task.steps.map((step) => (
          <Card key={step.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant={statusVariant(step.status)}>
                  {taskStatusLabel(step.status)}
                </Badge>
                <span>
                  {step.keyword} — {step.description}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">耗时: </span>
                {step.duration_ms != null ? `${step.duration_ms} ms` : '-'}
              </div>
              {step.error_message && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {step.error_message}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ))}

        {attachments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>附件</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {attachments.map((attachment, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span className="font-medium">{attachment.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {attachment.path}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
