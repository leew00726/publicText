import { DragEvent, useMemo, useRef, useState } from 'react'

import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { isSupportedSummaryFileName, suggestSummaryExportTitle } from '../utils/documentSummary'

type SummaryLength = 'short' | 'medium' | 'long'
type SummarySourceMode = 'file' | 'text'
type AgentMessage = {
  role: 'user' | 'assistant'
  content: string
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

  const normalizedSourceText = sourceText.trim()
  const canSummarize = Boolean(sourceMode === 'file' ? selectedFile : normalizedSourceText) && !summarizing
  const canExport = summary.trim().length > 0 && !exporting

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
          sourceFileName: selectedFile?.name || null,
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
      <PageHeader
        eyebrow="Summary"
        title="公文总结"
        description="上传文件或直接粘贴正文，再告诉 DeepSeek 你希望的总结格式，结果可继续编辑并导出。"
        meta={
          <>
            <span className="soft-pill">DeepSeek</span>
            <span className="soft-pill">DOCX / PDF / TXT</span>
            <span className="soft-pill">文件 / 粘贴文本</span>
            <span className="soft-pill">可编辑后导出</span>
          </>
        }
      />

      <section className="summary-studio">
        <article className="summary-control-card">
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

          <section
            className={`summary-drop-zone ${dragging ? 'dragging' : ''} ${sourceMode === 'file' ? '' : 'is-muted'}`}
            onClick={() => {
              if (sourceMode === 'file') {
                fileInputRef.current?.click()
              }
            }}
            onDragOver={(event) => {
              if (sourceMode !== 'file') return
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={(event) => {
              if (sourceMode !== 'file') return
              event.preventDefault()
              setDragging(false)
            }}
            onDrop={sourceMode === 'file' ? handleDrop : undefined}
          >
            <p>
              {selectedFile && sourceMode === 'file'
                ? `已选择：${selectedFile.name}`
                : '拖拽 DOCX / PDF / TXT 文件到这里，或点击选择文件'}
            </p>
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

          <div className="summary-side-note">
            <span className="soft-pill summary-file-pill">{activeSourceSummary}</span>
          </div>

          <section className="summary-text-source">
            <div className="summary-section-heading">
              <strong>上传文件或粘贴文本</strong>
              <span>不上传文件时，可直接复制粘贴正文内容进行总结。</span>
            </div>
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
          </section>

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
              <span>告诉智能体你希望的总结格式，例如“按会议纪要格式输出”或“先给结论再列要点”。</span>
            </div>

            <div className="summary-agent-thread">
              {agentMessages.length > 0 ? (
                agentMessages.map((item, index) => (
                  <article key={`${item.role}-${index}`} className={`summary-agent-bubble ${item.role}`}>
                    <span className="summary-agent-role">{item.role === 'user' ? '你' : '智能体'}</span>
                    <p>{item.content}</p>
                  </article>
                ))
              ) : (
                <div className="summary-agent-empty">还没有要求。你可以直接告诉它总结结构、语气和输出格式。</div>
              )}
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
            <button type="button" onClick={() => void summarize()} disabled={!canSummarize}>
              {summarizing ? '总结中...' : '开始总结'}
            </button>
          </div>

          {errorMessage ? <p className="summary-error">{errorMessage}</p> : null}
        </article>

        <article className="summary-result-card">
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

          <div className="row-gap">
            <button type="button" onClick={() => void exportDocx()} disabled={!canExport}>
              {exporting ? '导出中...' : '导出总结 DOCX'}
            </button>
          </div>
        </article>
      </section>
    </main>
  )
}
