import { describe, expect, it } from 'vitest'

import { resolveEmployeeCompanyHomePath } from '../src/utils/employeeCompany'

describe('employee company mapping', () => {
  it('routes to the company bound in the employee session', () => {
    expect(
      resolveEmployeeCompanyHomePath({
        username: '82000001',
        role: 'staff',
        loginAt: '2026-03-02T08:00:00.000Z',
        companyId: ' company-yc ',
        companyName: '云成数科',
        permissions: ['layout.topicList'],
      }),
    ).toBe('/layout/companies/company-yc/topics')
  })

  it('does not fall back to a default company when the session is unbound', () => {
    expect(resolveEmployeeCompanyHomePath(null)).toBeNull()
    expect(
      resolveEmployeeCompanyHomePath({
        username: '82000001',
        role: 'staff',
        loginAt: '2026-03-02T08:00:00.000Z',
        companyName: '云成数科',
        permissions: ['layout.topicList'],
      }),
    ).toBeNull()
  })
})
