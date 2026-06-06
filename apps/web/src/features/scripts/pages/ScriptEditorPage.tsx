import {
  ArrowDown,
  ArrowUp,
  Copy,
  Play,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'

import { ParameterInput } from '../components/ParameterInput'
import { useScriptEditorPage } from '../hooks/useScriptEditorPage'
import { groupKeywords } from '../utils/keywords'

export function ScriptEditorPage() {
  const {
    addStep,
    copyStep,
    executeMutation,
    formatIssue,
    issues,
    keywords,
    moveStep,
    removeStep,
    saveMessage,
    script,
    scriptId,
    scriptQuery,
    selectedKeyword,
    selectedStep,
    setSelectedStepId,
    setTagText,
    submit,
    tagText,
    updateParam,
    updateScript,
    updateStep,
  } = useScriptEditorPage()

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

      <div className="grid gap-4">
        <section className="grid gap-3 rounded-lg border border-border/80 bg-card/55 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="m-0 text-sm font-semibold text-foreground">基本信息</h2>
            <span className="text-xs text-muted-foreground">
              {scriptId ? '编辑已有脚本' : '创建新脚本'}
            </span>
          </div>
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
        </section>

        <div className="grid grid-cols-[minmax(280px,0.72fr)_minmax(360px,1.28fr)] gap-4 max-xl:grid-cols-1">
          <section className="overflow-hidden rounded-lg border border-border/80 bg-card/55">
            <div className="flex min-h-12 items-center justify-between gap-2 border-b border-border/75 bg-muted/25 px-3 py-2">
              <h2 className="m-0 text-sm font-semibold text-foreground">步骤列表</h2>
              <Button onClick={addStep} type="button" variant="secondary">
                <Plus aria-hidden="true" data-icon="inline-start" />
                添加步骤
              </Button>
            </div>
            <div className="grid gap-1 p-2">
              {script.steps.length === 0 ? (
                <EmptyState title="暂无步骤" />
              ) : (
                script.steps.map((step, index) => (
                  <button
                    className={cn(
                      'grid grid-cols-[2rem_minmax(0,1fr)] gap-2 rounded-md border border-transparent p-2.5 text-left text-card-foreground transition-colors hover:bg-muted/45',
                      step.id === selectedStep?.id &&
                        'border-border bg-muted/55 shadow-[inset_3px_0_0_var(--primary)]',
                    )}
                    key={step.id}
                    onClick={() => setSelectedStepId(step.id)}
                    type="button"
                  >
                    <span className="flex size-7 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-secondary-foreground">
                      {index + 1}
                    </span>
                    <span className="grid min-w-0 gap-1">
                      <strong className="truncate text-sm font-semibold">
                        {step.keyword || '未选择关键字'}
                      </strong>
                      <em className="text-xs not-italic text-muted-foreground">
                        {step.enabled ? '启用' : '禁用'}
                      </em>
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-border/80 bg-card/70">
            <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border/75 bg-muted/25 px-4 py-2">
              <h2 className="m-0 text-sm font-semibold text-foreground">步骤详情</h2>
              {selectedStep ? (
                <span className="text-xs text-muted-foreground">
                  {selectedStep.id}
                </span>
              ) : null}
            </div>
            <div className="grid gap-4 p-4">
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
            </div>
          </section>
        </div>
      </div>
    </PagePanel>
  )
}
