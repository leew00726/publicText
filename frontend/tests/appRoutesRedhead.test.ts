import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('app routes', () => {
  it('removes redhead management routes', () => {
    const source = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf-8')
    expect(source).not.toContain('/management/redhead-templates')
    expect(source).not.toContain('/redheadTemplates')
    expect(source).not.toContain('/redheads')
    expect(source).not.toContain('RedheadTemplateListPage')
    expect(source).not.toContain('RedheadTemplateEditorPage')
    expect(source).not.toContain('management.redheadTemplates')
  })
})
