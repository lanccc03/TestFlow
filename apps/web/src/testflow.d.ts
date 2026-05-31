export type BackendStatus = {
  state: 'stopped' | 'starting' | 'running' | 'failed' | 'exited'
  healthUrl: string
  message?: string
  pid?: number
}

export type DesktopInfo = {
  platform: string
  versions: {
    app: string
    chrome: string
    electron: string
    node: string
  }
}

declare global {
  interface Window {
    testflow?: {
      desktop: {
        getInfo: () => Promise<DesktopInfo>
        platform: string
        versions: Omit<DesktopInfo['versions'], 'app'>
      }
      backend: {
        getStatus: () => Promise<BackendStatus | undefined>
        onStatusChange: (callback: (status: BackendStatus) => void) => () => void
        start: () => Promise<BackendStatus | undefined>
      }
    }
  }
}
