import { DragEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useInRouterContext, useLocation, useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { Topic, TopicTemplate } from '../api/types'
import { isSupportedSummaryFileName, suggestSummaryExportTitle } from '../utils/documentSummary'
import { loadEmployeeSession } from '../utils/employeeAuth'
import { pickDefaultTopicTemplateId } from '../utils/topicCompose'

type SummaryLength = 'short' | 'medium' | 'long'
type SummarySourceMode = 'file' | 'text'
type AgentMessage = {
  role: 'user' | 'assistant'
  content: string
}

type SummaryExportTemplateOption = {
  id: string
  topicId: string
  topicName: string
  version: number
  effective: boolean
}

type SummaryApiResponse = {
  message: string
  provider: 'deepseek'
  model: string
  usage: Record<string, any>
  summaryLength: SummaryLength
  source: {
    fileName: string
    fileType: string
    originalChars: number
    usedChars: number
    truncated: boolean
  }
  summary: string
  knowledgeReferences?: Array<Record<string, any>>
}

type SummaryRouteState = {
  useKnowledgeBase?: boolean
  knowledgeSource?: {
    label?: string
    documentCount?: number
  }
}

type DocumentSummaryWorkspaceProps = {
  initialUseKnowledgeBase?: boolean
  knowledgeSourceContext?: string
}

export function getNextSummarySourceMode(currentMode: SummarySourceMode, key: string): SummarySourceMode | null {
  if (key === 'Home') return 'file'
  if (key === 'End') return 'text'
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    return currentMode === 'file' ? 'text' : 'file'
  }
  return null
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
    const intervalId = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [active])

  return elapsedSeconds
}

function SummaryOperationStatus({ message, announcement }: { message: string; announcement: string }) {
  return (
    <>
      <p className="summary-operation-status">{message}</p>
      <span className="summary-operation-announcement" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </>
  )
}

function KnowledgeBaseEntryButton({ disabled = false }: { disabled?: boolean }) {
  const inRouter = useInRouterContext()
  if (inRouter) {
    return <KnowledgeBaseRouterEntryButton disabled={disabled} />
  }

  return (
    <button type="button" className="secondary-button" onClick={() => window.location.assign('/knowledge')} disabled={disabled}>
      进入知识库
    </button>
  )
}

function KnowledgeBaseRouterEntryButton({ disabled = false }: { disabled?: boolean }) {
  const navigate = useNavigate()
  return (
    <button type="button" className="secondary-button" onClick={() => navigate('/knowledge')} disabled={disabled}>
      进入知识库
    </button>
  )
}

export function DocumentSummaryPage() {
  const inRouter = useInRouterContext()
  return inRouter ? <RoutedDocumentSummaryPage /> : <DocumentSummaryWorkspace />
}

function RoutedDocumentSummaryPage() {
  const location = useLocation()
  const routeState = (location.state as SummaryRouteState | null) || null
  const documentCount = routeState?.knowledgeSource?.documentCount
  const sourceLabel = routeState?.knowledgeSource?.label?.trim() || '云矩知识库'
  const knowledgeSourceContext = routeState?.useKnowledgeBase
    ? typeof documentCount === 'number'
      ? `写作来源：${sourceLabel} · 当前可调用 ${documentCount} 份材料`
      : `写作来源：${sourceLabel}`
    : ''

  return (
    <DocumentSummaryWorkspace
      key={location.key}
      initialUseKnowledgeBase={Boolean(routeState?.useKnowledgeBase)}
      knowledgeSourceContext={knowledgeSourceContext}
    />
  )
}

