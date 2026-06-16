import fs from 'node:fs'
import path from 'node:path'

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DocumentSummaryPage } from './DocumentSummaryPage'

const pagesCssPath = path.resolve(__dirname, '../styles/pages.css')

describe('DocumentSummaryPage', () => {
  it('renders a single input-source panel instead of a permanent pasted-text block', () => {
    const html = renderToStaticMarkup(<DocumentSummaryPage />)
    const source = fs.readFileSync(path.resolve(__dirname, './DocumentSummaryPage.tsx'), 'utf8')

    expect(html).not.toContain('输入源')
    expect(html).toContain('拖拽或点击选择文件')
    expect(html).toContain('支持 DOCX / PDF / TXT，单文件 ≤ 20MB')
    expect(html).not.toContain('summary-source-textarea')
    expect(source).not.toContain('summary-text-source')
    expect(html).not.toContain('单文件处理，建议内容不超过 12,000 字符。')
    expect(html).not.toContain('summary-file-pill')
  })

  it('connects to the standalone knowledge base through a drafting interface', () => {
    const html = renderToStaticMarkup(<DocumentSummaryPage />)
    const source = fs.readFileSync(path.resolve(__dirname, './DocumentSummaryPage.tsx'), 'utf8')

    expect(html).toContain('知识库调用')
    expect(html).toContain('调用知识库写作')
    expect(html).toContain('进入知识库')
    expect(html).toContain('summary-knowledge-bridge')
    expect(html).not.toContain('上传到知识库')
    expect(html).not.toContain('暂无入库材料')
    expect(source).not.toContain("api.get<KnowledgeDocument[]>('/api/layout/ai/knowledge-docs')")
    expect(source).not.toContain("api.post<KnowledgeDocument>('/api/layout/ai/knowledge-docs'")
    expect(source).toContain("api.post<SummaryApiResponse>('/api/layout/ai/draft-with-knowledge'")
    expect(source).toContain("navigate('/knowledge')")
  })

  it('renders a simplified agent requirement area without helper copy or empty thread panel', () => {
    const html = renderToStaticMarkup(<DocumentSummaryPage />)

    expect(html).toContain('补充要求')
    expect(html).not.toContain('summary-agent-thread')
    expect(html).not.toContain('告诉智能体你希望的总结格式')
    expect(html).toContain('placeholder="例如：突出结论、关键事项、时间节点。"')
    expect(html).not.toContain('要求输入')
  })

  it('keeps the export template selector visible even before templates load', () => {
    const html = renderToStaticMarkup(<DocumentSummaryPage />)

    expect(html).toContain('导出模板')
    expect(html).toContain('summary-template-select')
    expect(html).toContain('通用模板 · v1（当前生效）')
    expect(html).not.toContain('无可用模板，按默认格式导出')
  })

  it('renders a distinct two-panel studio chrome for the summary workspace', () => {
    const html = renderToStaticMarkup(<DocumentSummaryPage />)

    expect(html).toContain('summary-sidebar')
    expect(html).toContain('summary-main')
    expect(html).toContain('summary-output-surface')
    expect(html).toContain('summary-export-row')
    expect(html).toContain('summary-panel-header')
    expect(html).toContain('summary-panel-index')
    expect(html).toContain('输入控制台')
    expect(html).toContain('输出工作区')
    expect(html).not.toContain('>输入<')
    expect(html).not.toContain('>输出<')
    expect(html).not.toContain('>Input<')
    expect(html).not.toContain('>Output<')
    expect(html).not.toContain('选择输入源、补充要求，然后生成当前总结。')
    expect(html).not.toContain('校对生成结果，选择模板，然后导出 DOCX。')
  })

  it('shows the generated summary editor only after a result exists', () => {
    const html = renderToStaticMarkup(<DocumentSummaryPage />)

    expect(html).not.toContain('aria-label="总结内容"')
    expect(html).not.toContain('<label for="summary-textarea">总结内容</label>')
    expect(html).not.toContain('placeholder="生成结果显示在这里"')
  })

  it('uses the reference empty state copy inside the output surface', () => {
    const html = renderToStaticMarkup(<DocumentSummaryPage />)

    expect(html).toContain('summary-empty-mark')
    expect(html).toContain('暂无结果，完成左侧设置后点击「开始总结」')
    expect(html).not.toContain('生成后显示在这里。')
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

  it('uses the compact premium blue-white document workspace theme', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(/\.summary-page\s*\{[\s\S]*--summary-accent:\s*#2457d6;/)
    expect(styles).toMatch(/\.summary-page\s*\{[\s\S]*--summary-cyan:\s*#2457d6;/)
    expect(styles).toMatch(/\.summary-page\s*\{[\s\S]*--summary-panel-radius:\s*8px;/)
    expect(styles).toMatch(/\.summary-page\s*\{[\s\S]*--summary-tint:\s*#f4f7ff;/)
    expect(styles).toMatch(
      /\.summary-page\s+\.summary-control-card,\s*\.summary-page\s+\.summary-result-card\s*\{[\s\S]*border-radius:\s*0;/,
    )
    expect(styles).toMatch(
      /\.summary-page\s+button,\s*\.summary-page\s+select,\s*\.summary-page\s+textarea,\s*\.summary-page\s+input\s*\{[\s\S]*border-radius:\s*6px;/,
    )
    expect(styles).toMatch(
      /\.summary-page\s+button:hover\s*\{[\s\S]*transform:\s*translateY\(-1px\);[\s\S]*box-shadow:\s*0 10px 22px/,
    )
    expect(styles).toMatch(
      /\.summary-panel-index\s*\{[\s\S]*width:\s*38px;[\s\S]*background:\s*#f4f7ff;[\s\S]*color:\s*#153a73;/,
    )
    expect(styles).toMatch(
      /\.summary-panel-header\s*\{[\s\S]*grid-template-columns:\s*38px minmax\(0,\s*1fr\);/,
    )
    expect(styles).toMatch(
      /\.summary-page\s+\.summary-primary-action\s*\{[\s\S]*background:\s*var\(--summary-accent\);[\s\S]*color:\s*#fff;/,
    )
    expect(styles).toMatch(
      /\.summary-page\s+\.summary-studio\s*\{[\s\S]*grid-template-columns:\s*minmax\(320px,\s*356px\) minmax\(0,\s*1fr\);[\s\S]*gap:\s*0;/,
    )
  })

  it('keeps the summary page at native 100 percent scale', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(/\.summary-page\s*\{[\s\S]*--summary-ui-scale:\s*1(?:\.0)?;/)
    expect(styles).not.toMatch(/\.summary-page\s*\{[\s\S]*zoom:\s*var\(--summary-ui-scale\);/)
    expect(styles).not.toMatch(/\.summary-page\s*\{[\s\S]*width:\s*calc\(100%\s*\/\s*var\(--summary-ui-scale\)\);/)
    expect(styles).toMatch(/\.summary-panel-body\s*\{[\s\S]*padding:\s*calc\(18px\s*\*\s*var\(--summary-ui-scale\)\);/)
    expect(styles).toMatch(
      /\.summary-page\s+button,\s*\.summary-page\s+select,\s*\.summary-page\s+textarea,\s*\.summary-page\s+input\s*\{[\s\S]*font-size:\s*calc\(14px\s*\*\s*var\(--summary-ui-scale\)\);/,
    )
  })

  it('stacks the two summary panels on narrower screens', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(
      /@media\s*\(max-width:\s*1180px\)\s*\{[\s\S]*\.summary-page\s+\.summary-studio\s*\{[\s\S]*grid-template-columns:\s*1fr;[\s\S]*overflow:\s*visible;/,
    )
  })
})
