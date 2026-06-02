import { describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'

import { ApiError, createApiClient } from './api'
import type {
  ExecutionEventMessage,
  ExecutionTask,
  ExecutionTaskCreate,
} from './api'

describe('createApiClient', () => {
  it('returns health data from the backend', async () => {
    const httpClient = {
      get: vi.fn().mockResolvedValue({
        data: {
          data_dir: '/tmp/testflow',
          service: 'testflow-backend',
          status: 'ok',
          version: '0.1.0',
        },
      }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.getHealth()).resolves.toMatchObject({
      service: 'testflow-backend',
      status: 'ok',
    })
    expect(httpClient.get).toHaveBeenCalledWith('/health')
  })

  it('returns keyword metadata from the backend', async () => {
    const httpClient = {
      get: vi.fn().mockResolvedValue({
        data: {
          items: [
            {
              name: 'wait',
              description: '等待指定秒数',
              module: 'flow',
              parameters: [],
              example: {},
              enabled: true,
            },
          ],
        },
      }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.listKeywords()).resolves.toEqual({
      items: [
        {
          name: 'wait',
          description: '等待指定秒数',
          module: 'flow',
          parameters: [],
          example: {},
          enabled: true,
        },
      ],
    })
    expect(httpClient.get).toHaveBeenCalledWith('/api/keywords')
  })

  it('returns script summaries from the backend', async () => {
    const httpClient = {
      get: vi.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'smoke-cockpit',
              name: '座舱冒烟测试',
              description: '基础稳定性巡检',
              step_count: 1,
              enabled_step_count: 1,
              revision: 2,
              updated_at: '2026-05-31T12:00:00+00:00',
              status: 'published',
              tags: ['smoke'],
              group: 'stability',
            },
          ],
        },
      }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.listScripts()).resolves.toMatchObject({
      items: [
        {
          id: 'smoke-cockpit',
          name: '座舱冒烟测试',
          revision: 2,
        },
      ],
    })
    expect(httpClient.get).toHaveBeenCalledWith('/api/scripts')
  })

  it('returns a script detail from the backend', async () => {
    const httpClient = {
      get: vi.fn().mockResolvedValue({
        data: {
          id: 'smoke-cockpit',
          name: '座舱冒烟测试',
          description: '基础稳定性巡检',
          status: 'draft',
          tags: [],
          group: '',
          variables: [],
          steps: [],
        },
      }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.getScript('smoke-cockpit')).resolves.toMatchObject({
      id: 'smoke-cockpit',
      status: 'draft',
    })
    expect(httpClient.get).toHaveBeenCalledWith('/api/scripts/smoke-cockpit')
  })

  it('deletes a script through the backend', async () => {
    const httpClient = {
      delete: vi.fn().mockResolvedValue({ data: undefined }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.deleteScript('smoke-cockpit')).resolves.toBeUndefined()
    expect(httpClient.delete).toHaveBeenCalledWith('/api/scripts/smoke-cockpit')
  })

  it('exposes command template CRUD endpoints', async () => {
    const command = {
      id: 'command-1',
      name: '查看日志',
      command: 'tail -f /var/log/syslog',
      description: '跟随系统日志',
      group: 'diagnostics',
      tags: ['logs'],
      created_at: '2026-06-01T00:00:00+00:00',
      updated_at: '2026-06-01T00:00:00+00:00',
    }
    const httpClient = {
      delete: vi.fn().mockResolvedValue({ data: undefined }),
      get: vi.fn().mockResolvedValue({ data: { items: [command] } }),
      post: vi.fn().mockResolvedValue({ data: command }),
      put: vi.fn().mockResolvedValue({
        data: {
          ...command,
          command: 'dmesg -w',
          updated_at: '2026-06-01T00:01:00+00:00',
        },
      }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.listCommands('tail')).resolves.toEqual({ items: [command] })
    await expect(
      api.createCommand({
        name: '查看日志',
        command: 'tail -f /var/log/syslog',
        description: '跟随系统日志',
        group: 'diagnostics',
        tags: ['logs'],
      }),
    ).resolves.toEqual(command)
    await expect(
      api.updateCommand('command-1', {
        name: '查看日志',
        command: 'dmesg -w',
        description: '跟随系统日志',
        group: 'diagnostics',
        tags: ['logs'],
      }),
    ).resolves.toMatchObject({ command: 'dmesg -w' })
    await expect(api.deleteCommand('command-1')).resolves.toBeUndefined()

    expect(httpClient.get).toHaveBeenCalledWith('/api/commands', {
      params: { search: 'tail' },
    })
    expect(httpClient.post).toHaveBeenCalledWith('/api/commands', {
      name: '查看日志',
      command: 'tail -f /var/log/syslog',
      description: '跟随系统日志',
      group: 'diagnostics',
      tags: ['logs'],
    })
    expect(httpClient.put).toHaveBeenCalledWith('/api/commands/command-1', {
      name: '查看日志',
      command: 'dmesg -w',
      description: '跟随系统日志',
      group: 'diagnostics',
      tags: ['logs'],
    })
    expect(httpClient.delete).toHaveBeenCalledWith('/api/commands/command-1')
  })

  it('exposes execution task endpoints', async () => {
    const task = {
      id: 'task-1',
      script_id: 'smoke-cockpit',
      script_name: '座舱冒烟测试',
      script_revision: 2,
      status: 'running',
      environment: 'staging',
      target_device: 'bench-1',
      variables: { region: 'cn-north' },
      executor: 'local',
      created_at: '2026-06-01T00:00:00+00:00',
      started_at: '2026-06-01T00:00:01+00:00',
      finished_at: null,
      duration_ms: 1000,
      log_path: 'data/reports/task-1/task.log',
      report_dir: 'data/reports/task-1',
      steps: [
        {
          id: 'step-1',
          keyword: 'wait',
          description: '等待启动',
          status: 'passed',
          started_at: '2026-06-01T00:00:01+00:00',
          finished_at: '2026-06-01T00:00:02+00:00',
          duration_ms: 1000,
          index: 0,
          input: {},
          output: {},
          error_message: '',
          error_detail: '',
          attachments: [],
        },
      ],
      logs: [
        {
          timestamp: '2026-06-01T00:00:01+00:00',
          level: 'info',
          message: 'Task started',
          step_id: 'step-1',
        },
      ],
      error_message: '',
    } satisfies ExecutionTask
    const createPayload = {
      script_id: 'smoke-cockpit',
      environment: 'staging',
      target_device: 'bench-1',
      variables: { region: 'cn-north' },
    } satisfies ExecutionTaskCreate
    const defaultedCreatePayload = {
      script_id: 'smoke-cockpit',
    } satisfies ExecutionTaskCreate
    const connectionEvent = {
      type: 'connection',
      status: 'connected',
    } satisfies ExecutionEventMessage
    const taskStatusEvent = {
      type: 'task_status',
      task_id: 'task-1',
      status: 'running',
    } satisfies ExecutionEventMessage
    const httpClient = {
      get: vi.fn().mockResolvedValue({ data: { items: [task] } }),
      post: vi.fn().mockResolvedValue({ data: task }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.listTasks()).resolves.toEqual({ items: [task] })
    await expect(api.createTask(createPayload)).resolves.toEqual(task)
    await expect(api.createTask(defaultedCreatePayload)).resolves.toEqual(task)
    await expect(api.cancelTask('task-1')).resolves.toEqual(task)
    expect(connectionEvent.status).toBe('connected')
    expect(taskStatusEvent.status).toBe('running')

    expect(httpClient.get).toHaveBeenCalledWith('/api/tasks', { params: {} })
    expect(httpClient.post).toHaveBeenCalledWith('/api/tasks', createPayload)
    expect(httpClient.post).toHaveBeenCalledWith(
      '/api/tasks',
      defaultedCreatePayload,
    )
    expect(httpClient.post).toHaveBeenCalledWith('/api/tasks/task-1/cancel', {})
  })

  it('normalizes axios failed responses into ApiError', async () => {
    const httpClient = {
      get: vi.fn().mockRejectedValue({
        isAxiosError: true,
        response: {
          data: { detail: 'No route' },
          status: 404,
          statusText: 'Not Found',
        },
      }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.listItems('/api/scripts')).rejects.toMatchObject({
      message: 'No route',
      status: 404,
    })
    await expect(api.listItems('/api/scripts')).rejects.toBeInstanceOf(ApiError)
  })

  it('normalizes common backend error responses into ApiError', async () => {
    const httpClient = {
      get: vi.fn().mockRejectedValue({
        isAxiosError: true,
        response: {
          data: {
            error: {
              code: 'script_validation_error',
              message: 'Script validation failed',
              details: [],
            },
          },
          status: 422,
          statusText: 'Unprocessable Entity',
        },
      }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.listScripts()).rejects.toMatchObject({
      message: 'Script validation failed',
      status: 422,
      details: [],
    })
  })

  it('calls execution history and report endpoints with filters', async () => {
    const executionTask: ExecutionTask = {
      id: 'task-1',
      script_id: 'smoke-cockpit',
      script_name: '座舱冒烟测试',
      script_revision: 2,
      status: 'failed',
      environment: 'staging',
      target_device: 'bench-1',
      variables: {},
      executor: 'alice',
      created_at: '2026-06-01T10:00:00+00:00',
      started_at: '2026-06-01T10:00:01+00:00',
      finished_at: '2026-06-01T10:10:00+00:00',
      duration_ms: 599000,
      log_path: 'data/reports/task-1/task.log',
      report_dir: 'data/reports/task-1',
      steps: [],
      logs: [],
      error_message: '',
    }
    const httpClient = {
      get: vi
        .fn()
        .mockResolvedValueOnce({ data: { items: [] } })
        .mockResolvedValueOnce({
          data: {
            task: executionTask,
            attachments: [],
            raw_framework_report: null,
          },
        }),
    } as unknown as AxiosInstance
    const client = createApiClient({
      baseUrl: 'http://localhost',
      httpClient,
    })

    await client.listTasks({
      script_id: 'smoke-cockpit',
      status: 'failed',
      created_from: '2026-06-01T00:00:00+00:00',
      created_to: '2026-06-01T23:59:59+00:00',
      executor: 'alice',
    })
    await client.getReport('task-1')

    expect(httpClient.get).toHaveBeenNthCalledWith(1, '/api/tasks', {
      params: {
        script_id: 'smoke-cockpit',
        status: 'failed',
        created_from: '2026-06-01T00:00:00+00:00',
        created_to: '2026-06-01T23:59:59+00:00',
        executor: 'alice',
      },
    })
    expect(httpClient.get).toHaveBeenNthCalledWith(2, '/api/reports/task-1')
  })

  it('exposes backend field-level error details', async () => {
    const details = [
      {
        field: 'steps[0].params.seconds',
        message: 'Missing required parameter',
      },
    ]
    const httpClient = {
      get: vi.fn().mockRejectedValue({
        isAxiosError: true,
        response: {
          data: {
            error: {
              code: 'script_validation_error',
              message: 'Script validation failed',
              details,
            },
          },
          status: 422,
          statusText: 'Unprocessable Entity',
        },
      }),
    } as unknown as AxiosInstance
    const api = createApiClient({ baseUrl: 'http://backend.test', httpClient })

    await expect(api.listScripts()).rejects.toMatchObject({
      details,
      message: 'Script validation failed',
      status: 422,
    })
  })
})
