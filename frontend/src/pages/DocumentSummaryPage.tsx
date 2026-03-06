import { DragEvent, useMemo, useRef, useState } from 'react'

import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { isSupportedSummaryFileName, suggestSummaryExportTitle } from '../utils/documentSummary'

type SummaryLength = 'short' | 'medium' | 'long'

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('medium')
  const [summary, setSummary] = useState('')
  const [resultMeta, setResultMeta] = useState<SummaryApiResponse | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const canSummarize = Boolean(selectedFile) && !summarizing
  const canExport = summary.trim().length > 0 && !exporting

  const usageSummary = useMemo(() => {
    if (!resultMeta) return ''
    const totalTokens = resultMeta.usage?.total_tokens
    return typeof totalTokens === 'number' ? `Token 消耗：${totalTokens}` : ''
  }, [resultMeta])

  const pickFile = (file: File | null) => {
    if (!file) return
    if (!isSupportedSummaryFileName(file.name)) {
      setErrorMessage('仅支持 DOCX / PDF / TXT 文件')
      return
    }
    setSelectedFile(file)
    setErrorMessage('')
  }

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    pickFile(file || null)
  }

  const summarize = async () => {
    if (!selectedFile) return

    const form = new FormData()
    form.append('file', selectedFile)
    form.append('summaryLength', summaryLength)

    setSummarizing(true)
    setErrorMessage('')
    try {
      const res = await api.post<SummaryApiResponse>('/api/layout/ai/summarize-document', form, {
        timeout: 180000,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResultMeta(res.data)
      setSummary((res.data.summary || '').trim())
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

    const title = suggestSummaryExportTitle(selectedFile?.name || '')
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
        description="上传文档后，系统会调用 DeepSeek 生成结构化总结，并支持直接导出为 DOCX。"
        meta={
          <>
            <span className="soft-pill">DeepSeek</span>
            <span className="soft-pill">DOCX / PDF / TXT</span>
            <span className="soft-pill">可编辑后导出</span>
          </>
        }
      />

      <section className="summary-studio">
        <article className="summary-control-card">
          <div className="summary-section-heading">
            <strong>输入源</strong>
            <span>拖入文件或点击选择文件</span>
          </div>

          <section
            className={`summary-drop-zone ${dragging ? 'dragging' : ''}`}
            onClick={() => fileInputRef.current?.click()}
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

          <div className="summary-side-note">
            <span className="soft-pill">{selectedFile ? selectedFile.name : '未选择文件'}</span>
          </div>

          <label>
            总结长度
            <select value={summaryLength} onChange={(event) => setSummaryLength(event.target.value as SummaryLength)}>
              <option value="short">短（100-180字）</option>
              <option value="medium">中（220-320字）</option>
              <option value="long">长（380-520字）</option>
            </select>
          </label>

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
              <p>上传文件并点击“开始总结”后，结果会在这里显示。</p>
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
