import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useParams } from 'react-router-dom'

import { api } from '../api/client'
import type { DeletionAuditEvent, TopicAnalyzeResponse, TopicConfirmResponse, TopicDraft, TopicTemplate } from '../api/types'
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

type FeedbackKind = 'success' | 'error'

export type TemplateOperation = 'analyze' | 'revise' | 'confirm' | 'delete'

export function acquireTemplateOperation(
  currentOperation: TemplateOperation | null,
  requestedOperation: TemplateOperation,
) {
  if (currentOperation) {
    return { acquired: false as const, activeOperation: currentOperation }
  }

  return { acquired: true as const, activeOperation: requestedOperation }
}

export function resolveInstructionAfterRevision(currentInstruction: string, submittedInstruction: string) {
  return currentInstruction === submittedInstruction ? '' : currentInstruction
}

export function formatRefreshFailureFeedback(successMessage: string, refreshError: string) {
  const normalizedSuccess = successMessage.trim().replace(/[。！!]+$/, '')
  const normalizedError = refreshError.trim().replace(/[。！!]+$/, '')
  return `操作已成功：${normalizedSuccess}。但页面数据刷新失败：${normalizedError}。请手动刷新后确认最新状态。`
}

type OperationProgressProps = {
  id: string
  label: string
  elapsedSeconds: number
}

export function OperationProgress({ id, label, elapsedSeconds }: OperationProgressProps) {
  const announcedSeconds = Math.floor(elapsedSeconds / 10) * 10
  return (
    <>
      <p id={id} className="topic-revision-hint">
        {label}，已等待 {elapsedSeconds} 秒，请稍候。
      </p>
      <span className="summary-operation-announcement" role="status" aria-live="polite" aria-atomic="true">
        {announcedSeconds > 0 ? `${label}，已等待约 ${announcedSeconds} 秒。` : `${label}。`}
      </span>
    </>
  )
}

type TemplateVersionSummaryProps = {
  draftVersion?: number
  effectiveTemplateVersion?: number
}

export function TemplateVersionSummary({
  draftVersion,
  effectiveTemplateVersion,
}: TemplateVersionSummaryProps) {
  return (
    <>
      <span className="soft-pill">
        {draftVersion === undefined ? '尚未生成模板草稿' : `草稿版本 v${draftVersion}`}
      </span>
      <span className="soft-pill">
        {effectiveTemplateVersion === undefined
          ? '尚无生效模板'
          : `生效模板版本 v${effectiveTemplateVersion}`}
      </span>
    </>
  )
}

type DraftConfirmationButtonProps = {
  draftStatus?: string
  confirming: boolean
  operationBusy?: boolean
  progressId: string
  onConfirm: () => void
}

export function DraftConfirmationButton({
  draftStatus,
  confirming,
  operationBusy = confirming,
  progressId,
  onConfirm,
}: DraftConfirmationButtonProps) {
  const isConfirmed = draftStatus === 'confirmed'

  return (
    <button
      type="button"
      onClick={onConfirm}
      disabled={operationBusy || isConfirmed}
      aria-busy={confirming}
      aria-describedby={confirming ? progressId : undefined}
    >
      {isConfirmed ? '当前草稿已确认' : confirming ? '正在确认当前草稿…' : '确认当前草稿并保存模板'}
    </button>
  )
}

function useElapsedSeconds(active: boolean) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!active) {
      setElapsedSeconds(0)
      return
    }

    const startedAt = Date.now()
    setElapsedSeconds(0)
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [active])

  return elapsedSeconds
}

