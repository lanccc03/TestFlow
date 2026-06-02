import { Copy, Trash2 } from 'lucide-react'
import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ScriptSummary } from '@/lib/api'

export function ScriptListItem({
  confirmDeleteId,
  onCopy,
  onDelete,
  onPrepareDelete,
  script,
}: {
  confirmDeleteId: string | undefined
  onCopy: () => void
  onDelete: () => void
  onPrepareDelete: () => void
  script: ScriptSummary
}) {
  return (
    <Card
      size="sm"
      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-3 max-sm:grid-cols-1"
    >
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-base font-semibold">{script.name}</h3>
          <Badge
            variant={
              script.status === 'published' ? 'default' : 'secondary'
            }
          >
            {script.status === 'published' ? '已发布' : '草稿'}
          </Badge>
        </div>
        <p className="m-0 text-sm text-muted-foreground">
          {script.description || script.id}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {script.group ? (
            <Badge variant="secondary">{script.group}</Badge>
          ) : null}
          {script.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      <dl className="flex gap-2">
        <div className="min-w-16 rounded-lg bg-muted px-2 py-1.5">
          <dt className="text-xs text-muted-foreground">步骤</dt>
          <dd className="m-0 text-sm font-semibold text-foreground">
            {script.enabled_step_count}/{script.step_count}
          </dd>
        </div>
        <div className="min-w-16 rounded-lg bg-muted px-2 py-1.5">
          <dt className="text-xs text-muted-foreground">版本</dt>
          <dd className="m-0 text-sm font-semibold text-foreground">
            v{script.revision}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button asChild size="sm" variant="secondary">
          <Link to={`/scripts/${script.id}`}>编辑</Link>
        </Button>
        <Button
          aria-label={`复制 ${script.name}`}
          onClick={onCopy}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Copy aria-hidden="true" />
        </Button>
        {confirmDeleteId === script.id ? (
          <Button
            aria-label={`确认删除 ${script.name}`}
            onClick={onDelete}
            size="sm"
            type="button"
            variant="destructive"
          >
            确认
          </Button>
        ) : (
          <Button
            aria-label={`删除 ${script.name}`}
            onClick={onPrepareDelete}
            size="icon-sm"
            type="button"
            variant="destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </div>
    </Card>
  )
}
