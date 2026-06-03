import type React from 'react'

import { Sidebar } from './Sidebar'
import { TopStatusBar } from './TopStatusBar'
import type { BackendStatus } from '@/testflow'
import type { WebSocketStatus } from '@/lib/websocket'

export function AppShell({
  backendStatus,
  children,
  websocketStatus,
}: {
  backendStatus: BackendStatus
  children: React.ReactNode
  websocketStatus: WebSocketStatus
}) {
  return (
    <>
      <div className="grid min-h-screen grid-cols-[264px_minmax(0,1fr)] bg-background pb-10 text-foreground max-lg:grid-cols-1">
        <Sidebar />
        <div className="min-w-0">
          <main className="grid gap-5 p-3 pb-8 max-sm:px-4">
            {children}
          </main>
        </div>
      </div>
      <TopStatusBar
        backendStatus={backendStatus}
        websocketStatus={websocketStatus}
      />
    </>
  )
}
