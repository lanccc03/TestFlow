import {
  ArrowDown,
  ArrowUp,
  Copy,
  FilePlus2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { cn, parseTags } from '@/lib/utils'
import {
  createApiClient,
  type ApiError,
  type KeywordMetadata,
  type KeywordParameter,
  type ScriptStep,
  type ScriptSummary,
  type TestScript,
} from '@/lib/api'

const api = createApiClient({ baseUrl: 'http://127.0.0.1:8000' })

type ValidationIssue = {
  field: string
  message: string
}

const emptyScript: TestScript = {
  id: '',
  name: '',
  description: '',
  status: 'draft',
  tags: [],
  group: '',
  variables: [],
  steps: [],
}

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
  const keywordsQuery = useQuery({
    queryKey: ['keywords'],
    queryFn: api.listKeywords,
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

  const scripts = scriptsQuery.data?.items ?? []
  const keywords = keywordsQuery.data?.items ?? []
  const groups = uniqueValues(scripts.map((script) => script.group).filter(Boolean))
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
        eyebrow="阶段五"
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

      <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-1">
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">搜索脚本</span>
          <Input
            aria-label="搜索脚本"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="名称、ID、描述、标签"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">状态筛选</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
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
          <Select value={groupFilter} onValueChange={setGroupFilter}>
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
          <Select value={tagFilter} onValueChange={setTagFilter}>
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

      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] gap-4 max-xl:grid-cols-1">
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
                  script={script}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle>关键字库</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            {keywordsQuery.isPending ? (
              <EmptyState title="正在加载" />
            ) : (
              keywords.map((keyword) => (
                <Card size="sm" key={keyword.name}>
                  <CardHeader className="border-b">
                    <CardTitle>{keyword.name}</CardTitle>
                    <Badge variant={keyword.enabled ? 'default' : 'secondary'}>
                      {keyword.module}
                    </Badge>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    <CardDescription>{keyword.description}</CardDescription>
                    <span className="text-xs text-muted-foreground">
                      {keyword.parameters.length > 0
                        ? `${keyword.parameters.length} 个参数`
                        : '无参数'}
                    </span>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PagePanel>
  )
}

function ScriptListItem({
  confirmDeleteId,
  onCopy,
  onDelete,
  onPrepareDelete,
  script,
}: {
  confirmDeleteId: string | undefined
  onCopy: () => void
  onDelete: () => void
  onPrepareDelete: () => void
  script: ScriptSummary
}) {
  return (
    <Card size="sm" className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-3 max-sm:grid-cols-1">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-base font-semibold">{script.name}</h3>
          <Badge variant={script.status === 'published' ? 'default' : 'secondary'}>
            {script.status === 'published' ? '已发布' : '草稿'}
          </Badge>
        </div>
        <p className="m-0 text-sm text-muted-foreground">{script.description || script.id}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {script.group ? <Badge variant="secondary">{script.group}</Badge> : null}
          {script.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      <dl className="flex gap-2">
        <div className="min-w-16 rounded-lg bg-muted px-2 py-1.5">
          <dt className="text-xs text-muted-foreground">步骤</dt>
          <dd className="m-0 text-sm font-semibold text-foreground">
            {script.enabled_step_count}/{script.step_count}
          </dd>
        </div>
        <div className="min-w-16 rounded-lg bg-muted px-2 py-1.5">
          <dt className="text-xs text-muted-foreground">版本</dt>
          <dd className="m-0 text-sm font-semibold text-foreground">v{script.revision}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button asChild size="sm" variant="secondary">
          <Link to={`/scripts/${script.id}`}>编辑</Link>
        </Button>
        <Button
          aria-label={`复制 ${script.name}`}
          onClick={onCopy}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Copy aria-hidden="true" />
        </Button>
        {confirmDeleteId === script.id ? (
          <Button
            aria-label={`确认删除 ${script.name}`}
            onClick={onDelete}
            size="sm"
            type="button"
            variant="destructive"
          >
            确认
          </Button>
        ) : (
          <Button
            aria-label={`删除 ${script.name}`}
            onClick={onPrepareDelete}
            size="icon-sm"
            type="button"
            variant="destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </div>
    </Card>
  )
}

export function ScriptEditorPage() {
  const { scriptId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [script, setScript] = useState<TestScript>(emptyScript)
  const [tagText, setTagText] = useState('')
  const [selectedStepId, setSelectedStepId] = useState<string | undefined>()
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [saveMessage, setSaveMessage] = useState('')

  const keywordsQuery = useQuery({
    queryKey: ['keywords'],
    queryFn: api.listKeywords,
  })
  const scriptQuery = useQuery({
    queryKey: ['script', scriptId],
    queryFn: () => api.getScript(scriptId ?? ''),
    enabled: Boolean(scriptId),
  })

  useEffect(() => {
    if (scriptQuery.data) {
      setScript(scriptQuery.data)
      setTagText(scriptQuery.data.tags.join(', '))
      setSelectedStepId(scriptQuery.data.steps[0]?.id)
    }
  }, [scriptQuery.data])

  const keywords = useMemo(
    () => (keywordsQuery.data?.items ?? []).filter((keyword) => keyword.enabled),
    [keywordsQuery.data?.items],
  )
  const keywordMap = useMemo(
    () => new Map(keywords.map((keyword) => [keyword.name, keyword])),
    [keywords],
  )
  const selectedStep =
    script.steps.find((step) => step.id === selectedStepId) ?? script.steps[0]
  const selectedKeyword = selectedStep
    ? keywordMap.get(selectedStep.keyword)
    : undefined

  const saveMutation = useMutation({
    mutationFn: api.saveScript,
    onSuccess: async (savedScript) => {
      setScript(savedScript)
      setTagText(savedScript.tags.join(', '))
      setSaveMessage(
        savedScript.status === 'published' ? '已发布' : '草稿已保存',
      )
      queryClient.setQueryData(['script', savedScript.id], savedScript)
      await queryClient.invalidateQueries({ queryKey: ['scripts'] })
      if (!scriptId) {
        navigate(`/scripts/${savedScript.id}`)
      }
    },
    onError: (error) => {
      setIssues(normalizeMutationIssues(error))
    },
  })

  function updateScript(update: Partial<TestScript>) {
    setScript((current) => ({ ...current, ...update }))
  }

  function updateStep(stepId: string, update: Partial<ScriptStep>) {
    setScript((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.id === stepId ? { ...step, ...update } : step,
      ),
    }))
  }

  function addStep() {
    const nextStep: ScriptStep = {
      id: `step-${Date.now()}`,
      keyword: keywords[0]?.name ?? '',
      description: '',
      enabled: true,
      params: {},
    }
    setScript((current) => ({
      ...current,
      steps: [...current.steps, nextStep],
    }))
    setSelectedStepId(nextStep.id)
  }

  function removeStep(stepId: string) {
    setScript((current) => {
      const steps = current.steps.filter((step) => step.id !== stepId)
      setSelectedStepId(steps[0]?.id)
      return { ...current, steps }
    })
  }

  function copyStep(step: ScriptStep) {
    const nextStep = { ...step, id: `step-${Date.now()}` }
    setScript((current) => ({
      ...current,
      steps: [...current.steps, nextStep],
    }))
    setSelectedStepId(nextStep.id)
  }

  function moveStep(stepId: string, direction: -1 | 1) {
    setScript((current) => {
      const index = current.steps.findIndex((step) => step.id === stepId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.steps.length) {
        return current
      }
      const steps = [...current.steps]
      const [step] = steps.splice(index, 1)
      steps.splice(nextIndex, 0, step)
      return { ...current, steps }
    })
  }

  function updateParam(
    step: ScriptStep,
    parameter: KeywordParameter,
    value: string | boolean,
  ) {
    const nextParams = { ...step.params }
    if (value === '') {
      delete nextParams[parameter.name]
    } else if (parameter.type === 'boolean') {
      nextParams[parameter.name] = Boolean(value)
    } else if (parameter.type === 'integer' || parameter.type === 'number') {
      nextParams[parameter.name] = Number(value)
    } else {
      nextParams[parameter.name] = value
    }
    updateStep(step.id, { params: nextParams })
  }

  function submit(nextStatus: TestScript['status']) {
    const payload = {
      ...script,
      status: nextStatus,
      tags: parseTags(tagText),
    }
    const nextIssues = validateScript(payload, keywordMap)
    setIssues(nextIssues)
    setSaveMessage('')
    if (nextStatus === 'published' && nextIssues.length > 0) {
      return
    }
    saveMutation.mutate(payload)
  }

  if (scriptQuery.isPending && scriptId) {
    return (
      <PagePanel>
        <EmptyState title="正在加载脚本" />
      </PagePanel>
    )
  }

  return (
    <PagePanel>
      <PageHeader
        eyebrow="阶段五"
        title="脚本编辑器"
        subtitle="通过关键字和参数表单编排 YAML 测试脚本。"
        actions={
          <>
            <Button
              onClick={() => submit('draft')}
              type="button"
              variant="secondary"
            >
              <Save aria-hidden="true" data-icon="inline-start" />
              保存草稿
            </Button>
            <Button onClick={() => submit('published')} type="button">
              发布
            </Button>
          </>
        }
      />

      {issues.length > 0 ? (
        <Alert variant="destructive">
          <AlertDescription className="grid gap-1">
            {issues.map((issue) => (
              <p className="m-0" key={`${issue.field}-${issue.message}`}>
                {formatIssue(issue)}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}
      {saveMessage ? (
        <Alert>
          <AlertDescription>{saveMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-[minmax(280px,0.8fr)_minmax(320px,1fr)] gap-4 max-xl:grid-cols-1">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-1">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">脚本 ID</span>
                <Input
                  aria-label="脚本 ID"
                  disabled={Boolean(scriptId)}
                  value={script.id}
                  onChange={(event) => updateScript({ id: event.target.value })}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">脚本名称</span>
                <Input
                  aria-label="脚本名称"
                  value={script.name}
                  onChange={(event) => updateScript({ name: event.target.value })}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">分组</span>
                <Input
                  aria-label="分组"
                  value={script.group}
                  onChange={(event) => updateScript({ group: event.target.value })}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">标签</span>
                <Input
                  aria-label="标签"
                  value={tagText}
                  onChange={(event) => setTagText(event.target.value)}
                />
              </label>
              <label className="col-span-full grid gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">描述</span>
                <Textarea
                  aria-label="描述"
                  value={script.description}
                  onChange={(event) =>
                    updateScript({ description: event.target.value })
                  }
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>步骤列表</CardTitle>
              <Button onClick={addStep} type="button" variant="secondary">
                <Plus aria-hidden="true" data-icon="inline-start" />
                添加步骤
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {script.steps.length === 0 ? (
              <EmptyState title="暂无步骤" />
            ) : (
              script.steps.map((step, index) => (
                <button
                  className={cn(
                    'grid gap-1 rounded-lg border bg-card p-2.5 text-left text-card-foreground transition-colors hover:bg-muted/60',
                    step.id === selectedStep?.id && 'border-ring ring-2 ring-ring/20',
                  )}
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  type="button"
                >
                  <span className="text-xs text-muted-foreground">步骤 {index + 1}</span>
                  <strong className="text-sm font-semibold">{step.keyword || '未选择关键字'}</strong>
                  <em className="text-xs not-italic text-muted-foreground">
                    {step.enabled ? '启用' : '禁用'}
                  </em>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="col-span-full gap-3">
          <CardHeader>
            <CardTitle>步骤详情</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {selectedStep ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => moveStep(selectedStep.id, -1)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    onClick={() => moveStep(selectedStep.id, 1)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button
                    onClick={() => copyStep(selectedStep)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Copy aria-hidden="true" />
                  </Button>
                  <Button
                    onClick={() => removeStep(selectedStep.id)}
                    size="icon-sm"
                    type="button"
                    variant="destructive"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-1">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">关键字</span>
                    <Select
                      value={selectedStep.keyword}
                      onValueChange={(value) =>
                        updateStep(selectedStep.id, {
                          keyword: value,
                          params: {},
                        })
                      }
                    >
                      <SelectTrigger aria-label="关键字">
                        <SelectValue placeholder="选择关键字" />
                      </SelectTrigger>
                      <SelectContent>
                        {groupKeywords(keywords).map(([module, items]) => (
                          <div key={module}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              {module}
                            </div>
                            {items.map((keyword) => (
                              <SelectItem key={keyword.name} value={keyword.name}>
                                {keyword.name}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">启用步骤</span>
                    <Checkbox
                      aria-label="启用步骤"
                      checked={selectedStep.enabled}
                      onCheckedChange={(checked) =>
                        updateStep(selectedStep.id, { enabled: checked === true })
                      }
                    />
                  </label>
                  <label className="col-span-full grid gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">步骤描述</span>
                    <Textarea
                      aria-label="步骤描述"
                      value={selectedStep.description}
                      onChange={(event) =>
                        updateStep(selectedStep.id, {
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <div className="grid gap-2.5">
                  {selectedKeyword?.parameters.map((parameter) => (
                    <ParameterInput
                      key={parameter.name}
                      onChange={(value) =>
                        updateParam(selectedStep, parameter, value)
                      }
                      parameter={parameter}
                      value={selectedStep.params[parameter.name]}
                    />
                  ))}
                </div>
              </>
            ) : (
              <EmptyState title="请选择或添加步骤" />
            )}
          </CardContent>
        </Card>
      </div>
    </PagePanel>
  )
}

function ParameterInput({
  onChange,
  parameter,
  value,
}: {
  onChange: (value: string | boolean) => void
  parameter: KeywordParameter
  value: unknown
}) {
  if (parameter.type === 'boolean') {
    return (
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">{parameter.description || parameter.name}</span>
        <Checkbox
          aria-label={`参数 ${parameter.name}`}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
      </label>
    )
  }

  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{parameter.description || parameter.name}</span>
      <Input
        aria-label={`参数 ${parameter.name}`}
        type={parameter.type === 'integer' || parameter.type === 'number' ? 'number' : 'text'}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function filterScripts({
  groupFilter,
  scripts,
  search,
  statusFilter,
  tagFilter,
}: {
  groupFilter: string
  scripts: ScriptSummary[]
  search: string
  statusFilter: string
  tagFilter: string
}) {
  const query = search.trim().toLowerCase()
  return scripts.filter((script) => {
    const matchesSearch =
      !query ||
      [
        script.id,
        script.name,
        script.description,
        script.group,
        ...script.tags,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    const matchesStatus =
      statusFilter === 'all' || script.status === statusFilter
    const matchesGroup = groupFilter === 'all' || script.group === groupFilter
    const matchesTag = tagFilter === 'all' || script.tags.includes(tagFilter)
    return matchesSearch && matchesStatus && matchesGroup && matchesTag
  })
}

function validateScript(
  script: TestScript,
  keywords: Map<string, KeywordMetadata>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!script.id.trim()) {
    issues.push({ field: 'id', message: '脚本 ID 不能为空' })
  }
  if (!script.name.trim()) {
    issues.push({ field: 'name', message: '脚本名称不能为空' })
  }
  script.steps.forEach((step, stepIndex) => {
    const keyword = keywords.get(step.keyword)
    if (!keyword) {
      issues.push({
        field: `steps[${stepIndex}].keyword`,
        message: `Unknown keyword: ${step.keyword || 'empty'}`,
      })
      return
    }
    keyword.parameters.forEach((parameter) => {
      const field = `steps[${stepIndex}].params.${parameter.name}`
      const value = step.params[parameter.name]
      if (parameter.required && (value === undefined || value === '')) {
        issues.push({ field, message: 'Missing required parameter' })
      } else if (value !== undefined && value !== '' && !matchesType(value, parameter.type)) {
        issues.push({ field, message: `Expected ${parameter.type}` })
      }
    })
  })
  return issues
}

function matchesType(value: unknown, type: KeywordParameter['type']) {
  if (type === 'string') return typeof value === 'string'
  if (type === 'integer') return Number.isInteger(value)
  if (type === 'number') return typeof value === 'number' && !Number.isNaN(value)
  if (type === 'boolean') return typeof value === 'boolean'
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value)
  if (type === 'array') return Array.isArray(value)
  return false
}

function formatIssue(issue: ValidationIssue) {
  const match = issue.field.match(/^steps\[(\d+)]\.params\.(.+)$/)
  if (match) {
    return `步骤 ${Number(match[1]) + 1} 参数 ${match[2]}：${issue.message}`
  }
  return `${issue.field}：${issue.message}`
}

function normalizeMutationIssues(error: unknown): ValidationIssue[] {
  const details = (error as ApiError).details
  if (Array.isArray(details)) {
    return details.filter(isValidationIssue)
  }
  return [{ field: 'save', message: error instanceof Error ? error.message : '保存失败' }]
}

function isValidationIssue(value: unknown): value is ValidationIssue {
  if (!value || typeof value !== 'object') {
    return false
  }

  return (
    'field' in value &&
    typeof value.field === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  )
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values))
}

function groupKeywords(keywords: KeywordMetadata[]) {
  const groups = new Map<string, KeywordMetadata[]>()
  keywords.forEach((keyword) => {
    const items = groups.get(keyword.module) ?? []
    items.push(keyword)
    groups.set(keyword.module, items)
  })
  return Array.from(groups.entries())
}
