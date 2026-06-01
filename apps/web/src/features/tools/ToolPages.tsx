import '@xterm/xterm/css/xterm.css'

import type { FitAddon as XtermFitAddon } from '@xterm/addon-fit'
import type { Terminal as XtermTerminal } from '@xterm/xterm'
import {
  Edit3,
  Plug,
  Plus,
  Save,
  Search,
  SquareTerminal,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  createApiClient,
  type CommandTemplate,
  type CommandTemplatePayload,
} from '@/lib/api'

const api = createApiClient({ baseUrl: 'http://127.0.0.1:8000' })
const sshWebSocketUrl = 'ws://127.0.0.1:8000/ws/ssh'

const emptyCommandForm: CommandTemplatePayload = {
  name: '',
  command: '',
  description: '',
  group: '',
  tags: [],
}

export function CommandLibraryPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | undefined>()
  const [tagText, setTagText] = useState('')
  const [form, setForm] = useState<CommandTemplatePayload>(emptyCommandForm)

  const commandsQuery = useQuery({
    queryKey: ['commands', search],
    queryFn: () => api.listCommands(search),
  })
  const saveMutation = useMutation({
    mutationFn: (payload: CommandTemplatePayload) =>
      editingId
        ? api.updateCommand(editingId, payload)
        : api.createCommand(payload),
    onSuccess: async () => {
      resetForm()
      await queryClient.invalidateQueries({ queryKey: ['commands'] })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: api.deleteCommand,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['commands'] })
    },
  })

  const commands = commandsQuery.data?.items ?? []

  function updateForm(update: Partial<CommandTemplatePayload>) {
    setForm((current) => ({ ...current, ...update }))
  }

  function submit() {
    saveMutation.mutate({
      ...form,
      tags: parseTags(tagText),
    })
  }

  function editCommand(command: CommandTemplate) {
    setEditingId(command.id)
    setForm({
      name: command.name,
      command: command.command,
      description: command.description,
      group: command.group,
      tags: command.tags,
    })
    setTagText(command.tags.join(', '))
  }

  function resetForm() {
    setEditingId(undefined)
    setForm(emptyCommandForm)
    setTagText('')
  }

  return (
    <section className="content-panel tool-workspace">
      <div className="script-page-heading">
        <div className="section-heading">
          <p>阶段八</p>
          <h1>命令库</h1>
          <span>维护完整 SSH 命令，并在终端输入时用于联想。</span>
        </div>
        <Badge variant="secondary">完整命令</Badge>
      </div>

      <div className="tool-grid">
        <section className="editor-section command-form-panel">
          <div className="editor-section-heading">
            <h2>{editingId ? '编辑命令' : '新增命令'}</h2>
            {editingId ? (
              <Button onClick={resetForm} type="button" variant="ghost">
                <Plus aria-hidden="true" data-icon="inline-start" />
                新建
              </Button>
            ) : null}
          </div>
          <div className="form-grid command-form-grid">
            <label>
              <span>命令名称</span>
              <input
                aria-label="命令名称"
                value={form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
              />
            </label>
            <label>
              <span>分组</span>
              <input
                aria-label="分组"
                value={form.group}
                onChange={(event) => updateForm({ group: event.target.value })}
              />
            </label>
            <label className="form-wide">
              <span>完整命令</span>
              <textarea
                aria-label="完整命令"
                value={form.command}
                onChange={(event) =>
                  updateForm({ command: event.target.value })
                }
              />
            </label>
            <label>
              <span>标签</span>
              <input
                aria-label="标签"
                value={tagText}
                onChange={(event) => setTagText(event.target.value)}
              />
            </label>
            <label className="form-wide">
              <span>说明</span>
              <textarea
                aria-label="说明"
                value={form.description}
                onChange={(event) =>
                  updateForm({ description: event.target.value })
                }
              />
            </label>
          </div>
          <Button
            disabled={!form.name.trim() || !form.command.trim()}
            onClick={submit}
            type="button"
          >
            <Save aria-hidden="true" data-icon="inline-start" />
            保存命令
          </Button>
        </section>

        <section className="editor-section command-list-panel">
          <label className="tool-search">
            <span>
              <Search aria-hidden="true" size={14} />
              搜索命令
            </span>
            <input
              aria-label="搜索命令"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="名称、命令、分组、标签"
            />
          </label>

          {commandsQuery.isPending ? (
            <div className="catalog-placeholder">正在加载命令</div>
          ) : commands.length === 0 ? (
            <div className="catalog-placeholder">暂无命令</div>
          ) : (
            <div className="command-list">
              {commands.map((command) => (
                <article className="command-item" key={command.id}>
                  <div>
                    <div className="script-title-row">
                      <h3>{command.name}</h3>
                      {command.group ? (
                        <Badge variant="secondary">{command.group}</Badge>
                      ) : null}
                    </div>
                    <code>{command.command}</code>
                    {command.description ? <p>{command.description}</p> : null}
                    <div className="script-tags">
                      {command.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="script-actions">
                    <Button
                      aria-label={`编辑 ${command.name}`}
                      onClick={() => editCommand(command)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Edit3 aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label={`删除 ${command.name}`}
                      onClick={() => deleteMutation.mutate(command.id)}
                      size="icon-sm"
                      type="button"
                      variant="destructive"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

export function SshTerminalPage() {
  const terminalContainerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<XtermTerminal | null>(null)
  const fitAddonRef = useRef<XtermFitAddon | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const currentLineRef = useRef('')
  const [currentLine, setCurrentLine] = useState('')
  const [status, setStatus] = useState('disconnected')
  const [errorMessage, setErrorMessage] = useState('')
  const [form, setForm] = useState({
    host: '',
    port: '22',
    username: '',
    password: '',
    skipHostKeyCheck: false,
  })

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
        updateCurrentLine(data)
        sendSocketMessage({ type: 'input', data })
      })
      terminalRef.current = terminal
      fitAddonRef.current = fitAddon
    })

    window.addEventListener('resize', handleResize)

    return () => {
      isDisposed = true
      window.removeEventListener('resize', handleResize)
      socketRef.current?.close()
      socketRef.current = null
      terminalRef.current?.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [])

  function updateForm(update: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...update }))
  }

  function connect() {
    setErrorMessage('')
    setStatus('connecting')
    const socket = new WebSocket(sshWebSocketUrl)
    socketRef.current = socket

    socket.onopen = () => {
      sendSocketMessage({
        type: 'connect',
        host: form.host,
        port: Number(form.port),
        username: form.username,
        password: form.password,
        cols: terminalRef.current?.cols ?? 80,
        rows: terminalRef.current?.rows ?? 24,
        skip_host_key_check: form.skipHostKeyCheck,
      })
    }

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as SshServerMessage
      if (message.type === 'output') {
        terminalRef.current?.write(message.data)
      } else if (message.type === 'status') {
        setStatus(message.status)
        if (message.message) {
          setErrorMessage(message.message)
        }
      } else if (message.type === 'error') {
        setErrorMessage(message.message)
      }
    }

    socket.onerror = () => {
      setStatus('error')
      setErrorMessage('SSH WebSocket 连接异常')
    }

    socket.onclose = () => {
      setStatus('disconnected')
      socketRef.current = null
    }
  }

  function disconnect() {
    sendSocketMessage({ type: 'disconnect' })
    socketRef.current?.close()
    socketRef.current = null
    setStatus('disconnected')
  }

  function sendTerminalSize() {
    if (!socketRef.current || !terminalRef.current) {
      return
    }

    sendSocketMessage({
      type: 'resize',
      cols: terminalRef.current.cols,
      rows: terminalRef.current.rows,
    })
  }

  function sendSocketMessage(message: Record<string, unknown>) {
    socketRef.current?.send(JSON.stringify(message))
  }

  function updateCurrentLine(data: string) {
    const nextLine = applyTerminalInput(currentLineRef.current, data)
    currentLineRef.current = nextLine
    setCurrentLine(nextLine)
  }

  function applySuggestion(command: CommandTemplate) {
    const current = currentLineRef.current
    const data = command.command.startsWith(current)
      ? command.command.slice(current.length)
      : command.command
    if (!data) {
      return
    }

    currentLineRef.current = command.command
    setCurrentLine(command.command)
    sendSocketMessage({ type: 'input', data })
  }

  return (
    <section className="content-panel tool-workspace">
      <div className="script-page-heading">
        <div className="section-heading">
          <p>阶段八</p>
          <h1>SSH 终端</h1>
          <span>连接测试设备并通过命令库获得输入联想。</span>
        </div>
        <Badge variant={status === 'connected' ? 'default' : 'secondary'}>
          {sshStatusLabel(status)}
        </Badge>
      </div>

      <div className="ssh-layout">
        <section className="editor-section ssh-connect-panel">
          <h2>连接</h2>
          <div className="form-grid command-form-grid">
            <label>
              <span>主机</span>
              <input
                aria-label="主机"
                value={form.host}
                onChange={(event) => updateForm({ host: event.target.value })}
              />
            </label>
            <label>
              <span>端口</span>
              <input
                aria-label="端口"
                type="number"
                value={form.port}
                onChange={(event) => updateForm({ port: event.target.value })}
              />
            </label>
            <label>
              <span>账号</span>
              <input
                aria-label="账号"
                value={form.username}
                onChange={(event) =>
                  updateForm({ username: event.target.value })
                }
              />
            </label>
            <label>
              <span>密码</span>
              <input
                aria-label="密码"
                type="password"
                value={form.password}
                onChange={(event) =>
                  updateForm({ password: event.target.value })
                }
              />
            </label>
            <label className="checkbox-row form-wide">
              <input
                aria-label="跳过本次主机密钥校验"
                checked={form.skipHostKeyCheck}
                onChange={(event) =>
                  updateForm({ skipHostKeyCheck: event.target.checked })
                }
                type="checkbox"
              />
              <span>跳过本次主机密钥校验</span>
            </label>
          </div>
          <div className="editor-actions">
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
            <div className="validation-panel">
              <p>{errorMessage}</p>
            </div>
          ) : null}
        </section>

        <section className="terminal-shell">
          <div className="terminal-heading">
            <SquareTerminal aria-hidden="true" size={16} />
            <span>{sshWebSocketUrl}</span>
          </div>
          <div className="terminal-pane" ref={terminalContainerRef} />
        </section>

        <section className="editor-section suggestion-panel">
          <h2>命令联想</h2>
          {suggestions.length === 0 ? (
            <div className="catalog-placeholder">输入命令前缀后显示联想</div>
          ) : (
            <div className="suggestion-list">
              {suggestions.map((command) => (
                <button
                  className="suggestion-item"
                  key={command.id}
                  onClick={() => applySuggestion(command)}
                  type="button"
                >
                  <strong>{command.name}</strong>
                  <code>{command.command}</code>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

type SshServerMessage =
  | { type: 'output'; data: string }
  | { type: 'status'; status: string; message?: string }
  | { type: 'error'; message: string }

function parseTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  )
}

function filterCommandSuggestions(
  commands: CommandTemplate[],
  currentLine: string,
) {
  const query = currentLine.trim().toLowerCase()
  if (!query) {
    return []
  }

  return commands
    .filter(
      (command) =>
        command.command.toLowerCase().startsWith(query) ||
        command.name.toLowerCase().includes(query),
    )
    .slice(0, 6)
}

function applyTerminalInput(currentLine: string, data: string) {
  let nextLine = currentLine
  for (const char of data) {
    if (char === '\r' || char === '\n') {
      nextLine = ''
    } else if (char === '\u007f') {
      nextLine = nextLine.slice(0, -1)
    } else if (char >= ' ' && char !== '\u001b') {
      nextLine += char
    }
  }
  return nextLine
}

function sshStatusLabel(status: string) {
  if (status === 'connected') return '已连接'
  if (status === 'connecting') return '连接中'
  if (status === 'error') return '异常'
  return '已断开'
}
