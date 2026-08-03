import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
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
import type { StructuredFields } from '../api/types'

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

function isTemplateBackedDoc(structuredFields: Pick<StructuredFields, 'topicTemplateRules' | 'topicTemplateId' | 'topicId' | 'topicName'> | null | undefined): boolean {
  return Boolean(
    structuredFields?.topicTemplateRules || structuredFields?.topicTemplateId || structuredFields?.topicId || structuredFields?.topicName,
  )
}

function getNodeText(node: any): string {
  return Array.isArray(node?.content)
    ? node.content.map((part: any) => (part && typeof part === 'object' ? String(part.text || '') : '')).join('').trim()
    : ''
}

function looksLikeStaleTitleNode(node: any): boolean {
  if (!node || typeof node !== 'object' || !['paragraph', 'heading'].includes(String(node.type || ''))) return false
  const text = getNodeText(node)
  if (!text) return false
  if (/(有限公司|有限责任公司|集团|公司|委员会|办公室|政府)/.test(text)) return false
  if (/签发人\s*[：:]/.test(text)) return false
  if (/^(?:\d{4}\s*年第\s*[0-9一二三四五六七八九十百千]+\s*期|第\s*[0-9一二三四五六七八九十百千]+\s*期)$/.test(text)) return false
  return /(报告|纪要|请示|函|通知|方案|总结|通报|决定|公告|意见|办法|细则|规定|计划|说明|简报|要点|清单|材料)$/.test(text)
}

export function sanitizeTemplateBodyContent(
  body: GovDoc['body'],
  structuredFields:
    | Pick<StructuredFields, 'topicTemplateRules' | 'topicTemplateId' | 'topicId' | 'topicName' | 'title'>
    | null
    | undefined,
): GovDoc['body'] {
  if (!body || typeof body !== 'object' || !Array.isArray((body as any).content)) return body
  if (!isTemplateBackedDoc(structuredFields)) return body

  const topicTemplateRules = (structuredFields?.topicTemplateRules as Record<string, any> | null | undefined) || null
  if (hasFixedTemplateTitle(topicTemplateRules)) return body

  let removed = false
  const sanitizedContent = (body as any).content.filter((node: any) => {
    if (removed || !looksLikeStaleTitleNode(node)) return true
    removed = true
    return false
  })

  if (!removed) return body
  return {
    ...(body as any),
    content: sanitizedContent,
  }
}

function normalizeDoc(doc: GovDoc): GovDoc {
  const structuredFields: StructuredFields = {
    ...DEFAULT_STRUCTURED_FIELDS,
    ...(doc.structuredFields || {}),
    attachments: Array.isArray(doc.structuredFields?.attachments) ? doc.structuredFields.attachments : [],
    exportWithRedhead: false,
  }
  if (!structuredFields.title.trim() && !hasFixedTemplateTitle(structuredFields.topicTemplateRules || null)) {
    structuredFields.title = doc.title
  }
  return {
    ...doc,
    structuredFields,
    body: sanitizeTemplateBodyContent(doc.body, structuredFields),
  }
}

function hasFixedTemplateTitle(topicTemplateRules: Record<string, any> | null | undefined): boolean {
  const contentTemplate = topicTemplateRules?.contentTemplate
  if (!contentTemplate || typeof contentTemplate !== 'object') return false

  if (contentTemplate.titleMode === 'fixed') return true
  if (contentTemplate.titleMode === 'dynamic') return false

  const leadingNodes = Array.isArray(contentTemplate.leadingNodes) ? contentTemplate.leadingNodes : []
  return leadingNodes.some((node: any) => {
    if (!node || typeof node !== 'object') return false
    const text = ((node.content || []) as any[])
      .map((part: any) => (part && typeof part === 'object' ? String(part.text || '') : ''))
      .join('')
      .trim()
    if (!text) return false
    if (/(有限公司|有限责任公司|集团|公司|委员会|办公室|政府)/.test(text)) return false
    if (/签发人\s*[：:]/.test(text)) return false
    if (/^(?:\d{4}\s*年第\s*[0-9一二三四五六七八九十百千]+\s*期|第\s*[0-9一二三四五六七八九十百千]+\s*期)$/.test(text)) return false
    return /(报告|纪要|请示|函|通知|方案|总结|通报|决定|公告|意见|办法|细则|规定|计划|说明|简报|要点|清单|材料)$/.test(text)
  })
}

