import { useEffect, useState } from 'react'

import type { BackendStatus, DesktopInfo } from './testflow'

const statusLabels: Record<BackendStatus['state'], string> = {
  exited: 'Exited',
  failed: 'Failed',
  running: 'Running',
  starting: 'Starting',
  stopped: 'Stopped',
}

const statusDescriptions: Record<BackendStatus['state'], string> = {
  exited: 'The backend process stopped unexpectedly.',
  failed: 'The backend is not healthy. Check the startup message.',
  running: 'The local FastAPI backend is healthy.',
  starting: 'Electron is starting the local FastAPI backend.',
  stopped: 'The backend process is stopped.',
}

function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    healthUrl: 'http://127.0.0.1:8000/health',
    state: window.testflow ? 'starting' : 'stopped',
  })
  const [desktopInfo, setDesktopInfo] = useState<DesktopInfo | undefined>()

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

  const statusClassName = `backend-state backend-state-${backendStatus.state}`

  return (
    <main className="app-shell">
      <section className="status-panel">
        <p className="eyebrow">TestFlow</p>
        <h1>Automation testing workspace</h1>
        <p className="lede">
          Electron is managing the local FastAPI backend for the desktop
          testing workspace.
        </p>
      </section>

      <section className="service-grid" aria-label="Desktop services">
        <article className="backend-card">
          <span>Backend</span>
          <div className="backend-card-heading">
            <strong>{statusLabels[backendStatus.state]}</strong>
            <mark className={statusClassName}>
              {backendStatus.state}
            </mark>
          </div>
          <p>{statusDescriptions[backendStatus.state]}</p>
          {backendStatus.message ? <small>{backendStatus.message}</small> : null}
          <code>{backendStatus.healthUrl}</code>
        </article>
        <article>
          <span>Desktop</span>
          <strong>Electron shell</strong>
          <code>
            {desktopInfo
              ? `Electron ${desktopInfo.versions.electron} on ${desktopInfo.platform}`
              : 'Browser preview'}
          </code>
        </article>
        <article>
          <span>Frontend</span>
          <strong>React workspace</strong>
          <code>http://127.0.0.1:5174</code>
        </article>
      </section>
    </main>
  )
}

export default App
