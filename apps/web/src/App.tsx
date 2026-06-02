import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'

import { appRoutes } from './app/routes'
import { backendBaseUrl, websocketUrl } from './app/config'
import { createWebSocketClient, type WebSocketStatus } from './lib/websocket'
import { AppShell } from '@/components/layout/AppShell'
import type { BackendStatus } from './testflow'


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
  )
}

export default App