export function resolvePreviewTitleText(
  title: string,
  structuredFields:
    | Pick<StructuredFields, 'title' | 'topicTemplateRules' | 'topicTemplateId' | 'topicId' | 'topicName'>
    | null
    | undefined,
): string {
  const topicTemplateRules = (structuredFields?.topicTemplateRules as Record<string, any> | null | undefined) || null
  if (hasFixedTemplateTitle(topicTemplateRules)) {
    return ''
  }

  const structuredTitle = (structuredFields?.title || '').trim()
  if (isTemplateBackedDoc(structuredFields)) {
    return structuredTitle
  }
  return structuredTitle || title || ''
}

export function DocEditorPage() {
  const { id } = useParams()

  const [doc, setDoc] = useState<GovDoc | null>(null)
  const [issues, setIssues] = useState<CheckIssue[]>([])
  const [validationStatus, setValidationStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'stale'>('idle')
  const [syncToken, setSyncToken] = useState(0)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState('')
  const [layoutBackup, setLayoutBackup] = useState<Pick<GovDoc, 'title' | 'body' | 'structuredFields'> | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [installerOpen, setInstallerOpen] = useState(false)
  const [aiMode, setAiMode] = useState<'formal' | 'concise' | 'polish'>('formal')
  const [aiRewriting, setAiRewriting] = useState(false)
  const [rewritePreview, setRewritePreview] = useState<RewritePreview | null>(null)

  const editorRef = useRef<Editor | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const docRef = useRef<GovDoc | null>(null)
  const revisionRef = useRef(0)

  const { status, missing, ready, checking, recheck } = useFontCheck()

  const loadBase = useCallback(async () => {
    if (!id) return
    const docRes = await api.get<GovDoc>(`/api/layout/docs/${id}`)
    const normalized = normalizeDoc(docRes.data)
    docRef.current = normalized
    revisionRef.current = 0
    setDoc(normalized)
    setDirty(false)
    setLastSavedAt(normalized.updatedAt ? new Date(normalized.updatedAt) : null)
    setSaveError('')
    setIssues([])
    setValidationStatus('idle')
    setLayoutBackup(null)
  }, [id])

  useEffect(() => {
    void loadBase()
  }, [loadBase])

  const setDocField = (patch: Partial<GovDoc>) => {
    if (!docRef.current) return
    const nextDoc = { ...docRef.current, ...patch }
    docRef.current = nextDoc
    revisionRef.current += 1
    setDoc(nextDoc)
    setDirty(true)
    setSaveError('')
    setValidationStatus((current) => (current === 'idle' ? 'idle' : 'stale'))
  }

  const saveDoc = useCallback(async (): Promise<boolean> => {
    const currentDoc = docRef.current
    if (!currentDoc) return false
    const savedRevision = revisionRef.current
    setSaving(true)
    setSaveError('')
    try {
      const payload = {
        title: currentDoc.title,
        docType: currentDoc.docType,
        unitId: currentDoc.unitId,
        redheadTemplateId: currentDoc.redheadTemplateId,
        status: currentDoc.status,
        structuredFields: currentDoc.structuredFields,
        body: currentDoc.body,
      }
      await api.put(`/api/layout/docs/${currentDoc.id}`, payload)
      if (savedRevision === revisionRef.current) {
        setDirty(false)
      }
      setLastSavedAt(new Date())
      return true
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      setSaveError(typeof detail === 'string' ? detail : '保存失败，请重试。')
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  const runCheck = async () => {
    const currentDoc = docRef.current
    if (!currentDoc) return
    setValidationStatus('checking')
    const saved = await saveDoc()
    if (!saved) {
      setValidationStatus('stale')
      return
    }
    try {
      const res = await api.post<{ issues: CheckIssue[] }>(`/api/layout/docs/${currentDoc.id}/check`)
      setIssues(res.data.issues)
      setValidationStatus(res.data.issues.length > 0 ? 'invalid' : 'valid')
    } catch {
      setValidationStatus('stale')
    }
  }

  useEffect(() => {
    if (!dirty || !doc) return
    const timer = window.setTimeout(() => {
      void saveDoc()
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [dirty, doc, saveDoc])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  const doOneClickLayout = () => {
    if (!doc) return
    setLayoutBackup({
      title: doc.title,
      body: doc.body,
      structuredFields: doc.structuredFields,
    })
    const result = applyOneClickLayoutWithFields(doc.body, doc.structuredFields)
    const nextBody = result.body
    const nextFields = { ...result.structuredFields }

    const isDefaultTitle = doc.title === '新建公文' || doc.title === '新建通知'
    const nextTitle = isDefaultTitle && nextFields.title.trim() ? nextFields.title : doc.title

    setDocField({
      title: nextTitle,
      body: nextBody,
      structuredFields: nextFields,
    })
    setSyncToken((v) => v + 1)
  }

  const undoOneClickLayout = () => {
    if (!layoutBackup) return
    setDocField({
      title: layoutBackup.title,
      body: layoutBackup.body,
      structuredFields: layoutBackup.structuredFields,
    })
    setLayoutBackup(null)
    setSyncToken((value) => value + 1)
  }

  const locatePath = (path: string) => {
    if (path === 'structuredFields.title') {
      document.getElementById('structured-document-title')?.focus()
      return
    }
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
    setExporting(true)
    setExportMessage('')
    try {
    const latest = await recheck()
    const missingNow = Object.entries(latest)
      .filter(([, ok]) => !ok)
      .map(([name]) => name)

    if (missingNow.length > 0) {
      setInstallerOpen(true)
      return
    }

    const saved = await saveDoc()
    if (!saved) return
    const checkRes = await api.post<{ issues: CheckIssue[] }>(`/api/layout/docs/${doc.id}/check`)
    setIssues(checkRes.data.issues)
    setValidationStatus(checkRes.data.issues.length > 0 ? 'invalid' : 'valid')
    const errorCount = checkRes.data.issues.filter((issue) => issue.level === 'error').length
    if (errorCount > 0 && !window.confirm(`当前仍有 ${errorCount} 项校验错误。是否继续导出？`)) {
      return
    }
    const res = await api.post(`/api/layout/docs/${doc.id}/exportDocx`, null, { responseType: 'blob' })
    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.title || '公文'}.docx`
    a.click()
    URL.revokeObjectURL(url)
    setExportMessage(`已导出 ${doc.title || '公文'}.docx`)
    } finally {
      setExporting(false)
    }
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
      }>('/api/layout/ai/rewrite', { text: selectedText, mode: aiMode }, { timeout: 120000 })
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

  const handleImportClick = async () => {
    if (dirty) {
      const saved = await saveDoc()
      if (!saved) return
    }
    importInputRef.current?.click()
  }

  const handleImportFile = async (file?: File) => {
    if (!file || !doc) return
    const confirmed = window.confirm('导入会替换当前文档的正文和识别出的结构化字段，模板关联与版本信息会保留。是否继续？')
    if (!confirmed) return
    const form = new FormData()
    form.append('file', file)
    form.append('documentId', doc.id)
    form.append('unitId', doc.unitId)
    form.append('docType', doc.docType)
    form.append('preserveFormatting', 'true')
    form.append('title', doc.title || '导入文档')

    setImporting(true)
    try {
      const res = await api.post<{ docId: string; importReport: any }>('/api/layout/docs/importDocx', form)
    const report = res.data.importReport || {}
    const messages: string[] = []
    if ((report.unrecognizedTitleCount || 0) > 0) {
      messages.push(`未识别标题 ${report.unrecognizedTitleCount} 段`)
    }
    if (Array.isArray(report.numberingWarnings) && report.numberingWarnings.length > 0) {
      messages.push(`标题编号提醒 ${report.numberingWarnings.length} 项`)
    }
    if (Array.isArray(report.tableWarnings) && report.tableWarnings.length > 0) {
      messages.push(`表格提醒 ${report.tableWarnings.length} 项`)
    }
    alert(messages.length > 0 ? `导入完成：${messages.join('；')}` : '导入完成')
      await loadBase()
      setSyncToken((value) => value + 1)
    } finally {
      setImporting(false)
    }
  }

  const hasFixedTemplateTitleContent = useMemo(
    () => hasFixedTemplateTitle((doc?.structuredFields?.topicTemplateRules as Record<string, any> | null | undefined) || null),
    [doc?.structuredFields?.topicTemplateRules],
  )
  const previewTitleText = resolvePreviewTitleText(doc?.title || '', doc?.structuredFields || null)
  const previewMainToText = hasFixedTemplateTitleContent ? '' : doc?.structuredFields?.mainTo || ''

  if (!doc) {
    return <div className="page doc-editor-page module-workbench-page">加载中...</div>
  }

  return (
    <main className="page doc-editor-page module-workbench-page">
      <section className="glass-card editor-command-bar">
        <div className="editor-command-row">
          <input
            className="doc-title-input"
            value={doc.title}
            onChange={(e) => setDocField({ title: e.target.value })}
            placeholder="文档名称（用于列表和导出文件名）"
            aria-label="文档名称（用于列表和导出文件名）"
            title="文档名称用于列表和导出文件名；正文中的主标题请在左侧结构化要素中填写。"
          />
          <div className="row-gap">
            <button type="button" onClick={() => void saveDoc()} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
            <button type="button" onClick={() => void handleImportClick()} disabled={importing} title="导入并替换当前正文">
              导入 DOCX
            </button>
            <button type="button" onClick={exportDocx} disabled={!ready || exporting}>
              {exporting ? '导出中...' : '导出 DOCX'}
            </button>
            <select value={aiMode} onChange={(e) => setAiMode(e.target.value as 'formal' | 'concise' | 'polish')} disabled={aiRewriting}>
              <option value="formal">智能体模式：正式</option>
              <option value="concise">智能体模式：精简</option>
              <option value="polish">智能体模式：润色</option>
            </select>
            <button type="button" onClick={aiRewriteSelection} disabled={aiRewriting}>
              {aiRewriting ? '生成预览中...' : rewritePreview ? '重新润色预览' : '智能润色选中'}
            </button>
            <span className={`editor-save-status ${saveError ? 'error' : dirty ? 'dirty' : 'saved'}`} aria-live="polite">
              {saveError
                ? saveError
                : saving
                  ? '正在保存'
                  : dirty
                    ? '有未保存修改'
                    : lastSavedAt
                      ? `已保存 ${lastSavedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
                      : '已保存'}
            </span>
          </div>
        </div>
      </section>
      {exportMessage ? <div className="inline-status-card" aria-live="polite">{exportMessage}</div> : null}
      {doc.structuredFields.topicTemplateId ? (
        <div className="template-provenance-card">
          基于“{doc.structuredFields.topicName || '未命名题材'}”模板 v{doc.structuredFields.topicTemplateVersion || '-'} 的固定快照。
          后续模板升级不会静默改动当前文档。
        </div>
      ) : null}

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
        <div className="ai-preview-panel glass-card">
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
          key={doc.id}
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
          importedTitleAttrs={doc.structuredFields.importedTitleAttrs || null}
        />

        <ValidationPanel
          issues={issues}
          status={validationStatus}
          onCheck={runCheck}
          onOneClickLayout={doOneClickLayout}
          onUndoLayout={undoOneClickLayout}
          canUndoLayout={Boolean(layoutBackup)}
          onLocate={locatePath}
        />
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
    </main>
  )
}
