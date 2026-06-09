import { describe, expect, it } from 'vitest'

import { appRoutes } from './routes'

describe('appRoutes', () => {
  it('defines the MVP page routes through phase five', () => {
    expect(appRoutes.map((route) => route.path)).toEqual([
      '/cases',
      '/framework-config',
      '/tasks',
      '/history',
      '/reports',
      '/reports/:taskId',
      '/ssh',
      '/scp',
      '/commands',
    ])
  })

  it('places framework config in the scripts navigation group', () => {
    expect(
      appRoutes.find((route) => route.path === '/framework-config'),
    ).toMatchObject({
      label: '框架配置',
      navGroup: 'scripts',
    })
  })
})
