import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AppShell } from './AppShell'

const appShellCssPath = path.resolve(__dirname, '../styles/app-shell.css')

vi.mock('../utils/employeeAuth', () => ({
  clearEmployeeSession: vi.fn(),
  loadEmployeeSession: vi.fn(() => ({
    username: 'tester',
    displayName: '张三',
    role: 'admin',
    loginAt: '2026-03-09T00:00:00.000Z',
    companyName: '云矩科技',
  })),
}))

describe('AppShell chrome', () => {
  it('does not render the sidebar navigation anymore', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/workspace']}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>,
    )

    expect(html).not.toContain('app-shell-sidebar')
    expect(html).not.toContain('aria-label="主导航"')
    expect(html).not.toContain('shell-sidebar-toggle')
    expect(html).toContain('shell-topbar-copy')
    expect(html).toContain('云矩公文管理平台')
    expect(html).toContain('张三')
  })

  it('allows page-level scrolling on the workspace route', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/workspace']}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>,
    )
    const styles = fs.readFileSync(appShellCssPath, 'utf8')

    expect(html).toContain('app-shell app-shell-workspace')
    expect(html).toContain('app-shell-main app-shell-main-workspace')
    expect(html).toContain('app-shell-scroll app-shell-scroll-workspace')
    expect(styles).toMatch(
      /\.app-shell-workspace\s*\{[\s\S]*min-height:\s*100dvh;[\s\S]*height:\s*auto;[\s\S]*overflow:\s*visible;/,
    )
    expect(styles).toMatch(
      /\.app-shell-main-workspace\s*\{[\s\S]*height:\s*auto;[\s\S]*min-height:\s*0;[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*1fr\);/,
    )
    expect(styles).toMatch(
      /\.app-shell-scroll-workspace\s*\{[\s\S]*overflow:\s*visible;[\s\S]*padding-bottom:\s*0;/,
    )
  })

  it('adds a summary-specific shell class on the summary route', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/layout/summary']}>
        <AppShell>
          <div>summary content</div>
        </AppShell>
      </MemoryRouter>,
    )

    expect(html).toContain('app-shell app-shell-summary')
    expect(html).toContain('app-shell-topbar shell-topbar-summary')
    expect(html).toContain('公文总结')
    expect(html).toContain('出于公文保密要求，请勿上传涉密文件')
    expect(html).not.toContain('>Summary<')
    expect(html).not.toContain('上传文档后调用 DeepSeek 生成结构化总结并导出。')
  })

  it('labels the company department route as department management', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/management/companies/company-1/departments']}>
        <AppShell>
          <div>department content</div>
        </AppShell>
      </MemoryRouter>,
    )

    expect(html).toContain('部门管理')
    expect(html).toContain('查看公司组织架构与人员归属')
  })

  it('styles the summary shell as a premium blue-white document workspace chrome', () => {
    const styles = fs.readFileSync(appShellCssPath, 'utf8')

    expect(styles).toMatch(
      /\.app-shell-summary\s*\{[\s\S]*background:\s*[\s\S]*linear-gradient/,
    )
    expect(styles).toMatch(
      /\.app-shell-summary\s+\.app-shell-topbar\s*\{[\s\S]*border-radius:\s*8px;[\s\S]*border:\s*1px solid rgba\(40,\s*74,\s*118,\s*0\.12\);[\s\S]*box-shadow:\s*0 12px 28px/,
    )
    expect(styles).toMatch(
      /\.app-shell-summary\s+\.shell-topbar-title-row\s*\{[\s\S]*border-left:\s*3px solid #2457d6;[\s\S]*padding-left:\s*14px;/,
    )
    expect(styles).toMatch(
      /\.app-shell-summary\s+\.shell-logout-btn\s*\{[\s\S]*background:\s*#ffffff;[\s\S]*color:\s*#153a73;/,
    )
  })

  it('keeps the summary title on a single line even when the notice is visible', () => {
    const styles = fs.readFileSync(appShellCssPath, 'utf8')

    expect(styles).toMatch(
      /\.shell-topbar-title-row\s+>\s+h1\s*\{[\s\S]*flex:\s*0\s+0\s+auto;[\s\S]*white-space:\s*nowrap;/,
    )
  })
})
