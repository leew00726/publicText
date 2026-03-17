import { LAYOUT_HOME_PATH } from './layoutNavigation'

export type EmployeeRole = 'staff' | 'admin'
export type ModuleKey = 'summary' | 'layout' | 'management'

export type EmployeeSession = {
  username: string
  role: EmployeeRole
  loginAt: string
  companyId?: string
  companyName?: string
}

export type EmployeeModule = {
  key: ModuleKey
  title: string
  description: string
  entryPath: string
  enabled: boolean
}

type ModuleDefinition = Omit<EmployeeModule, 'enabled'> & {
  allowedRoles: EmployeeRole[]
}

export type EmployeeLoginValidation = {
  valid: boolean
  normalizedUsername: string
  usernameError: string | null
  passwordError: string | null
}

export type EmployeeCompanyRef = {
  id: string
  name: string
}

export const EMPLOYEE_SESSION_STORAGE_KEY = 'public_text_employee_session'

const MIN_PASSWORD_LENGTH = 6

const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key: 'summary',
    title: '公文总结',
    description: '聚焦内容提炼、要点归纳与主题提取，快速形成可复用摘要。',
    entryPath: '/summary',
    allowedRoles: ['staff', 'admin'],
  },
  {
    key: 'layout',
    title: '公文排版',
    description: '统一正文结构、格式规范和输出标准，提升发文一致性。',
    entryPath: LAYOUT_HOME_PATH,
    allowedRoles: ['staff', 'admin'],
  },
  {
    key: 'management',
    title: '公文管理',
    description: '管理公司、题材和历史文档，支持后续权限精细化治理。',
    entryPath: '/management',
    allowedRoles: ['admin'],
  },
]

function isEmployeeRole(value: unknown): value is EmployeeRole {
  return value === 'staff' || value === 'admin'
}

export function validateEmployeeLogin(username: string, password: string): EmployeeLoginValidation {
  const normalizedUsername = username.trim()
  const usernameError = normalizedUsername ? null : '请输入员工账号'
  const passwordError = password.length >= MIN_PASSWORD_LENGTH ? null : `密码至少 ${MIN_PASSWORD_LENGTH} 位`

  return {
    valid: !usernameError && !passwordError,
    normalizedUsername,
    usernameError,
    passwordError,
  }
}

export function createEmployeeSession(
  username: string,
  role: EmployeeRole,
  companyOrNow?: EmployeeCompanyRef | Date,
  nowArg: Date = new Date(),
): EmployeeSession {
  const now = companyOrNow instanceof Date ? companyOrNow : nowArg
  const company = companyOrNow instanceof Date ? null : companyOrNow || null
  return {
    username: username.trim(),
    role,
    loginAt: now.toISOString(),
    ...(company
      ? {
          companyId: company.id.trim(),
          companyName: company.name.trim(),
        }
      : {}),
  }
}

export function parseEmployeeSession(payload: string | null | undefined): EmployeeSession | null {
  if (!payload) return null

  try {
    const parsed = JSON.parse(payload) as Partial<EmployeeSession>
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.username !== 'string' || !parsed.username.trim()) return null
    if (!isEmployeeRole(parsed.role)) return null
    if (typeof parsed.loginAt !== 'string' || Number.isNaN(Date.parse(parsed.loginAt))) return null
    if (parsed.companyId !== undefined && typeof parsed.companyId !== 'string') return null
    if (parsed.companyName !== undefined && typeof parsed.companyName !== 'string') return null

    const companyId = typeof parsed.companyId === 'string' ? parsed.companyId.trim() : ''
    const companyName = typeof parsed.companyName === 'string' ? parsed.companyName.trim() : ''
    if (Boolean(companyId) !== Boolean(companyName)) return null

    return {
      username: parsed.username.trim(),
      role: parsed.role,
      loginAt: parsed.loginAt,
      ...(companyId && companyName
        ? {
            companyId,
            companyName,
          }
        : {}),
    }
  } catch {
    return null
  }
}

export function saveEmployeeSession(session: EmployeeSession): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(EMPLOYEE_SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function loadEmployeeSession(): EmployeeSession | null {
  if (typeof window === 'undefined') return null
  return parseEmployeeSession(window.localStorage.getItem(EMPLOYEE_SESSION_STORAGE_KEY))
}

export function clearEmployeeSession(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(EMPLOYEE_SESSION_STORAGE_KEY)
}

export function listModulesByRole(role: EmployeeRole): EmployeeModule[] {
  return MODULE_DEFINITIONS.map((moduleItem) => ({
    key: moduleItem.key,
    title: moduleItem.title,
    description: moduleItem.description,
    entryPath: moduleItem.entryPath,
    enabled: moduleItem.allowedRoles.includes(role),
  }))
}
