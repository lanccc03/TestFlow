export type WebSocketState =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'reconnecting'

export type WebSocketStatus = {
  state: WebSocketState
  message?: string
}

type WebSocketLike = {
  close: () => void
  onclose: ((event: CloseEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent<string>) => void) | null
  onopen: ((event: Event) => void) | null
}

type WebSocketCtor = new (url: string) => WebSocketLike

type WebSocketClientOptions = {
  reconnectDelayMs?: number
  url: string
  WebSocketCtor?: WebSocketCtor
}

type StatusListener = (status: WebSocketStatus) => void
type MessageListener = (message: unknown) => void

export function createWebSocketClient({
  reconnectDelayMs = 3000,
  url,
  WebSocketCtor = WebSocket as unknown as WebSocketCtor,
}: WebSocketClientOptions) {
  let reconnectTimer: number | undefined
  let shouldReconnect = true
  let socket: WebSocketLike | undefined
  const statusListeners = new Set<StatusListener>()
  const messageListeners = new Set<MessageListener>()

  function publishStatus(status: WebSocketStatus) {
    statusListeners.forEach((listener) => listener(status))
  }

  function publishMessage(message: unknown) {
    messageListeners.forEach((listener) => listener(message))
  }

  function connect() {
    clearReconnect()
    shouldReconnect = true
    publishStatus({ state: socket ? 'reconnecting' : 'connecting' })
    socket = new WebSocketCtor(url)

    socket.onopen = () => {
      publishStatus({ state: 'connected' })
    }

    socket.onmessage = (event) => {
      try {
        publishMessage(JSON.parse(event.data) as unknown)
      } catch {
        publishMessage(event.data)
      }
    }

    socket.onerror = () => {
      publishStatus({ state: 'disconnected', message: 'WebSocket 连接异常' })
    }

    socket.onclose = () => {
      publishStatus({ state: 'disconnected' })
      socket = undefined
      if (shouldReconnect) {
        reconnectTimer = window.setTimeout(connect, reconnectDelayMs)
      }
    }
  }

  function clearReconnect() {
    if (reconnectTimer !== undefined) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = undefined
    }
  }

  return {
    connect,
    disconnect() {
      shouldReconnect = false
      clearReconnect()
      socket?.close()
      socket = undefined
    },
    subscribe(onStatus: StatusListener, onMessage?: MessageListener) {
      statusListeners.add(onStatus)
      if (onMessage) {
        messageListeners.add(onMessage)
      }
      return () => {
        statusListeners.delete(onStatus)
        if (onMessage) {
          messageListeners.delete(onMessage)
        }
      }
    },
  }
}
