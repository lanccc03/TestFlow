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

export function StatusBar({
  backendStatus,
  websocketStatus,
}: {
  backendStatus: BackendStatus
  websocketStatus: WebSocketStatus
}) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 flex h-8 items-center justify-between border-t border-sidebar-border bg-sidebar px-2 text-xs text-sidebar-foreground shadow-[0_-1px_2px_rgb(0_0_0_/_0.06)]">
      <div className="flex min-w-0 items-center gap-1 px-1 text-[11px] text-sidebar-foreground/60 max-sm:hidden">
        <span className="font-medium text-sidebar-foreground/75">TestFlow</span>
        <span aria-hidden="true">/</span>
        <span>工作台就绪</span>
      </div>
      <div
        className="flex min-w-0 items-center divide-x divide-sidebar-border max-sm:ml-auto"
        aria-label="系统状态"
      >
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
    </footer>
  )
}
