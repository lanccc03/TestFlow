import { Input } from '@/components/ui/input'

export function ScriptFilters({
  onSearchChange,
  search,
}: {
  onSearchChange: (value: string) => void
  search: string
}) {
  return (
    <Input
      aria-label="搜索脚本"
      value={search}
      onChange={(event) => onSearchChange(event.target.value)}
      placeholder="搜索脚本"
    />
  )
}
