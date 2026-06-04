import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('company scoped content routes', () => {
  it('checks loaded topic company before showing compose and library pages', () => {
    const composeSource = readFileSync(resolve(__dirname, '../src/pages/TopicComposePage.tsx'), 'utf-8')
    const librarySource = readFileSync(resolve(__dirname, '../src/pages/TopicLibraryPage.tsx'), 'utf-8')

    expect(composeSource).toContain('canAccessCompany(session, topicRes.data.companyId)')
    expect(composeSource).toContain("navigate('/layout/company-home', { replace: true })")
    expect(librarySource).toContain('canAccessCompany(session, topicRes.data.companyId)')
    expect(librarySource).toContain("navigate('/layout/company-home', { replace: true })")
  })

  it('checks loaded document company before showing the editor', () => {
    const source = readFileSync(resolve(__dirname, '../src/pages/DocEditorPage.tsx'), 'utf-8')

    expect(source).toContain('loadEmployeeSession()')
    expect(source).toContain('canAccessCompany(session, nextDoc.unitId)')
    expect(source).toContain("navigate('/layout/company-home', { replace: true })")
  })
})
