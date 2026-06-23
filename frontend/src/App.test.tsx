import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import App from './App'

vi.mock('./components/AppShell', () => ({
  AppShell: ({ children }: { children: JSX.Element }) => <div data-testid="app-shell">{children}</div>,
}))

vi.mock('./utils/employeeAuth', () => ({
  loadEmployeeSession: vi.fn(() => ({
    username: '80051081',
    name: '金刚善',
    role: 'admin',
    companyId: 'company-1',
    companyName: '云成数科',
  })),
  saveEmployeeSession: vi.fn(),
}))

describe('App management routes', () => {
  it('renders the company department overview route', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/management/companies/company-1/departments']}>
        <App />
      </MemoryRouter>,
    )

    expect(html).toContain('部门总览')
  })
})
