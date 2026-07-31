import fs from 'node:fs'
import path from 'node:path'

import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { KnowledgeBasePage } from './KnowledgeBasePage'

const pagesCssPath = path.resolve(__dirname, '../styles/pages.css')

describe('KnowledgeBasePage', () => {
  it('renders a standalone knowledge base module for uploaded official-document materials', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/knowledge']}>
        <KnowledgeBasePage />
      </MemoryRouter>,
    )
    const source = fs.readFileSync(path.resolve(__dirname, './KnowledgeBasePage.tsx'), 'utf8')

    expect(html).toContain('knowledge-base-page')
    expect(html).toContain('云矩知识库')
    expect(html).toContain('上传公文材料')
    expect(html).toContain('支持 DOCX / PDF / TXT')
    expect(html).toContain('知识库文档')
    expect(html).toContain('上传左侧公文材料后，会在这里形成可调阅的写作参考。')
    expect(source).toContain("api.get<KnowledgeDocument[]>('/api/knowledge/docs')")
    expect(source).toContain("api.post<KnowledgeDocument>('/api/knowledge/docs'")
    expect(source).not.toContain('/api/layout/ai/knowledge-docs')
    expect(source).toContain("navigate('/layout/summary', {")
    expect(source).toContain('useKnowledgeBase: true')
    expect(source).toContain('documentCount: docs.length')
  })

  it('makes upload keyboard accessible and exposes persistent operation feedback', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/knowledge']}>
        <KnowledgeBasePage />
      </MemoryRouter>,
    )
    const source = fs.readFileSync(path.resolve(__dirname, './KnowledgeBasePage.tsx'), 'utf8')

    expect(html).toContain('role="button"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('aria-label="选择要加入云矩知识库的公文材料"')
    expect(source).toContain("event.key !== 'Enter' && event.key !== ' '")
    expect(source).toContain('已等待 ${elapsedSeconds} 秒')
    expect(source).toContain('Math.floor(elapsedSeconds / 10) * 10')
    expect(source).toContain('aria-live="polite"')
    expect(source).toContain('role="alert"')
  })

  it('uses the shared premium blue-white module workbench visual language', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(/\.knowledge-base-page\s*\{[\s\S]*grid-template-columns:\s*minmax\(320px,\s*380px\) minmax\(0,\s*1fr\);/)
    expect(styles).toMatch(/\.knowledge-upload-zone\s*\{[\s\S]*border:\s*1px dashed rgba\(36,\s*87,\s*214,\s*0\.28\);/)
    expect(styles).toMatch(/\.knowledge-doc-header\s*\{[\s\S]*background:\s*linear-gradient\(180deg,\s*#ffffff,\s*#f7faff\);/)
    expect(styles).toMatch(/\.knowledge-doc-list\s+li\s*\{[\s\S]*border-radius:\s*6px;[\s\S]*background:\s*#ffffff;/)
    expect(styles).toMatch(
      /\.knowledge-doc-list\s+\.knowledge-empty-row\s*\{[\s\S]*border-style:\s*dashed;[\s\S]*text-align:\s*center;/,
    )
  })
})
