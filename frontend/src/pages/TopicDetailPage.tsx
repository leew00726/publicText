import { useEffect, useState, type KeyboardEvent } from 'react'
import { useParams } from 'react-router-dom'

import { api } from '../api/client'
import type { DeletionAuditEvent, TopicAnalyzeResponse, TopicConfirmResponse, TopicDraft, TopicTemplate } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import { formatApiErrorDetail, getApiErrorMessage } from '../utils/apiError'
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
  const [useDeepSeek, setUseDeepSeek] = useState(true)
  const [conversation, setConversation] = useState<RevisionMessage[]>([])
  const [message, setMessage] = useState('')

  const load = async () => {
    if (!topicId) return
    setLoading(true)
    try {
      const [draftRes, templateRes, auditRes] = await Promise.all([
        api
          .get<TopicDraft>(`/api/management/topics/${topicId}/drafts/latest`)
          .then((res) => res.data)
          .catch((error: any) => {
            if (error?.response?.status === 404) return null
            throw error
          }),
        api.get<TopicTemplate[]>(`/api/management/topics/${topicId}/templates`),
        api.get<DeletionAuditEvent[]>(`/api/management/topics/${topicId}/audit-events`),
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
      const res = await api.post<TopicAnalyzeResponse>(`/api/management/topics/${topicId}/analyze`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setDraft(res.data.draft)
      setMessage('分析完成。训练文件未落盘，仅保留审计元数据。')
      await load()
    } catch (error: any) {
      alert(formatApiErrorDetail(error?.response?.data?.detail, '分析失败'))
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

    const userMessage: RevisionMessage = { role: 'user', content: text }
    setRevising(true)
    setMessage('')
    try {
      const res = await api.post<TopicDraft>(`/api/management/topics/${topicId}/agent/revise`, {
        instruction: text,
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
      setMessage(
        draft
          ? useDeepSeek
            ? 'DeepSeek 已基于当前草稿生成新的修订版本。'
            : '已基于当前草稿生成新的修订版本。'
          : useDeepSeek
            ? 'DeepSeek 已根据文字要求生成首版模板草稿。'
            : '已根据文字要求生成首版模板草稿。',
      )
      setInstruction('')
    } catch (error: any) {
      alert(
        getApiErrorMessage(
          error,
          '修订失败',
          '修订请求超时，请稍后查看最新草稿是否已生成，或检查后端网络与 DeepSeek 配置。',
        ),
      )
    } finally {
      setRevising(false)
    }
  }

  const confirmTemplate = async () => {
    if (!topicId) return
    setConfirming(true)
    setMessage('')
    try {
      const res = await api.post<TopicConfirmResponse>(`/api/management/topics/${topicId}/confirm-template`)
      setMessage(`模板 v${res.data.template.version} 已确认并生效。`)
      await load()
    } catch (error: any) {
      alert(formatApiErrorDetail(error?.response?.data?.detail, '确认模板失败'))
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
      await api.delete(`/api/management/topics/${topicId}/templates/${template.id}`)
      setMessage(`模板 v${template.version} 已删除。`)
      await load()
    } catch (error: any) {
      alert(formatApiErrorDetail(error?.response?.data?.detail, '删除模板失败'))
    } finally {
      setDeletingTemplateId(null)
    }
  }

  const rulesNarrative = draft ? summarizeRulesAsNarrative(draft.inferredRules) : []
  const confidenceNarrative = draft ? summarizeConfidenceAsNarrative(draft.confidenceReport) : []
  const hasDraft = Boolean(draft)
  const hasConversation = conversation.length > 0
  const hasConfidenceData = Boolean(draft && Object.keys(draft.confidenceReport || {}).length > 0)
  const revisionPanelTitle = hasDraft ? '继续修订当前模板草稿' : '推荐：直接生成首版模板草稿'
  const revisionSubmitLabel = !hasDraft
    ? '生成首版模板草稿'
    : useDeepSeek
      ? '基于当前草稿继续修订'
      : '生成新的草稿版本'
  const revisionHint = !draft
    ? useDeepSeek
      ? '无需先上传文件。先用文字描述模板规范，再点击主按钮让 DeepSeek 生成首版草稿。支持 Ctrl+Enter / Cmd+Enter。'
      : '无需先上传文件。先用文字描述模板规范，再点击主按钮生成首版草稿。支持 Ctrl+Enter / Cmd+Enter。'
    : useDeepSeek
      ? '当前会基于最新草稿继续修订，并自动带上本轮 DeepSeek 对话上下文。支持 Ctrl+Enter / Cmd+Enter。'
      : '当前会基于最新草稿继续修订，并生成一个新的草稿版本。支持 Ctrl+Enter / Cmd+Enter。'

  const handleInstructionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey) || revising) return
    event.preventDefault()
    void revise()
  }

  return (
    <main className="page workspace-page">
      <PageHeader
        eyebrow="Training"
        title="模板训练"
        description="先用文字要求快速生成首版模板草稿；手头有标准样稿时，再补充样本分析校准规则。"
        meta={
          <>
            <span className="soft-pill">题材 ID {topicId}</span>
            <span className="soft-pill">零留存模式</span>
            <span className="soft-pill">模板数 {templates.length}</span>
          </>
        }
      />

      {message ? <div className="inline-status-card">{message}</div> : null}

      <section className="workspace-grid workspace-grid-two">
        <div className="panel topic-training-panel">
          <div className="topic-training-header">
            <h3>{revisionPanelTitle}</h3>
            <p>核心流程只保留一条：输入规范要求，生成草稿，再确认保存模板。</p>
          </div>
          <div className="row-gap">
            <span className="soft-pill">{hasDraft ? `当前草稿 v${draft?.version}` : '尚未生成草稿'}</span>
            <span className="soft-pill">{useDeepSeek ? 'DeepSeek 已开启' : '本地规则模式'}</span>
          </div>
          <label>
            修订指令
            <textarea
              rows={3}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={handleInstructionKeyDown}
              maxLength={500}
              placeholder="例如：正文改为宋体，保持标题层级不变"
            />
          </label>
          <label className="checkbox-inline">
            <input type="checkbox" checked={useDeepSeek} onChange={(e) => setUseDeepSeek(e.target.checked)} />
            启用 DeepSeek 智能修订
          </label>
          {useDeepSeek && hasConversation ? (
            <div className="topic-history-card">
              <div className="row-between">
                <strong>当前对话上下文</strong>
                <button type="button" className="topic-inline-action" onClick={() => setConversation([])} disabled={revising}>
                  重新开始对话
                </button>
              </div>
              <ul className="narrative-list">
                {conversation.map((item, idx) => (
                  <li key={`${idx}-${item.role}-${item.content.slice(0, 16)}`}>
                    {item.role === 'user' ? '你' : 'DeepSeek'}：{item.content}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="topic-revision-actions">
            <button
              type="button"
              className="topic-revision-submit"
              onClick={() => void revise()}
              disabled={revising}
            >
              {revising ? '生成中...' : revisionSubmitLabel}
            </button>
            <p className="topic-revision-hint">{revisionHint}</p>
          </div>
        </div>

        <div className="panel topic-training-panel secondary">
          <div className="topic-training-header">
            <h3>补充：从样本提取规则</h3>
            <p>仅在你手头已有标准样稿时使用。样本分析会生成新的草稿版本，适合作为文字训练后的补充校准。</p>
          </div>
          <div className="row-gap">
            <input type="file" multiple accept=".docx,.pdf,application/pdf" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          </div>
          <p className="topic-revision-hint">
            {files.length > 0 ? `已选择 ${files.length} 个文件。` : '1）上传并分析训练材料（可选）'}
          </p>
          <button type="button" onClick={() => void analyze()} disabled={analyzing || loading || files.length === 0}>
            {analyzing ? '分析中...' : hasDraft ? '从样本生成新的草稿版本' : '从样本生成首版草稿'}
          </button>
        </div>
      </section>

      <section className="workspace-grid workspace-grid-two">
        <div className="panel">
          <h3>最新草稿</h3>
          {loading ? (
            <p>加载中...</p>
          ) : draft ? (
            <>
              <div className="topic-draft-meta">
                <span className="soft-pill">版本 v{draft.version}</span>
                <span className="soft-pill">状态 {DRAFT_STATUS_LABEL[draft.status] || draft.status}</span>
              </div>
              <p>摘要：{draft.agentSummary || '-'}</p>
              <div className="row-gap">
                <button type="button" onClick={() => void confirmTemplate()} disabled={confirming}>
                  {confirming ? '确认中...' : '确认当前草稿并保存模板'}
                </button>
              </div>
              <h4>规则摘要</h4>
              <ul className="narrative-list">
                {rulesNarrative.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {hasConfidenceData ? (
                <>
                  <h4>置信度参考</h4>
                  <ul className="narrative-list">
                    {confidenceNarrative.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          ) : (
            <p>还没有草稿。直接输入文字要求生成首版模板，或在右侧补充上传样本分析。</p>
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
      </section>

      {auditEvents.length > 0 ? (
        <section className="panel">
          <h3>训练材料删除审计</h3>
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
        </section>
      ) : null}
    </main>
  )
}
