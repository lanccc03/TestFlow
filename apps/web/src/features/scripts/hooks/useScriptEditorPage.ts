import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/app/backend'
import { parseTags } from '@/lib/utils'
import {
  type KeywordParameter,
  type ScriptStep,
  type TestScript,
} from '@/lib/api'

import { emptyScript } from '../constants'
import type { ValidationIssue } from '../types'
import { formatIssue, normalizeMutationIssues, validateScript } from '../utils/validation'

export function useScriptEditorPage() {
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
    onSuccess: (task) => {
      navigate(`/tasks?taskId=${encodeURIComponent(task.id)}`)
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

  return {
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
  }
}
