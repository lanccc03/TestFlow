import type { CaseSummary } from '@/lib/api'

export function SelectedScriptSummary({ script }: { script: CaseSummary }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3.5 max-sm:flex-col">
      <strong className="text-sm font-semibold">{script.name}</strong>
      <span className="text-sm text-muted-foreground">{script.description || script.id}</span>
    </div>
  )
}
