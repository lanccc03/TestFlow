import type {
  ApiError,
  KeywordMetadata,
  KeywordParameter,
  TestScript,
} from '@/lib/api'
import type { ValidationIssue } from '../types'

export function validateScript(
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
      } else if (
        value !== undefined &&
        value !== '' &&
        !matchesType(value, parameter.type)
      ) {
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
  if (type === 'object')
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  if (type === 'array') return Array.isArray(value)
  return false
}

export { matchesType }

export function formatIssue(issue: ValidationIssue) {
  const match = issue.field.match(/^steps\[(\d+)]\.params\.(.+)$/)
  if (match) {
    return `步骤 ${Number(match[1]) + 1} 参数 ${match[2]}：${issue.message}`
  }
  return `${issue.field}：${issue.message}`
}

export function normalizeMutationIssues(error: unknown): ValidationIssue[] {
  const details = (error as ApiError).details
  if (Array.isArray(details)) {
    return details.filter(isValidationIssue)
  }
  return [
    {
      field: 'save',
      message: error instanceof Error ? error.message : '保存失败',
    },
  ]
}

export function isValidationIssue(value: unknown): value is ValidationIssue {
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