function DocumentSummaryWorkspace({
  initialUseKnowledgeBase = false,
  knowledgeSourceContext = '',
}: DocumentSummaryWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const employeeSession = useMemo(() => loadEmployeeSession(), [])
  const [dragging, setDragging] = useState(false)
  const [sourceMode, setSourceMode] = useState<SummarySourceMode>('file')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [sourceText, setSourceText] = useState('')
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(initialUseKnowledgeBase)
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('medium')
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([])
  const [agentDraft, setAgentDraft] = useState('')
  const [summary, setSummary] = useState('')
  const [resultMeta, setResultMeta] = useState<SummaryApiResponse | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [feedbackTarget, setFeedbackTarget] = useState<'input' | 'output'>('input')
  const [templateOptions, setTemplateOptions] = useState<SummaryExportTemplateOption[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templatesLoading, setTemplatesLoading] = useState(false)

  const normalizedSourceText = sourceText.trim()
  const activeInstruction = useMemo(() => {
    const staged = agentDraft.trim()
    const messages = staged ? [...agentMessages, { role: 'user' as const, content: staged }] : agentMessages
    return messages
      .filter((item) => item.role === 'user')
      .map((item) => item.content.trim())
      .filter(Boolean)
      .join('\n')
  }, [agentDraft, agentMessages])
  const canSummarize =
    (useKnowledgeBase
      ? Boolean(activeInstruction)
      : Boolean(sourceMode === 'file' ? selectedFile : normalizedSourceText)) &&
    !summarizing &&
    !exporting
  const canExport =
    summary.trim().length > 0 &&
    !exporting &&
    !summarizing &&
    !templatesLoading &&
    (templateOptions.length === 0 || Boolean(selectedTemplateId))
  const inputControlsLocked = summarizing || exporting
  const showGeneratedSummary = Boolean(summary.trim() || resultMeta)
  const elapsedSeconds = useElapsedSeconds(summarizing || exporting)
  const activeOperationLabel = summarizing
    ? useKnowledgeBase
      ? '正在调用知识库写作'
      : '正在生成总结'
    : exporting
      ? '正在导出总结'
      : ''
  const activeOperationDetail = summarizing
    ? showGeneratedSummary
      ? '当前结果已锁定'
      : '完成后将在右侧显示结果'
    : exporting
      ? '导出内容与模板已锁定'
      : ''
  const activeOperationMessage = activeOperationLabel
    ? `${activeOperationLabel}，已等待 ${elapsedSeconds} 秒；${activeOperationDetail}`
    : ''
  const announcedElapsedSeconds = Math.floor(elapsedSeconds / 10) * 10
  const activeOperationAnnouncement = activeOperationLabel
    ? announcedElapsedSeconds > 0
      ? `${activeOperationLabel}，已等待约 ${announcedElapsedSeconds} 秒。`
      : `${activeOperationLabel}。`
    : ''
  const userRequirements = useMemo(
    () =>
      agentMessages
        .map((message, index) => ({ message, index }))
        .filter(({ message }) => message.role === 'user' && Boolean(message.content.trim())),
    [agentMessages],
  )

  const usageSummary = useMemo(() => {
    if (!resultMeta) return ''
    const totalTokens = resultMeta.usage?.total_tokens
    return typeof totalTokens === 'number' ? `Token 消耗：${totalTokens}` : ''
  }, [resultMeta])

  useEffect(() => {
    let cancelled = false

    const loadTemplates = async () => {
      const companyId = employeeSession?.companyId?.trim() || ''
      if (!companyId) {
        setTemplateOptions([])
        setSelectedTemplateId('')
        return
      }

      setTemplatesLoading(true)
      try {
        const topicsRes = await api.get<Topic[]>('/api/management/topics', {
          params: { companyId },
        })

        const templateGroups = await Promise.all(
          topicsRes.data.map(async (topic) => {
            const templateRes = await api.get<TopicTemplate[]>(`/api/management/topics/${topic.id}/templates`)
            return templateRes.data.map((template) => ({
              id: template.id,
              topicId: topic.id,
              topicName: topic.name,
              version: template.version,
              effective: template.effective,
            }))
          }),
        )

        if (cancelled) return

        const nextOptions = templateGroups
          .flat()
          .sort((left, right) => {
            if (left.effective !== right.effective) return left.effective ? -1 : 1
            if (left.topicName !== right.topicName) return left.topicName.localeCompare(right.topicName, 'zh-CN')
            return right.version - left.version
          })
        setTemplateOptions(nextOptions)
        setSelectedTemplateId((current) => {
          if (current && nextOptions.some((item) => item.id === current)) return current
          return pickDefaultTopicTemplateId(nextOptions)
        })
      } catch {
        if (cancelled) return
        setTemplateOptions([])
        setSelectedTemplateId('')
      } finally {
        if (!cancelled) {
          setTemplatesLoading(false)
        }
      }
    }

    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [employeeSession?.companyId])

  const pickFile = (file: File | null) => {
    if (inputControlsLocked) return
    if (!file) return
    if (!isSupportedSummaryFileName(file.name)) {
      setFeedbackTarget('input')
      setErrorMessage('仅支持 DOCX / PDF / TXT 文件')
      setStatusMessage('')
      return
    }
    setSelectedFile(file)
    setSourceMode('file')
    setFeedbackTarget('input')
    setErrorMessage('')
    setStatusMessage(`已选择文件：${file.name}`)
  }

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragging(false)
    if (summarizing || exporting) return
    const file = event.dataTransfer.files?.[0]
    pickFile(file || null)
  }

  const handleUploadKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (summarizing || exporting) return
    fileInputRef.current?.click()
  }

  const handleSourceTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (inputControlsLocked) return
    const nextMode = getNextSummarySourceMode(sourceMode, event.key)
    if (!nextMode) return
    event.preventDefault()
    setSourceMode(nextMode)
    document.getElementById(`summary-source-tab-${nextMode}`)?.focus()
  }

  const summarize = async () => {
    const stagedAgentInstruction = agentDraft.trim()
    const nextAgentMessages =
      stagedAgentInstruction.length > 0
        ? [...agentMessages, { role: 'user' as const, content: stagedAgentInstruction }]
        : agentMessages
    const extraInstruction = nextAgentMessages
      .filter((item) => item.role === 'user')
      .map((item) => item.content.trim())
      .filter(Boolean)
      .join('\n')

    if (useKnowledgeBase) {
      if (!extraInstruction) {
        setFeedbackTarget('input')
        setErrorMessage('请先填写写作要求，再调用知识库写作。')
        return
      }

      setSummarizing(true)
      setFeedbackTarget('input')
      setErrorMessage('')
      setStatusMessage('')
      setAgentMessages(nextAgentMessages)
      setAgentDraft('')
      try {
        const res = await api.post<SummaryApiResponse>('/api/layout/ai/draft-with-knowledge', {
          instruction: extraInstruction,
          summaryLength,
        }, {
          timeout: 180000,
        })
        setResultMeta(res.data)
        setSummary((res.data.summary || '').trim())
        setAgentMessages((current) => [
          ...current,
          {
            role: 'assistant',
            content: '已调阅云矩知识库生成材料。你可以继续补充要求后重新生成。',
          },
        ])
        if (!res.data.summary?.trim()) {
          setErrorMessage('生成结果为空，请重试。')
        } else {
          setStatusMessage('知识库写作已完成，可继续编辑或导出。')
        }
      } catch (error: any) {
        const detail = error?.response?.data?.detail
        if (typeof detail === 'string') {
          setErrorMessage(detail)
        } else {
          setErrorMessage('知识库写作失败，请检查 DeepSeek 配置或稍后重试。')
        }
      } finally {
        setSummarizing(false)
      }
      return
    }

    if (sourceMode === 'file' && !selectedFile) return
    if (sourceMode === 'text' && !normalizedSourceText) return

    const form = new FormData()
    if (sourceMode === 'file' && selectedFile) {
      form.append('file', selectedFile)
    }
    if (sourceMode === 'text') {
      form.append('sourceText', normalizedSourceText)
    }
    form.append('summaryLength', summaryLength)
    if (extraInstruction) {
      form.append('extraInstruction', extraInstruction)
    }

    setSummarizing(true)
    setFeedbackTarget('input')
    setErrorMessage('')
    setStatusMessage('')
    setAgentMessages(nextAgentMessages)
    setAgentDraft('')
    try {
      const res = await api.post<SummaryApiResponse>('/api/layout/ai/summarize-document', form, {
        timeout: 180000,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResultMeta(res.data)
      setSummary((res.data.summary || '').trim())
      setAgentMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: extraInstruction
            ? '已按当前要求生成总结。你可以继续补充格式要求后重新生成。'
            : '已按默认结构生成总结。你可以补充格式要求后重新生成。',
        },
      ])
      if (!res.data.summary?.trim()) {
        setErrorMessage('总结结果为空，请重试。')
      } else {
        setStatusMessage('总结已生成，可继续编辑或导出。')
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      if (typeof detail === 'string') {
        setErrorMessage(detail)
      } else {
        setErrorMessage('总结失败，请检查 DeepSeek 配置或稍后重试。')
      }
    } finally {
      setSummarizing(false)
    }
  }

  const exportDocx = async () => {
    const exportSummarySnapshot = summary.trim()
    if (!exportSummarySnapshot) return

    const exportSourceFileName = resultMeta
      ? resultMeta.source.fileName && resultMeta.source.fileName !== '直接粘贴文本'
        ? resultMeta.source.fileName
        : ''
      : sourceMode === 'file'
        ? selectedFile?.name || ''
        : ''
    const exportTemplateSnapshot = selectedTemplateId || null
    const title = suggestSummaryExportTitle(exportSourceFileName)
    setExporting(true)
    setFeedbackTarget('output')
    setErrorMessage('')
    setStatusMessage('')
    try {
      const res = await api.post(
        '/api/layout/ai/export-summary-docx',
        {
          title,
          summary: exportSummarySnapshot,
          sourceFileName: exportSourceFileName || null,
          topicTemplateId: exportTemplateSnapshot,
        },
        {
          responseType: 'blob',
        },
      )
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}.docx`
      a.click()
      URL.revokeObjectURL(url)
      setStatusMessage(`总结 DOCX 已开始下载：${title}.docx（已按点击导出时的内容与模板生成）`)
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      if (typeof detail === 'string') {
        setErrorMessage(detail)
      } else {
        setErrorMessage('导出失败，请稍后重试。')
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="page summary-page" aria-busy={summarizing || exporting}>
      <section className="summary-studio">
        <aside className="summary-sidebar">
          <article className="summary-control-card">
            <div className="summary-panel-header">
              <span className="summary-panel-index">01</span>
              <div className="summary-panel-copy">
                <strong>输入控制台</strong>
              </div>
            </div>

            <div className="summary-panel-body">
              <div className="summary-source-switch" role="tablist" aria-label="总结输入方式">
                <button
                  id="summary-source-tab-file"
                  type="button"
                  role="tab"
                  aria-selected={sourceMode === 'file'}
                  aria-controls="summary-source-panel-file"
                  tabIndex={sourceMode === 'file' ? 0 : -1}
                  className={`summary-source-tab ${sourceMode === 'file' ? 'active' : ''}`}
                  onClick={() => setSourceMode('file')}
                  onKeyDown={handleSourceTabKeyDown}
                  disabled={inputControlsLocked}
                >
                  上传文件
                </button>
                <button
                  id="summary-source-tab-text"
                  type="button"
                  role="tab"
                  aria-selected={sourceMode === 'text'}
                  aria-controls="summary-source-panel-text"
                  tabIndex={sourceMode === 'text' ? 0 : -1}
                  className={`summary-source-tab ${sourceMode === 'text' ? 'active' : ''}`}
                  onClick={() => setSourceMode('text')}
                  onKeyDown={handleSourceTabKeyDown}
                  disabled={inputControlsLocked}
                >
                  粘贴文本
                </button>
              </div>

              {sourceMode === 'file' ? (
                <section
                  id="summary-source-panel-file"
                  role="tabpanel"
                  aria-labelledby="summary-source-tab-file"
                  className="summary-source-panel"
                >
                  <div
                    className={`summary-drop-zone ${dragging ? 'dragging' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={selectedFile ? `更换总结文件，当前已选择 ${selectedFile.name}` : '选择需要总结的文件'}
                    aria-disabled={summarizing || exporting}
                    onClick={() => {
                      if (!summarizing && !exporting) fileInputRef.current?.click()
                    }}
                    onKeyDown={handleUploadKeyDown}
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
                    <p>{selectedFile ? `已选择：${selectedFile.name}` : '拖拽或点击选择文件'}</p>
                    <small>支持 DOCX / PDF / TXT，单文件 ≤ 20MB</small>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    aria-label="选择需要总结的文件"
                    accept=".docx,.pdf,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    disabled={inputControlsLocked}
                    style={{ display: 'none' }}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null
                      pickFile(file)
                      event.currentTarget.value = ''
                    }}
                  />
                </section>
              ) : (
                <section
                  id="summary-source-panel-text"
                  role="tabpanel"
                  aria-labelledby="summary-source-tab-text"
                  className="summary-source-panel summary-text-panel"
                >
                  <label htmlFor="summary-source-textarea">正文</label>
                  <textarea
                    id="summary-source-textarea"
                    value={sourceText}
                    rows={10}
                    placeholder="粘贴需要总结的正文"
                    disabled={inputControlsLocked}
                    onChange={(event) => {
                      setSourceText(event.target.value)
                      if (event.target.value.trim()) {
                        setSourceMode('text')
                      }
                    }}
                  />
                </section>
              )}

              <section className="summary-knowledge-bridge">
                <div className="summary-section-heading">
                  <strong>知识库调用</strong>
                </div>

                <label className="checkbox-inline summary-knowledge-toggle">
                  <input
                    type="checkbox"
                    checked={useKnowledgeBase}
                    disabled={inputControlsLocked}
                    onChange={(event) => setUseKnowledgeBase(event.target.checked)}
                  />
                  调用知识库写作
                </label>

                {useKnowledgeBase && knowledgeSourceContext ? (
                  <p className="summary-knowledge-context" role="status">
                    {knowledgeSourceContext}
                  </p>
                ) : null}
                <p className="summary-side-note">启用后将根据补充要求调阅云矩知识库生成材料。</p>
                <KnowledgeBaseEntryButton disabled={inputControlsLocked} />
              </section>

              <label>
                总结长度
                <select
                  value={summaryLength}
                  onChange={(event) => setSummaryLength(event.target.value as SummaryLength)}
                  disabled={inputControlsLocked}
                >
                  <option value="short">短（100-180字）</option>
                  <option value="medium">中（220-320字）</option>
                  <option value="long">长（380-520字）</option>
                </select>
              </label>

              <section className="summary-agent-card">
                <div className="summary-section-heading">
                  <strong>补充要求</strong>
                </div>

                <label htmlFor="summary-agent-draft">要求</label>
                <textarea
                  id="summary-agent-draft"
                  value={agentDraft}
                  rows={4}
                  placeholder="例如：突出结论、关键事项、时间节点。"
                  onChange={(event) => setAgentDraft(event.target.value)}
                  disabled={inputControlsLocked}
                />

                <div className="summary-requirement-list" aria-label="已添加的补充要求">
                  {userRequirements.length > 0 ? (
                    <ol>
                      {userRequirements.map(({ message, index }, displayIndex) => (
                        <li key={`${index}-${message.content}`}>
                          <span className="summary-requirement-index">{displayIndex + 1}</span>
                          <span>{message.content}</span>
                          <button
                            type="button"
                            className="secondary-button summary-requirement-remove"
                            aria-label={`删除补充要求 ${displayIndex + 1}`}
                            disabled={inputControlsLocked}
                            onClick={() => {
                              setAgentMessages((current) => current.filter((_, currentIndex) => currentIndex !== index))
                              setFeedbackTarget('input')
                              setStatusMessage(`已删除补充要求 ${displayIndex + 1}`)
                            }}
                          >
                            删除
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>尚未添加补充要求。</p>
                  )}
                </div>

                <div className="row-gap">
                  <button
                    type="button"
                    onClick={() => {
                      const next = agentDraft.trim()
                      if (!next) return
                      setAgentMessages((current) => [...current, { role: 'user', content: next }])
                      setAgentDraft('')
                      setFeedbackTarget('input')
                      setErrorMessage('')
                      setStatusMessage('已添加补充要求。')
                    }}
                    disabled={inputControlsLocked || !agentDraft.trim()}
                  >
                    添加
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setAgentMessages([])
                      setAgentDraft('')
                      setFeedbackTarget('input')
                      setStatusMessage('补充要求已清空。')
                    }}
                    disabled={inputControlsLocked || (agentMessages.length === 0 && !agentDraft.trim())}
                  >
                    清空
                  </button>
                </div>
              </section>

              <div className="row-gap">
                <button type="button" className="summary-primary-action" onClick={() => void summarize()} disabled={!canSummarize}>
                  {summarizing ? (useKnowledgeBase ? '写作中...' : '总结中...') : useKnowledgeBase ? '开始知识库写作' : '开始总结'}
                </button>
              </div>

              {feedbackTarget === 'input' && activeOperationMessage ? (
                <SummaryOperationStatus message={activeOperationMessage} announcement={activeOperationAnnouncement} />
              ) : null}
              {feedbackTarget === 'input' && statusMessage ? (
                <p className="summary-success" role="status" aria-live="polite">
                  {statusMessage}
                </p>
              ) : null}
              {feedbackTarget === 'input' && errorMessage ? (
                <p className="summary-error" role="alert">
                  {errorMessage}
                </p>
              ) : null}
            </div>
          </article>
        </aside>

        <section className="summary-main">
          <article className="summary-result-card">
            <div className="summary-panel-header">
              <span className="summary-panel-index">02</span>
              <div className="summary-panel-copy">
                <strong>输出工作区</strong>
              </div>
            </div>

            <div className="summary-panel-body">
              <div className="summary-section-heading">
                <strong>总结结果</strong>
              </div>

              {resultMeta ? (
                <section className="summary-meta">
                  <span>模型：{resultMeta.model}</span>
                  <span>来源：{resultMeta.source.fileName}</span>
                  <span>处理字数：{resultMeta.source.usedChars}</span>
                  {usageSummary ? <span>{usageSummary}</span> : null}
                  {resultMeta.source.truncated ? <span className="summary-warn">原文过长，已截断处理。</span> : null}
                </section>
              ) : (
                <section className="summary-meta summary-meta-empty" aria-hidden="true" />
              )}

              <section className="summary-output-surface">
                {showGeneratedSummary ? (
                  <section className={`summary-editor ${summarizing || exporting ? 'summary-editor-locked' : ''}`}>
                    {summarizing || exporting ? (
                      <p className="summary-editor-lock-note">
                        {summarizing ? '正在生成新结果，当前总结暂不可编辑。' : '正在导出，当前总结与模板暂不可修改。'}
                      </p>
                    ) : null}
                    <textarea
                      id="summary-textarea"
                      aria-label="总结内容"
                      rows={16}
                      value={summary}
                      disabled={summarizing || exporting}
                      onChange={(event) => setSummary(event.target.value)}
                    />
                  </section>
                ) : (
                  <div className="empty-state">
                    <span className="summary-empty-mark">-</span>
                    <p>暂无结果，完成左侧设置后点击「开始总结」</p>
                  </div>
                )}
              </section>

              <section className="summary-export-row">
                <section className="summary-template-panel">
                  <label htmlFor="summary-template-select">导出模板</label>
                  <select
                    id="summary-template-select"
                    className="summary-template-select"
                    value={selectedTemplateId}
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                    disabled={templatesLoading || templateOptions.length === 0 || summarizing || exporting}
                  >
                    {templateOptions.length === 0 ? (
                      <option value="">通用模板 · v1（当前生效）</option>
                    ) : (
                      templateOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.topicName} · v{option.version}
                          {option.effective ? '（当前生效）' : ''}
                        </option>
                      ))
                    )}
                  </select>
                </section>

                <button
                  type="button"
                  className="summary-primary-action summary-export-action"
                  onClick={() => void exportDocx()}
                  disabled={!canExport}
                >
                  {exporting ? '导出中...' : '导出总结 DOCX'}
                </button>
              </section>

              {feedbackTarget === 'output' && activeOperationMessage ? (
                <SummaryOperationStatus message={activeOperationMessage} announcement={activeOperationAnnouncement} />
              ) : null}
              {feedbackTarget === 'output' && statusMessage ? (
                <p className="summary-success" role="status" aria-live="polite">
                  {statusMessage}
                </p>
              ) : null}
              {feedbackTarget === 'output' && errorMessage ? (
                <p className="summary-error" role="alert">
                  {errorMessage}
                </p>
              ) : null}
            </div>
          </article>
        </section>
      </section>
    </main>
  )
}
