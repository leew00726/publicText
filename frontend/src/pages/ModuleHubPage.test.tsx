import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import * as ModuleHubPageModule from './ModuleHubPage'

const { ModuleHubPage } = ModuleHubPageModule

const pagesCssPath = path.resolve(__dirname, '../styles/pages.css')
const appShellCssPath = path.resolve(__dirname, '../styles/app-shell.css')

vi.mock('../utils/employeeAuth', () => ({
  loadEmployeeSession: vi.fn(() => ({
    username: 'treter',
    displayName: '张三',
    role: 'admin',
    loginAt: '2026-03-12T00:00:00.000Z',
    companyName: '云成数科',
  })),
  listModulesByRole: vi.fn(() => [
    {
      key: 'summary',
      title: '公文总结',
      description: '聚焦内容提炼、要点归纳与主题提取，快速形成可复用摘要。',
      entryPath: '/summary',
      enabled: true,
    },
    {
      key: 'layout',
      title: '公文排版',
      description: '统一正文结构、格式规范和输出标准，提升发文一致性。',
      entryPath: '/layout',
      enabled: true,
    },
    {
      key: 'management',
      title: '公文管理',
      description: '管理公司、题材和模板版本，支持后续权限精细化治理。',
      entryPath: '/management',
      enabled: true,
    },
    {
      key: 'knowledge',
      title: '知识库',
      description: '沉淀本地公文材料，供智能写作调阅参考。',
      entryPath: '/knowledge',
      enabled: true,
    },
  ]),
}))

