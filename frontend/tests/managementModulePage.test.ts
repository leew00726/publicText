import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('management module page', () => {
  it('does not expose redhead governance entry', () => {
    const source = readFileSync(resolve(__dirname, '../src/pages/ManagementModulePage.tsx'), 'utf-8')
    expect(source).not.toContain('红头模板治理')
    expect(source).not.toContain('/management/redhead-templates')
  })
})

