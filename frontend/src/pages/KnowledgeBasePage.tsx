import { DragEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { KnowledgeDocument } from '../api/types'
import { isSupportedSummaryFileName } from '../utils/documentSummary'

function useElapsedSeconds(active: boolean) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!active) {
      setElapsedSeconds(0)
      return
    }

    const startedAt = Date.now()
    setElapsedSeconds(0)
    const intervalId = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [active])

  return elapsedSeconds
}

export function KnowledgeBasePage() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const navigate = useNavigate()
  const [docs, setDocs] = useState<KnowledgeDocument[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const elapsedSeconds = useElapsedSeconds(uploading || loading)
  const activeOperationLabel = uploading ? '正在将材料加入知识库' : loading ? '正在同步知识库' : ''
  const activeOperationMessage = activeOperationLabel ? `${activeOperationLabel}，已等待 ${elapsedSeconds} 秒` : ''
  const announcedElapsedSeconds = Math.floor(elapsedSeconds / 10) * 10
  const activeOperationAnnouncement = activeOperationLabel
    ? announcedElapsedSeconds > 0
      ? `${activeOperationLabel}，已等待约 ${announcedElapsedSeconds} 秒。`
      : `${activeOperationLabel}。`
    : ''

  const loadDocs = async (announce = false) => {
    setLoading(true)
    setErrorMessage('')
    setStatusMessage('')
    try {
      const res = await api.get<KnowledgeDocument[]>('/api/knowledge/docs')
      setDocs(res.data)
      if (announce) {
        setStatusMessage(`知识库已同步，共 ${res.data.length} 份材料。`)
      }
    } catch {
      setErrorMessage('知识库文档加载失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDocs()
  }, [])

  const uploadFile = async (file: File | null) => {
    if (!file) return
    if (!isSupportedSummaryFileName(file.name)) {
      setErrorMessage('仅支持 DOCX / PDF / TXT 文件')
      setStatusMessage('')
      return
    }

    const form = new FormData()
    form.append('file', file)
    form.append('title', file.name.replace(/\.[^.]+$/, ''))

    setUploading(true)
    setErrorMessage('')
    setStatusMessage('')
    try {
      const res = await api.post<KnowledgeDocument>('/api/knowledge/docs', form, {
        timeout: 180000,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setDocs((current) => [res.data, ...current.filter((item) => item.id !== res.data.id)])
      setStatusMessage(`已入库：${res.data.title}`)
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      setErrorMessage(typeof detail === 'string' ? detail : '知识库上传失败，请稍后重试。')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragging(false)
    if (uploading || loading) return
    const file = event.dataTransfer.files?.[0] || null
    void uploadFile(file)
  }

  const handleUploadKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    inputRef.current?.click()
  }

  const openSummaryWithKnowledgeBase = () => {
    navigate('/layout/summary', {
      state: {
        useKnowledgeBase: true,
        knowledgeSource: {
          label: '云矩知识库',
          documentCount: docs.length,
        },
      },
    })
  }

  return (
    <main className="page workspace-page module-workbench-page knowledge-base-page" aria-busy={uploading || loading}>
      <section className="panel knowledge-upload-panel">
        <h3>云矩知识库</h3>
        <p>上传本地公文材料后，系统会提取正文并沉淀为 DeepSeek 写作参考。</p>

        <section
          className={`knowledge-upload-zone ${dragging ? 'dragging' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="选择要加入云矩知识库的公文材料"
          aria-disabled={uploading || loading}
          onClick={() => {
            if (!uploading && !loading) inputRef.current?.click()
          }}
          onKeyDown={(event) => {
            if (!uploading && !loading) handleUploadKeyDown(event)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            setDragging(false)
          }}
          onDrop={handleDrop}
        >
          <strong>{uploading ? '正在入库...' : '上传公文材料'}</strong>
          <span>支持 DOCX / PDF / TXT，单文件 ≤ 20MB</span>
        </section>
        <input
          ref={inputRef}
          type="file"
          aria-label="选择要加入云矩知识库的公文材料"
          accept=".docx,.pdf,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0] || null
            void uploadFile(file)
            event.currentTarget.value = ''
          }}
        />

        <div className="row-gap">
          <button type="button" className="secondary-button" onClick={() => void loadDocs(true)} disabled={loading}>
            {loading ? '同步中...' : '刷新列表'}
          </button>
          <button type="button" onClick={openSummaryWithKnowledgeBase} disabled={loading || uploading}>
            去公文总结调用
          </button>
        </div>

        {activeOperationMessage ? (
          <>
            <p className="summary-operation-status">{activeOperationMessage}</p>
            <span className="summary-operation-announcement" role="status" aria-live="polite" aria-atomic="true">
              {activeOperationAnnouncement}
            </span>
          </>
        ) : null}
        {statusMessage ? (
          <p className="summary-success" role="status" aria-live="polite">
            {statusMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="summary-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <section className="workspace-table-card knowledge-doc-panel">
        <div className="row-between knowledge-doc-header">
          <div className="knowledge-doc-heading">
            <h3>知识库文档</h3>
            <p>{loading ? '正在同步知识库...' : `共 ${docs.length} 份材料`}</p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={openSummaryWithKnowledgeBase}
            disabled={loading || uploading}
          >
            调用写作
          </button>
        </div>

        <ul className="knowledge-doc-list">
          {docs.length === 0 ? (
            <li className="knowledge-empty-row">
              <strong>暂无知识库文档</strong>
              <span>上传左侧公文材料后，会在这里形成可调阅的写作参考。</span>
            </li>
          ) : (
            docs.map((doc) => (
              <li key={doc.id}>
                <div className="knowledge-doc-main">
                  <strong>{doc.title}</strong>
                  <span>{doc.excerpt || '暂无摘要'}</span>
                </div>
                <div className="knowledge-doc-meta">
                  <span>{doc.fileName}</span>
                  <span>{doc.sourceChars} 字</span>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  )
}
