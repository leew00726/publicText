import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../api/client'
import type { GovDoc, Topic } from '../api/types'
import { formatServerDateTime } from '../utils/time'

export function TopicLibraryPage() {
  const { topicId = '' } = useParams()
  const navigate = useNavigate()

  const [topic, setTopic] = useState<Topic | null>(null)
  const [docs, setDocs] = useState<GovDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)

  const load = async () => {
    if (!topicId) return
    setLoading(true)
    try {
      const [topicRes, docsRes] = await Promise.all([
        api.get<Topic>(`/api/topics/${topicId}`),
        api.get<GovDoc[]>('/api/docs', { params: { topicId } }),
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
    const confirmed = window.confirm(`确认删除文档“${doc.title}”？`)
    if (!confirmed) return

    setDeletingDocId(doc.id)
    try {
      await api.delete(`/api/docs/${doc.id}`)
      await load()
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '删除文档失败'
      alert(String(detail))
    } finally {
      setDeletingDocId(null)
    }
  }

  return (
    <div className="page">
      <div className="header-row">
        <h2>文档库{topic ? ` - ${topic.name}` : ''}</h2>
      </div>

      <div className="unit-editor-card">
        <strong>当前题材：{topic?.name || '-'}</strong>
        <div className="row-gap">
          <button type="button" onClick={() => navigate(`/topics/${topicId}`)}>
            新建/进入正文编辑
          </button>
        </div>
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : docs.length === 0 ? (
        <p>该题材下暂无文档，先去正文编辑入口创建一份文档即可出现在这里。</p>
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
                  <div className="row-gap">
                    <button type="button" onClick={() => navigate(`/docs/${doc.id}`)}>
                      打开编辑
                    </button>
                    <button type="button" onClick={() => void deleteDoc(doc)} disabled={deletingDocId === doc.id}>
                      {deletingDocId === doc.id ? '删除中...' : '删除'}
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
