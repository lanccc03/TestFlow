import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router'
import { Cable, ChevronRight, Server } from 'lucide-react'

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
    <div className={`status-pill status-pill-${tone}`}>
      <Icon aria-hidden="true" size={14} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default App
