import type { CaseSummary } from '@/lib/api'
import { Badge } from '@/components/ui/badge'

export function SelectedScriptSummary({ script }: { script: CaseSummary }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3.5">
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <strong className="truncate text-sm font-semibold">{script.name}</strong>
          {script.tag ? <Badge variant="secondary">{script.tag}</Badge> : null}
        </div>
        <span className="truncate text-sm text-muted-foreground">
          {script.description || script.id}
        </span>
      </div>
    </div>
  )
}
