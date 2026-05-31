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

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
    <section className="content-panel script-workspace">
      <div className="script-page-heading">
        <div className="section-heading">
          <p>阶段五</p>
          <h1>脚本管理</h1>
          <span>管理 YAML 测试脚本、筛选分组标签，并进入可视化编辑。</span>
        </div>
        <Button asChild>
          <Link to="/scripts/new">
            <FilePlus2 aria-hidden="true" data-icon="inline-start" />
            新建脚本
          </Link>
        </Button>
      </div>

      <div className="script-filters">
        <label>
          <span>搜索脚本</span>
          <input
            aria-label="搜索脚本"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="名称、ID、描述、标签"
          />
        </label>
        <label>
          <span>状态筛选</span>
          <select
            aria-label="状态筛选"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
          </select>
        </label>
        <label>
          <span>分组筛选</span>
          <select
            aria-label="分组筛选"
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
          >
            <option value="all">全部分组</option>
            {groups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>标签筛选</span>
          <select
            aria-label="标签筛选"
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
          >
            <option value="all">全部标签</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="script-layout">
        <section className="script-list-section">
          <h2>脚本列表</h2>
          {scriptsQuery.isPending ? (
            <div className="catalog-placeholder">正在加载</div>
          ) : scriptsQuery.isError ? (
            <div className="catalog-error">后端脚本数据不可用</div>
          ) : filteredScripts.length === 0 ? (
            <div className="catalog-placeholder">没有匹配的脚本</div>
          ) : (
            <div className="script-list">
              {filteredScripts.map((script) => (
                <ScriptListItem
                  confirmDeleteId={confirmDeleteId}
                  key={script.id}
                  onCopy={() => copyMutation.mutate(script.id)}
                  onDelete={() => deleteMutation.mutate(script.id)}
                  onPrepareDelete={() => setConfirmDeleteId(script.id)}
                  script={script}
                />
              ))}
            </div>
          )}
        </section>

        <section className="keyword-sidebar">
          <h2>关键字库</h2>
          {keywordsQuery.isPending ? (
            <div className="catalog-placeholder">正在加载</div>
          ) : (
            <div className="keyword-grid">
              {keywords.map((keyword) => (
                <article className="keyword-item" key={keyword.name}>
                  <div className="keyword-title-row">
                    <h3>{keyword.name}</h3>
                    <Badge variant={keyword.enabled ? 'default' : 'secondary'}>
                      {keyword.module}
                    </Badge>
                  </div>
                  <p>{keyword.description}</p>
                  <span>
                    {keyword.parameters.length > 0
                      ? `${keyword.parameters.length} 个参数`
                      : '无参数'}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
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
    <article className="script-list-item">
      <div>
        <div className="script-title-row">
          <h3>{script.name}</h3>
          <Badge variant={script.status === 'published' ? 'default' : 'secondary'}>
            {script.status === 'published' ? '已发布' : '草稿'}
          </Badge>
        </div>
        <p>{script.description || script.id}</p>
        <div className="script-tags">
          {script.group ? <span>{script.group}</span> : null}
          {script.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
      <dl className="compact-meta">
        <div>
          <dt>步骤</dt>
          <dd>
            {script.enabled_step_count}/{script.step_count}
          </dd>
        </div>
        <div>
          <dt>版本</dt>
          <dd>v{script.revision}</dd>
        </div>
      </dl>
      <div className="script-actions">
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
    </article>
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
      <section className="content-panel">
        <div className="catalog-placeholder">正在加载脚本</div>
      </section>
    )
  }

  return (
    <section className="content-panel script-workspace">
      <div className="script-page-heading">
        <div className="section-heading">
          <p>阶段五</p>
          <h1>脚本编辑器</h1>
          <span>通过关键字和参数表单编排 YAML 测试脚本。</span>
        </div>
        <div className="editor-actions">
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
        </div>
      </div>

      {issues.length > 0 ? (
        <div className="validation-panel">
          {issues.map((issue) => (
            <p key={`${issue.field}-${issue.message}`}>
              {formatIssue(issue)}
            </p>
          ))}
        </div>
      ) : null}
      {saveMessage ? <div className="save-message">{saveMessage}</div> : null}

      <div className="editor-grid">
        <section className="editor-section">
          <h2>基本信息</h2>
          <div className="form-grid">
            <label>
              <span>脚本 ID</span>
              <input
                aria-label="脚本 ID"
                disabled={Boolean(scriptId)}
                value={script.id}
                onChange={(event) => updateScript({ id: event.target.value })}
              />
            </label>
            <label>
              <span>脚本名称</span>
              <input
                aria-label="脚本名称"
                value={script.name}
                onChange={(event) => updateScript({ name: event.target.value })}
              />
            </label>
            <label>
              <span>分组</span>
              <input
                aria-label="分组"
                value={script.group}
                onChange={(event) => updateScript({ group: event.target.value })}
              />
            </label>
            <label>
              <span>标签</span>
              <input
                aria-label="标签"
                value={tagText}
                onChange={(event) => setTagText(event.target.value)}
              />
            </label>
            <label className="form-wide">
              <span>描述</span>
              <textarea
                aria-label="描述"
                value={script.description}
                onChange={(event) =>
                  updateScript({ description: event.target.value })
                }
              />
            </label>
          </div>
        </section>

        <section className="editor-section">
          <div className="editor-section-heading">
            <h2>步骤列表</h2>
            <Button onClick={addStep} type="button" variant="secondary">
              <Plus aria-hidden="true" data-icon="inline-start" />
              添加步骤
            </Button>
          </div>
          {script.steps.length === 0 ? (
            <div className="catalog-placeholder">暂无步骤</div>
          ) : (
            <div className="step-list">
              {script.steps.map((step, index) => (
                <button
                  className={
                    step.id === selectedStep?.id
                      ? 'step-list-item step-list-item-active'
                      : 'step-list-item'
                  }
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  type="button"
                >
                  <span>步骤 {index + 1}</span>
                  <strong>{step.keyword || '未选择关键字'}</strong>
                  <em>{step.enabled ? '启用' : '禁用'}</em>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="editor-section step-editor">
          <h2>步骤详情</h2>
          {selectedStep ? (
            <>
              <div className="step-toolbar">
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
              <div className="form-grid">
                <label>
                  <span>关键字</span>
                  <select
                    aria-label="关键字"
                    value={selectedStep.keyword}
                    onChange={(event) =>
                      updateStep(selectedStep.id, {
                        keyword: event.target.value,
                        params: {},
                      })
                    }
                  >
                    <option value="">选择关键字</option>
                    {groupKeywords(keywords).map(([module, items]) => (
                      <optgroup key={module} label={module}>
                        {items.map((keyword) => (
                          <option key={keyword.name} value={keyword.name}>
                            {keyword.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label>
                  <span>启用步骤</span>
                  <input
                    aria-label="启用步骤"
                    checked={selectedStep.enabled}
                    onChange={(event) =>
                      updateStep(selectedStep.id, {
                        enabled: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                </label>
                <label className="form-wide">
                  <span>步骤描述</span>
                  <textarea
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

              <div className="param-list">
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
            <div className="catalog-placeholder">请选择或添加步骤</div>
          )}
        </section>
      </div>
    </section>
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
      <label>
        <span>{parameter.description || parameter.name}</span>
        <input
          aria-label={`参数 ${parameter.name}`}
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
      </label>
    )
  }

  return (
    <label>
      <span>{parameter.description || parameter.name}</span>
      <input
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

function parseTags(value: string) {
  return uniqueValues(
    value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
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
