import type React from 'react'

import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
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
      <div className="grid min-h-screen grid-cols-[248px_minmax(0,1fr)] bg-background pb-10 text-foreground max-lg:grid-cols-1">
        <Sidebar />
        <div className="min-w-0 bg-[linear-gradient(180deg,rgb(255_255_255_/_0.48),transparent_240px)]">
          <main className="mx-auto grid w-full max-w-[1480px] gap-5 px-5 py-5 pb-8 max-sm:px-4">
            {children}
          </main>
        </div>
      </div>
      <StatusBar
        backendStatus={backendStatus}
        websocketStatus={websocketStatus}
      />
    </>
  )
}
