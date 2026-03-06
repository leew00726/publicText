import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { Unit } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import { loadEmployeeSession } from '../utils/employeeAuth'
import { canPerformAction } from '../utils/pagePermissions'

type CompanySelectPageProps = {
  mode: 'layout' | 'management'
}

export function CompanySelectPage({ mode }: CompanySelectPageProps) {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<Unit[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const role = loadEmployeeSession()?.role || 'staff'
  const canCreateCompany = mode === 'management' && canPerformAction(role, 'management.company.create')
  const canDeleteCompany = mode === 'management' && canPerformAction(role, 'management.company.delete')
  const canManageCompany = mode === 'management'
  const nextTopicsPrefix = useMemo(
    () => (mode === 'management' ? '/management/companies' : '/layout/companies'),
    [mode],
  )

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get<Unit[]>('/api/management/companies')
      setCompanies(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const createCompany = async () => {
    if (!canCreateCompany) {
      alert('当前账号无创建公司权限，请联系管理员处理。')
      return
    }
    const companyName = name.trim()
    if (!companyName) {
      alert('请输入公司名称')
      return
    }

    setCreating(true)
    try {
      await api.post<Unit>('/api/management/units', { name: companyName })
      setName('')
      await load()
    } catch (error: any) {
      const message = error?.response?.data?.detail || '创建公司失败'
      alert(String(message))
    } finally {
      setCreating(false)
    }
  }

  const deleteCompany = async (company: Unit) => {
    if (!canDeleteCompany) {
      alert('当前账号无删除公司权限，请联系管理员处理。')
      return
    }
    const confirmed = window.confirm(`确认删除公司“${company.name}”？该操作会删除其关联题材、文档和模板。`)
    if (!confirmed) return

    setDeletingId(company.id)
    try {
      await api.delete(`/api/management/units/${company.id}`)
      await load()
    } catch (error: any) {
      const message = error?.response?.data?.detail || '删除公司失败'
      alert(String(message))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="page workspace-page">
      <PageHeader
        eyebrow={canManageCompany ? 'Companies' : 'Selection'}
        title={canManageCompany ? '公司管理' : '公司选择'}
        description={canManageCompany ? '维护公司主数据，并继续进入题材治理流程。' : '选择公司后进入对应题材库。'}
        meta={
          <>
            <span className="soft-pill">{canManageCompany ? '治理视图' : '排版视图'}</span>
            <span className="soft-pill">公司数 {companies.length}</span>
          </>
        }
      />

      {canCreateCompany ? (
        <section className="unit-editor-card">
          <strong>新建公司</strong>
          <div className="row-gap">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="公司名称（必填）" />
            <button type="button" onClick={() => void createCompany()} disabled={creating}>
              {creating ? '创建中...' : '创建公司'}
            </button>
          </div>
        </section>
      ) : null}

      <section className="workspace-table-card">
        {loading ? (
          <p>加载中...</p>
        ) : companies.length === 0 ? (
          <div className="empty-state">
            <strong>暂无公司</strong>
            <p>请先新建公司，再进入题材与模板治理流程。</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>公司名称</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td>{company.name}</td>
                  <td>
                    <div className="row-gap table-actions">
                      <button type="button" onClick={() => navigate(`${nextTopicsPrefix}/${company.id}/topics`)}>
                        {canManageCompany ? '进入题材管理' : '进入排版题材库'}
                      </button>
                      {canDeleteCompany ? (
                        <button type="button" onClick={() => void deleteCompany(company)} disabled={deletingId === company.id}>
                          {deletingId === company.id ? '删除中...' : '删除'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
