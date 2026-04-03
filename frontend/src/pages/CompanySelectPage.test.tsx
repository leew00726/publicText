import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { CompanySelectPage } from './CompanySelectPage'

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
  },
}))

vi.mock('../utils/employeeAuth', () => ({
  loadEmployeeSession: vi.fn(() => ({
    username: 'tester',
    role: 'admin',
  })),
}))

vi.mock('../utils/pagePermissions', () => ({
  canPerformAction: vi.fn(() => true),
}))

describe('CompanySelectPage', () => {
  it('renders the company creation header with a stable two-column layout', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <CompanySelectPage mode="management" />
      </MemoryRouter>,
    )

    expect(html).toContain('company-create-card')
    expect(html).toContain('company-create-copy')
    expect(html).toContain('company-create-form')
    expect(html).toContain('新增公司后即可进入对应题材、模板与文档治理流程。')
    expect(html).toContain('公司名称（必填）')
  })
})
