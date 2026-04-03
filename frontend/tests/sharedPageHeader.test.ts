import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pages = [
  'TopicListPage.tsx',
  'TopicComposePage.tsx',
  'TopicLibraryPage.tsx',
  'TopicDetailPage.tsx',
  'CompanySelectPage.tsx',
  'DocEditorPage.tsx',
]

describe('shared page header adoption', () => {
  it('no longer uses the shared page header across workflow pages', () => {
    for (const fileName of pages) {
      const source = readFileSync(resolve(__dirname, `../src/pages/${fileName}`), 'utf-8')
      expect(source).not.toContain('PageHeader')
    }
  })
})
