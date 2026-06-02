import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function ScriptFilters({
  groups,
  groupFilter,
  onGroupFilterChange,
  onSearchChange,
  onStatusFilterChange,
  onTagFilterChange,
  search,
  statusFilter,
  tagFilter,
  tags,
}: {
  groups: string[]
  groupFilter: string
  onGroupFilterChange: (value: string) => void
  onSearchChange: (value: string) => void
  onStatusFilterChange: (value: string) => void
  onTagFilterChange: (value: string) => void
  search: string
  statusFilter: string
  tagFilter: string
  tags: string[]
}) {
  return (
    <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-1">
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">搜索脚本</span>
        <Input
          aria-label="搜索脚本"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="名称、ID、描述、标签"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">状态筛选</span>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger aria-label="状态筛选">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="published">已发布</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">分组筛选</span>
        <Select value={groupFilter} onValueChange={onGroupFilterChange}>
          <SelectTrigger aria-label="分组筛选">
            <SelectValue placeholder="全部分组" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分组</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group} value={group}>
                {group}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">标签筛选</span>
        <Select value={tagFilter} onValueChange={onTagFilterChange}>
          <SelectTrigger aria-label="标签筛选">
            <SelectValue placeholder="全部标签" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部标签</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </div>
  )
}
