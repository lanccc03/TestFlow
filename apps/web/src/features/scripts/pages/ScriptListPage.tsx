import { FilePlus2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { createApiClient } from '@/lib/api'
import { backendBaseUrl } from '@/app/config'

import { ScriptFilters } from '../components/ScriptFilters'
import { ScriptListItem } from '../components/ScriptListItem'
import { filterScripts, uniqueValues } from '../utils/filters'

const api = createApiClient({ baseUrl: backendBaseUrl })

export function ScriptListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | undefined>()

  const scriptsQuery = useQuery({
    queryKey: ['scripts'],
    queryFn: api.listScripts,
  })
  const deleteMutation = useMutation({
    mutationFn: api.deleteScript,
    onSuccess: async () => {
      setConfirmDeleteId(undefined)
      await queryClient.invalidateQueries({ queryKey: ['scripts'] })
    },
  })
  const copyMutation = useMutation({
    mutationFn: async (scriptId: string) => {
      const source = await api.getScript(scriptId)
      const nextId = `${source.id}-copy-${Date.now()}`
      return api.saveScript({
        ...source,
        id: nextId,
        name: `${source.name} 副本`,
        status: 'draft',
        version: undefined,
      })
    },
    onSuccess: async (script) => {
      await queryClient.invalidateQueries({ queryKey: ['scripts'] })
      navigate(`/scripts/${script.id}`)
    },
  })
  const executeMutation = useMutation({
    mutationFn: (scriptId: string) => api.createTask({ script_id: scriptId }),
    onSuccess: () => {
      navigate('/tasks')
    },
  })

  const scripts = scriptsQuery.data?.items ?? []
  const groups = uniqueValues(
    scripts.map((script) => script.group).filter(Boolean),
  )
  const tags = uniqueValues(scripts.flatMap((script) => script.tags))
  const filteredScripts = filterScripts({
    scripts,
    search,
    statusFilter,
    groupFilter,
    tagFilter,
  })

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

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>脚本列表</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2.5">
          {scriptsQuery.isPending ? (
            <EmptyState title="正在加载" />
          ) : scriptsQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>后端脚本数据不可用</AlertDescription>
            </Alert>
          ) : filteredScripts.length === 0 ? (
            <EmptyState title="没有匹配的脚本" />
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
        </CardContent>
      </Card>
    </PagePanel>
  )
}
