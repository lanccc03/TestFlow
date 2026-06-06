import { Braces, RefreshCw, Save, Settings2 } from 'lucide-react'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'

import { useFrameworkConfigPage } from '../hooks/useFrameworkConfigPage'

export function FrameworkConfigPage() {
  const {
    configQuery,
    editorText,
    parseError,
    saveConfig,
    saveMutation,
    savedMessage,
    updateEditorText,
  } = useFrameworkConfigPage()
  const backendError =
    configQuery.error instanceof Error
      ? configQuery.error.message
      : saveMutation.error instanceof Error
        ? saveMutation.error.message
        : ''

  return (
    <PagePanel>
      <PageHeader
        title="框架配置"
        subtitle="读取并替换自动化框架的完整 JSON 配置。"
        actions={<Badge variant="secondary">JSON</Badge>}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-4 max-xl:grid-cols-1">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <CardTitle>配置 JSON</CardTitle>
                <CardDescription>
                  保存时会将当前 JSON 作为整份框架配置提交。
                </CardDescription>
              </div>
              <Braces aria-hidden="true" className="mt-0.5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {configQuery.isPending ? (
              <EmptyState
                icon={<RefreshCw aria-hidden="true" />}
                title="正在加载配置"
              />
            ) : (
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  saveConfig()
                }}
              >
                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    配置 JSON
                  </span>
                  <Textarea
                    aria-invalid={Boolean(parseError)}
                    aria-label="配置 JSON"
                    className="min-h-[420px] resize-y font-mono text-sm leading-6"
                    spellCheck={false}
                    value={editorText}
                    onChange={(event) => updateEditorText(event.target.value)}
                  />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 text-xs text-muted-foreground">
                    支持对象、数组、字符串、数字、布尔值和 null。
                  </p>
                  <Button disabled={saveMutation.isPending} type="submit">
                    <Save aria-hidden="true" data-icon="inline-start" />
                    {saveMutation.isPending ? '保存中' : '保存配置'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>状态</CardTitle>
            <CardDescription>配置读取和保存结果。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {savedMessage ? (
              <Alert>
                <Settings2 aria-hidden="true" />
                <AlertTitle>{savedMessage}</AlertTitle>
                <AlertDescription>
                  后端已返回保存后的框架配置。
                </AlertDescription>
              </Alert>
            ) : null}
            {parseError ? (
              <Alert variant="destructive">
                <AlertTitle>JSON 格式无效</AlertTitle>
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            ) : null}
            {backendError ? (
              <Alert variant="destructive">
                <AlertTitle>框架配置不可用</AlertTitle>
                <AlertDescription>{backendError}</AlertDescription>
              </Alert>
            ) : null}
            {!savedMessage && !parseError && !backendError ? (
              <EmptyState title="等待配置操作" />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PagePanel>
  )
}
