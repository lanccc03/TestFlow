import { Edit3, Trash2 } from 'lucide-react'

import type { CommandTemplate } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription } from '@/components/ui/card'

export function CommandListItem({
  command,
  onDelete,
  onEdit,
}: {
  command: CommandTemplate
  onDelete: () => void
  onEdit: () => void
}) {
  return (
    <Card size="sm" className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-3 max-sm:grid-cols-1">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-base font-semibold">{command.name}</h3>
          {command.group ? <Badge variant="secondary">{command.group}</Badge> : null}
        </div>
        <code className="block rounded-md bg-muted px-2 py-1.5 font-mono text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
          {command.command}
        </code>
        {command.description ? (
          <CardDescription className="mt-2">{command.description}</CardDescription>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {command.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button
          aria-label={`编辑 ${command.name}`}
          onClick={onEdit}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Edit3 aria-hidden="true" />
        </Button>
        <Button
          aria-label={`删除 ${command.name}`}
          onClick={onDelete}
          size="icon-sm"
          type="button"
          variant="destructive"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </Card>
  )
}
