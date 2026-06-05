import { Copy, Edit3, FilePlus2, Play, Trash2 } from 'lucide-react'
import { Link } from 'react-router'

import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { ScriptFilters } from '../components/ScriptFilters'
import { useScriptListPage } from '../hooks/useScriptListPage'

export function ScriptListPage() {
  const {
    confirmDeleteId,
    copyMutation,
    deleteMutation,
    executeMutation,
    filteredScripts,
    search,
    scriptsQuery,
    setConfirmDeleteId,
    setSearch,
  } = useScriptListPage()

  return (
    <PagePanel>
      <PageHeader
        title="脚本管理"
        subtitle="管理 YAML 测试脚本、筛选分组标签，并进入可视化编辑。"
        actions={
          <Button asChild>
            <Link to="/scripts/new">
              <FilePlus2 aria-hidden="true" data-icon="inline-start" />
              新建脚本
            </Link>
          </Button>
        }
      />

      <ScriptFilters
        onSearchChange={setSearch}
        search={search}
      />

      <Table aria-label="脚本列表">
        <TableHeader>
          <TableRow>
            <TableHead>脚本</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>分组 / 标签</TableHead>
            <TableHead className="text-right">步骤</TableHead>
            <TableHead className="text-right">版本</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scriptsQuery.isPending ? (
            <TableRow>
              <TableCell colSpan={6}>
                <EmptyState title="正在加载" />
              </TableCell>
            </TableRow>
          ) : scriptsQuery.isError ? (
            <TableRow>
              <TableCell colSpan={6}>
                <Alert variant="destructive">
                  <AlertDescription>后端脚本数据不可用</AlertDescription>
                </Alert>
              </TableCell>
            </TableRow>
          ) : filteredScripts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <EmptyState title="没有匹配的脚本" />
              </TableCell>
            </TableRow>
          ) : (
            filteredScripts.map((script) => (
              <TableRow key={script.id}>
                <TableCell className="max-w-[360px]">
                  <div className="grid gap-1">
                    <div className="font-medium">{script.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {script.description || script.id}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={script.status === 'published' ? 'default' : 'secondary'}>
                    {script.status === 'published' ? '已发布' : '草稿'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {script.group ? (
                      <Badge variant="secondary">{script.group}</Badge>
                    ) : null}
                    {script.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {script.enabled_step_count}/{script.step_count}
                </TableCell>
                <TableCell className="text-right font-medium">
                  v{script.revision}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
                    <Button
                      aria-label={`运行 ${script.name}`}
                      onClick={() => executeMutation.mutate(script.id)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Play aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label={`编辑 ${script.name}`}
                      asChild
                      size="icon-sm"
                      variant="ghost"
                    >
                      <Link to={`/scripts/${script.id}`}>
                        <Edit3 aria-hidden="true" />
                      </Link>
                    </Button>
                    <Button
                      aria-label={`复制 ${script.name}`}
                      onClick={() => copyMutation.mutate(script.id)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Copy aria-hidden="true" />
                    </Button>
                    {confirmDeleteId === script.id ? (
                      <Button
                        aria-label={`确认删除 ${script.name}`}
                        onClick={() => deleteMutation.mutate(script.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        确认
                      </Button>
                    ) : (
                      <Button
                        aria-label={`删除 ${script.name}`}
                        onClick={() => setConfirmDeleteId(script.id)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </PagePanel >
  )
}
