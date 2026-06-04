import { listPermissionsByRole, type EmployeeRole, type EmployeeSession } from './employeeAuth'

export type PagePermissionKey =
  | 'layout.home'
  | 'layout.summary'
  | 'layout.company'
  | 'layout.topicList'
  | 'layout.topicCompose'
  | 'layout.topicLibrary'
  | 'layout.docEditor'
  | 'workspace.meetingMinutes'
  | 'management.home'
  | 'management.company'
  | 'management.topicList'
  | 'management.topicTrain'
  | 'workspace.home'

export type ActionPermissionKey =
  | 'management.company.create'
  | 'management.company.delete'
  | 'management.topic.create'
  | 'management.topic.delete'
  | 'management.template.delete'
  | 'management.doc.delete'

export type PermissionSubject = EmployeeRole | Pick<EmployeeSession, 'role'> & Partial<Pick<EmployeeSession, 'permissions'>>
export type CompanyAccessScope = 'own' | 'any'

function getSubjectPermissions(subject: PermissionSubject): string[] {
  if (typeof subject === 'string') {
    return listPermissionsByRole(subject)
  }
  if (Array.isArray(subject.permissions)) {
    return subject.permissions
  }
  return listPermissionsByRole(subject.role)
}

export function canAccessPage(subject: PermissionSubject, key: PagePermissionKey): boolean {
  return getSubjectPermissions(subject).includes(key)
}

export function canPerformAction(subject: PermissionSubject, key: ActionPermissionKey): boolean {
  return getSubjectPermissions(subject).includes(key)
}

export function canAccessCompany(
  session: Pick<EmployeeSession, 'companyId'> | null | undefined,
  companyId: string,
  scope: CompanyAccessScope = 'own',
): boolean {
  if (scope === 'any') return true
  const sessionCompanyId = session?.companyId?.trim() || ''
  const requestedCompanyId = companyId.trim()
  return Boolean(sessionCompanyId && requestedCompanyId && sessionCompanyId === requestedCompanyId)
}
