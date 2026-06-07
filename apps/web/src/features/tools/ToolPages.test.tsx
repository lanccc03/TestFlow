import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const httpDelete = vi.hoisted(() => vi.fn())
const httpGet = vi.hoisted(() => vi.fn())
const httpPost = vi.hoisted(() => vi.fn())
const httpPut = vi.hoisted(() => vi.fn())
const terminalMock = vi.hoisted(() => {
  class FakeTerminal {
    cols = 100
    rows = 30
    dataHandler: ((data: string) => void) | undefined
    dispose = vi.fn()
    loadAddon = vi.fn()
    open = vi.fn()
    write = vi.fn()

    constructor(_options?: unknown) {}

    onData(handler: (data: string) => void) {
      this.dataHandler = handler
      return { dispose: vi.fn() }
    }

    emitData(data: string) {
      this.dataHandler?.(data)
    }
  }

  class FakeFitAddon {
    fit = vi.fn()
  }

  return {
    FakeFitAddon,
    FakeTerminal,
    fitInstances: [] as FakeFitAddon[],
    terminalInstances: [] as FakeTerminal[],
  }
})

vi.mock('axios', () => ({
  default: {
    create: () => ({
      delete: httpDelete,
      get: httpGet,
      post: httpPost,
      put: httpPut,
    }),
    isAxiosError: (error: unknown) =>
      Boolean(
        error &&
          typeof error === 'object' &&
          'isAxiosError' in error &&
          error.isAxiosError,
      ),
  },
}))

vi.mock('@xterm/xterm', () => ({
  Terminal: class extends terminalMock.FakeTerminal {
    constructor(options?: unknown) {
      super(options)
      terminalMock.terminalInstances.push(this)
    }
  },
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class extends terminalMock.FakeFitAddon {
    constructor() {
      super()
      terminalMock.fitInstances.push(this)
    }
  },
}))

vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

import { CommandLibraryPage, ScpTransferPage, SshTerminalPage } from '@/features/tools'
import {
  resetSshTerminalStore,
  useSshTerminalStore,
} from '@/features/tools/ssh-terminal/store'

