import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('layout module page', () => {
  it('does not show duplicated summary entry', () => {
    const source = readFileSync(resolve(__dirname, '../src/pages/LayoutModulePage.tsx'), 'utf-8')

    expect(source).not.toContain('进入公文总结')
    expect(source).toContain('进入排版流程')
    expect(source).toContain("navigate('/layout/company-home')")
  })
})
