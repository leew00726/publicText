import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { api } from '../api/client'
import type { DeletionAuditEvent, TopicAnalyzeResponse, TopicConfirmResponse, TopicDraft, TopicTemplate } from '../api/types'
import { formatServerDateTime } from '../utils/time'
import { summarizeConfidenceAsNarrative, summarizeRulesAsNarrative } from '../utils/topicNarrative'

const DRAFT_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  confirmed: '已确认',
  archived: '已归档',
}

const AUDIT_STATUS_LABEL: Record<string, string> = {
  success: '成功',
  failed: '失败',
}

type RevisionMessage = {
  role: 'user' | 'assistant'
  content: string
}

export function TopicDetailPage() {
  const { topicId = '' } = useParams()

  const [draft, setDraft] = useState<TopicDraft | null>(null)
  const [templates, setTemplates] = useState<TopicTemplate[]>([])
  const [auditEvents, setAuditEvents] = useState<DeletionAuditEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [revising, setRevising] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [instruction, setInstruction] = useState('')
  const [bodyFontFamily, setBodyFontFamily] = useState('')
  const [useDeepSeek, setUseDeepSeek] = useState(true)
  const [conversation, setConversation] = useState<RevisionMessage[]>([])
  const [message, setMessage] = useState('')

  const load = async () => {
    if (!topicId) return
    setLoading(true)
    try {
      const [draftRes, templateRes, auditRes] = await Promise.all([
        api
          .get<TopicDraft>(`/api/topics/${topicId}/drafts/latest`)
          .then((res) => res.data)
          .catch((error: any) => {
            if (error?.response?.status === 404) return null
            throw error
          }),
        api.get<TopicTemplate[]>(`/api/topics/${topicId}/templates`),
        api.get<DeletionAuditEvent[]>(`/api/topics/${topicId}/audit-events`),
      ])
      setDraft(draftRes)
      setTemplates(templateRes.data)
      setAuditEvents(auditRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [topicId])

  const analyze = async () => {
    if (!topicId) return
    if (!files.length) {
      alert('请至少选择一个 DOCX 或 PDF 文件')
      return
    }

    const form = new FormData()
    files.forEach((file) => form.append('files', file))

    setAnalyzing(true)
    setMessage('')
    try {
      const res = await api.post<TopicAnalyzeResponse>(`/api/topics/${topicId}/analyze`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setDraft(res.data.draft)
      setMessage('分析完成。训练文件未落盘，仅保留审计元数据。')
      await load()
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '分析失败'
      alert(String(detail))
    } finally {
      setAnalyzing(false)
    }
  }

  const revise = async () => {
    if (!topicId) return
    const text = instruction.trim()
    if (!text) {
      alert('请输入修订指令')
      return
    }

    const patch = bodyFontFamily.trim() ? { body: { fontFamily: bodyFontFamily.trim() } } : undefined
    const userMessage: RevisionMessage = { role: 'user', content: text }
    setRevising(true)
    setMessage('')
    try {
      const res = await api.post<TopicDraft>(`/api/topics/${topicId}/agent/revise`, {
        instruction: text,
        patch,
        useDeepSeek,
        conversation: useDeepSeek ? conversation : [],
      })
      setDraft(res.data)
      if (useDeepSeek) {
        const nextConversation = [...conversation, userMessage]
        const assistantReply = (res.data.agentSummary || '').trim()
        if (assistantReply) {
          nextConversation.push({ role: 'assistant', content: assistantReply })
        }
        setConversation(nextConversation)
      }
      setMessage(useDeepSeek ? 'DeepSeek 已生成新的修订草稿版本。' : '已生成新的修订草稿版本。')
      setInstruction('')
      setBodyFontFamily('')
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '修订失败'
      alert(String(detail))
    } finally {
      setRevising(false)
    }
  }

  const confirmTemplate = async () => {
    if (!topicId) return
    setConfirming(true)
    setMessage('')
    try {
      const res = await api.post<TopicConfirmResponse>(`/api/topics/${topicId}/confirm-template`)
      setMessage(`模板 v${res.data.template.version} 已确认并生效。`)
      await load()
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '确认模板失败'
      alert(String(detail))
    } finally {
      setConfirming(false)
    }
  }

  const deleteTemplate = async (template: TopicTemplate) => {
    if (!topicId) return
    const confirmed = window.confirm(
      `确认删除模板 v${template.version}${template.effective ? '（当前生效）' : ''}？`,
    )
    if (!confirmed) return

    setDeletingTemplateId(template.id)
    setMessage('')
    try {
      await api.delete(`/api/topics/${topicId}/templates/${template.id}`)
      setMessage(`模板 v${template.version} 已删除。`)
      await load()
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '删除模板失败'
      alert(String(detail))
    } finally {
      setDeletingTemplateId(null)
    }
  }

  const rulesNarrative = draft ? summarizeRulesAsNarrative(draft.inferredRules) : []
  const confidenceNarrative = draft ? summarizeConfidenceAsNarrative(draft.confidenceReport) : []

  return (
    <div className="page">
      <div className="header-row">
        <h2>模板训练</h2>
      </div>

      <div className="unit-editor-card">
        <strong>题材 ID：{topicId}</strong>
        <span>模式：零留存（仅审计元数据）</span>
      </div>

      <div className="panel">
        <h3>1）上传并分析训练材料</h3>
        <div className="row-gap">
          <input type="file" multiple accept=".docx,.pdf,application/pdf" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          <button type="button" onClick={() => void analyze()} disabled={analyzing || loading}>
            {analyzing ? '分析中...' : '开始分析'}
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>2）智能体修订模板草稿</h3>
        <label>
          修订指令
          <textarea
            rows={3}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="例如：正文改为宋体，保持标题层级不变"
          />
        </label>
        <label>
          正文字体（可选）
          <input value={bodyFontFamily} onChange={(e) => setBodyFontFamily(e.target.value)} placeholder="例如：宋体" />
        </label>
        <label className="checkbox-inline">
          <input type="checkbox" checked={useDeepSeek} onChange={(e) => setUseDeepSeek(e.target.checked)} />
          使用 DeepSeek 对话修订
        </label>
        {useDeepSeek ? (
          <div>
            <div className="row-gap">
              <strong>对话上下文</strong>
              <button type="button" onClick={() => setConversation([])} disabled={revising || conversation.length === 0}>
                清空对话
              </button>
            </div>
            {conversation.length === 0 ? (
              <p>当前无历史对话，首次指令会作为对话起点。</p>
            ) : (
              <ul className="narrative-list">
                {conversation.map((item, idx) => (
                  <li key={`${idx}-${item.role}-${item.content.slice(0, 16)}`}>
                    {item.role === 'user' ? '你' : 'DeepSeek'}：{item.content}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        <div className="row-gap">
          <button type="button" onClick={() => void revise()} disabled={revising || !draft}>
            {revising ? '修订中...' : '生成修订草稿'}
          </button>
          <button type="button" onClick={() => void confirmTemplate()} disabled={confirming || !draft}>
            {confirming ? '确认中...' : '确认并保存模板'}
          </button>
        </div>
      </div>

      {message ? <div className="unit-editor-card">{message}</div> : null}

      <div className="editor-layout">
        <div className="panel">
          <h3>最新草稿</h3>
          {loading ? (
            <p>加载中...</p>
          ) : draft ? (
            <>
              <p>版本：v{draft.version}</p>
              <p>状态：{DRAFT_STATUS_LABEL[draft.status] || draft.status}</p>
              <p>摘要：{draft.agentSummary || '-'}</p>
              <ul className="narrative-list">
                {rulesNarrative.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>暂无草稿。</p>
          )}
        </div>

        <div className="panel">
          <h3>置信度报告</h3>
          {draft ? (
            <ul className="narrative-list">
              {confidenceNarrative.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p>暂无数据。</p>
          )}
        </div>

        <div className="panel">
          <h3>模板版本</h3>
          {templates.length === 0 ? (
            <p>暂无已确认模板。</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>版本</th>
                  <th>是否生效</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((item) => (
                  <tr key={item.id}>
                    <td>v{item.version}</td>
                    <td>{item.effective ? '是' : '否'}</td>
                    <td>{formatServerDateTime(item.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => void deleteTemplate(item)}
                        disabled={deletingTemplateId === item.id}
                      >
                        {deletingTemplateId === item.id ? '删除中...' : '删除'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel">
        <h3>训练材料删除审计</h3>
        {auditEvents.length === 0 ? (
          <p>暂无审计事件。</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>状态</th>
                <th>文件数</th>
                <th>总字节</th>
                <th>错误码</th>
                <th>结束时间</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map((event) => (
                <tr key={event.id}>
                  <td>{AUDIT_STATUS_LABEL[event.status] || event.status}</td>
                  <td>{event.fileCount}</td>
                  <td>{event.totalBytes}</td>
                  <td>{event.errorCode || '-'}</td>
                  <td>{formatServerDateTime(event.endedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
