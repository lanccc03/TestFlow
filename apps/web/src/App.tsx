import { useEffect, useState } from 'react'
import type React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate, NavLink, Route, Routes } from 'react-router'
import {
  Cable,
  CheckCircle2,
  ChevronRight,
  LoaderCircle,
  Laptop,
  RefreshCcw,
  Server,
  WifiOff,
} from 'lucide-react'

import { appRoutes, navGroups } from './app/routes'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, createApiClient, type HealthResponse } from './lib/api'
import {
  createWebSocketClient,
  type WebSocketStatus,
} from './lib/websocket'
import type { BackendStatus, DesktopInfo } from './testflow'

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
const api = createApiClient({ baseUrl: backendBaseUrl })

function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    healthUrl: `${backendBaseUrl}/health`,
    state: window.testflow ? 'starting' : 'stopped',
  })
  const [desktopInfo, setDesktopInfo] = useState<DesktopInfo | undefined>()
  const [websocketStatus, setWebsocketStatus] = useState<WebSocketStatus>({
    state: 'connecting',
  })
  const [lastWebsocketMessage, setLastWebsocketMessage] = useState<
    string | undefined
  >()

  const healthQuery = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 5000,
  })
  const health = healthQuery.data
  const isHealthLoading = healthQuery.isPending

  useEffect(() => {
    if (!window.testflow) {
      return
    }

    let isMounted = true
    void window.testflow.desktop.getInfo().then((info) => {
      if (isMounted) {
        setDesktopInfo(info)
      }
    })
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
    const unsubscribe = client.subscribe(
      (status) => setWebsocketStatus(status),
      (message) => setLastWebsocketMessage(JSON.stringify(message)),
    )
    client.connect()

    return () => {
      unsubscribe()
      client.disconnect()
    }
  }, [])

  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand">
          <div className="brand-mark">TF</div>
          <div>
            <strong>TestFlow</strong>
            <span>自动化测试工作台</span>
          </div>
        </div>

        <nav className="nav-list">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.id}>
              <div className="nav-group-label">
                <group.icon aria-hidden="true" size={14} />
                {group.label}
              </div>
              {appRoutes
                .filter((route) => route.navGroup === group.id && !route.navHidden)
                .map((route) => (
                  <NavLink
                    className={({ isActive }) =>
                      `nav-link${isActive ? ' nav-link-active' : ''}`
                    }
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

      <div className="workspace">
        <header className="topbar">
          <div>
            <p>前端应用壳与基础交互框架</p>
            <strong>阶段三</strong>
          </div>
          <div className="status-strip" aria-label="系统状态">
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

        <main className="main-content">
          <section className="overview-grid" aria-label="运行状态">
            <StatusCard
              title="后端服务"
              icon={Server}
              badge={
                <StatusBadge
                  tone={
                    backendStatus.state === 'running' ? 'success' : 'warning'
                  }
                >
                  {backendStateLabels[backendStatus.state]}
                </StatusBadge>
              }
            >
              <code>{backendStatus.healthUrl}</code>
              {backendStatus.message ? <p>{backendStatus.message}</p> : null}
            </StatusCard>

            <StatusCard
              title="健康检查"
              icon={CheckCircle2}
              badge={<StatusBadge tone={health ? 'success' : 'danger'}>HTTP</StatusBadge>}
            >
              {isHealthLoading ? (
                <LoadingState label="正在检查后端" />
              ) : health ? (
                <dl className="detail-list">
                  <div>
                    <dt>服务</dt>
                    <dd>{health.service}</dd>
                  </div>
                  <div>
                    <dt>版本</dt>
                    <dd>{health.version}</dd>
                  </div>
                </dl>
              ) : (
                <ErrorState
                  title="健康检查不可用"
                  message={
                    healthQuery.error
                      ? formatError(healthQuery.error)
                      : '无法连接本地后端'
                  }
                />
              )}
            </StatusCard>

            <StatusCard
              title="WebSocket"
              icon={websocketStatus.state === 'connected' ? Cable : WifiOff}
              badge={
                <StatusBadge
                  tone={
                    websocketStatus.state === 'connected'
                      ? 'success'
                      : 'warning'
                  }
                >
                  {websocketStateLabels[websocketStatus.state]}
                </StatusBadge>
              }
            >
              <code>{websocketUrl}</code>
              <p>{lastWebsocketMessage ?? '等待后端实时消息'}</p>
            </StatusCard>

            <StatusCard
              title="桌面环境"
              icon={Laptop}
              badge={<Badge variant="secondary">{desktopInfo ? 'Electron' : 'Browser'}</Badge>}
            >
              <p>
                {desktopInfo
                  ? `Electron ${desktopInfo.versions.electron} on ${desktopInfo.platform}`
                  : '当前在浏览器预览模式运行'}
              </p>
              {!desktopInfo && (
                <Button
                  variant="secondary"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCcw aria-hidden="true" data-icon="inline-start" />
                  刷新状态
                </Button>
              )}
            </StatusCard>
          </section>

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

function StatusCard({
  badge,
  children,
  icon: Icon,
  title,
}: {
  badge: React.ReactNode
  children: React.ReactNode
  icon: typeof Server
  title: string
}) {
  return (
    <Card className="status-card" size="sm">
      <CardHeader className="card-heading">
        <Icon aria-hidden="true" />
        <CardTitle>{title}</CardTitle>
        <CardAction>{badge}</CardAction>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function StatusBadge({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'danger' | 'success' | 'warning'
}) {
  if (tone === 'danger') {
    return <Badge variant="destructive">{children}</Badge>
  }

  return (
    <Badge variant={tone === 'success' ? 'default' : 'secondary'}>
      {children}
    </Badge>
  )
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-row" role="status">
      <LoaderCircle aria-hidden="true" className="spinner" />
      <span>{label}</span>
      <Skeleton className="h-2 w-20" />
    </div>
  )
}

function ErrorState({ message, title }: { message: string; title: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
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
    <div className={`status-pill status-pill-${tone}`}>
      <Icon aria-hidden="true" size={14} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return `${error.status}: ${error.message}`
  }

  if (error instanceof Error) {
    return error.message
  }

  return '未知错误'
}

export default App
