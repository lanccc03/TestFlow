import { Cable, Server } from 'lucide-react'

import { StatusPill } from './StatusPill'
import type { BackendStatus } from '@/testflow'
import type { WebSocketStatus } from '@/lib/websocket'

const backendStateLabels: Record<BackendStatus['state'], string> = {
  exited: '已退出',
  failed: '异常',
  running: '运行中',
  starting: '启动中',
  stopped: '已停止',
}

const websocketStateLabels: Record<WebSocketStatus['state'], string> = {
  connected: '已连接',
  connecting: '连接中',
  disconnected: '已断开',
  reconnecting: '重连中',
}

export function TopStatusBar({
  backendStatus,
  websocketStatus,
}: {
  backendStatus: BackendStatus
  websocketStatus: WebSocketStatus
}) {
  return (
    <header className="flex min-h-18 items-center justify-between gap-4 border-b bg-card/90 px-7 py-3.5 max-sm:px-4 max-md:flex-col max-md:items-start">
      <div className="flex flex-wrap justify-end gap-2.5" aria-label="系统状态">
        <StatusPill
          icon={Server}
          label="后端服务"
          tone={backendStatus.state === 'running' ? 'success' : 'warning'}
          value={backendStateLabels[backendStatus.state]}
        />
        <StatusPill
          icon={Cable}
          label="WebSocket"
          tone={
            websocketStatus.state === 'connected' ? 'success' : 'warning'
          }
          value={websocketStateLabels[websocketStatus.state]}
        />
      </div>
    </header>
  )
}
