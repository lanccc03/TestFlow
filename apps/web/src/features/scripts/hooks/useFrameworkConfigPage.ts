import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/app/backend'
import type { JsonValue } from '@/lib/api'

const frameworkConfigQueryKey = ['framework-config']

export function formatJson(value: JsonValue) {
  return JSON.stringify(value, null, 2)
}

type ParseJsonValueResult =
  | { config: JsonValue; error: ''; ok: true }
  | { config?: never; error: string; ok: false }

export function parseJsonValue(text: string): ParseJsonValueResult {
  try {
    return {
      config: JSON.parse(text) as JsonValue,
      error: '',
      ok: true,
    }
  } catch (error) {
    return {
      config: undefined,
      error: error instanceof Error ? error.message : 'JSON parse failed',
      ok: false,
    }
  }
}

export function useFrameworkConfigPage() {
  const queryClient = useQueryClient()
  const [editorText, setEditorText] = useState('')
  const [parseError, setParseError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')

  const configQuery = useQuery({
    queryKey: frameworkConfigQueryKey,
    queryFn: api.getFrameworkConfig,
  })
  const saveMutation = useMutation({
    mutationFn: api.updateFrameworkConfig,
    onSuccess: async (config) => {
      setEditorText(formatJson(config))
      setSavedMessage('配置已保存')
      await queryClient.invalidateQueries({ queryKey: frameworkConfigQueryKey })
    },
  })

  useEffect(() => {
    if (configQuery.data !== undefined) {
      setEditorText(formatJson(configQuery.data))
    }
  }, [configQuery.data])

  function updateEditorText(value: string) {
    setEditorText(value)
    setParseError('')
    setSavedMessage('')
  }

  function saveConfig() {
    const result = parseJsonValue(editorText)

    if (!result.ok) {
      setParseError(result.error)
      setSavedMessage('')
      return
    }

    saveMutation.mutate(result.config)
  }

  return {
    configQuery,
    editorText,
    parseError,
    saveConfig,
    saveMutation,
    savedMessage,
    updateEditorText,
  }
}