export function TopicDetailPage() {
  const { topicId = '' } = useParams()

  const [draft, setDraft] = useState<TopicDraft | null>(null)
  const [templates, setTemplates] = useState<TopicTemplate[]>([])
  const [auditEvents, setAuditEvents] = useState<DeletionAuditEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [activeOperation, setActiveOperation] = useState<TemplateOperation | null>(null)
  const activeOperationRef = useRef<TemplateOperation | null>(null)
  const mountedRef = useRef(true)
  const loadRequestRef = useRef(0)
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [instruction, setInstruction] = useState('')
  const [useDeepSeek, setUseDeepSeek] = useState(true)
  const [conversation, setConversation] = useState<RevisionMessage[]>([])
  const [message, setMessage] = useState('')
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind>('success')
  const analyzing = activeOperation === 'analyze'
  const revising = activeOperation === 'revise'
  const confirming = activeOperation === 'confirm'
  const operationBusy = activeOperation !== null
  const analyzingSeconds = useElapsedSeconds(analyzing)
  const revisingSeconds = useElapsedSeconds(revising)
  const confirmingSeconds = useElapsedSeconds(confirming)

  const clearFeedback = () => setMessage('')
  const showSuccess = (text: string) => {
    setFeedbackKind('success')
    setMessage(text)
  }
  const showError = (text: string) => {
    setFeedbackKind('error')
    setMessage(text)
  }

  const beginOperation = (operation: TemplateOperation) => {
    const decision = acquireTemplateOperation(activeOperationRef.current, operation)
    if (!decision.acquired) return false

    activeOperationRef.current = decision.activeOperation
    setActiveOperation(decision.activeOperation)
    return true
  }

  const endOperation = (operation: TemplateOperation) => {
    if (activeOperationRef.current !== operation) return
    activeOperationRef.current = null
    setActiveOperation(null)
  }

  const load = async () => {
    if (!topicId) return
    const requestId = ++loadRequestRef.current
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
      if (!mountedRef.current || requestId !== loadRequestRef.current) return
      setDraft(draftRes)
      setTemplates(templateRes.data)
      setAuditEvents(auditRes.data)
    } finally {
      if (mountedRef.current && requestId === loadRequestRef.current) {
        setLoading(false)
      }
    }
  }

  const refreshAfterSuccessfulOperation = async (successMessage: string) => {
    showSuccess(successMessage)
    try {
      await load()
    } catch (error: any) {
      showError(
        formatRefreshFailureFeedback(
          successMessage,
          getApiErrorMessage(error, '未知错误'),
        ),
      )
    }
  }

  useEffect(() => {
    mountedRef.current = true
    void load().catch((error: any) => {
      if (!mountedRef.current) return
      showError(`模板数据加载失败：${getApiErrorMessage(error, '请检查网络后重试')}`)
    })
    return () => {
      mountedRef.current = false
      loadRequestRef.current += 1
    }
  }, [topicId])

  const analyze = async () => {
    if (!topicId) return
    if (!files.length) {
      alert('请至少选择一个 DOCX 或 PDF 文件')
      return
    }

    const form = new FormData()
    files.forEach((file) => form.append('files', file))
    if (!beginOperation('analyze')) return

    clearFeedback()
    try {
      const res = await api.post<TopicAnalyzeResponse>(`/api/management/topics/${topicId}/analyze`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setDraft(res.data.draft)
      await refreshAfterSuccessfulOperation(
        `已从样本生成草稿版本 v${res.data.draft.version}。训练文件未落盘，仅保留审计元数据。`,
      )
    } catch (error: any) {
      showError(`样本分析失败：${formatApiErrorDetail(error?.response?.data?.detail, '请检查文件后重试')}`)
    } finally {
      endOperation('analyze')
    }
  }

  const revise = async () => {
    if (!topicId) return
    const submittedInstruction = instruction
    const text = submittedInstruction.trim()
    if (!text) {
      alert('请输入修订指令')
      return
    }
    if (!beginOperation('revise')) return

    const requestUsesDeepSeek = useDeepSeek
    const requestConversation = requestUsesDeepSeek ? conversation : []
    const userMessage: RevisionMessage = { role: 'user', content: text }
    clearFeedback()
    try {
      const res = await api.post<TopicDraft>(`/api/management/topics/${topicId}/agent/revise`, {
        instruction: text,
        useDeepSeek: requestUsesDeepSeek,
        conversation: requestConversation,
      })
      setDraft(res.data)
      if (requestUsesDeepSeek) {
        const nextConversation = [...requestConversation, userMessage]
        const assistantReply = (res.data.agentSummary || '').trim()
        if (assistantReply) {
          nextConversation.push({ role: 'assistant', content: assistantReply })
        }
        setConversation(nextConversation)
      }
      showSuccess(
        `${requestUsesDeepSeek ? 'DeepSeek ' : ''}已生成草稿版本 v${res.data.version}${draft ? '，并完成当前规则修订' : ''}。`,
      )
      setInstruction((currentInstruction) =>
        resolveInstructionAfterRevision(currentInstruction, submittedInstruction),
      )
    } catch (error: any) {
      showError(
        `模板草稿修订失败：${getApiErrorMessage(
          error,
          '请稍后重试',
          '修订请求超时，请稍后查看最新草稿是否已生成，或检查后端网络与 DeepSeek 配置。',
        )}`,
      )
    } finally {
      endOperation('revise')
    }
  }

  const confirmTemplate = async () => {
    if (!topicId || !draft || draft.status === 'confirmed') return
    if (!beginOperation('confirm')) return

    const draftToConfirm = draft
    clearFeedback()
    try {
      const res = await api.post<TopicConfirmResponse>(`/api/management/topics/${topicId}/confirm-template`)
      setDraft((currentDraft) =>
        currentDraft?.id === draftToConfirm.id ? { ...currentDraft, status: 'confirmed' } : currentDraft,
      )
      setTemplates((currentTemplates) => [
        res.data.template,
        ...currentTemplates
          .filter((template) => template.id !== res.data.template.id)
          .map((template) => ({ ...template, effective: false })),
      ])
      await refreshAfterSuccessfulOperation(
        `草稿版本 v${draftToConfirm.version} 已确认，生效模板版本 v${res.data.template.version} 已生效。`,
      )
    } catch (error: any) {
      showError(`确认草稿失败：${formatApiErrorDetail(error?.response?.data?.detail, '请稍后重试')}`)
    } finally {
      endOperation('confirm')
    }
  }

  const deleteTemplate = async (template: TopicTemplate) => {
    if (!topicId) return
    if (activeOperationRef.current) return
    const confirmed = window.confirm(
      `确认删除已确认模板版本 v${template.version}${template.effective ? '（当前生效模板）' : ''}？`,
    )
    if (!confirmed) return
    if (!beginOperation('delete')) return

    setDeletingTemplateId(template.id)
    clearFeedback()
    try {
      await api.delete(`/api/management/topics/${topicId}/templates/${template.id}`)
      setTemplates((currentTemplates) => currentTemplates.filter((item) => item.id !== template.id))
      await refreshAfterSuccessfulOperation(`已确认模板版本 v${template.version} 已删除。`)
    } catch (error: any) {
      showError(`删除已确认模板失败：${formatApiErrorDetail(error?.response?.data?.detail, '请稍后重试')}`)
    } finally {
      setDeletingTemplateId(null)
      endOperation('delete')
    }
  }

  const rulesNarrative = draft ? summarizeRulesAsNarrative(draft.inferredRules) : []
  const confidenceNarrative = draft ? summarizeConfidenceAsNarrative(draft.confidenceReport) : []
  const hasDraft = Boolean(draft)
  const hasConversation = conversation.length > 0
  const hasConfidenceData = Boolean(draft && Object.keys(draft.confidenceReport || {}).length > 0)
  const effectiveTemplate = templates.find((template) => template.effective)
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
    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey) || operationBusy || loading) return
    event.preventDefault()
    void revise()
  }

  return (
    <main className="page workspace-page module-workbench-page module-workbench-page-management">
      {message ? (
        <div
          className="inline-status-card"
          role={feedbackKind === 'error' ? 'alert' : 'status'}
          aria-live={feedbackKind === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {message}
        </div>
      ) : null}

      <section className="workspace-grid workspace-grid-two">
        <div className="panel topic-training-panel" aria-busy={revising}>
          <div className="topic-training-header">
            <h3>{revisionPanelTitle}</h3>
            <p>核心流程只保留一条：输入规范要求，生成草稿，再确认保存模板。</p>
          </div>
          <div className="row-gap">
            <TemplateVersionSummary
              draftVersion={draft?.version}
              effectiveTemplateVersion={effectiveTemplate?.version}
            />
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
                <button type="button" className="topic-inline-action" onClick={() => setConversation([])} disabled={operationBusy}>
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
              disabled={operationBusy || loading}
              aria-busy={revising}
              aria-describedby={revising ? 'template-revision-progress' : undefined}
            >
              {revising ? '正在生成草稿版本…' : revisionSubmitLabel}
            </button>
            <p className="topic-revision-hint">{revisionHint}</p>
            {revising ? (
              <OperationProgress
                id="template-revision-progress"
                label="模板草稿修订进行中"
                elapsedSeconds={revisingSeconds}
              />
            ) : null}
          </div>
        </div>

        <div className="panel topic-training-panel secondary" aria-busy={analyzing}>
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
          <button
            type="button"
            onClick={() => void analyze()}
            disabled={operationBusy || loading || files.length === 0}
            aria-busy={analyzing}
            aria-describedby={analyzing ? 'sample-analysis-progress' : undefined}
          >
            {analyzing ? '正在分析样本…' : hasDraft ? '从样本生成新的草稿版本' : '从样本生成首版草稿'}
          </button>
          {analyzing ? (
            <OperationProgress
              id="sample-analysis-progress"
              label="样本规则分析进行中"
              elapsedSeconds={analyzingSeconds}
            />
          ) : null}
        </div>
      </section>

      <section className="workspace-grid workspace-grid-two">
        <div className="panel" aria-busy={confirming}>
          <h3>最新模板草稿</h3>
          {loading ? (
            <p>加载中...</p>
          ) : draft ? (
            <>
              <div className="topic-draft-meta">
                <span className="soft-pill">草稿版本 v{draft.version}</span>
                <span className="soft-pill">草稿状态：{DRAFT_STATUS_LABEL[draft.status] || draft.status}</span>
              </div>
              <p>摘要：{draft.agentSummary || '-'}</p>
              <div className="row-gap">
                <DraftConfirmationButton
                  draftStatus={draft.status}
                  confirming={confirming}
                  operationBusy={operationBusy || loading}
                  progressId="template-confirmation-progress"
                  onConfirm={() => void confirmTemplate()}
                />
              </div>
              {confirming ? (
                <OperationProgress
                  id="template-confirmation-progress"
                  label="正在确认草稿并更新生效模板"
                  elapsedSeconds={confirmingSeconds}
                />
              ) : null}
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
          <h3>已确认模板版本</h3>
          {templates.length === 0 ? (
            <p>暂无已确认模板。</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>模板版本</th>
                  <th>生效状态</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((item) => (
                  <tr key={item.id}>
                    <td>模板版本 v{item.version}</td>
                    <td>{item.effective ? '当前生效' : '未生效'}</td>
                    <td>{formatServerDateTime(item.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => void deleteTemplate(item)}
                        disabled={operationBusy || loading}
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
