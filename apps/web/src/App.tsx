import { useEffect, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { Navigate, Route, Routes } from 'react-router'

import { appRoutes } from './app/routes'
import { backendUrls, createBackendStatusSocket } from './app/backend'
import type { WebSocketStatus } from './lib/websocket'
import { AppShell } from '@/components/layout/AppShell'
import type { BackendStatus } from './testflow'

function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    healthUrl: backendUrls.health,
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
    const client = createBackendStatusSocket()
    const unsubscribe = client.subscribe((status) => setWebsocketStatus(status))
    client.connect()

    return () => {
      unsubscribe()
      client.disconnect()
    }
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <AppShell backendStatus={backendStatus} websocketStatus={websocketStatus}>
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
      </AppShell>
    </MotionConfig>
  )
}

export default App
