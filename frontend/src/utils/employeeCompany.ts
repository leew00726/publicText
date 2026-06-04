import type { EmployeeSession } from './employeeAuth'

export function resolveEmployeeCompanyHomePath(session: Pick<EmployeeSession, 'companyId'> | null | undefined): string | null {
  const companyId = session?.companyId?.trim()
  if (!companyId) return null
  return `/layout/companies/${companyId}/topics`
}
