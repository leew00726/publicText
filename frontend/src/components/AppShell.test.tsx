import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AppShell } from './AppShell'

vi.mock('../utils/employeeAuth', () => ({
  clearEmployeeSession: vi.fn(),
  loadEmployeeSession: vi.fn(() => ({
    username: 'tester',
    role: 'admin',
    loginAt: '2026-03-09T00:00:00.000Z',
    companyName: '云矩科技',
  })),
}))

describe('AppShell brand block', () => {
  it('renders only the updated platform name in the sidebar brand area', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/workspace']}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>,
    )

    expect(html).toContain('云矩公文管理平台')
    expect(html).not.toContain('PublicText')
    expect(html).not.toContain('Apple-style blue workspace for document operations.')
    expect(html).not.toContain('>PT<')
  })
})
