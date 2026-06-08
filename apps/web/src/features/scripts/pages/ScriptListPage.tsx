import { Play } from 'lucide-react'

import { ListToolbar } from '@/components/layout/list'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { useScriptListPage } from '../hooks/useScriptListPage'

export function ScriptListPage() {
  const {
    executeMutation,
    filteredScripts,
    search,
    scriptsQuery,
    setSearch,
  } = useScriptListPage()

  return (
    <PagePanel>
      <PageHeader
        title="框架用例库"
        subtitle="从测试框架读取用例名称、描述和测试步骤。"
      />

      <ListToolbar className="grid-cols-[minmax(280px,1fr)] items-center">
        <Input
          aria-label="搜索用例"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索用例名称、描述或测试步骤"
          value={search}
        />
      </ListToolbar>

      <Table aria-label="用例列表">
        <TableHeader>
          <TableRow>
            <TableHead>用例</TableHead>
            <TableHead>测试步骤</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scriptsQuery.isPending ? (
            <TableRow>
              <TableCell colSpan={3}>
                <EmptyState title="正在加载" />
              </TableCell>
            </TableRow>
          ) : scriptsQuery.isError ? (
            <TableRow>
              <TableCell colSpan={3}>
                <Alert variant="destructive">
                  <AlertDescription>后端用例数据不可用</AlertDescription>
                </Alert>
              </TableCell>
            </TableRow>
          ) : filteredScripts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3}>
                <EmptyState title={search.trim() ? '没有匹配的用例' : '没有用例'} />
              </TableCell>
            </TableRow>
          ) : (
            filteredScripts.map((script) => (
              <TableRow key={script.id}>
                <TableCell className="max-w-[360px] align-top">
                  <div className="grid gap-1">
                    <div className="font-medium">{script.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {script.description || script.id}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  {script.steps.length === 0 ? (
                    <span className="text-sm text-muted-foreground">暂无步骤说明</span>
                  ) : (
                    <ol className="m-0 grid gap-1 pl-5 text-sm">
                      {script.steps.map((step, index) => (
                        <li key={`${script.id}-${index}`}>{step}</li>
                      ))}
                    </ol>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex justify-end">
                    <Button
                      aria-label={`运行 ${script.name}`}
                      disabled={executeMutation.isPending}
                      onClick={() => executeMutation.mutate(script.id)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Play aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </PagePanel>
  )
}
