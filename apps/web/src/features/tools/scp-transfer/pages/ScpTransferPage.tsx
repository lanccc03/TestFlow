import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  Folder,
  HardDrive,
  RefreshCw,
  Server,
} from 'lucide-react'

import { api, backendUrls } from '@/app/backend'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import type {
  ScpFileNode,
  ScpTransferEvent,
  ScpTransferTask,
} from '@/lib/api'

import { useSshTerminalStore } from '../../ssh-terminal/store'

export function ScpTransferPage() {
  const connectionSummary = useSshTerminalStore(
    (state) => state.connectionSummary,
  )
  const sessionId = useSshTerminalStore((state) => state.sessionId)
  const sshStatus = useSshTerminalStore((state) => state.status)
  const isConnected = sshStatus === 'connected' && Boolean(sessionId)
  const [localPath, setLocalPath] = useState('')
  const [remotePath, setRemotePath] = useState('/remote')
  const [selectedLocal, setSelectedLocal] = useState<ScpFileNode | null>(null)
  const [selectedRemote, setSelectedRemote] = useState<ScpFileNode | null>(null)
  const [transfers, setTransfers] = useState<ScpTransferTask[]>([])

  const localTreeQuery = useQuery({
    queryKey: ['scp', 'local-tree', localPath],
    queryFn: () => api.listLocalScpTree(localPath || undefined),
    enabled: isConnected,
  })
  const remoteTreeQuery = useQuery({
    queryKey: ['scp', 'remote-tree', sessionId, remotePath],
    queryFn: () => api.listRemoteScpTree(sessionId, remotePath),
    enabled: isConnected,
  })
  const transfersQuery = useQuery({
    queryKey: ['scp', 'transfers'],
    queryFn: () => api.listScpTransfers(),
    enabled: isConnected,
  })

  useEffect(() => {
    if (transfersQuery.data) {
      setTransfers((current) =>
        transfersQuery.data.items.reduce(upsertTransfer, current),
      )
    }
  }, [transfersQuery.data])

  useEffect(() => {
    if (!isConnected) {
      return
    }

    const socket = new WebSocket(backendUrls.scpTransfersWebSocket)
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ScpTransferEvent
      if (message.type === 'transfer_update') {
        setTransfers((current) => upsertTransfer(current, message.task))
      }
    }

    return () => socket.close()
  }, [isConnected])

  const uploadMutation = useMutation({
    mutationFn: () =>
      api.createScpUpload({
        session_id: sessionId,
        source_path: selectedLocal?.path ?? '',
        target_path: selectedRemote?.path ?? remotePath,
      }),
    onSuccess: (task) => setTransfers((current) => upsertTransfer(current, task)),
  })
  const downloadMutation = useMutation({
    mutationFn: () =>
      api.createScpDownload({
        session_id: sessionId,
        source_path: selectedRemote?.path ?? '',
        target_path:
          selectedLocal?.type === 'directory'
            ? selectedLocal.path
            : localTreeQuery.data?.path ?? '',
      }),
    onSuccess: (task) => setTransfers((current) => upsertTransfer(current, task)),
  })
  const retryMutation = useMutation({
    mutationFn: (transferId: string) => api.retryScpTransfer(transferId),
    onSuccess: (task) => setTransfers((current) => upsertTransfer(current, task)),
  })
  const cancelMutation = useMutation({
    mutationFn: (transferId: string) => api.cancelScpTransfer(transferId),
    onSuccess: (task) => setTransfers((current) => upsertTransfer(current, task)),
  })

  const canUpload = Boolean(
    selectedLocal?.type === 'file' && selectedRemote?.type === 'directory',
  )
  const canDownload = Boolean(
    selectedRemote?.type === 'file' &&
      (selectedLocal?.type === 'directory' || localTreeQuery.data?.path),
  )

  const currentTransfers = useMemo(
    () =>
      transfers.toSorted((first, second) =>
        first.id.localeCompare(second.id),
      ),
    [transfers],
  )

  if (!isConnected) {
    return (
      <PagePanel>
        <PageHeader
          title="SCP 文件传输"
          subtitle="复用 SSH 终端当前连接进行文件浏览和传输。"
          actions={<Badge variant="secondary">未连接</Badge>}
        />
        <EmptyState
          icon={<Server aria-hidden="true" />}
          title="请先连接 SSH 终端"
          description={
            <Link className="font-medium text-primary" to="/ssh">
              前往 SSH 终端
            </Link>
          }
        />
      </PagePanel>
    )
  }

  return (
    <PagePanel>
      <PageHeader
        title="SCP 文件传输"
        subtitle="左侧选择本地文件，右侧选择远程目录，或反向下载远程文件。"
        actions={<Badge>{connectionSummary}</Badge>}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] gap-4">
        <FileTreePanel
          icon={<HardDrive aria-hidden="true" size={16} />}
          isLoading={localTreeQuery.isLoading}
          nodes={localTreeQuery.data?.items ?? []}
          onRefresh={() => void localTreeQuery.refetch()}
          onSelect={setSelectedLocal}
          path={localTreeQuery.data?.path ?? localPath}
          pathLabel="本地路径"
          selectedPath={selectedLocal?.path}
          setPath={setLocalPath}
          title="本地文件"
        />

        <div className="flex flex-col items-stretch justify-center gap-2">
          <Button
            disabled={!canUpload || uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
            type="button"
          >
            上传
            <ArrowRight aria-hidden="true" data-icon="inline-end" />
          </Button>
          <Button
            disabled={!canDownload || downloadMutation.isPending}
            onClick={() => downloadMutation.mutate()}
            type="button"
            variant="secondary"
          >
            <ArrowLeft aria-hidden="true" data-icon="inline-start" />
            下载
          </Button>
        </div>

        <FileTreePanel
          icon={<Server aria-hidden="true" size={16} />}
          isLoading={remoteTreeQuery.isLoading}
          nodes={remoteTreeQuery.data?.items ?? []}
          onRefresh={() => void remoteTreeQuery.refetch()}
          onSelect={setSelectedRemote}
          path={remoteTreeQuery.data?.path ?? remotePath}
          pathLabel="远程路径"
          selectedPath={selectedRemote?.path}
          setPath={setRemotePath}
          title="远程文件"
        />
      </div>

      {localTreeQuery.error || remoteTreeQuery.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {readErrorMessage(localTreeQuery.error ?? remoteTreeQuery.error)}
          </AlertDescription>
        </Alert>
      ) : null}

      <TransferQueue
        onCancel={(transferId) => cancelMutation.mutate(transferId)}
        onRetry={(transferId) => retryMutation.mutate(transferId)}
        transfers={currentTransfers}
      />
    </PagePanel>
  )
}

