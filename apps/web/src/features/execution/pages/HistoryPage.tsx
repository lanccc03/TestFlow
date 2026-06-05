import { ListSurface, ListToolbar } from '@/components/layout/list'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { ExecutionSummaryRow } from '../components/ExecutionSummaryRow'
import { useHistoryPage } from '../hooks/useHistoryPage'

export function HistoryPage() {
  const {
    applyFilters,
    createdFrom,
    createdTo,
    executor,
    scriptId,
    scripts,
    setCreatedFrom,
    setCreatedTo,
    setExecutor,
    setScriptId,
    setStatus,
    status,
    tasks,
    tasksQuery,
  } = useHistoryPage()

  return (
    <PagePanel>
      <PageHeader
        title="执行历史"
        subtitle="查看历史执行记录和报告"
      />

      <ListToolbar
        aria-label="历史筛选"
        className="grid-cols-[minmax(160px,1fr)_minmax(120px,0.5fr)_minmax(140px,0.5fr)_minmax(140px,0.5fr)_minmax(120px,0.4fr)_auto] max-lg:grid-cols-2 max-sm:grid-cols-1"
      >
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">脚本</span>
          <Select value={scriptId} onValueChange={setScriptId}>
            <SelectTrigger aria-label="脚本">
              <SelectValue placeholder="全部脚本" />
            </SelectTrigger>
            <SelectContent>
              {scripts.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name || s.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">状态</span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="状态">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">等待中</SelectItem>
              <SelectItem value="running">运行中</SelectItem>
              <SelectItem value="passed">通过</SelectItem>
              <SelectItem value="failed">失败</SelectItem>
              <SelectItem value="canceled">已取消</SelectItem>
              <SelectItem value="error">异常</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">开始时间从</span>
          <Input
            type="datetime-local"
            aria-label="开始时间从"
            value={createdFrom}
            onChange={(e) => setCreatedFrom(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">开始时间到</span>
          <Input
            type="datetime-local"
            aria-label="开始时间到"
            value={createdTo}
            onChange={(e) => setCreatedTo(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">执行人</span>
          <Input
            aria-label="执行人"
            value={executor}
            onChange={(e) => setExecutor(e.target.value)}
            placeholder="alice"
          />
        </label>
        <div className="flex items-end">
          <Button onClick={applyFilters} type="button">
            查询历史
          </Button>
        </div>
      </ListToolbar>

      <ListSurface
        description={`${tasks.length} 条执行记录`}
        title="任务记录"
      >
        {tasksQuery.isPending ? (
          <div className="p-3">
            <EmptyState title="正在加载任务" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-3">
            <EmptyState title="暂无执行记录" />
          </div>
        ) : (
          tasks.map((task) => (
            <ExecutionSummaryRow key={task.id} task={task} />
          ))
        )}
      </ListSurface>
    </PagePanel>
  )
}
