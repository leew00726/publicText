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

  it('uses a viewport-locked shell on the workspace route', () => {
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
      /\.app-shell-workspace\s*\{[\s\S]*height:\s*100dvh;[\s\S]*overflow:\s*hidden;/,
    )
    expect(styles).toMatch(
      /\.app-shell-scroll-workspace\s*\{[\s\S]*overflow:\s*hidden;[\s\S]*padding-bottom:\s*0;/,
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

  it('styles the summary shell as a blue and white minimal chrome', () => {
    const styles = fs.readFileSync(appShellCssPath, 'utf8')

    expect(styles).toMatch(
      /\.app-shell-summary\s+\.app-shell-topbar\s*\{[\s\S]*border-radius:\s*24px;[\s\S]*background:\s*linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255,\s*0\.96\),\s*#ffffff\);/,
    )
    expect(styles).toMatch(
      /\.app-shell-summary\s+\.shell-logout-btn\s*\{[\s\S]*background:\s*linear-gradient\(135deg,\s*#2563eb,\s*#1d4ed8\);[\s\S]*color:\s*#ffffff;/,
    )
    expect(styles).toMatch(
      /\.app-shell-summary\s+\.global-back-btn\.shell:hover\s*\{[\s\S]*transform:\s*translateY\(-2px\);[\s\S]*box-shadow:\s*0 14px 28px rgba\(37,\s*99,\s*235,\s*0\.18\);/,
    )
  })

  it('keeps the summary title on a single line even when the notice is visible', () => {
    const styles = fs.readFileSync(appShellCssPath, 'utf8')

    expect(styles).toMatch(
      /\.shell-topbar-title-row\s+>\s+h1\s*\{[\s\S]*flex:\s*0\s+0\s+auto;[\s\S]*white-space:\s*nowrap;/,
    )
  })
})
