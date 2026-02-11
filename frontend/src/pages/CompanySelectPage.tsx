import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { Unit } from '../api/types'

export function CompanySelectPage() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<Unit[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get<Unit[]>('/api/companies')
      setCompanies(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const createCompany = async () => {
    const companyName = name.trim()
    if (!companyName) {
      alert('请输入公司名称')
      return
    }

    setCreating(true)
    try {
      await api.post<Unit>('/api/units', { name: companyName, code: code.trim() || undefined })
      setName('')
      setCode('')
      await load()
    } catch (error: any) {
      const message = error?.response?.data?.detail || '创建公司失败'
      alert(String(message))
    } finally {
      setCreating(false)
    }
  }

  const deleteCompany = async (company: Unit) => {
    const confirmed = window.confirm(`确认删除公司“${company.name}”？该操作会删除其关联题材、文档和模板。`)
    if (!confirmed) return

    setDeletingId(company.id)
    try {
      await api.delete(`/api/units/${company.id}`)
      await load()
    } catch (error: any) {
      const message = error?.response?.data?.detail || '删除公司失败'
      alert(String(message))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="page">
      <div className="header-row">
        <h2>公司选择</h2>
        <button type="button" onClick={() => navigate('/docs')}>
          进入文档中心
        </button>
      </div>

      <div className="unit-editor-card">
        <strong>新建公司</strong>
        <div className="row-gap">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="公司名称（必填）" />
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="公司编码（可选）" />
          <button type="button" onClick={() => void createCompany()} disabled={creating}>
            {creating ? '创建中...' : '创建公司'}
          </button>
        </div>
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : companies.length === 0 ? (
        <p>暂无公司，请先新建公司。</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>公司名称</th>
              <th>编码</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id}>
                <td>{company.name}</td>
                <td>{company.code}</td>
                <td>
                  <div className="row-gap">
                    <button type="button" onClick={() => navigate(`/companies/${company.id}/topics`)}>
                      进入题材库
                    </button>
                    <button type="button" onClick={() => void deleteCompany(company)} disabled={deletingId === company.id}>
                      {deletingId === company.id ? '删除中...' : '删除'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
