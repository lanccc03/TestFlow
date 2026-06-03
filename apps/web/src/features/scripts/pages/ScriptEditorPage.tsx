import {
  ArrowDown,
  ArrowUp,
  Copy,
  Play,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { cn, parseTags } from '@/lib/utils'
import {
  createApiClient,
  type KeywordParameter,
  type ScriptStep,
  type TestScript,
} from '@/lib/api'
import { backendBaseUrl } from '@/app/config'

import { ParameterInput } from '../components/ParameterInput'
import { emptyScript } from '../constants'
import type { ValidationIssue } from '../types'
import { groupKeywords } from '../utils/keywords'
import {
  formatIssue,
  normalizeMutationIssues,
  validateScript,
} from '../utils/validation'

const api = createApiClient({ baseUrl: backendBaseUrl })

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
        savedScript.status === 'published' ? '已保存' : '草稿已保存',
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

  const executeMutation = useMutation({
    mutationFn: () => api.createTask({ script_id: script.id }),
    onSuccess: (_task) => {
      navigate(`/tasks`)
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
              保存
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800"
              disabled={!scriptId || executeMutation.isPending}
              onClick={() => executeMutation.mutate()}
              type="button"
            >
              <Play
                aria-hidden="true"
                data-icon="inline-start"
              />
              运行
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
                    step.id === selectedStep?.id &&
                      'border-ring ring-2 ring-ring/20',
                  )}
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  type="button"
                >
                  <span className="text-xs text-muted-foreground">
                    步骤 {index + 1}
                  </span>
                  <strong className="text-sm font-semibold">
                    {step.keyword || '未选择关键字'}
                  </strong>
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
                    <span className="text-xs font-semibold text-muted-foreground">
                      关键字
                    </span>
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
                              <SelectItem
                                key={keyword.name}
                                value={keyword.name}
                              >
                                {keyword.name}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">
                      启用步骤
                    </span>
                    <Checkbox
                      aria-label="启用步骤"
                      checked={selectedStep.enabled}
                      onCheckedChange={(checked) =>
                        updateStep(selectedStep.id, {
                          enabled: checked === true,
                        })
                      }
                    />
                  </label>
                  <label className="col-span-full grid gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">
                      步骤描述
                    </span>
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
