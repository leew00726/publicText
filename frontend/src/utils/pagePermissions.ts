import type { EmployeeRole } from './employeeAuth'

export type PagePermissionKey =
  | 'layout.home'
  | 'layout.summary'
  | 'layout.company'
  | 'layout.topicList'
  | 'layout.topicCompose'
  | 'layout.topicLibrary'
  | 'layout.docEditor'
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

const ROLE_PAGE_PERMISSIONS: Record<EmployeeRole, PagePermissionKey[]> = {
  staff: [
    'workspace.home',
    'layout.home',
    'layout.summary',
    'layout.company',
    'layout.topicList',
    'layout.topicCompose',
    'layout.topicLibrary',
    'layout.docEditor',
  ],
  admin: [
    'workspace.home',
    'layout.home',
    'layout.summary',
    'layout.company',
    'layout.topicList',
    'layout.topicCompose',
    'layout.topicLibrary',
    'layout.docEditor',
    'management.home',
    'management.company',
    'management.topicList',
    'management.topicTrain',
  ],
}

const ROLE_ACTION_PERMISSIONS: Record<EmployeeRole, ActionPermissionKey[]> = {
  staff: [],
  admin: [
    'management.company.create',
    'management.company.delete',
    'management.topic.create',
    'management.topic.delete',
    'management.template.delete',
    'management.doc.delete',
  ],
}

export function canAccessPage(role: EmployeeRole, key: PagePermissionKey): boolean {
  return ROLE_PAGE_PERMISSIONS[role].includes(key)
}

export function canPerformAction(role: EmployeeRole, key: ActionPermissionKey): boolean {
  return ROLE_ACTION_PERMISSIONS[role].includes(key)
}
