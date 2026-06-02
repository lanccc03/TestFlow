import type { CommandTemplatePayload } from '@/lib/api'

export const emptyCommandForm: CommandTemplatePayload = {
  name: '',
  command: '',
  description: '',
  group: '',
  tags: [],
}
