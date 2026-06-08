import { describe, expect, it, vi } from 'vitest'

import { createCommandsApi } from './commands'
import { createExecutionsApi } from './executions'
import { createFrameworkApi } from './framework'
import { createHealthApi } from './health'
import { createReportsApi } from './reports'
import { createScriptsApi } from './scripts'
import type { ApiRequestClient } from './client'
import type { CommandTemplatePayload } from './commands'
import type { ExecutionTaskCreate } from './executions'
import type { JsonValue } from './types'

function createClientMock(): ApiRequestClient {
  return {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    postEmpty: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
  }
}

describe('api endpoint modules', () => {
  it('keeps health and framework endpoints in focused modules', async () => {
    const client = createClientMock()
    const healthApi = createHealthApi(client)
    const frameworkApi = createFrameworkApi(client)
    const config = { variables: { retries: 2 } } satisfies JsonValue

    await healthApi.getHealth()
    await frameworkApi.getFrameworkConfig()
    await frameworkApi.updateFrameworkConfig(config)

    expect(client.get).toHaveBeenNthCalledWith(1, '/health')
    expect(client.get).toHaveBeenNthCalledWith(2, '/api/framework/config')
    expect(client.put).toHaveBeenCalledWith('/api/framework/config', config)
  })

  it('keeps framework case endpoints in a focused module', async () => {
    const client = createClientMock()
    const scriptsApi = createScriptsApi(client)

    await scriptsApi.listScripts()
    await scriptsApi.getScript('case.smoke_cockpit')

    expect(client.get).toHaveBeenNthCalledWith(1, '/api/scripts')
    expect(client.get).toHaveBeenNthCalledWith(
      2,
      '/api/scripts/case.smoke_cockpit',
    )
    expect(client.remove).not.toHaveBeenCalled()
  })

  it('keeps command endpoints in a focused module', async () => {
    const client = createClientMock()
    const commandsApi = createCommandsApi(client)
    const payload = {
      name: '查看日志',
      command: 'tail -f /var/log/syslog',
      description: '跟随系统日志',
      group: 'diagnostics',
      tags: ['logs'],
    } satisfies CommandTemplatePayload

    await commandsApi.listCommands('tail')
    await commandsApi.createCommand(payload)
    await commandsApi.updateCommand('command-1', payload)
    await commandsApi.deleteCommand('command-1')

    expect(client.get).toHaveBeenCalledWith('/api/commands', {
      params: { search: 'tail' },
    })
    expect(client.post).toHaveBeenCalledWith('/api/commands', payload)
    expect(client.put).toHaveBeenCalledWith('/api/commands/command-1', payload)
    expect(client.remove).toHaveBeenCalledWith('/api/commands/command-1')
  })

  it('keeps execution and report endpoints in focused modules', async () => {
    const client = createClientMock()
    const executionsApi = createExecutionsApi(client)
    const reportsApi = createReportsApi(client)
    const payload = { script_id: 'smoke-cockpit' } satisfies ExecutionTaskCreate

    await executionsApi.listTasks({
      created_from: '',
      executor: 'alice',
      status: undefined,
    })
    await executionsApi.getTask('task-1')
    await executionsApi.createTask(payload)
    await executionsApi.cancelTask('task-1')
    await reportsApi.listReports({ executor: 'alice' })
    await reportsApi.getReport('task-1')

    expect(client.get).toHaveBeenNthCalledWith(1, '/api/tasks', {
      params: { executor: 'alice' },
    })
    expect(client.get).toHaveBeenNthCalledWith(2, '/api/tasks/task-1')
    expect(client.post).toHaveBeenCalledWith('/api/tasks', payload)
    expect(client.postEmpty).toHaveBeenCalledWith('/api/tasks/task-1/cancel')
    expect(client.get).toHaveBeenNthCalledWith(3, '/api/reports', {
      params: { executor: 'alice' },
    })
    expect(client.get).toHaveBeenNthCalledWith(4, '/api/reports/task-1')
  })
})
