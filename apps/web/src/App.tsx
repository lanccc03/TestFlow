import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router'
import { Cable, ChevronRight, Server } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { appRoutes, navGroups } from './app/routes'
import { createWebSocketClient, type WebSocketStatus } from './lib/websocket'
import type { BackendStatus } from './testflow'

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

const backendBaseUrl = 'http://127.0.0.1:8000'
const websocketUrl = 'ws://127.0.0.1:8000/ws'

function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    healthUrl: `${backendBaseUrl}/health`,
    state: window.testflow ? 'starting' : 'stopped',
  })
  const [websocketStatus, setWebsocketStatus] = useState<WebSocketStatus>({
    state: 'connecting',
  })

  useEffect(() => {
    if (!window.testflow) {
      return
    }

    let isMounted = true
    void window.testflow.backend.getStatus().then((status) => {
      if (isMounted && status) {
        setBackendStatus(status)
      }
    })
    const unsubscribe = window.testflow.backend.onStatusChange((status) => {
      setBackendStatus(status)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const client = createWebSocketClient({ url: websocketUrl })
    const unsubscribe = client.subscribe((status) => setWebsocketStatus(status))
    client.connect()

    return () => {
      unsubscribe()
      client.disconnect()
    }
  }, [])

  return (
    <div className="grid min-h-screen grid-cols-[264px_minmax(0,1fr)] bg-background text-foreground max-lg:grid-cols-1">
      <aside
        className="flex flex-col gap-7 border-r border-sidebar-border bg-sidebar px-3.5 py-5 text-sidebar-foreground max-lg:gap-4"
        aria-label="主导航"
      >
        <div className="flex items-center gap-3 px-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
            TF
          </div>
          <div>
            <strong className="block text-base font-semibold text-sidebar-foreground">
              TestFlow
            </strong>
            <span className="mt-0.5 block text-xs text-sidebar-foreground/60">
              自动化测试工作台
            </span>
          </div>
        </div>

        <nav className="grid gap-2 max-sm:grid-cols-1 max-lg:grid-cols-3">
          {navGroups.map((group) => (
            <div className="grid gap-2 border-t border-sidebar-border pt-4" key={group.id}>
              <div className="flex items-center gap-2 px-2 text-xs font-semibold text-sidebar-foreground/60">
                <group.icon aria-hidden="true" size={14} />
                {group.label}
              </div>
              {appRoutes
                .filter((route) => route.navGroup === group.id && !route.navHidden)
                .map((route) => (
                  <NavLink
                    className={({ isActive }) =>
                      cn(
                        'grid min-h-9 grid-cols-[18px_minmax(0,1fr)_14px] items-center gap-2.5 rounded-lg px-2.5 text-sm text-sidebar-foreground/75 no-underline transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        isActive &&
                        'bg-sidebar-accent text-sidebar-accent-foreground font-semibold',
                      )
                    }
                    end
                    key={route.path}
                    to={route.path}
                  >
                    <route.icon aria-hidden="true" size={17} />
                    <span>{route.label}</span>
                    <ChevronRight aria-hidden="true" size={14} />
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="grid min-w-0 grid-rows-[auto_1fr]">
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

        <main className="grid gap-5 p-3 pb-8 max-sm:px-4">
          <Routes>
            <Route element={<Navigate replace to="/scripts" />} path="/" />
            {appRoutes.map((route) => (
              <Route
                element={route.element}
                key={route.path}
                path={route.path}
              />
            ))}
            <Route element={<Navigate replace to="/scripts" />} path="*" />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function StatusPill({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof Server
  label: string
  tone: 'success' | 'warning'
  value: string
}) {
  return (
    <Badge
      className={cn(
        'min-h-8 gap-1.5 rounded-lg px-2.5 font-medium',
        tone === 'success'
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground',
      )}
      variant={tone === 'success' ? 'default' : 'secondary'}
    >
      <Icon aria-hidden="true" size={14} />
      <span className="text-current/70">{label}</span>
      <strong className="font-semibold">{value}</strong>
    </Badge>
  )
}

export default App
