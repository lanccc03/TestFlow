import { FilePlus2 } from 'lucide-react'
import { Link } from 'react-router'

import { ListSurface } from '@/components/layout/list'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { ScriptFilters } from '../components/ScriptFilters'
import { ScriptListItem } from '../components/ScriptListItem'
import { useScriptListPage } from '../hooks/useScriptListPage'

export function ScriptListPage() {
  const {
    confirmDeleteId,
    copyMutation,
    deleteMutation,
    executeMutation,
    filteredScripts,
    groupFilter,
    groups,
    search,
    scriptsQuery,
    setConfirmDeleteId,
    setGroupFilter,
    setSearch,
    setStatusFilter,
    setTagFilter,
    statusFilter,
    tagFilter,
    tags,
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
        groups={groups}
        groupFilter={groupFilter}
        onGroupFilterChange={setGroupFilter}
        onSearchChange={setSearch}
        onStatusFilterChange={setStatusFilter}
        onTagFilterChange={setTagFilter}
        search={search}
        statusFilter={statusFilter}
        tagFilter={tagFilter}
        tags={tags}
      />

      <ListSurface
        description={`${filteredScripts.length} 个匹配脚本`}
        title="脚本列表"
      >
        {scriptsQuery.isPending ? (
          <div className="p-3">
            <EmptyState title="正在加载" />
          </div>
        ) : scriptsQuery.isError ? (
          <div className="p-3">
            <Alert variant="destructive">
              <AlertDescription>后端脚本数据不可用</AlertDescription>
            </Alert>
          </div>
        ) : filteredScripts.length === 0 ? (
          <div className="p-3">
            <EmptyState title="没有匹配的脚本" />
          </div>
        ) : (
          filteredScripts.map((script) => (
            <ScriptListItem
              confirmDeleteId={confirmDeleteId}
              key={script.id}
              onCopy={() => copyMutation.mutate(script.id)}
              onDelete={() => deleteMutation.mutate(script.id)}
              onPrepareDelete={() => setConfirmDeleteId(script.id)}
              onRun={() => executeMutation.mutate(script.id)}
              script={script}
            />
          ))
        )}
      </ListSurface>
    </PagePanel>
  )
}
