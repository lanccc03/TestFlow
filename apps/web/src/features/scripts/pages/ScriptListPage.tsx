import { useState } from 'react'

import { Play } from 'lucide-react'

import { ListToolbar } from '@/components/layout/list'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
    filteredCases,
    search,
    casesQuery,
    setSearch,
  } = useScriptListPage()

  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null)

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
            <TableHead>标签</TableHead>
            <TableHead>测试步骤</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {casesQuery.isPending ? (
            <TableRow>
              <TableCell colSpan={4}>
                <EmptyState title="正在加载" />
              </TableCell>
            </TableRow>
          ) : casesQuery.isError ? (
            <TableRow>
              <TableCell colSpan={4}>
                <Alert variant="destructive">
                  <AlertDescription>后端用例数据不可用</AlertDescription>
                </Alert>
              </TableCell>
            </TableRow>
          ) : filteredCases.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4}>
                <EmptyState title={search.trim() ? '没有匹配的用例' : '没有用例'} />
              </TableCell>
            </TableRow>
          ) : (
            filteredCases.map((caseItem) => (
              <TableRow key={caseItem.id}>
                <TableCell className="max-w-[360px] align-top">
                  <div className="grid gap-1">
                    <div className="font-medium">{caseItem.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {caseItem.description || caseItem.id}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  {caseItem.tag ? (
                    <Badge variant="secondary">{caseItem.tag}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="max-w-[420px] whitespace-normal align-top">
                  {caseItem.test_steps.length === 0 ? (
                    <span className="text-sm text-muted-foreground">暂无步骤说明</span>
                  ) : (
                    <div className="grid min-w-0 gap-2">
                      {expandedCaseId === caseItem.id ? (
                        <ol className="m-0 grid gap-1 pl-5 text-sm leading-relaxed">
                          {caseItem.test_steps.map((step, index) => (
                            <li className="break-words" key={`${caseItem.id}-${index}`}>
                              {step}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <div className="min-w-0 text-sm leading-relaxed">
                          <span className="font-medium text-muted-foreground">1. </span>
                          <span className="break-words">{caseItem.test_steps[0]}</span>
                        </div>
                      )}
                      {caseItem.test_steps.length > 1 ? (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>共 {caseItem.test_steps.length} 步</span>
                          <Button
                            aria-label={
                              expandedCaseId === caseItem.id
                                ? `收起 ${caseItem.name} 的测试步骤`
                                : `查看 ${caseItem.name} 的全部测试步骤`
                            }
                            className="h-auto px-0 text-xs"
                            onClick={() =>
                              setExpandedCaseId((current) =>
                                current === caseItem.id ? null : caseItem.id,
                              )
                            }
                            type="button"
                            variant="link"
                          >
                            {expandedCaseId === caseItem.id ? '收起' : '查看全部'}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex justify-end">
                    <Button
                      aria-label={`运行 ${caseItem.name}`}
                      disabled={executeMutation.isPending}
                      onClick={() => executeMutation.mutate(caseItem.id)}
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
