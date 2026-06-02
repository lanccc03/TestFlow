import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { createApiClient } from '@/lib/api'
import { backendBaseUrl } from '@/app/config'

import { formatLogEntry, statusVariant, taskStatusLabel } from '../utils/taskFormatters'

const api = createApiClient({ baseUrl: backendBaseUrl })

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

  return (
    <PagePanel>
      <PageHeader
        title={task.script_name}
        subtitle={`任务 ${task.id}`}
      />

      <div className="grid grid-cols-[1fr_2fr] gap-6 max-lg:grid-cols-1">
        {/* Left column: Summary + Logs */}
        <div className="grid content-start gap-6">
          {/* Summary card */}
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

          {/* Logs card */}
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

        {/* Right column: Steps + Attachments */}
        <div className="grid content-start gap-6">
          {/* Step detail cards */}
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

          {/* Attachments card */}
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
    </PagePanel>
  )
}
