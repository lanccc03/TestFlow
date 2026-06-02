import { Badge } from '@/components/ui/badge'
import type { ScriptSummary } from '@/lib/api'

export function SelectedScriptSummary({ script }: { script: ScriptSummary }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3.5 max-sm:flex-col">
      <strong className="text-sm font-semibold">{script.name}</strong>
      <span className="text-sm text-muted-foreground">{script.description || script.id}</span>
      <Badge variant="secondary" className="max-sm:self-start">v{script.revision}</Badge>
    </div>
  )
}
