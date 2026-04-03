import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('global back button route rules', () => {
  it('sends layout summary page back to workspace', () => {
    const source = readFileSync(resolve(__dirname, '../src/components/GlobalBackButton.tsx'), 'utf-8')
    expect(source).toMatch(/if \(layoutSummaryMatch\)\s*{\s*return '\/workspace'/)
    expect(source).not.toMatch(/if \(layoutSummaryMatch\)\s*{\s*return '\/layout'/)
  })

  it('sends management company home back to workspace after removing the intermediate module page', () => {
    const source = readFileSync(resolve(__dirname, '../src/components/GlobalBackButton.tsx'), 'utf-8')
    expect(source).toMatch(/if \(managementCompanyHomeMatch\)\s*{\s*return '\/workspace'/)
    expect(source).not.toMatch(/if \(managementCompanyHomeMatch\)\s*{\s*return '\/management'/)
  })
})
