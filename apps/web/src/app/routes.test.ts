import { describe, expect, it } from 'vitest'

import { appRoutes } from './routes'

describe('appRoutes', () => {
  it('defines the MVP page routes through phase five', () => {
    expect(appRoutes.map((route) => route.path)).toEqual([
      '/scripts',
      '/scripts/new',
      '/scripts/:scriptId',
      '/tasks',
      '/history',
      '/reports',
      '/ssh',
      '/scp',
      '/commands',
    ])
  })
})
