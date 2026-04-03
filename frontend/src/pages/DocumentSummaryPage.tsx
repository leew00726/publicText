import { DragEvent, useEffect, useMemo, useRef, useState } from 'react'

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
}

export function DocumentSummaryPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const employeeSession = useMemo(() => loadEmployeeSession(), [])
  const [dragging, setDragging] = useState(false)
  const [sourceMode, setSourceMode] = useState<SummarySourceMode>('file')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [sourceText, setSourceText] = useState('')
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('medium')
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([])
  const [agentDraft, setAgentDraft] = useState('')
  const [summary, setSummary] = useState('')
  const [resultMeta, setResultMeta] = useState<SummaryApiResponse | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [templateOptions, setTemplateOptions] = useState<SummaryExportTemplateOption[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateStatusMessage, setTemplateStatusMessage] = useState('')

  const normalizedSourceText = sourceText.trim()
  const canSummarize = Boolean(sourceMode === 'file' ? selectedFile : normalizedSourceText) && !summarizing
  const canExport = summary.trim().length > 0 && !exporting && (templateOptions.length === 0 || Boolean(selectedTemplateId))

  const usageSummary = useMemo(() => {
    if (!resultMeta) return ''
    const totalTokens = resultMeta.usage?.total_tokens
    return typeof totalTokens === 'number' ? `Token 消耗：${totalTokens}` : ''
  }, [resultMeta])

  const activeSourceSummary = useMemo(() => {
    if (sourceMode === 'file') {
      return selectedFile ? selectedFile.name : '未选择文件'
    }
    return normalizedSourceText ? `已粘贴 ${normalizedSourceText.length} 字` : '未粘贴文本'
  }, [normalizedSourceText, selectedFile, sourceMode])

  const selectedTemplate = useMemo(
    () => templateOptions.find((item) => item.id === selectedTemplateId) || null,
    [selectedTemplateId, templateOptions],
  )

  const exportTemplateHint = useMemo(() => {
    if (templatesLoading) return '正在加载当前公司已创建模板...'
    if (templateStatusMessage) return templateStatusMessage
    if (selectedTemplate) {
      return `当前导出将套用“${selectedTemplate.topicName}”模板的标题、标题层级和正文样式。`
    }
    if (templateOptions.length === 0) {
      return '当前公司暂无已创建模板，导出将使用默认总结样式。'
    }
    return '请选择导出模板后再导出总结。'
  }, [selectedTemplate, templateOptions.length, templateStatusMessage, templatesLoading])

  useEffect(() => {
    let cancelled = false

    const loadTemplates = async () => {
      const companyId = employeeSession?.companyId?.trim() || ''
      if (!companyId) {
        setTemplateOptions([])
        setSelectedTemplateId('')
        setTemplateStatusMessage('未识别到当前公司，导出将使用默认总结样式。')
        return
      }

      setTemplatesLoading(true)
      setTemplateStatusMessage('')
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
        if (nextOptions.length === 0) {
          setTemplateStatusMessage('当前公司暂无已创建模板，导出将使用默认总结样式。')
        }
      } catch {
        if (cancelled) return
        setTemplateOptions([])
        setSelectedTemplateId('')
        setTemplateStatusMessage('模板列表加载失败，当前将按默认总结样式导出。')
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
    if (!file) return
    if (!isSupportedSummaryFileName(file.name)) {
      setErrorMessage('仅支持 DOCX / PDF / TXT 文件')
      return
    }
    setSelectedFile(file)
    setSourceMode('file')
    setErrorMessage('')
  }

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    pickFile(file || null)
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
    setErrorMessage('')
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
    if (!summary.trim()) return

    const exportSourceFileName =
      resultMeta?.source.fileName && resultMeta.source.fileName !== '直接粘贴文本'
        ? resultMeta.source.fileName
        : sourceMode === 'file'
          ? selectedFile?.name || ''
          : ''
    const title = suggestSummaryExportTitle(exportSourceFileName)
    setExporting(true)
    setErrorMessage('')
    try {
      const res = await api.post(
        '/api/layout/ai/export-summary-docx',
        {
          title,
          summary: summary.trim(),
          sourceFileName: exportSourceFileName || null,
          topicTemplateId: selectedTemplateId || null,
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
    <main className="page summary-page">
      <section className="summary-studio">
        <aside className="summary-sidebar">
          <article className="summary-control-card">
            <div className="summary-panel-header">
              <span className="summary-panel-index">01</span>
              <div className="summary-panel-copy">
                <span className="summary-panel-kicker">Input</span>
                <strong>输入控制台</strong>
                <p>选择输入源、补充要求，然后生成当前总结。</p>
              </div>
            </div>

            <div className="summary-panel-body">
              <div className="summary-section-heading">
                <strong>输入源</strong>
                <span>上传文件或粘贴文本，二选一后开始总结</span>
              </div>

              <div className="summary-source-switch" role="tablist" aria-label="总结输入方式">
                <button
                  type="button"
                  className={`summary-source-tab ${sourceMode === 'file' ? 'active' : ''}`}
                  onClick={() => setSourceMode('file')}
                >
                  上传文件
                </button>
                <button
                  type="button"
                  className={`summary-source-tab ${sourceMode === 'text' ? 'active' : ''}`}
                  onClick={() => setSourceMode('text')}
                >
                  粘贴文本
                </button>
              </div>

              {sourceMode === 'file' ? (
                <section
                  className={`summary-source-panel summary-drop-zone ${dragging ? 'dragging' : ''}`}
                  onClick={() => {
                    fileInputRef.current?.click()
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
                  <p>{selectedFile ? `已选择：${selectedFile.name}` : '拖拽 DOCX / PDF / TXT 文件到这里，或点击选择文件'}</p>
                  <small>单文件处理，建议内容不超过 12,000 字符。</small>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx,.pdf,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    style={{ display: 'none' }}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null
                      pickFile(file)
                      event.currentTarget.value = ''
                    }}
                  />
                </section>
              ) : (
                <section className="summary-source-panel summary-text-panel">
                  <label htmlFor="summary-source-textarea">正文文本</label>
                  <textarea
                    id="summary-source-textarea"
                    value={sourceText}
                    rows={10}
                    placeholder="把需要总结的正文直接粘贴到这里"
                    onChange={(event) => {
                      setSourceText(event.target.value)
                      if (event.target.value.trim()) {
                        setSourceMode('text')
                      }
                    }}
                  />
                  <small>直接粘贴需要总结的正文内容，不上传文件也可以开始总结。</small>
                </section>
              )}

              <div className="summary-side-note">
                <span className="soft-pill summary-file-pill">{activeSourceSummary}</span>
              </div>

              <label>
                总结长度
                <select value={summaryLength} onChange={(event) => setSummaryLength(event.target.value as SummaryLength)}>
                  <option value="short">短（100-180字）</option>
                  <option value="medium">中（220-320字）</option>
                  <option value="long">长（380-520字）</option>
                </select>
              </label>

              <section className="summary-agent-card">
                <div className="summary-section-heading">
                  <strong>智能体要求</strong>
                </div>

                <label htmlFor="summary-agent-draft">要求输入</label>
                <textarea
                  id="summary-agent-draft"
                  value={agentDraft}
                  rows={4}
                  placeholder="例如：按“核心结论 / 关键要点 / 执行建议”格式总结，并保留原文中的时间节点。"
                  onChange={(event) => setAgentDraft(event.target.value)}
                />

                <div className="row-gap">
                  <button
                    type="button"
                    onClick={() => {
                      const next = agentDraft.trim()
                      if (!next) return
                      setAgentMessages((current) => [...current, { role: 'user', content: next }])
                      setAgentDraft('')
                    }}
                    disabled={!agentDraft.trim()}
                  >
                    添加要求
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setAgentMessages([])
                      setAgentDraft('')
                    }}
                    disabled={agentMessages.length === 0 && !agentDraft.trim()}
                  >
                    清空要求
                  </button>
                </div>
              </section>

              <div className="row-gap">
                <button type="button" className="summary-primary-action" onClick={() => void summarize()} disabled={!canSummarize}>
                  {summarizing ? '总结中...' : '开始总结'}
                </button>
              </div>

              {errorMessage ? <p className="summary-error">{errorMessage}</p> : null}
            </div>
          </article>
        </aside>

        <section className="summary-main">
          <article className="summary-result-card">
            <div className="summary-panel-header">
              <span className="summary-panel-index">02</span>
              <div className="summary-panel-copy">
                <span className="summary-panel-kicker">Output</span>
                <strong>输出工作区</strong>
                <p>校对生成结果，选择模板，然后导出 DOCX。</p>
              </div>
            </div>

            <div className="summary-panel-body">
              <div className="summary-section-heading">
                <strong>总结结果</strong>
                <span>结果可直接编辑，再导出为 DOCX</span>
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
                <div className="empty-state">
                  <strong>尚未生成总结</strong>
                  <p>上传文件或粘贴文本并点击“开始总结”后，结果会在这里显示。</p>
                </div>
              )}

              <section className="summary-editor">
                <label htmlFor="summary-textarea">总结内容（可编辑后导出）</label>
                <textarea
                  id="summary-textarea"
                  rows={16}
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="总结结果将显示在这里"
                />
              </section>

              <section className="summary-template-panel">
                <label htmlFor="summary-template-select">导出模板</label>
                <select
                  id="summary-template-select"
                  className="summary-template-select"
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  disabled={templatesLoading || templateOptions.length === 0}
                >
                  {templateOptions.length === 0 ? (
                    <option value="">{templatesLoading ? '模板加载中...' : '暂无已创建模板，按默认格式导出'}</option>
                  ) : (
                    templateOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.topicName} · v{option.version}
                        {option.effective ? '（当前生效）' : ''}
                      </option>
                    ))
                  )}
                </select>
                <small>{exportTemplateHint}</small>
              </section>

              <div className="row-gap">
                <button
                  type="button"
                  className="summary-primary-action"
                  onClick={() => void exportDocx()}
                  disabled={!canExport}
                >
                  {exporting ? '导出中...' : '导出总结 DOCX'}
                </button>
              </div>
            </div>
          </article>
        </section>
      </section>
    </main>
  )
}
