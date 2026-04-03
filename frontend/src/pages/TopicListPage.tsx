import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../api/client'
import type { Topic, Unit } from '../api/types'
import { loadEmployeeSession } from '../utils/employeeAuth'
import { canPerformAction } from '../utils/pagePermissions'
import { formatServerDateTime } from '../utils/time'

const TOPIC_STATUS_LABEL: Record<string, string> = {
  active: '启用',
  disabled: '停用',
}

type TopicListPageProps = {
  mode: 'layout' | 'management'
}

export function TopicListPage({ mode }: TopicListPageProps) {
  const { companyId = '' } = useParams()
  const navigate = useNavigate()

  const [companies, setCompanies] = useState<Unit[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const role = loadEmployeeSession()?.role || 'staff'
  const canCreateTopic = mode === 'management' && canPerformAction(role, 'management.topic.create')
  const canDeleteTopic = mode === 'management' && canPerformAction(role, 'management.topic.delete')
  const canManageTopic = mode === 'management'

  const load = async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const [companyRes, topicRes] = await Promise.all([
        api.get<Unit[]>('/api/management/companies'),
        api.get<Topic[]>('/api/management/topics', { params: { companyId } }),
      ])
      setCompanies(companyRes.data)
      setTopics(topicRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [companyId])

  const currentCompany = useMemo(() => companies.find((item) => item.id === companyId), [companies, companyId])

  const createTopic = async () => {
    if (!canCreateTopic) {
      alert('当前账号无创建题材权限，请联系管理员处理。')
      return
    }
    const topicName = name.trim()
    if (!topicName) {
      alert('请输入题材名称')
      return
    }

    setCreating(true)
    try {
      await api.post<Topic>('/api/management/topics', {
        companyId,
        name: topicName,
      })
      setName('')
      await load()
    } catch (error: any) {
      const message = error?.response?.data?.detail || '新建题材失败'
      alert(String(message))
    } finally {
      setCreating(false)
    }
  }

  const deleteTopic = async (topic: Topic) => {
    if (!canDeleteTopic) {
      alert('当前账号无删除题材权限，请联系管理员处理。')
      return
    }
    const confirmed = window.confirm(`确认删除题材“${topic.name}”？该操作会删除其模板草稿与审计记录。`)
    if (!confirmed) return

    setDeletingId(topic.id)
    try {
      await api.delete(`/api/management/topics/${topic.id}`)
      await load()
    } catch (error: any) {
      const message = error?.response?.data?.detail || '删除题材失败'
      alert(String(message))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className={`page workspace-page${mode === 'layout' ? ' layout-page-scale' : ''}`}>
      {canCreateTopic ? (
        <section className="unit-editor-card">
          <strong>新建题材</strong>
          <div className="row-gap">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：周例会纪要" />
            <button type="button" onClick={() => void createTopic()} disabled={creating || !companyId}>
              {creating ? '创建中...' : '创建题材'}
            </button>
          </div>
        </section>
      ) : null}

      <section className="workspace-table-card">
        {loading ? (
          <p>加载中...</p>
        ) : topics.length === 0 ? (
          <div className="empty-state">
            <strong>该公司题材库为空</strong>
            <p>请先新建题材并上传训练材料，再进入文档编排与治理流程。</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>题材名称</th>
                <th>状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((topic) => (
                <tr key={topic.id}>
                  <td>{topic.name}</td>
                  <td>{TOPIC_STATUS_LABEL[topic.status] || topic.status}</td>
                  <td>{formatServerDateTime(topic.updatedAt)}</td>
                  <td>
                    <div className="row-gap table-actions">
                      {canManageTopic ? (
                        <>
                          <button type="button" onClick={() => navigate(`/management/topics/${topic.id}/train`)}>
                            模板训练
                          </button>
                          <button type="button" onClick={() => navigate(`/layout/topics/${topic.id}/library`)}>
                            文档库
                          </button>
                          {canDeleteTopic ? (
                            <button type="button" onClick={() => void deleteTopic(topic)} disabled={deletingId === topic.id}>
                              {deletingId === topic.id ? '删除中...' : '删除'}
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => navigate(`/layout/topics/${topic.id}/library`)}>
                            文档库
                          </button>
                          <button type="button" onClick={() => navigate(`/layout/topics/${topic.id}`)}>
                            进入正文编辑
                          </button>
                        </>
                      )}
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
