import { create } from 'zustand'

import { backendUrls } from '@/app/backend'

export const sshWebSocketUrl = backendUrls.sshWebSocket

export type SshConnectionForm = {
  host: string
  port: string
  username: string
  password: string
  skipHostKeyCheck: boolean
}

type SshServerMessage =
  | { type: 'output'; data: string }
  | { type: 'status'; status: string; message?: string; session_id?: string }
  | { type: 'error'; message: string }

type ConnectOptions = {
  cols: number
  rows: number
}

type SshTerminalState = {
  connectionSummary: string
  currentLine: string
  errorMessage: string
  form: SshConnectionForm
  outputBuffer: string
  sessionId: string
  status: string
  applySuggestion: (command: string) => void
  attachTerminal: (writer: (data: string) => void) => () => void
  connect: (options: ConnectOptions) => void
  disconnect: () => void
  sendInput: (data: string) => void
  sendResize: (options: ConnectOptions) => void
  updateForm: (update: Partial<SshConnectionForm>) => void
}

const emptyConnectionForm: SshConnectionForm = {
  host: '',
  port: '22',
  username: '',
  password: '',
  skipHostKeyCheck: false,
}

const maxOutputBufferLength = 200_000

let socket: WebSocket | null = null
let terminalWriter: ((data: string) => void) | null = null

export const useSshTerminalStore = create<SshTerminalState>((set, get) => ({
  connectionSummary: '',
  currentLine: '',
  errorMessage: '',
  form: emptyConnectionForm,
  outputBuffer: '',
  sessionId: '',
  status: 'disconnected',
  applySuggestion(command) {
    const currentLine = get().currentLine
    const data = command.startsWith(currentLine)
      ? command.slice(currentLine.length)
      : command
    if (!data) {
      return
    }

    set({ currentLine: command })
    sendSocketMessage({ type: 'input', data })
  },
  attachTerminal(writer) {
    terminalWriter = writer
    const { outputBuffer } = get()
    if (outputBuffer) {
      writer(outputBuffer)
    }
    return () => {
      if (terminalWriter === writer) {
        terminalWriter = null
      }
    }
  },
  connect({ cols, rows }) {
    socket?.close()
    set({ errorMessage: '', status: 'connecting' })

    const nextSocket = new WebSocket(sshWebSocketUrl)
    socket = nextSocket

    nextSocket.onopen = () => {
      const { form } = get()
      sendSocketMessage({
        type: 'connect',
        host: form.host,
        port: Number(form.port),
        username: form.username,
        password: form.password,
        cols,
        rows,
        skip_host_key_check: form.skipHostKeyCheck,
      })
    }

    nextSocket.onmessage = (event) => {
      const message = JSON.parse(event.data) as SshServerMessage
      if (message.type === 'output') {
        set((state) => ({
          outputBuffer: trimOutputBuffer(state.outputBuffer + message.data),
        }))
        terminalWriter?.(message.data)
      } else if (message.type === 'status') {
        const { form } = get()
        set({
          connectionSummary:
            message.status === 'connected'
              ? `${form.username}@${form.host}:${form.port}`
              : get().connectionSummary,
          errorMessage: message.message ?? get().errorMessage,
          sessionId:
            message.status === 'connected'
              ? message.session_id ?? ''
              : get().sessionId,
          status: message.status,
        })
      } else if (message.type === 'error') {
        set({ errorMessage: message.message })
      }
    }

    nextSocket.onerror = () => {
      set({ errorMessage: 'SSH WebSocket 连接异常', status: 'error' })
    }

    nextSocket.onclose = () => {
      if (socket === nextSocket) {
        socket = null
        set({ connectionSummary: '', sessionId: '', status: 'disconnected' })
      }
    }
  },
  disconnect() {
    sendSocketMessage({ type: 'disconnect' })
    socket?.close()
    socket = null
    set({ connectionSummary: '', sessionId: '', status: 'disconnected' })
  },
  sendInput(data) {
    set({ currentLine: applyTerminalInput(get().currentLine, data) })
    sendSocketMessage({ type: 'input', data })
  },
  sendResize(options) {
    sendSocketMessage({ type: 'resize', cols: options.cols, rows: options.rows })
  },
  updateForm(update) {
    set((state) => ({ form: { ...state.form, ...update } }))
  },
}))

export function resetSshTerminalStore() {
  socket?.close()
  socket = null
  terminalWriter = null
  useSshTerminalStore.setState({
    connectionSummary: '',
    currentLine: '',
    errorMessage: '',
    form: emptyConnectionForm,
    outputBuffer: '',
    sessionId: '',
    status: 'disconnected',
  })
}

function sendSocketMessage(message: Record<string, unknown>) {
  socket?.send(JSON.stringify(message))
}

function trimOutputBuffer(output: string) {
  if (output.length <= maxOutputBufferLength) {
    return output
  }
  return output.slice(output.length - maxOutputBufferLength)
}

function applyTerminalInput(currentLine: string, data: string) {
  let nextLine = currentLine
  for (const char of data) {
    if (char === '\r' || char === '\n') {
      nextLine = ''
    } else if (char === '') {
      nextLine = nextLine.slice(0, -1)
    } else if (char >= ' ' && char !== '') {
      nextLine += char
    }
  }
  return nextLine
}
