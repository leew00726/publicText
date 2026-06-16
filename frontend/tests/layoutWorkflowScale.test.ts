import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const pagesCssPath = path.resolve(__dirname, '../src/styles/pages.css')

describe('layout workflow scale', () => {
  it('marks the layout workflow pages with a shared full-width workbench class', () => {
    const topicListPageSource = fs.readFileSync(resolvePage('TopicListPage.tsx'), 'utf8')
    const topicComposePageSource = fs.readFileSync(resolvePage('TopicComposePage.tsx'), 'utf8')
    const topicLibraryPageSource = fs.readFileSync(resolvePage('TopicLibraryPage.tsx'), 'utf8')

    expect(topicListPageSource).toContain('layout-page-scale')
    expect(topicComposePageSource).toContain('layout-page-scale')
    expect(topicLibraryPageSource).toContain('layout-page-scale')
    expect(topicListPageSource).toContain('module-workbench-page')
    expect(topicComposePageSource).toContain('module-workbench-page')
    expect(topicLibraryPageSource).toContain('module-workbench-page')
  })

  it('keeps the layout workflow pages full width in the document workbench shell', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(/\.layout-page-scale\s*\{[\s\S]*--layout-ui-scale:\s*1;/)
    expect(styles).toMatch(/\.layout-page-scale\s*\{[\s\S]*width:\s*100%;/)
    expect(styles).not.toMatch(/\.layout-page-scale\s*\{[\s\S]*zoom:\s*var\(--layout-ui-scale\);/)
    expect(styles).not.toMatch(/\.layout-page-scale\s*\{[\s\S]*width:\s*calc\(100%\s*\/\s*var\(--layout-ui-scale\)\);/)
  })
})

function resolvePage(fileName: string) {
  return path.resolve(__dirname, `../src/pages/${fileName}`)
}
