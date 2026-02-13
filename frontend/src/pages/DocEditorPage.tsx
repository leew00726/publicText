import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Editor } from '@tiptap/react'

import { api } from '../api/client'
import type { CheckIssue, GovDoc } from '../api/types'
import { FontInstallModal } from '../components/FontInstallModal'
import { FontStatusBar } from '../components/FontStatusBar'
import { StructuredFormPanel } from '../components/StructuredFormPanel'
import { TiptapEditor } from '../components/TiptapEditor'
import { ValidationPanel } from '../components/ValidationPanel'
import { useFontCheck } from '../hooks/useFontCheck'
import { applyOneClickLayoutWithFields } from '../utils/docUtils'

const DEFAULT_STRUCTURED_FIELDS = {
  title: '',
  mainTo: '',
  signOff: '',
  docNo: '',
  signatory: '',
  copyNo: '',
  date: '',
  exportWithRedhead: false,
  attachments: [] as Array<{ index: number; name: string }>,
}

type RewritePreview = {
  from: number
  to: number
  original: string
  rewritten: string
  mode: 'formal' | 'concise' | 'polish'
}

const AI_MODE_LABEL: Record<'formal' | 'concise' | 'polish', string> = {
  formal: '正式',
  concise: '精简',
  polish: '润色',
}

function normalizeDoc(doc: GovDoc): GovDoc {
  return {
    ...doc,
    structuredFields: {
      ...DEFAULT_STRUCTURED_FIELDS,
      ...(doc.structuredFields || {}),
      attachments: Array.isArray(doc.structuredFields?.attachments) ? doc.structuredFields.attachments : [],
      exportWithRedhead: false,
    },
  }
}

