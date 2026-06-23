import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../api/client'
import type { GovDoc, Topic } from '../api/types'
import { loadEmployeeSession } from '../utils/employeeAuth'
import { canPerformAction } from '../utils/pagePermissions'
import { formatServerDateTime } from '../utils/time'

export function TopicLibraryPage() {
  const { topicId = '' } = useParams()
  const navigate = useNavigate()
  const uploadInputRef = useRef<HTMLInputElement | null>(null)

  const [topic, setTopic] = useState<Topic | null>(null)
  const [docs, setDocs] = useState<GovDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploadError, setUploadError] = useState('')
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

  const uploadDocument = async (file?: File) => {
    if (!file || !topicId || uploading) return
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setUploadMessage('')
      setUploadError('仅支持 DOCX 文件')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadMessage('')
      setUploadError('文件大小不能超过 20MB')
      return
    }

    const title = file.name.replace(/\.docx$/i, '') || '导入文档'
    const form = new FormData()
    form.append('file', file)
    form.append('title', title)
    form.append('preserveFormatting', 'true')

    setUploading(true)
    setUploadMessage('')
    setUploadError('')
    try {
      await api.post<{ docId: string; importReport: any }>(`/api/management/topics/${topicId}/docs/importDocx`, form, {
        timeout: 180000,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await load()
      setUploadMessage(`上传成功：${title}`)
    } catch (error: any) {
      setUploadError(String(error?.response?.data?.detail || '文件上传失败，请稍后重试。'))
    } finally {
      setUploading(false)
    }
  }

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
    <main className="page workspace-page module-workbench-page module-workbench-page-layout layout-page-scale">
      <section className="workspace-table-card">
        <div className="row-between topic-library-header">
          <div className="knowledge-doc-heading">
            <h3>{topic?.name || '题材文档库'}</h3>
            <p>{loading ? '正在同步文档...' : `共 ${docs.length} 份文档`}</p>
          </div>
          <div className="row-gap">
            <button type="button" onClick={() => navigate(`/layout/topics/${topicId}`)}>
              新建/进入正文编辑
            </button>
            <button
              type="button"
              className="department-upload-button"
              onClick={() => uploadInputRef.current?.click()}
              disabled={!topicId || uploading}
            >
              {uploading ? '上传中...' : '上传文件'}
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                void uploadDocument(file)
                event.currentTarget.value = ''
              }}
            />
          </div>
        </div>

        {uploadMessage || uploadError ? (
          <div
            className={uploadError ? 'department-upload-feedback is-error' : 'department-upload-feedback is-success'}
            role={uploadError ? 'alert' : 'status'}
          >
            {uploadError || uploadMessage}
          </div>
        ) : null}

        {loading ? (
          <p>加载中...</p>
        ) : docs.length === 0 ? (
          <div className="empty-state">
            <strong>该题材下暂无文档</strong>
            <p>可以上传已有 DOCX，也可以从正文编辑入口新建一份文档。</p>
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
                      <button type="button" onClick={() => navigate(`/layout/topics/${topicId}`)}>
                        新建/进入正文编辑
                      </button>
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