function FileTreePanel({
  icon,
  isLoading,
  nodes,
  onRefresh,
  onSelect,
  path,
  pathLabel,
  selectedPath,
  setPath,
  title,
}: {
  icon: React.ReactNode
  isLoading: boolean
  nodes: ScpFileNode[]
  onRefresh: () => void
  onSelect: (node: ScpFileNode) => void
  path: string
  pathLabel: string
  selectedPath?: string
  setPath: (path: string) => void
  title: string
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex gap-2">
          <Input
            aria-label={pathLabel}
            value={path}
            onChange={(event) => setPath(event.target.value)}
          />
          <Button
            aria-label={`刷新${title}`}
            onClick={onRefresh}
            type="button"
            variant="secondary"
          >
            <RefreshCw aria-hidden="true" />
          </Button>
        </div>
        <div className="grid min-h-[340px] content-start gap-1 rounded-lg border bg-muted/20 p-2">
          {isLoading ? <p className="p-3 text-sm text-muted-foreground">加载中</p> : null}
          {!isLoading && nodes.length === 0 ? (
            <EmptyState title="暂无文件" />
          ) : null}
          {nodes.map((node) => (
            <button
              className={[
                'flex min-h-9 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors',
                selectedPath === node.path
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted',
              ].join(' ')}
              key={node.path}
              onClick={() => onSelect(node)}
              type="button"
              aria-label={`选择${title.startsWith('本地') ? '本地' : '远程'} ${node.name}`}
            >
              {node.type === 'directory' ? (
                <Folder aria-hidden="true" size={16} />
              ) : (
                <span aria-hidden="true" className="size-4 rounded-sm border" />
              )}
              <span className="min-w-0 flex-1 truncate">{node.name}</span>
              {node.size ? (
                <span className="text-xs opacity-70">{node.size} B</span>
              ) : null}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function TransferQueue({
  onCancel,
  onRetry,
  transfers,
}: {
  onCancel: (transferId: string) => void
  onRetry: (transferId: string) => void
  transfers: ScpTransferTask[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>传输队列</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {transfers.length === 0 ? (
          <EmptyState title="暂无传输任务" />
        ) : (
          transfers.map((task) => (
            <div
              className="grid gap-2 rounded-lg border bg-card p-3"
              key={task.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {task.source_path} → {task.target_path}
                </span>
                <Badge variant={task.status === 'failed' ? 'destructive' : 'secondary'}>
                  {task.status}
                </Badge>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              {task.error_message ? (
                <p className="m-0 text-sm text-destructive">
                  {task.error_message}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  aria-label={`重试 ${task.id}`}
                  disabled={task.status !== 'failed'}
                  onClick={() => onRetry(task.id)}
                  type="button"
                  variant="secondary"
                >
                  重试
                </Button>
                <Button
                  aria-label={`取消 ${task.id}`}
                  disabled={!['pending', 'running'].includes(task.status)}
                  onClick={() => onCancel(task.id)}
                  type="button"
                  variant="secondary"
                >
                  取消
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function upsertTransfer(
  transfers: ScpTransferTask[],
  task: ScpTransferTask,
) {
  const index = transfers.findIndex((item) => item.id === task.id)
  if (index === -1) {
    return [...transfers, task]
  }

  return transfers.map((item) => (item.id === task.id ? task : item))
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return 'SCP 操作失败'
}
