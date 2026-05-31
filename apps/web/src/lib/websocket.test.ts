import { describe, expect, it, vi } from 'vitest'

import { createWebSocketClient } from './websocket'

describe('createWebSocketClient', () => {
  it('publishes connection states and backend messages', () => {
    const sockets: FakeSocket[] = []
    const client = createWebSocketClient({
      reconnectDelayMs: 10,
      url: 'ws://backend.test/ws',
      WebSocketCtor: class extends FakeSocket {
        constructor(url: string) {
          super(url)
          sockets.push(this)
        }
      },
    })
    const onStatus = vi.fn()
    const onMessage = vi.fn()

    client.subscribe(onStatus, onMessage)
    client.connect()
    sockets[0].open()
    sockets[0].message({ type: 'connection', status: 'connected' })
    sockets[0].close()
    client.disconnect()

    expect(onStatus).toHaveBeenCalledWith({ state: 'connecting' })
    expect(onStatus).toHaveBeenCalledWith({ state: 'connected' })
    expect(onStatus).toHaveBeenCalledWith({ state: 'disconnected' })
    expect(onMessage).toHaveBeenCalledWith({
      type: 'connection',
      status: 'connected',
    })
  })
})

class FakeSocket {
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onopen: ((event: Event) => void) | null = null
  readonly url: string

  constructor(url: string) {
    this.url = url
  }

  close() {
    this.onclose?.({} as CloseEvent)
  }

  open() {
    this.onopen?.({} as Event)
  }

  message(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent<string>)
  }
}