export function DocEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [doc, setDoc] = useState<GovDoc | null>(null)
  const [issues, setIssues] = useState<CheckIssue[]>([])
  const [syncToken, setSyncToken] = useState(0)
  const [saving, setSaving] = useState(false)
  const [installerOpen, setInstallerOpen] = useState(false)
  const [aiMode, setAiMode] = useState<'formal' | 'concise' | 'polish'>('formal')
  const [aiRewriting, setAiRewriting] = useState(false)
  const [rewritePreview, setRewritePreview] = useState<RewritePreview | null>(null)

  const editorRef = useRef<Editor | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const { status, missing, ready, checking, recheck } = useFontCheck()

  const loadBase = useCallback(async () => {
    if (!id) return
    const docRes = await api.get<GovDoc>(`/api/docs/${id}`)
    setDoc(normalizeDoc(docRes.data))
  }, [id])

  useEffect(() => {
    void loadBase()
  }, [loadBase])

  const setDocField = (patch: Partial<GovDoc>) => {
    if (!doc) return
    setDoc({ ...doc, ...patch })
  }

  const saveDoc = async () => {
    if (!doc) return
    setSaving(true)
    try {
      const payload = {
        title: doc.title,
        docType: doc.docType,
        unitId: doc.unitId,
        redheadTemplateId: doc.redheadTemplateId,
        status: doc.status,
        structuredFields: doc.structuredFields,
        body: doc.body,
      }
      await api.put(`/api/docs/${doc.id}`, payload)
    } finally {
      setSaving(false)
    }
  }

  const runCheck = async () => {
    if (!doc) return
    const res = await api.post<{ issues: CheckIssue[] }>(`/api/docs/${doc.id}/check`)
    setIssues(res.data.issues)
  }

  const doOneClickLayout = () => {
    if (!doc) return
    const result = applyOneClickLayoutWithFields(doc.body, doc.structuredFields)
    const nextBody = result.body
    const nextFields = { ...result.structuredFields }

    const isDefaultTitle = doc.title === '新建公文' || doc.title === '新建通知'
    const nextTitle = isDefaultTitle && nextFields.title.trim() ? nextFields.title : doc.title

    setDoc({
      ...doc,
      title: nextTitle,
      body: nextBody,
      structuredFields: nextFields,
    })
    setSyncToken((v) => v + 1)
  }

  const locatePath = (path: string) => {
    const m = path.match(/body\.content\[(\d+)\]/)
    if (!m) return
    const index = Number(m[1])
    const editor = editorRef.current
    if (!editor) return

    try {
      let pos = 1
      for (let i = 0; i < index; i += 1) {
        pos += editor.state.doc.child(i).nodeSize
      }
      editor.chain().focus(pos + 1).run()
    } catch {
      // ignore
    }
  }

  const exportDocx = async () => {
    if (!doc) return
    const latest = await recheck()
    const missingNow = Object.entries(latest)
      .filter(([, ok]) => !ok)
      .map(([name]) => name)

    if (missingNow.length > 0) {
      setInstallerOpen(true)
      return
    }

    await saveDoc()
    const res = await api.post(`/api/docs/${doc.id}/exportDocx`, null, { responseType: 'blob' })
    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.title || '公文'}.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const aiRewriteSelection = async () => {
    const editor = editorRef.current
    if (!editor) return

    const { from, to } = editor.state.selection
    if (from === to) {
      alert('请先选中需要润色的正文文本')
      return
    }
    const selectedText = editor.state.doc.textBetween(from, to, '\n', '\n').trim()
    if (!selectedText) {
      alert('选中的文本为空')
      return
    }

    setAiRewriting(true)
    setRewritePreview(null)
    try {
      const res = await api.post<{
        message: string
        provider: string
        model: string
        rewritten: string
      }>('/api/ai/rewrite', { text: selectedText, mode: aiMode }, { timeout: 120000 })
      const rewritten = (res.data.rewritten || '').trim()
      if (!rewritten) {
        alert('智能体未返回有效文本，请重试')
        return
      }
      setRewritePreview({
        from,
        to,
        original: selectedText,
        rewritten,
        mode: aiMode,
      })
    } catch (error: any) {
      if (error?.code === 'ECONNABORTED') {
        alert('智能润色请求超时，请检查后端网络与 DeepSeek 配置。')
      } else {
        const detail = error?.response?.data?.detail
        if (typeof detail === 'string') {
          alert(detail)
        } else if (Array.isArray(detail)) {
          const msg = detail.map((item: any) => item?.msg).filter(Boolean).join('；')
          alert(msg || '智能润色失败，请检查后端 DeepSeek 配置。')
        } else {
          alert('智能润色失败，请检查后端 DeepSeek 配置。')
        }
      }
    } finally {
      setAiRewriting(false)
    }
  }

  const applyRewritePreview = () => {
    if (!rewritePreview) return
    const editor = editorRef.current
    if (!editor) return

    const currentText = editor.state.doc.textBetween(rewritePreview.from, rewritePreview.to, '\n', '\n').trim()
    if (currentText !== rewritePreview.original) {
      alert('原选区已变化，请重新选择文本并再次智能润色。')
      return
    }

    const finalText = rewritePreview.rewritten.trim()
    if (!finalText) {
      alert('润色文本为空，请重新生成或手动输入。')
      return
    }

    editor
      .chain()
      .focus()
      .insertContentAt({ from: rewritePreview.from, to: rewritePreview.to }, finalText)
      .run()
    setRewritePreview(null)
  }

  const handleImportClick = () => {
    importInputRef.current?.click()
  }

  const handleImportFile = async (file?: File) => {
    if (!file || !doc) return
    const form = new FormData()
    form.append('file', file)
    form.append('unitId', doc.unitId)
    form.append('docType', doc.docType)
    form.append('title', doc.title || '导入文档')

    const res = await api.post<{ docId: string; importReport: any }>('/api/docs/importDocx', form)
    alert(`导入完成：未识别标题 ${res.data.importReport.unrecognizedTitleCount} 段`)
    navigate(`/docs/${res.data.docId}`)
  }

  const hasFixedLeadingNodes = useMemo(() => {
    const rules = doc?.structuredFields?.topicTemplateRules as any
    const leadingNodes = rules?.contentTemplate?.leadingNodes
    return Array.isArray(leadingNodes) && leadingNodes.length > 0
  }, [doc?.structuredFields?.topicTemplateRules])
  const previewTitleText = hasFixedLeadingNodes ? doc?.structuredFields?.title || '' : doc?.structuredFields?.title || doc?.title || ''
  const previewMainToText = hasFixedLeadingNodes ? '' : doc?.structuredFields?.mainTo || ''

  if (!doc) {
    return <div className="page">加载中...</div>
  }

  return (
    <div className="page doc-editor-page">
      <div className="header-row">
        <input
          className="doc-title-input"
          value={doc.title}
          onChange={(e) => setDocField({ title: e.target.value })}
          placeholder="文档标题"
        />
        <button type="button" onClick={saveDoc} disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </button>
        <button type="button" onClick={handleImportClick}>
          导入 DOCX
        </button>
        <button type="button" onClick={exportDocx} disabled={!ready}>
          导出 DOCX
        </button>
        <select value={aiMode} onChange={(e) => setAiMode(e.target.value as 'formal' | 'concise' | 'polish')} disabled={aiRewriting}>
          <option value="formal">智能体模式：正式</option>
          <option value="concise">智能体模式：精简</option>
          <option value="polish">智能体模式：润色</option>
        </select>
        <button type="button" onClick={aiRewriteSelection} disabled={aiRewriting}>
          {aiRewriting ? '生成预览中...' : rewritePreview ? '重新润色预览' : '智能润色选中'}
        </button>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept=".docx"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          void handleImportFile(f)
          e.currentTarget.value = ''
        }}
      />

      <FontStatusBar status={status} missing={missing} onOpenInstaller={() => setInstallerOpen(true)} />
      {!ready && <div className="font-preview-warning">当前缺少必需字体，正文框预览字体可能不准确（导出会被阻断）。</div>}

      {rewritePreview && (
        <div className="ai-preview-panel">
          <div className="row-between">
            <strong>智能润色预览</strong>
            <span className="ai-preview-meta">模式：{AI_MODE_LABEL[rewritePreview.mode]}</span>
          </div>

          <label>
            原文
            <textarea value={rewritePreview.original} readOnly rows={3} />
          </label>
          <label>
            润色后（可编辑）
            <textarea
              value={rewritePreview.rewritten}
              rows={5}
              onChange={(e) => setRewritePreview((prev) => (prev ? { ...prev, rewritten: e.target.value } : prev))}
            />
          </label>
          <div className="row-gap">
            <button type="button" onClick={applyRewritePreview} disabled={!rewritePreview.rewritten.trim()}>
              替换正文
            </button>
            <button type="button" onClick={() => setRewritePreview(null)}>
              取消
            </button>
          </div>
        </div>
      )}

      <div className="editor-layout">
        <StructuredFormPanel value={doc.structuredFields} onChange={(next) => setDocField({ structuredFields: { ...next } })} />

        <TiptapEditor
          value={doc.body}
          syncToken={syncToken}
          onChange={(json) => setDocField({ body: json })}
          onReady={(editor) => {
            editorRef.current = editor
          }}
          titleText={previewTitleText}
          mainToText={previewMainToText}
          signOffText={doc.structuredFields.signOff}
          dateText={doc.structuredFields.date}
          attachments={doc.structuredFields.attachments}
          topicTemplateRules={doc.structuredFields.topicTemplateRules || null}
        />

        <ValidationPanel issues={issues} onCheck={runCheck} onOneClickLayout={doOneClickLayout} onLocate={locatePath} />
      </div>

      <FontInstallModal
        open={installerOpen}
        missing={missing}
        checking={checking}
        onClose={() => setInstallerOpen(false)}
        onRecheck={async () => {
          const latest = await recheck()
          if (Object.values(latest).every(Boolean)) {
            setInstallerOpen(false)
          }
        }}
      />
    </div>
  )
}
