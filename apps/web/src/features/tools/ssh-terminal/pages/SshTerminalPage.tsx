import '@xterm/xterm/css/xterm.css'

import type { FitAddon as XtermFitAddon } from '@xterm/addon-fit'
import type { Terminal as XtermTerminal } from '@xterm/xterm'
import {
  Plug,
  SquareTerminal,
} from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import {
  useQuery,
} from '@tanstack/react-query'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import {
  createApiClient,
  type CommandTemplate,
} from '@/lib/api'
import { backendBaseUrl } from '@/app/config'
import { sshWebSocketUrl, useSshTerminalStore } from '../store'
import { filterCommandSuggestions } from '../utils/commandSuggestions'
import { sshStatusLabel } from '../utils/sshStatus'

const api = createApiClient({ baseUrl: backendBaseUrl })

export function SshTerminalPage() {
  const terminalContainerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<XtermTerminal | null>(null)
  const fitAddonRef = useRef<XtermFitAddon | null>(null)
  const currentLine = useSshTerminalStore((state) => state.currentLine)
  const errorMessage = useSshTerminalStore((state) => state.errorMessage)
  const form = useSshTerminalStore((state) => state.form)
  const status = useSshTerminalStore((state) => state.status)
  const applyStoredSuggestion = useSshTerminalStore(
    (state) => state.applySuggestion,
  )
  const attachTerminal = useSshTerminalStore((state) => state.attachTerminal)
  const connectSsh = useSshTerminalStore((state) => state.connect)
  const disconnectSsh = useSshTerminalStore((state) => state.disconnect)
  const sendInput = useSshTerminalStore((state) => state.sendInput)
  const sendResize = useSshTerminalStore((state) => state.sendResize)
  const updateForm = useSshTerminalStore((state) => state.updateForm)

  const commandsQuery = useQuery({
    queryKey: ['commands', ''],
    queryFn: () => api.listCommands(''),
  })
  const suggestions = useMemo(
    () => filterCommandSuggestions(commandsQuery.data?.items ?? [], currentLine),
    [commandsQuery.data?.items, currentLine],
  )

  useEffect(() => {
    if (!terminalContainerRef.current) {
      return
    }

    let isDisposed = false
    function handleResize() {
      fitAddonRef.current?.fit()
      sendTerminalSize()
    }

    let detachTerminal: (() => void) | undefined
    void Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
    ]).then(([xtermModule, fitModule]) => {
      if (isDisposed || !terminalContainerRef.current) {
        return
      }

      const terminal = new xtermModule.Terminal({
        cursorBlink: true,
        fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
        fontSize: 13,
        theme: {
          background: '#0b171b',
          foreground: '#dce8eb',
        },
      })
      const fitAddon = new fitModule.FitAddon()
      terminal.loadAddon(fitAddon)
      terminal.open(terminalContainerRef.current)
      fitAddon.fit()
      terminal.onData((data) => {
        sendInput(data)
      })
      detachTerminal = attachTerminal((data) => terminal.write(data))
      terminalRef.current = terminal
      fitAddonRef.current = fitAddon
    })

    window.addEventListener('resize', handleResize)

    return () => {
      isDisposed = true
      window.removeEventListener('resize', handleResize)
      detachTerminal?.()
      terminalRef.current?.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [attachTerminal, sendInput, sendResize])

  function connect() {
    connectSsh({
      cols: terminalRef.current?.cols ?? 80,
      rows: terminalRef.current?.rows ?? 24,
    })
  }

  function disconnect() {
    disconnectSsh()
  }

  function sendTerminalSize() {
    if (!terminalRef.current) {
      return
    }

    sendResize({
      cols: terminalRef.current.cols,
      rows: terminalRef.current.rows,
    })
  }

  function applySuggestion(command: CommandTemplate) {
    applyStoredSuggestion(command.command)
  }

  return (
    <PagePanel>
      <PageHeader
        eyebrow="阶段八"
        title="SSH 终端"
        subtitle="连接测试设备并通过命令库获得输入联想。"
        actions={
          <Badge variant={status === 'connected' ? 'default' : 'secondary'}>
            {sshStatusLabel(status)}
          </Badge>
        }
      />

      <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-4 max-xl:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>连接</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">主机</span>
                <Input
                  aria-label="主机"
                  value={form.host}
                  onChange={(event) => updateForm({ host: event.target.value })}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">端口</span>
                <Input
                  aria-label="端口"
                  type="number"
                  value={form.port}
                  onChange={(event) => updateForm({ port: event.target.value })}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">账号</span>
                <Input
                  aria-label="账号"
                  value={form.username}
                  onChange={(event) =>
                    updateForm({ username: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">密码</span>
                <Input
                  aria-label="密码"
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    updateForm({ password: event.target.value })
                  }
                />
              </label>
              <label className="col-span-full flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Checkbox
                  aria-label="跳过本次主机密钥校验"
                  checked={form.skipHostKeyCheck}
                  onCheckedChange={(checked) =>
                    updateForm({ skipHostKeyCheck: checked === true })
                  }
                />
                <span>跳过本次主机密钥校验</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!form.host.trim() || !form.username.trim()}
                onClick={connect}
                type="button"
              >
                <Plug aria-hidden="true" data-icon="inline-start" />
                连接
              </Button>
              <Button onClick={disconnect} type="button" variant="secondary">
                断开
              </Button>
            </div>
            {errorMessage ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <section className="grid min-w-0 grid-rows-[auto_minmax(360px,58vh)] overflow-hidden rounded-lg border bg-gray-950">
          <div className="flex min-h-9 items-center gap-2 border-b border-gray-800 bg-gray-900 px-3 text-xs text-gray-300">
            <SquareTerminal aria-hidden="true" size={16} />
            <span>{sshWebSocketUrl}</span>
          </div>
          <div className="min-h-0 p-2.5" ref={terminalContainerRef} />
        </section>

        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>命令联想</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {suggestions.length === 0 ? (
              <EmptyState title="输入命令前缀后显示联想" />
            ) : (
              suggestions.map((command) => (
                <button
                  className="grid gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/60"
                  key={command.id}
                  onClick={() => applySuggestion(command)}
                  type="button"
                >
                  <strong className="text-sm font-semibold">{command.name}</strong>
                  <code className="block rounded-md bg-muted px-2 py-1.5 font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    {command.command}
                  </code>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PagePanel>
  )
}
