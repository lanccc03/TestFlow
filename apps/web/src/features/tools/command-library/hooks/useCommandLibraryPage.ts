import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/app/backend'
import { parseTags } from '@/lib/utils'
import {
  type CommandTemplate,
  type CommandTemplatePayload,
} from '@/lib/api'

import { emptyCommandForm } from '../constants'

export function useCommandLibraryPage() {
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

  return {
    commands,
    commandsQuery,
    deleteMutation,
    editCommand,
    editingId,
    form,
    resetForm,
    search,
    setSearch,
    setTagText,
    submit,
    tagText,
    updateForm,
  }
}
