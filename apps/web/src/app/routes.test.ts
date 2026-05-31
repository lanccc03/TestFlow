import { describe, expect, it } from 'vitest'

import { appRoutes } from './routes'

describe('appRoutes', () => {
  it('defines the MVP page routes from phase three', () => {
    expect(appRoutes.map((route) => route.path)).toEqual([
      '/scripts',
      '/scripts/new',
      '/tasks',
      '/history',
      '/reports',
      '/ssh',
      '/scp',
      '/commands',
    ])
  })
})