const command = {
  id: 'command-1',
  name: '查看日志',
  command: 'tail -f /var/log/syslog',
  description: '跟随系统日志',
  group: 'diagnostics',
  tags: ['logs'],
  created_at: '2026-06-01T00:00:00+00:00',
  updated_at: '2026-06-01T00:00:00+00:00',
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CommandLibraryPage', () => {
  beforeEach(() => {
    httpGet.mockImplementation((path: string) => {
      if (path === '/api/commands') {
        return Promise.resolve({ data: { items: [command] } })
      }

      return Promise.reject(new Error(`Unexpected path: ${path}`))
    })
    httpPost.mockResolvedValue({
      data: { ...command, id: 'command-2', name: '查看目录', command: 'ls -la' },
    })
    httpPut.mockResolvedValue({
      data: { ...command, command: 'dmesg -w' },
    })
    httpDelete.mockResolvedValue({ data: undefined })
  })

  afterEach(() => {
    cleanup()
    httpDelete.mockReset()
    httpGet.mockReset()
    httpPost.mockReset()
    httpPut.mockReset()
  })

  it('searches, creates, edits, and deletes command templates', async () => {
    renderWithQuery(<CommandLibraryPage />)

    expect(await screen.findByText('tail -f /var/log/syslog')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('搜索命令'), {
      target: { value: 'tail' },
    })
    await waitFor(() =>
      expect(httpGet).toHaveBeenLastCalledWith('/api/commands', {
        params: { search: 'tail' },
      }),
    )

    fireEvent.change(screen.getByLabelText('命令名称'), {
      target: { value: '查看目录' },
    })
    fireEvent.change(screen.getByLabelText('完整命令'), {
      target: { value: 'ls -la' },
    })
    fireEvent.change(screen.getByLabelText('分组'), {
      target: { value: 'diagnostics' },
    })
    fireEvent.change(screen.getByLabelText('标签'), {
      target: { value: 'linux, files' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存命令' }))

    await waitFor(() =>
      expect(httpPost).toHaveBeenCalledWith('/api/commands', {
        name: '查看目录',
        command: 'ls -la',
        description: '',
        group: 'diagnostics',
        tags: ['linux', 'files'],
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: '编辑 查看日志' }))
    fireEvent.change(screen.getByLabelText('完整命令'), {
      target: { value: 'dmesg -w' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存命令' }))

    await waitFor(() =>
      expect(httpPut).toHaveBeenCalledWith('/api/commands/command-1', {
        name: '查看日志',
        command: 'dmesg -w',
        description: '跟随系统日志',
        group: 'diagnostics',
        tags: ['logs'],
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: '删除 查看日志' }))
    await waitFor(() =>
      expect(httpDelete).toHaveBeenCalledWith('/api/commands/command-1'),
    )
  })
})

describe('SshTerminalPage', () => {
  beforeEach(() => {
    terminalMock.terminalInstances.length = 0
    terminalMock.fitInstances.length = 0
    FakeWebSocket.instances.length = 0
    httpGet.mockResolvedValue({ data: { items: [command] } })
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    cleanup()
    resetSshTerminalStore()
    httpGet.mockReset()
    vi.unstubAllGlobals()
  })

  it('connects over SSH websocket and fills command suggestions without executing', async () => {
    renderWithQuery(<SshTerminalPage />)

    await waitFor(() =>
      expect(terminalMock.terminalInstances).toHaveLength(1),
    )

    fireEvent.change(screen.getByLabelText('主机'), {
      target: { value: '127.0.0.1' },
    })
    fireEvent.change(screen.getByLabelText('端口'), {
      target: { value: '2222' },
    })
    fireEvent.change(screen.getByLabelText('账号'), {
      target: { value: 'tester' },
    })
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'secret-password' },
    })
    fireEvent.click(screen.getByLabelText('跳过本次主机密钥校验'))
    fireEvent.click(screen.getByRole('button', { name: '连接' }))

    const socket = FakeWebSocket.instances[0]
    socket.open()

    await waitFor(() =>
      expect(socket.sentJson()).toContainEqual({
        type: 'connect',
        host: '127.0.0.1',
        port: 2222,
        username: 'tester',
        password: 'secret-password',
        cols: 100,
        rows: 30,
        skip_host_key_check: true,
      }),
    )

    const terminal = terminalMock.terminalInstances[0]
    terminal.emitData('ta')
    expect(socket.sentJson()).toContainEqual({ type: 'input', data: 'ta' })

    fireEvent.click(
      await screen.findByRole('button', {
        name: /tail -f \/var\/log\/syslog/,
      }),
    )

    expect(socket.sentJson()).toContainEqual({
      type: 'input',
      data: 'il -f /var/log/syslog',
    })
    expect(socket.sentJson()).not.toContainEqual({
      type: 'input',
      data: 'il -f /var/log/syslog\n',
    })

    socket.message({ type: 'output', data: 'ready\r\n' })
    expect(terminal.write).toHaveBeenCalledWith('ready\r\n')

    window.dispatchEvent(new Event('resize'))
    expect(socket.sentJson()).toContainEqual({
      type: 'resize',
      cols: 100,
      rows: 30,
    })

    fireEvent.click(screen.getByRole('button', { name: '断开' }))
    expect(socket.sentJson()).toContainEqual({ type: 'disconnect' })
  })

  it('keeps the active SSH websocket when the page unmounts and remounts', async () => {
    const view = renderWithQuery(<SshTerminalPage />)

    await waitFor(() =>
      expect(terminalMock.terminalInstances).toHaveLength(1),
    )

    fireEvent.change(screen.getByLabelText('主机'), {
      target: { value: '127.0.0.1' },
    })
    fireEvent.change(screen.getByLabelText('账号'), {
      target: { value: 'tester' },
    })
    fireEvent.click(screen.getByRole('button', { name: '连接' }))

    const socket = FakeWebSocket.instances[0]
    socket.open()
    socket.message({ type: 'status', status: 'connected' })

    await waitFor(() => expect(screen.getByText('已连接')).toBeInTheDocument())

    view.unmount()

    expect(socket.close).not.toHaveBeenCalled()

    renderWithQuery(<SshTerminalPage />)

    await waitFor(() =>
      expect(terminalMock.terminalInstances).toHaveLength(2),
    )
    expect(screen.getByText('已连接')).toBeInTheDocument()

    socket.message({ type: 'output', data: 'still alive\r\n' })
    expect(terminalMock.terminalInstances[1].write).toHaveBeenCalledWith(
      'still alive\r\n',
    )
  })

  it('restores terminal output when returning to the SSH page', async () => {
    const view = renderWithQuery(<SshTerminalPage />)

    await waitFor(() =>
      expect(terminalMock.terminalInstances).toHaveLength(1),
    )

    fireEvent.change(screen.getByLabelText('主机'), {
      target: { value: '127.0.0.1' },
    })
    fireEvent.change(screen.getByLabelText('账号'), {
      target: { value: 'tester' },
    })
    fireEvent.click(screen.getByRole('button', { name: '连接' }))

    const socket = FakeWebSocket.instances[0]
    socket.open()
    socket.message({ type: 'status', status: 'connected' })
    socket.message({ type: 'output', data: 'ready\r\n' })

    view.unmount()
    socket.message({ type: 'output', data: 'background\r\n' })

    renderWithQuery(<SshTerminalPage />)

    await waitFor(() =>
      expect(terminalMock.terminalInstances).toHaveLength(2),
    )
    expect(terminalMock.terminalInstances[1].write).toHaveBeenCalledWith(
      'ready\r\nbackground\r\n',
    )
  })
})

describe('ScpTransferPage', () => {
  beforeEach(() => {
    FakeWebSocket.instances.length = 0
    resetSshTerminalStore()
    httpGet.mockImplementation((path: string, config?: unknown) => {
      if (path === '/api/scp/local/tree') {
        return Promise.resolve({
          data: {
            path: '/local',
            items: [
              {
                name: 'app.zip',
                path: '/local/app.zip',
                type: 'file',
                size: 128,
              },
              {
                name: 'downloads',
                path: '/local/downloads',
                type: 'directory',
              },
            ],
          },
        })
      }

      if (path === '/api/scp/remote/tree') {
        const params = (config as {
          params: { session_id: string; path: string }
        }).params
        expect(params.session_id).toBe('session-1')
        const remotePath = params.path
        return Promise.resolve({
          data: {
            path: remotePath,
            items: [
              {
                name: 'home',
                path: remotePath === '.' ? './home' : `${remotePath}/home`,
                type: 'directory',
              },
              {
                name: 'report.log',
                path: remotePath === '.' ? './report.log' : `${remotePath}/report.log`,
                type: 'file',
                size: 64,
              },
            ],
          },
        })
      }

      if (path === '/api/scp/transfers') {
        return Promise.resolve({ data: { items: [] } })
      }

      return Promise.reject(new Error(`Unexpected path: ${path}`))
    })
    httpPost.mockImplementation((path: string, payload: unknown) =>
      Promise.resolve({
        data: {
          id: path.includes('download') ? 'download-1' : 'upload-1',
          direction: path.includes('download') ? 'download' : 'upload',
          source_path: (payload as { source_path: string }).source_path,
          target_path: (payload as { target_path: string }).target_path,
          status: 'completed',
          progress: 100,
        },
      }),
    )
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    cleanup()
    resetSshTerminalStore()
    httpGet.mockReset()
    httpPost.mockReset()
    vi.unstubAllGlobals()
  })

  it('requires an active SSH terminal session before enabling SCP', () => {
    renderWithQuery(<ScpTransferPage />)

    expect(screen.getByText('请先连接 SSH 终端')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '前往 SSH 终端' }),
    ).toHaveAttribute('href', '/ssh')
    expect(httpGet).not.toHaveBeenCalledWith('/api/scp/remote/tree', expect.anything())
  })

  it('loads both file trees and creates upload and download transfers', async () => {
    useSshTerminalStore.setState({
      connectionSummary: 'tester@127.0.0.1:22',
      sessionId: 'session-1',
      status: 'connected',
    })

    renderWithQuery(<ScpTransferPage />)

    expect(await screen.findByText('app.zip')).toBeInTheDocument()
    expect(await screen.findByText('report.log')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '选择本地 app.zip' }))
    fireEvent.click(screen.getByRole('button', { name: '选择远程 home' }))
    fireEvent.click(screen.getByRole('button', { name: '上传' }))

    await waitFor(() =>
      expect(httpPost).toHaveBeenCalledWith('/api/scp/transfers/upload', {
        session_id: 'session-1',
        source_path: '/local/app.zip',
        target_path: './home',
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: '选择远程 report.log' }))
    fireEvent.click(screen.getByRole('button', { name: '选择本地 downloads' }))
    fireEvent.click(screen.getByRole('button', { name: '下载' }))

    await waitFor(() =>
      expect(httpPost).toHaveBeenCalledWith('/api/scp/transfers/download', {
        session_id: 'session-1',
        source_path: './report.log',
        target_path: '/local/downloads',
      }),
    )
  })

  it('uploads a selected local file to the current remote path', async () => {
    useSshTerminalStore.setState({
      connectionSummary: 'tester@127.0.0.1:22',
      sessionId: 'session-1',
      status: 'connected',
    })

    renderWithQuery(<ScpTransferPage />)

    fireEvent.click(await screen.findByRole('button', { name: '选择本地 app.zip' }))
    fireEvent.click(screen.getByRole('button', { name: '上传' }))

    await waitFor(() =>
      expect(httpPost).toHaveBeenCalledWith('/api/scp/transfers/upload', {
        session_id: 'session-1',
        source_path: '/local/app.zip',
        target_path: '.',
      }),
    )
  })

  it('waits for Enter before loading a typed remote path', async () => {
    useSshTerminalStore.setState({
      connectionSummary: 'tester@127.0.0.1:22',
      sessionId: 'session-1',
      status: 'connected',
    })

    renderWithQuery(<ScpTransferPage />)

    expect(await screen.findByText('report.log')).toBeInTheDocument()
    httpGet.mockClear()

    fireEvent.change(screen.getByLabelText('远程路径'), {
      target: { value: '/tmp' },
    })

    expect(httpGet).not.toHaveBeenCalledWith(
      '/api/scp/remote/tree',
      expect.objectContaining({
        params: { session_id: 'session-1', path: '/tmp' },
      }),
    )

    fireEvent.keyDown(screen.getByLabelText('远程路径'), { key: 'Enter' })

    await waitFor(() =>
      expect(httpGet).toHaveBeenCalledWith('/api/scp/remote/tree', {
        params: { session_id: 'session-1', path: '/tmp' },
      }),
    )
  })

  it('updates the transfer queue from websocket events and allows retry', async () => {
    useSshTerminalStore.setState({
      connectionSummary: 'tester@127.0.0.1:22',
      sessionId: 'session-1',
      status: 'connected',
    })

    renderWithQuery(<ScpTransferPage />)

    const socket = FakeWebSocket.instances.find((item) =>
      item.url.includes('/ws/scp/transfers'),
    )
    expect(socket).toBeDefined()
    socket?.message({
      type: 'transfer_update',
      task: {
        id: 'transfer-1',
        direction: 'upload',
        source_path: '/local/app.zip',
        target_path: './home',
        status: 'failed',
        progress: 0,
        error_message: 'permission denied',
      },
    })

    expect(await screen.findByText('permission denied')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重试 transfer-1' }))

    await waitFor(() =>
      expect(httpPost).toHaveBeenCalledWith(
        '/api/scp/transfers/transfer-1/retry',
        {},
      ),
    )
  })
})

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onopen: ((event: Event) => void) | null = null
  sent: string[] = []
  url: string

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  close = vi.fn(() => {
    this.onclose?.({} as CloseEvent)
  })

  open() {
    this.onopen?.({} as Event)
  }

  send(data: string) {
    this.sent.push(data)
  }

  message(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent<string>)
  }

  sentJson() {
    return this.sent.map((message) => JSON.parse(message) as unknown)
  }
}
