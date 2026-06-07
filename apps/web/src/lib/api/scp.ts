import type { ApiRequestClient } from './client'
import type { ItemList } from './types'

export type ScpFileNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number | null
  modified_at?: string | null
}

export type ScpFileTree = {
  path: string
  items: ScpFileNode[]
}

export type ScpTransferTask = {
  id: string
  direction: 'upload' | 'download'
  source_path: string
  target_path: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled'
  progress: number
  error_message?: string | null
}

export type ScpTransferEvent = {
  type: 'transfer_update'
  task: ScpTransferTask
}

export type ScpTransferPayload = {
  session_id: string
  source_path: string
  target_path: string
}

export function createScpApi(client: ApiRequestClient) {
  return {
    listLocalScpTree: (path?: string) =>
      client.get<ScpFileTree>('/api/scp/local/tree', {
        params: { path },
      }),
    listRemoteScpTree: (sessionId: string, path: string) =>
      client.get<ScpFileTree>('/api/scp/remote/tree', {
        params: { session_id: sessionId, path },
      }),
    listScpTransfers: () =>
      client.get<ItemList<ScpTransferTask>>('/api/scp/transfers'),
    createScpUpload: (payload: ScpTransferPayload) =>
      client.post<ScpTransferTask, ScpTransferPayload>(
        '/api/scp/transfers/upload',
        payload,
      ),
    createScpDownload: (payload: ScpTransferPayload) =>
      client.post<ScpTransferTask, ScpTransferPayload>(
        '/api/scp/transfers/download',
        payload,
      ),
    retryScpTransfer: (transferId: string) =>
      client.postEmpty<ScpTransferTask>(
        `/api/scp/transfers/${transferId}/retry`,
      ),
    cancelScpTransfer: (transferId: string) =>
      client.postEmpty<ScpTransferTask>(
        `/api/scp/transfers/${transferId}/cancel`,
      ),
  }
}
