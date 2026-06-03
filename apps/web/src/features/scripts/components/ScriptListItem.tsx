import { Copy, Edit3, Play, Trash2 } from 'lucide-react'
import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ScriptSummary } from '@/lib/api'

const runButtonClassName =
  'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 hover:text-emerald-800 focus-visible:border-emerald-500/40 focus-visible:ring-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30 dark:hover:text-emerald-200 dark:focus-visible:ring-emerald-500/40'

const editButtonClassName =
  'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 hover:text-blue-800 focus-visible:border-blue-500/40 focus-visible:ring-blue-500/20 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30 dark:hover:text-blue-200 dark:focus-visible:ring-blue-500/40'

const copyButtonClassName =
  'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 hover:text-amber-800 focus-visible:border-amber-500/40 focus-visible:ring-amber-500/20 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30 dark:hover:text-amber-200 dark:focus-visible:ring-amber-500/40'

const deleteButtonClassName =
  'bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40'

export function ScriptListItem({
  confirmDeleteId,
  onCopy,
  onDelete,
  onPrepareDelete,
  onRun,
  script,
}: {
  confirmDeleteId: string | undefined
  onCopy: () => void
  onDelete: () => void
  onPrepareDelete: () => void
  onRun: () => void
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
        <Button
          aria-label={`运行 ${script.name}`}
          className={runButtonClassName}
          onClick={onRun}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Play aria-hidden="true" />
        </Button>
        <Button
          aria-label={`编辑 ${script.name}`}
          asChild
          className={editButtonClassName}
          size="icon-sm"
          variant="ghost"
        >
          <Link to={`/scripts/${script.id}`}>
            <Edit3 aria-hidden="true" />
          </Link>
        </Button>
        <Button
          aria-label={`复制 ${script.name}`}
          className={copyButtonClassName}
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
            className={deleteButtonClassName}
            onClick={onDelete}
            size="sm"
            type="button"
            variant="ghost"
          >
            确认
          </Button>
        ) : (
          <Button
            aria-label={`删除 ${script.name}`}
            className={deleteButtonClassName}
            onClick={onPrepareDelete}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </div>
    </Card>
  )
}
