import { describe, expect, it } from 'vitest'

import { parseTags } from './utils'

describe('parseTags', () => {
  it('splits comma-separated tags, trims whitespace, removes blanks, and deduplicates', () => {
    expect(parseTags(' smoke, regression, smoke, , nightly ')).toEqual([
      'smoke',
      'regression',
      'nightly',
    ])
  })

  it('returns an empty array for blank input', () => {
    expect(parseTags(' ,  , ')).toEqual([])
  })
})
