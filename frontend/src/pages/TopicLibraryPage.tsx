import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../api/client'
import type { GovDoc, Topic } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import { loadEmployeeSession } from '../utils/employeeAuth'
import { canPerformAction } from '../utils/pagePermissions'
import { formatServerDateTime } from '../utils/time'

export function TopicLibraryPage() {
  const { topicId = '' } = useParams()
  const navigate = useNavigate()

  const [topic, setTopic] = useState<Topic | null>(null)
  const [docs, setDocs] = useState<GovDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const role = loadEmployeeSession()?.role || 'staff'
  const canDeleteDoc = canPerformAction(role, 'management.doc.delete')

  const load = async () => {
    if (!topicId) return
    setLoading(true)
    try {
      const [topicRes, docsRes] = await Promise.all([
        api.get<Topic>(`/api/management/topics/${topicId}`),
        api.get<GovDoc[]>('/api/layout/docs', { params: { topicId } }),
      ])
      setTopic(topicRes.data)
      setDocs(docsRes.data)
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '加载文档库失败'
      alert(String(detail))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [topicId])

  const deleteDoc = async (doc: GovDoc) => {
    if (!canDeleteDoc) {
      alert('当前账号无删除文档权限，请联系管理员处理。')
      return
    }
    const confirmed = window.confirm(`确认删除文档“${doc.title}”？`)
    if (!confirmed) return

    setDeletingDocId(doc.id)
    try {
      await api.delete(`/api/layout/docs/${doc.id}`)
      await load()
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '删除文档失败'
      alert(String(detail))
    } finally {
      setDeletingDocId(null)
    }
  }

  return (
    <main className="page workspace-page">
      <PageHeader
        eyebrow="Library"
        title={`文档库${topic ? ` · ${topic.name}` : ''}`}
        description="按题材查看既有文档，并继续进入正文排版工作区。"
        meta={
          <>
            <span className="soft-pill">题材 {topic?.name || '-'}</span>
            <span className="soft-pill">文档数 {docs.length}</span>
          </>
        }
        actions={
          <button type="button" onClick={() => navigate(`/layout/topics/${topicId}`)}>
            新建/进入正文编辑
          </button>
        }
      />

      <section className="workspace-table-card">
        {loading ? (
          <p>加载中...</p>
        ) : docs.length === 0 ? (
          <div className="empty-state">
            <strong>该题材下暂无文档</strong>
            <p>先去正文编辑入口创建一份文档，即可出现在这里。</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>文档标题</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.title}</td>
                  <td>{formatServerDateTime(doc.updatedAt)}</td>
                  <td>
                    <div className="row-gap table-actions">
                      <button type="button" onClick={() => navigate(`/layout/docs/${doc.id}`)}>
                        打开编辑
                      </button>
                      {canDeleteDoc ? (
                        <button type="button" onClick={() => void deleteDoc(doc)} disabled={deletingDocId === doc.id}>
                          {deletingDocId === doc.id ? '删除中...' : '删除'}
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
