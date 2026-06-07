import type React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useLocation } from 'react-router'

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
  const location = useLocation()

  return (
    <>
      <div className="grid h-screen grid-cols-[248px_minmax(0,1fr)] overflow-hidden bg-background pb-9 text-foreground max-lg:grid-cols-1">
        <Sidebar />
        <div className="min-h-0 min-w-0 overflow-y-auto bg-[linear-gradient(90deg,rgb(23_32_29_/_0.045)_1px,transparent_1px),linear-gradient(180deg,rgb(255_255_255_/_0.72),transparent_260px)] bg-[length:24px_24px,100%_100%]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.main
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto grid w-full max-w-[1480px] gap-5 px-5 py-5 pb-8 max-sm:px-4"
              exit={{ opacity: 0, y: 4 }}
              initial={{ opacity: 0, y: 8 }}
              key={location.pathname}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
      <StatusBar
        backendStatus={backendStatus}
        websocketStatus={websocketStatus}
      />
    </>
  )
}
