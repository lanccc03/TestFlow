import { backendBaseUrl } from './config'

import { createApiClient, frameworkReportUrl } from '@/lib/api'
import { createWebSocketClient } from '@/lib/websocket'

const httpBaseUrl = backendBaseUrl.replace(/\/+$/, '')

function websocketUrl(path: string) {
  const url = new URL(path, httpBaseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

export const api = createApiClient({ baseUrl: httpBaseUrl })

export const backendUrls = {
  health: `${httpBaseUrl}/health`,
  frameworkReport: (taskId: string) => frameworkReportUrl(httpBaseUrl, taskId),
  sshWebSocket: websocketUrl('/ws/ssh'),
  scpTransfersWebSocket: websocketUrl('/ws/scp/transfers'),
}

export function createBackendStatusSocket() {
  return createWebSocketClient({ url: websocketUrl('/ws') })
}

export function createExecutionSocket() {
  return createWebSocketClient({ url: websocketUrl('/ws/executions') })
}
