export function frameworkReportUrl(baseUrl: string, taskId: string) {
  return `${baseUrl.replace(/\/+$/, '')}/api/reports/${encodeURIComponent(taskId)}/framework-report`
}
