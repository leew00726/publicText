import { describe, expect, it } from 'vitest'

import { createEmployeeSession, listModulesByRole, parseEmployeeSession, validateEmployeeLogin } from '../src/utils/employeeAuth'

describe('employee auth helpers', () => {
  it('validates login form inputs', () => {
    const invalid = validateEmployeeLogin('   ', '123')
    expect(invalid.valid).toBe(false)
    expect(invalid.usernameError).toBe('请输入员工账号')
    expect(invalid.passwordError).toBe('密码至少 6 位')

    const valid = validateEmployeeLogin('  alice  ', '123456')
    expect(valid.valid).toBe(true)
    expect(valid.usernameError).toBeNull()
    expect(valid.passwordError).toBeNull()
    expect(valid.normalizedUsername).toBe('alice')
  })

  it('creates and parses a valid employee session', () => {
    const session = createEmployeeSession('alice', 'staff', new Date('2026-03-02T08:00:00.000Z'))
    const parsed = parseEmployeeSession(JSON.stringify(session))
    expect(parsed).toEqual(session)
  })

  it('stores company info in employee session when provided', () => {
    const session = createEmployeeSession(
      'alice',
      'staff',
      { id: 'company-yc', name: '云成数科' },
      new Date('2026-03-02T08:00:00.000Z'),
    )
    const parsed = parseEmployeeSession(JSON.stringify(session))
    expect(parsed?.companyId).toBe('company-yc')
    expect(parsed?.companyName).toBe('云成数科')
  })

  it('returns null for malformed session payload', () => {
    expect(parseEmployeeSession('{')).toBeNull()
    expect(parseEmployeeSession(JSON.stringify({ username: 'alice', role: 'owner', loginAt: 'bad' }))).toBeNull()
    expect(parseEmployeeSession(null)).toBeNull()
  })

  it('maps module access by employee role', () => {
    const staffModules = listModulesByRole('staff')
    const adminModules = listModulesByRole('admin')

    expect(staffModules).toHaveLength(3)
    expect(adminModules).toHaveLength(3)
    expect(staffModules.find((item) => item.key === 'summary')?.entryPath).toBe('/summary')
    expect(staffModules.find((item) => item.key === 'layout')?.entryPath).toBe('/layout')
    expect(staffModules.find((item) => item.key === 'management')?.entryPath).toBe('/management')
    expect(staffModules.find((item) => item.key === 'management')?.enabled).toBe(false)
    expect(adminModules.find((item) => item.key === 'management')?.enabled).toBe(true)
  })
})
