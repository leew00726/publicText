import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { api } from './client'

describe('api client defaults', () => {
  it('allows long-running AI requests before timing out', () => {
    expect(api.defaults.timeout).toBe(120000)
  })

  it('uses separate runtime defaults for api and asset hosts', () => {
    const source = readFileSync(resolve(__dirname, './client.ts'), 'utf-8')

    expect(source).toContain("import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://localhost:8000' : '/api')")
    expect(source).toContain("import.meta.env.VITE_ASSET_BASE || (import.meta.env.DEV ? 'http://localhost:8000' : '')")
  })
})
