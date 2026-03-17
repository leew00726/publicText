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

  it('renders pasted-text and agent-guidance controls for summary customization', () => {
    const html = renderToStaticMarkup(<DocumentSummaryPage />)

    expect(html).toContain('上传文件或粘贴文本')
    expect(html).toContain('summary-source-textarea')
    expect(html).toContain('智能体要求')
    expect(html).toContain('summary-agent-thread')
    expect(html).toContain('告诉智能体你希望的总结格式')
  })

  it('guards the summary grid against long filename overflow', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(/\.summary-control-card,\s*\.summary-result-card\s*\{[\s\S]*?min-width:\s*0;/)
    expect(styles).toMatch(
      /\.summary-drop-zone p,\s*\.summary-file-pill,\s*\.summary-meta span\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?overflow-wrap:\s*anywhere;/,
    )
  })
})
