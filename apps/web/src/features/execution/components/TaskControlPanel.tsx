import { Play, Square } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/layout/page'
import type { CaseSummary, ExecutionTask } from '@/lib/api'
import { canCancelTask } from '../utils/taskGuards'
import { SelectedScriptSummary } from './SelectedScriptSummary'

export interface TaskControlPanelProps {
  selectedScriptId: string
  onSelectedScriptIdChange: (value: string) => void
  publishedScripts: CaseSummary[]
  selectedScript: CaseSummary | undefined
  activeTask: ExecutionTask | null
  createMutationIsPending: boolean
  cancelMutationIsPending: boolean
  scriptsQueryIsError: boolean
  scriptsQueryIsPending: boolean
  onStartExecution: () => void
  onCancelExecution: () => void
}

export function TaskControlPanel({
  selectedScriptId,
  onSelectedScriptIdChange,
  publishedScripts,
  selectedScript,
  activeTask,
  createMutationIsPending,
  cancelMutationIsPending,
  scriptsQueryIsError,
  scriptsQueryIsPending,
  onStartExecution,
  onCancelExecution,
}: TaskControlPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>任务控制</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">选择用例</span>
            <Select value={selectedScriptId} onValueChange={onSelectedScriptIdChange}>
              <SelectTrigger aria-label="选择用例">
                <SelectValue placeholder="选择框架用例" />
              </SelectTrigger>
              <SelectContent>
                {publishedScripts.map((script) => (
                  <SelectItem key={script.id} value={script.id}>
                    {script.name || script.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!selectedScriptId || createMutationIsPending}
            onClick={onStartExecution}
            type="button"
          >
            <Play aria-hidden="true" data-icon="inline-start" />
            开始执行
          </Button>
          <Button
            disabled={!canCancelTask(activeTask) || cancelMutationIsPending}
            onClick={onCancelExecution}
            type="button"
            variant="secondary"
          >
            <Square aria-hidden="true" data-icon="inline-start" />
            取消
          </Button>
        </div>
        {scriptsQueryIsError ? (
          <Alert variant="destructive">
            <AlertDescription>用例列表不可用</AlertDescription>
          </Alert>
        ) : null}
        {publishedScripts.length === 0 && !scriptsQueryIsPending ? (
          <EmptyState title="暂无可用用例" />
        ) : null}
        {selectedScript ? <SelectedScriptSummary script={selectedScript} /> : null}
      </CardContent>
    </Card>
  )
}
