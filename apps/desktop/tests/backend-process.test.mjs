import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'

import { BackendProcessManager } from '../dist/main/backend-process.js'
import { createBackendProcessOptions } from '../dist/main/backend-config.js'

class FakeChildProcess extends EventEmitter {
  killed = false
  pid = 4242

  kill(signal = 'SIGTERM') {
    this.killed = true
    this.signal = signal
    this.emit('exit', 0, signal)
    return true
  }
}

test('starts backend process and reports running after health check passes', async () => {
  const child = new FakeChildProcess()
  const healthChecks = [false, true]
  const statusChanges = []
  const manager = new BackendProcessManager({
    command: 'uv',
    args: ['run', 'python', '-m', 'uvicorn'],
    cwd: '/repo/backend',
    healthUrl: 'http://127.0.0.1:8000/health',
    spawnProcess: () => child,
    fetchHealth: async () => ({ ok: healthChecks.shift() ?? true }),
    pollIntervalMs: 5,
  })
  manager.onStatusChange((status) => statusChanges.push(status.state))

  await manager.start()

  assert.equal(manager.getStatus().state, 'running')
  assert.equal(manager.getStatus().pid, 4242)
  assert.deepEqual(statusChanges, ['starting', 'running'])
})

test('does not keep polling health after a spawned backend is running', async () => {
  const child = new FakeChildProcess()
  let healthCheckCount = 0
  const manager = new BackendProcessManager({
    command: 'uv',
    args: ['run', 'python', '-m', 'uvicorn'],
    cwd: '/repo/backend',
    healthUrl: 'http://127.0.0.1:8000/health',
    spawnProcess: () => child,
    fetchHealth: async () => {
      healthCheckCount += 1
      return { ok: healthCheckCount >= 2 }
    },
    pollIntervalMs: 5,
  })

  await manager.start()
  assert.equal(healthCheckCount, 2)

  await new Promise((resolve) => setTimeout(resolve, 25))

  assert.equal(healthCheckCount, 2)
})

test('reuses an already healthy backend without spawning another process', async () => {
  let spawnCount = 0
  const manager = new BackendProcessManager({
    command: 'uv',
    args: ['run', 'python', '-m', 'uvicorn'],
    cwd: '/repo/backend',
    healthUrl: 'http://127.0.0.1:8000/health',
    spawnProcess: () => {
      spawnCount += 1
      return new FakeChildProcess()
    },
    fetchHealth: async () => ({ ok: true }),
    pollIntervalMs: 5,
  })

  await manager.start()

  assert.equal(spawnCount, 0)
  assert.equal(manager.getStatus().state, 'running')
}
)

test('does not keep polling health after reusing an existing backend', async () => {
  let healthCheckCount = 0
  const manager = new BackendProcessManager({
    command: 'uv',
    args: ['run', 'python', '-m', 'uvicorn'],
    cwd: '/repo/backend',
    healthUrl: 'http://127.0.0.1:8000/health',
    spawnProcess: () => new FakeChildProcess(),
    fetchHealth: async () => {
      healthCheckCount += 1
      return { ok: true }
    },
    pollIntervalMs: 5,
  })

  await manager.start()
  assert.equal(healthCheckCount, 1)

  await new Promise((resolve) => setTimeout(resolve, 25))

  assert.equal(healthCheckCount, 1)
})

test('reports failed when backend process exits before becoming healthy', async () => {
  const child = new FakeChildProcess()
  const manager = new BackendProcessManager({
    command: 'uv',
    args: ['run', 'python', '-m', 'uvicorn'],
    cwd: '/repo/backend',
    healthUrl: 'http://127.0.0.1:8000/health',
    spawnProcess: () => {
      setImmediate(() => child.emit('exit', 1, null))
      return child
    },
    fetchHealth: async () => ({ ok: false }),
    pollIntervalMs: 5,
  })

  const startPromise = manager.start()
  await assert.rejects(startPromise, /exited before becoming healthy/)
  assert.equal(manager.getStatus().state, 'failed')
})

test('stop terminates a running backend process and reports stopped', async () => {
  const child = new FakeChildProcess()
  const healthChecks = [false, true]
  const manager = new BackendProcessManager({
    command: 'uv',
    args: ['run', 'python', '-m', 'uvicorn'],
    cwd: '/repo/backend',
    healthUrl: 'http://127.0.0.1:8000/health',
    spawnProcess: () => child,
    fetchHealth: async () => ({ ok: healthChecks.shift() ?? true }),
    pollIntervalMs: 5,
  })

  await manager.start()
  await manager.stop()

  assert.equal(child.killed, true)
  assert.equal(manager.getStatus().state, 'stopped')
}
)

test('stop waits for the backend process tree to terminate before reporting stopped', async () => {
  const child = new FakeChildProcess()
  const healthChecks = [false, true]
  let resolveTermination
  const termination = new Promise((resolve) => {
    resolveTermination = resolve
  })
  const manager = new BackendProcessManager({
    command: 'uv',
    args: ['run', 'python', '-m', 'uvicorn'],
    cwd: '/repo/backend',
    healthUrl: 'http://127.0.0.1:8000/health',
    spawnProcess: () => child,
    fetchHealth: async () => ({ ok: healthChecks.shift() ?? true }),
    terminateProcessTree: async (process) => {
      assert.equal(process.pid, 4242)
      await termination
      process.kill('SIGTERM')
    },
    pollIntervalMs: 5,
  })

  await manager.start()
  const stopPromise = manager.stop()
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(manager.getStatus().state, 'running')
  resolveTermination()
  await stopPromise

  assert.equal(child.killed, true)
  assert.equal(manager.getStatus().state, 'stopped')
})

test('desktop backend defaults to single-process uvicorn without reload', () => {
  const options = createBackendProcessOptions({
    appPath: '/repo/apps/desktop',
    isPackaged: false,
    resourcesPath: '/repo/resources',
  })

  assert.deepEqual(options.args, [
    'run',
    'python',
    '-m',
    'uvicorn',
    'app.main:app',
    '--host',
    '127.0.0.1',
    '--port',
    '8000',
  ])
  assert.equal(options.args.includes('--reload'), false)
})
