import { api } from '../api/client'
import type { Unit } from '../api/types'

export const DEFAULT_COMPANY_NAME = '云成数科'

export function resolveCompanyNameByEmployeeNo(employeeNo: string): string {
  const normalized = employeeNo.trim()
  if (!normalized) return DEFAULT_COMPANY_NAME
  return DEFAULT_COMPANY_NAME
}

export async function ensureEmployeeCompany(employeeNo: string): Promise<Unit> {
  const companyName = resolveCompanyNameByEmployeeNo(employeeNo)
  const listResp = await api.get<Unit[]>('/api/management/companies')
  const existing = listResp.data.find((item) => item.name.trim() === companyName)
  if (existing) return existing

  try {
    const createdResp = await api.post<Unit>('/api/management/units', { name: companyName })
    return createdResp.data
  } catch (error: any) {
    if (error?.response?.status !== 409) {
      throw error
    }
    const retryResp = await api.get<Unit[]>('/api/management/companies')
    const createdByOtherRequest = retryResp.data.find((item) => item.name.trim() === companyName)
    if (createdByOtherRequest) return createdByOtherRequest
    throw error
  }
}

