import type { ApiRequestClient } from './client'
import type { ItemList } from './types'

export type CommandTemplatePayload = {
  name: string
  command: string
  description: string
  group: string
  tags: string[]
}

export type CommandTemplate = CommandTemplatePayload & {
  id: string
  created_at: string
  updated_at: string
}

export function createCommandsApi(client: ApiRequestClient) {
  return {
    listCommands: (search = '') =>
      client.get<ItemList<CommandTemplate>>('/api/commands', {
        params: { search },
      }),
    createCommand: (command: CommandTemplatePayload) =>
      client.post<CommandTemplate, CommandTemplatePayload>(
        '/api/commands',
        command,
      ),
    updateCommand: (commandId: string, command: CommandTemplatePayload) =>
      client.put<CommandTemplate, CommandTemplatePayload>(
        `/api/commands/${commandId}`,
        command,
      ),
    deleteCommand: (commandId: string) =>
      client.remove(`/api/commands/${commandId}`),
  }
}
