import { describe, expect, it } from 'vitest'

import { api } from './client'

describe('api client defaults', () => {
  it('allows long-running AI requests before timing out', () => {
    expect(api.defaults.timeout).toBe(120000)
  })
})
