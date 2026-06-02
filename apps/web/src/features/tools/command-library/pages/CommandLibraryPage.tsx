import { Plus, Save, Search } from 'lucide-react'
import { useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { parseTags } from '@/lib/utils'
import {
  createApiClient,
  type CommandTemplate,
  type CommandTemplatePayload,
} from '@/lib/api'
import { backendBaseUrl } from '@/app/config'
import { emptyCommandForm } from '../constants'
import { CommandListItem } from '../components/CommandListItem'

const api = createApiClient({ baseUrl: backendBaseUrl })

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
    <PagePanel>
      <PageHeader
        title="命令库"
        subtitle="维护完整 SSH 命令，并在终端输入时用于联想。"
        actions={
          <Badge variant="secondary">完整命令</Badge>
        }
      />

      <div className="grid grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)] gap-4 max-xl:grid-cols-1">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{editingId ? '编辑命令' : '新增命令'}</CardTitle>
              {editingId ? (
                <Button onClick={resetForm} type="button" variant="ghost">
                  <Plus aria-hidden="true" data-icon="inline-start" />
                  新建
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">命令名称</span>
                <Input
                  aria-label="命令名称"
                  value={form.name}
                  onChange={(event) => updateForm({ name: event.target.value })}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">分组</span>
                <Input
                  aria-label="分组"
                  value={form.group}
                  onChange={(event) => updateForm({ group: event.target.value })}
                />
              </label>
              <label className="col-span-full grid gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">完整命令</span>
                <Textarea
                  aria-label="完整命令"
                  value={form.command}
                  onChange={(event) =>
                    updateForm({ command: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">标签</span>
                <Input
                  aria-label="标签"
                  value={tagText}
                  onChange={(event) => setTagText(event.target.value)}
                />
              </label>
              <label className="col-span-full grid gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">说明</span>
                <Textarea
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <label className="grid gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Search aria-hidden="true" size={14} />
                搜索命令
              </span>
              <Input
                aria-label="搜索命令"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="名称、命令、分组、标签"
              />
            </label>
          </CardHeader>
          <CardContent className="grid gap-3">
            {commandsQuery.isPending ? (
              <EmptyState title="正在加载命令" />
            ) : commands.length === 0 ? (
              <EmptyState title="暂无命令" />
            ) : (
              commands.map((command) => (
                <CommandListItem
                  key={command.id}
                  command={command}
                  onEdit={() => editCommand(command)}
                  onDelete={() => deleteMutation.mutate(command.id)}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PagePanel>
  )
}