describe('ModuleHubPage', () => {
  it('renders a redesigned workspace dashboard without the hologram banner', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/workspace']}>
        <ModuleHubPage />
      </MemoryRouter>,
    )

    expect(html).toContain('workspace-hero')
    expect(html).toContain('今日工作台')
    expect(html).toContain('当前可用模块')
    expect(html).toContain('欢迎回来，张三')
    expect(html).toContain('公司归属')
    expect(html).toContain('workspace-primary-module')
    expect(html).toContain('workspace-module-stack')
    expect(html).toContain('workspace-secondary-modules')
    expect(html).toContain('公文总结')
    expect(html).toContain('公文排版')
    expect(html).toContain('公文管理')
    expect(html).toContain('知识库')
    expect(html).toContain('进入公文总结')
    expect(html).toContain('进入公文排版')
    expect(html).toContain('进入公文管理')
    expect(html).toContain('进入知识库')
    expect(html).toContain('按题材进入正文编排流程')
    expect(html).toContain('从题材库、模板版本到正文编辑与导出')
    expect(html).not.toContain('workspace-module-tier')
    expect(html).not.toContain('协同模块')
    expect(html).not.toContain('module-card-eyebrow')
    expect(html).not.toContain('workspace-module-count')
    expect(html).not.toContain('当前可用 4 个模块')
    expect(html).not.toContain('最近文档')
    expect(html).not.toContain('workspace-recent')
    expect(html).not.toContain('会议纪要')
    expect(html.indexOf('公文排版')).toBeLessThan(html.indexOf('公文总结'))
    expect(html).not.toContain('模块总数')
    expect(html).not.toContain('统一进入公文总结、公文排版和公文管理模块。')
    expect(html).not.toContain('这里不再放装饰横幅')
    expect(html).not.toContain('workspace-quick-grid')
    expect(html).not.toContain('SUMMARY')
    expect(html).not.toContain('LAYOUT')
    expect(html).not.toContain('MANAGEMENT')
    expect(html).not.toContain('主流程')
    expect(html).not.toContain('<span>01</span>')
    expect(html).not.toContain('<span>02</span>')
    expect(html).not.toContain('<span>03</span>')

    expect(html).not.toContain('中国华能')
    expect(html).not.toContain('module-h-hero')
    expect(html).not.toContain('data-particle-shape=')
  })

  it('does not load recent documents from the document API', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'ModuleHubPage.tsx'), 'utf8')

    expect(source).not.toContain("'/api/layout/docs'")
    expect(source).not.toContain('buildRecentDocRows')
    expect(source).not.toContain('workspace-recent')
  })

  it('puts layout in the largest workspace module area on desktop', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(
      /\.workspace-primary-module\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(320px,\s*0\.84fr\) auto;/,
    )
    expect(styles).toMatch(/\.workspace-secondary-modules\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/)
    expect(styles).toMatch(/border-bottom:\s*1px solid rgba\(40,\s*74,\s*118,\s*0\.14\);/)
    expect(styles).not.toMatch(/\.workspace-secondary-module \+ \.workspace-secondary-module\s*\{[\s\S]*border-left:/)
  })

  it('top-aligns the desktop workspace panel instead of centering it in dead space', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(
      /\.workspace-dashboard\s*\{[\s\S]*min-height:\s*100%;[\s\S]*height:\s*auto;[\s\S]*overflow:\s*visible;/,
    )
    expect(styles).toMatch(
      /\.workspace-panel\s*\{[^}]*height:\s*auto;[^}]*grid-template-rows:\s*auto auto;[^}]*overflow:\s*hidden;/,
    )
    expect(styles).toMatch(
      /@media \(min-width:\s*1181px\)\s*\{[\s\S]*\.workspace-dashboard\s*\{[\s\S]*align-self:\s*start;[\s\S]*\.workspace-panel\s*\{[\s\S]*align-self:\s*start;[\s\S]*grid-template-rows:\s*auto auto;/,
    )
    expect(styles).toMatch(/\.workspace-module-stack\s*\{[\s\S]*align-content:\s*start;/)
    expect(styles).not.toContain('align-self: safe center')
    expect(styles).not.toContain('min-height: clamp(')
  })

  it('keeps the workspace overview banner visually compact with a premium blue-white surface', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(
      /\.workspace-hero\s*\{[\s\S]*gap:\s*28px;[\s\S]*padding:\s*22px 28px;[\s\S]*border-radius:\s*8px;/,
    )
    expect(styles).toMatch(
      /\.workspace-hero-copy\s*\{[\s\S]*gap:\s*6px;/,
    )
    expect(styles).toMatch(
      /\.workspace-hero h2\s*\{[\s\S]*font-size:\s*20px;/,
    )
    expect(styles).toMatch(
      /\.workspace-overview-stat\s*\{[\s\S]*padding:\s*0 18px;[\s\S]*min-height:\s*40px;/,
    )
    expect(styles).toMatch(
      /\.workspace-panel::before\s*\{[\s\S]*background:\s*linear-gradient\(90deg,\s*#153a73,\s*#2457d6 52%,\s*#6d8edc\);/,
    )
  })

  it('optimizes home page controls for scanning and touch', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(
      /\.workspace-link-button\s*\{[\s\S]*min-height:\s*44px;/,
    )
    expect(styles).toMatch(
      /\.workspace-link-button:focus-visible\s*\{[\s\S]*outline:\s*2px solid #2457d6;/,
    )
  })

  it('shows complete supporting copy in the secondary workspace modules', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(
      /\.workspace-secondary-module\s*\{[\s\S]*height:\s*auto;/,
    )
    expect(styles).not.toContain('.workspace-secondary-module .module-card-copy p {\n  -webkit-line-clamp')
    expect(styles).not.toContain('.workspace-secondary-module .workspace-secondary-flow {\n  min-width: 0;\n  overflow: hidden;')
  })

  it('keeps a descending type scale from the shell title down to the module cards', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')
    const shellStyles = fs.readFileSync(appShellCssPath, 'utf8')

    expect(shellStyles).toMatch(
      /\.app-shell-workspace \.shell-topbar-copy h1\s*\{[\s\S]*font-size:\s*26px;/,
    )
    expect(styles).toMatch(/\.workspace-primary-module h2\s*\{\s*font-size:\s*24px;/)
    expect(styles).toMatch(/\.workspace-secondary-module h2\s*\{\s*font-size:\s*20px;/)
  })

  it('does not let the removed hero subtitle rule outrank the hero kicker', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    // `.workspace-hero p` is (0,1,1) and silently overrode `.workspace-hero-kicker`
    expect(styles).not.toMatch(/\.workspace-hero p\s*\{/)
    expect(styles).toMatch(/\.workspace-hero-kicker\s*\{[\s\S]*font-size:\s*11px;/)
  })

  it('meets AA contrast on the small grey workspace labels', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(/\.workspace-overview-stat span\s*\{\s*color:\s*#5a6a80;/)
    expect(styles).toMatch(/\.workspace-secondary-flow\s*\{[\s\S]*color:\s*#5a6a80;/)
    expect(styles).not.toContain('#6c7a90')
  })

  it('keeps each module accent colour on the stacked mobile cards', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    // this group flipped border-left to a generic border-top and wiped is-knowledge / is-management
    expect(styles).not.toMatch(
      /\.workspace-secondary-module \+ \.workspace-secondary-module\s*\{\s*border-left:\s*0;/,
    )
    expect(styles).toMatch(/\.workspace-secondary-module\.is-knowledge\s*\{\s*border-top-color:\s*#4f75cf;/)
    expect(styles).toMatch(/\.workspace-secondary-module\.is-management\s*\{\s*border-top-color:\s*#153a73;/)
  })

  it('sizes the module cards to their content instead of a fixed floor', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(/\.workspace-secondary-module\s*\{[^}]*grid-template-rows:\s*auto auto auto;/)
    expect(styles).not.toMatch(/\.workspace-secondary-module\s*\{[^}]*min-height:\s*204px;/)
    expect(styles).not.toMatch(/\.workspace-primary-module\.workspace-module-card\s*\{[^}]*min-height:/)
    // the button follows the copy instead of being pinned to a stretched bottom row
    expect(styles).toMatch(/\.workspace-secondary-module \.module-card-footer\s*\{[^}]*justify-items:\s*start;/)
    expect(styles).not.toMatch(/\.workspace-secondary-module \.module-card-footer\s*\{[^}]*align-self:\s*end;/)
  })
})
