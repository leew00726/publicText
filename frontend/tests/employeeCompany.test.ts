import { describe, expect, it } from 'vitest'

import { DEFAULT_COMPANY_NAME, resolveCompanyNameByEmployeeNo } from '../src/utils/employeeCompany'

describe('employee company mapping', () => {
  it('maps employee number to default company', () => {
    expect(resolveCompanyNameByEmployeeNo('10001')).toBe(DEFAULT_COMPANY_NAME)
    expect(resolveCompanyNameByEmployeeNo('yc-zhangsan')).toBe(DEFAULT_COMPANY_NAME)
  })
})

