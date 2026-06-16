import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AppShell } from '../src/components/AppShell'
import { CompanySelectPage } from '../src/pages/CompanySelectPage'
import { TopicComposePage } from '../src/pages/TopicComposePage'
import { TopicDetailPage } from '../src/pages/TopicDetailPage'
import { TopicLibraryPage } from '../src/pages/TopicLibraryPage'
import { TopicListPage } from '../src/pages/TopicListPage'

const appShellCssPath = path.resolve(__dirname, '../src/styles/app-shell.css')
const pagesCssPath = path.resolve(__dirname, '../src/styles/pages.css')
const editorCssPath = path.resolve(__dirname, '../src/styles/editor.css')

vi.mock('../src/utils/employeeAuth', () => ({
  clearEmployeeSession: vi.fn(),
  loadEmployeeSession: vi.fn(() => ({
    username: 'tester',
    displayName: '李梓源',
    role: 'admin',
    loginAt: '2026-06-10T00:00:00.000Z',
    companyName: '云成数科',
  })),
}))

describe('module workbench style', () => {
  it('marks layout and management workflow pages with the shared workbench class', () => {
    const pages = [
      renderToStaticMarkup(
        <MemoryRouter initialEntries={['/management/companies']}>
          <CompanySelectPage mode="management" />
        </MemoryRouter>,
      ),
      renderToStaticMarkup(
        <MemoryRouter initialEntries={['/layout/companies/company-1/topics']}>
          <Routes>
            <Route path="/layout/companies/:companyId/topics" element={<TopicListPage mode="layout" />} />
          </Routes>
        </MemoryRouter>,
      ),
      renderToStaticMarkup(
        <MemoryRouter initialEntries={['/management/companies/company-1/topics']}>
          <Routes>
            <Route path="/management/companies/:companyId/topics" element={<TopicListPage mode="management" />} />
          </Routes>
        </MemoryRouter>,
      ),
      renderToStaticMarkup(
        <MemoryRouter initialEntries={['/layout/topics/topic-1']}>
          <Routes>
            <Route path="/layout/topics/:topicId" element={<TopicComposePage />} />
          </Routes>
        </MemoryRouter>,
      ),
      renderToStaticMarkup(
        <MemoryRouter initialEntries={['/layout/topics/topic-1/library']}>
          <Routes>
            <Route path="/layout/topics/:topicId/library" element={<TopicLibraryPage />} />
          </Routes>
        </MemoryRouter>,
      ),
      renderToStaticMarkup(
        <MemoryRouter initialEntries={['/management/topics/topic-1/train']}>
          <Routes>
            <Route path="/management/topics/:topicId/train" element={<TopicDetailPage />} />
          </Routes>
        </MemoryRouter>,
      ),
    ]

    for (const html of pages) {
      expect(html).toContain('workspace-page module-workbench-page')
      expect(html).not.toContain('page-header')
    }
  })

  it('uses the flat document shell on layout and management routes without English kickers', () => {
    const routes = ['/layout/companies/company-1/topics', '/layout/topics/topic-1/library', '/management/companies']

    for (const route of routes) {
      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={[route]}>
          <AppShell>
            <div>content</div>
          </AppShell>
        </MemoryRouter>,
      )

      expect(html).toContain('app-shell app-shell-document')
      expect(html).toContain('app-shell-topbar shell-topbar-document')
      expect(html).not.toContain('>Layout<')
      expect(html).not.toContain('>Management<')
      expect(html).not.toContain('>Topics<')
      expect(html).not.toContain('>Companies<')
    }
  })

  it('defines a premium blue-white 8px workbench surface for module cards, tables, and buttons', () => {
    const styles = fs.readFileSync(pagesCssPath, 'utf8')

    expect(styles).toMatch(/\.module-workbench-page\s*\{[\s\S]*--module-accent:\s*#2457d6;/)
    expect(styles).toMatch(/\.module-workbench-page\s*\{[\s\S]*--module-cyan:\s*#2457d6;/)
    expect(styles).toMatch(
      /\.module-workbench-page\s+\.workspace-table-card\s*\{[\s\S]*border-radius:\s*8px;[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.94\);[\s\S]*box-shadow:\s*0 18px 42px/,
    )
    expect(styles).toMatch(
      /\.module-workbench-page\s+\.panel\s*\{[\s\S]*border-radius:\s*8px;[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.94\);[\s\S]*box-shadow:\s*0 18px 42px/,
    )
    expect(styles).toMatch(
      /\.module-workbench-page\s+button\s*\{[\s\S]*border-radius:\s*6px;[\s\S]*background:\s*var\(--module-accent\);[\s\S]*box-shadow:\s*0 10px 24px/,
    )
  })

  it('shares the premium blue-white page shell language across document modules', () => {
    const styles = fs.readFileSync(appShellCssPath, 'utf8')

    expect(styles).toMatch(/\.app-shell-document\s*\{[\s\S]*background:\s*[\s\S]*linear-gradient/)
    expect(styles).toMatch(
      /\.app-shell-document\s+\.app-shell-topbar\s*\{[\s\S]*border-radius:\s*8px;[\s\S]*border:\s*1px solid rgba\(40,\s*74,\s*118,\s*0\.12\);[\s\S]*box-shadow:\s*0 12px 28px/,
    )
    expect(styles).toMatch(
      /\.app-shell-document\s+\.shell-topbar-title-row\s*\{[\s\S]*border-left:\s*3px solid #2457d6;[\s\S]*padding-left:\s*14px;/,
    )
  })

  it('keeps the document editor inside the same flat workbench system', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/pages/DocEditorPage.tsx'), 'utf8')
    const styles = fs.readFileSync(editorCssPath, 'utf8')

    expect(source).toContain('doc-editor-page module-workbench-page')
    expect(styles).toMatch(
      /\.doc-editor-page\.module-workbench-page\s+\.editor-command-bar\s*\{[\s\S]*border-radius:\s*8px;[\s\S]*box-shadow:\s*0 14px 34px/,
    )
    expect(styles).toMatch(
      /\.doc-editor-page\.module-workbench-page\s+\.editor-shell\s*\{[\s\S]*border-radius:\s*8px;[\s\S]*box-shadow:\s*0 20px 48px/,
    )
  })
})
