import fs from 'node:fs'
import path from 'node:path'

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DocumentSummaryPage } from './DocumentSummaryPage'

const pagesCssPath = path.resolve(__dirname, '../styles/pages.css')

describe('DocumentSummaryPage', () => {
  it('renders a dedicated class for the selected-file pill', () => {
    const html = renderToStaticMarkup(<DocumentSummaryPage />)

    expect(html).toContain('summary-file-pill')
  })

  it('renders a single input-source panel instead of a permanent pasted-text block', () => {
    const html = renderToStaticMarkup(<DocumentSummaryPage />)
    const source = fs.readFileSync(path.resolve(__dirname, './DocumentSummaryPage.tsx'), 'utf8')

    expect(html).toContain('上传文件或粘贴文本')
    expect(html).not.toContain('summary-source-textarea')
    expect(source).not.toContain('summary-text-source')
  })

  it('renders a simplified agent requirement area without helper copy or empty thread panel', () => {
    const html = renderToStaticMarkup(<DocumentSummaryPage />)

    expect(html).toContain('智能体要求')
    expect(html).not.toContain('summary-agent-thread')
    expect(html).not.toContain('告诉智能体你希望的总结格式')
    expect(html).toContain('要求输入')
  })

  it('renders an export template selector before docx export', () => {
    const html = renderToStaticMarkup(<DocumentSummaryPage />)

    expect(html).toContain('导出模板')
    expect(html).toContain('summary-template-select')
  })

  it('renders a distinct two-panel studio chrome for the summary workspace', () => {
    const html = renderToStaticMarkup(<DocumentSummaryPage />)

    expect(html).toContain('summary-sidebar')
    expect(html).toContain('summary-main')
    expect(html).toContain('summary-panel-header')
    expect(html).toContain('summary-panel-index')
    expect(html).toContain('输入控制台')
    expect(html).toContain('输出工作区')
  })

  it('guards the summary grid against long filename overflow', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(/\.summary-control-card,\s*\.summary-result-card\s*\{[\s\S]*?min-width:\s*0;/)
    expect(styles).toMatch(
      /\.summary-drop-zone p,\s*\.summary-file-pill,\s*\.summary-meta span\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?overflow-wrap:\s*anywhere;/,
    )
  })

  it('locks the summary page to the viewport and uses internal card scrolling', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(/\.summary-page\s*\{[\s\S]*height:\s*calc\(100dvh\s*-\s*[^;]+\);[\s\S]*overflow:\s*hidden;/)
    expect(styles).toMatch(/\.summary-studio\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;/)
    expect(styles).toMatch(/\.summary-panel-body\s*\{[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*auto;/)
  })

  it('uses a square monochrome summary theme with blue button hover motion', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(/\.summary-page\s*\{[\s\S]*--summary-accent:\s*#2563eb;/)
    expect(styles).toMatch(/\.summary-page\s*\{[\s\S]*--summary-panel-radius:\s*24px;/)
    expect(styles).toMatch(/\.summary-page\s*\{[\s\S]*--summary-tint:\s*#eff6ff;/)
    expect(styles).toMatch(
      /\.summary-page\s+\.summary-control-card,\s*\.summary-page\s+\.summary-result-card\s*\{[\s\S]*border-radius:\s*var\(--summary-panel-radius\);/,
    )
    expect(styles).toMatch(
      /\.summary-page\s+button,\s*\.summary-page\s+select,\s*\.summary-page\s+textarea,\s*\.summary-page\s+input\s*\{[\s\S]*border-radius:\s*18px;/,
    )
    expect(styles).toMatch(
      /\.summary-page\s+button:hover\s*\{[\s\S]*transform:\s*translateY\(-2px\);[\s\S]*box-shadow:\s*0 16px 32px rgba\(37,\s*99,\s*235,\s*0\.24\);/,
    )
    expect(styles).toMatch(
      /\.summary-panel-index\s*\{[\s\S]*background:\s*rgba\(37,\s*99,\s*235,\s*0\.12\);[\s\S]*color:\s*var\(--summary-accent\);/,
    )
    expect(styles).toMatch(
      /\.summary-panel-header\s*\{[\s\S]*grid-template-columns:\s*(?:72px|minmax\(72px,\s*88px\))\s+minmax\(0,\s*1fr\);/,
    )
    expect(styles).toMatch(
      /\.summary-page\s+\.summary-primary-action\s*\{[\s\S]*background:\s*linear-gradient\(135deg,\s*#2563eb,\s*#1d4ed8\);[\s\S]*color:\s*#fff;/,
    )
  })

  it('keeps the summary page at native 100 percent scale', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(/\.summary-page\s*\{[\s\S]*--summary-ui-scale:\s*1(?:\.0)?;/)
    expect(styles).not.toMatch(/\.summary-page\s*\{[\s\S]*zoom:\s*var\(--summary-ui-scale\);/)
    expect(styles).not.toMatch(/\.summary-page\s*\{[\s\S]*width:\s*calc\(100%\s*\/\s*var\(--summary-ui-scale\)\);/)
    expect(styles).toMatch(/\.summary-panel-body\s*\{[\s\S]*padding:\s*calc\(20px\s*\*\s*var\(--summary-ui-scale\)\);/)
    expect(styles).toMatch(
      /\.summary-page\s+button,\s*\.summary-page\s+select,\s*\.summary-page\s+textarea,\s*\.summary-page\s+input\s*\{[\s\S]*font-size:\s*calc\(14px\s*\*\s*var\(--summary-ui-scale\)\);/,
    )
  })
})
