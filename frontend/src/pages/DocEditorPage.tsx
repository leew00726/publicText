import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Editor } from '@tiptap/react'

import { api } from '../api/client'
import type { CheckIssue, GovDoc, StructuredFields } from '../api/types'
import { FontInstallModal } from '../components/FontInstallModal'
import { FontStatusBar } from '../components/FontStatusBar'
import { EditorUnsavedNavigationGuard } from '../components/EditorUnsavedNavigationGuard'
import { StructuredFormPanel } from '../components/StructuredFormPanel'
import { TiptapEditor } from '../components/TiptapEditor'
import { ValidationPanel, type ValidationStatus } from '../components/ValidationPanel'
import { useFontCheck } from '../hooks/useFontCheck'
import { applyOneClickLayoutWithFields } from '../utils/docUtils'
import {
  confirmDiscardUnsavedEditorChanges,
  registerEditorUnsavedCheck,
} from '../utils/editorUnsavedChanges'

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

type SaveResult = 'saved' | 'changed' | 'failed'
type OperationFeedback = { kind: 'success' | 'error' | 'info'; message: string }
type EditorOperation = 'save' | 'check' | 'export' | 'import'
type ExclusiveOperationResult<T> = { started: true; value: T } | { started: false }

export function createExclusiveOperationGate() {
  let locked = false
  return {
    isLocked: () => locked,
    async run<T>(operation: () => Promise<T>): Promise<ExclusiveOperationResult<T>> {
      if (locked) return { started: false }
      locked = true
      try {
        return { started: true, value: await operation() }
      } finally {
        locked = false
      }
    },
  }
}

export function resolveImportedDocTitle(fileName: string): string {
  return fileName.trim().replace(/\.docx$/i, '').trim() || '导入文档'
}

const AI_MODE_LABEL: Record<'formal' | 'concise' | 'polish', string> = {
  formal: '正式',
  concise: '精简',
  polish: '润色',
}

function getApiErrorMessage(error: any, fallback: string): string {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const message = detail.map((item: any) => item?.msg).filter(Boolean).join('；')
    if (message) return message
  }
  return fallback
}

export function formatSaveState(
  saving: boolean,
  dirty: boolean,
  failed: boolean,
  lastSavedAt: Date | null,
): { className: 'saving' | 'dirty' | 'error' | 'saved'; text: string } {
  if (saving) return { className: 'saving', text: '保存中...' }
  if (failed) return { className: 'error', text: '保存失败，请重试' }
  if (dirty) return { className: 'dirty', text: '未保存' }
  if (!lastSavedAt) return { className: 'saved', text: '已保存' }
  return {
    className: 'saved',
    text: `已保存 ${lastSavedAt.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })}`,
  }
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
  importedFromDocx = false,
): GovDoc['body'] {
  if (!body || typeof body !== 'object' || !Array.isArray((body as any).content)) return body
  if (importedFromDocx) return body
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
  const structuredFields = {
    ...DEFAULT_STRUCTURED_FIELDS,
    ...(doc.structuredFields || {}),
    attachments: Array.isArray(doc.structuredFields?.attachments) ? doc.structuredFields.attachments : [],
    exportWithRedhead: false,
  }
  return {
    ...doc,
    structuredFields,
    body: sanitizeTemplateBodyContent(doc.body, structuredFields, Boolean(doc.importReport)),
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
  const navigate = useNavigate()

  const [doc, setDoc] = useState<GovDoc | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [issues, setIssues] = useState<CheckIssue[]>([])
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [syncToken, setSyncToken] = useState(0)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [exporting, setExporting] = useState(false)
  const [activeOperation, setActiveOperation] = useState<EditorOperation | null>(null)
  const [operationFeedback, setOperationFeedback] = useState<OperationFeedback | null>(null)
  const [installerOpen, setInstallerOpen] = useState(false)
  const [aiMode, setAiMode] = useState<'formal' | 'concise' | 'polish'>('formal')
  const [aiRewriting, setAiRewriting] = useState(false)
  const [aiElapsedSeconds, setAiElapsedSeconds] = useState(0)
  const [rewritePreview, setRewritePreview] = useState<RewritePreview | null>(null)

  const editorRef = useRef<Editor | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const mountedRef = useRef(true)
  const loadRequestRef = useRef(0)
  const aiRequestRef = useRef(0)
  const routeDocIdRef = useRef(id)
  routeDocIdRef.current = id
  const dirtyRef = useRef(false)
  const editRevisionRef = useRef(0)
  const operationGateRef = useRef<ReturnType<typeof createExclusiveOperationGate> | null>(null)
  if (!operationGateRef.current) operationGateRef.current = createExclusiveOperationGate()

  const { status, missing, ready, checking, recheck } = useFontCheck()

  const loadBase = useCallback(async () => {
    if (!id) return
    const requestId = ++loadRequestRef.current
    setLoadError(null)
    try {
      const docRes = await api.get<GovDoc>(`/api/layout/docs/${id}`)
      if (!mountedRef.current || requestId !== loadRequestRef.current) return
      const normalized = normalizeDoc(docRes.data)
      setDoc(normalized)
      editRevisionRef.current = 0
      dirtyRef.current = false
      setDirty(false)
      setSaveError(null)
      setLastSavedAt(normalized.updatedAt ? new Date(normalized.updatedAt) : null)
      setIssues([])
      setValidationStatus('idle')
      setValidationError(null)
      setOperationFeedback(null)
      aiRequestRef.current += 1
      setAiRewriting(false)
      setRewritePreview(null)
    } catch (error: any) {
      if (!mountedRef.current || requestId !== loadRequestRef.current) return
      setLoadError(getApiErrorMessage(error, '文档加载失败，请检查网络后重试。'))
    }
  }, [id])

  useEffect(() => {
    void loadBase()
  }, [loadBase])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      loadRequestRef.current += 1
      aiRequestRef.current += 1
    }
  }, [])

  useEffect(() => registerEditorUnsavedCheck(() => dirtyRef.current), [])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    if (!aiRewriting) {
      setAiElapsedSeconds(0)
      return
    }
    const startedAt = Date.now()
    setAiElapsedSeconds(0)
    const timer = window.setInterval(() => {
      setAiElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [aiRewriting])

  const markDocEdited = useCallback(() => {
    editRevisionRef.current += 1
    dirtyRef.current = true
    setDirty(true)
    setSaveError(null)
    setOperationFeedback(null)
    setValidationError(null)
    setValidationStatus((current) => (current === 'idle' ? 'idle' : 'stale'))
  }, [])

  const setDocField = useCallback(
    (patch: Partial<GovDoc>) => {
      setDoc((current) => (current ? { ...current, ...patch } : current))
      markDocEdited()
    },
    [markDocEdited],
  )

  const runExclusiveEditorOperation = useCallback(
    async <T,>(name: EditorOperation, operation: () => Promise<T>): Promise<ExclusiveOperationResult<T>> =>
      operationGateRef.current!.run(async () => {
        setActiveOperation(name)
        try {
          return await operation()
        } finally {
          setActiveOperation(null)
        }
      }),
    [],
  )

  const saveDoc = async ({ announce = true }: { announce?: boolean } = {}): Promise<SaveResult> => {
    if (!doc) return 'failed'
    const savedRevision = editRevisionRef.current
    setSaving(true)
    setSaveError(null)
    if (announce) setOperationFeedback(null)
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
      await api.put(`/api/layout/docs/${doc.id}`, payload)
      const savedCurrentRevision = savedRevision === editRevisionRef.current
      if (savedCurrentRevision) {
        dirtyRef.current = false
        setDirty(false)
        setLastSavedAt(new Date())
      }
      if (announce) {
        setOperationFeedback({
          kind: 'success',
          message: savedCurrentRevision ? '保存成功。' : '已保存发起时的版本，后续修改仍未保存。',
        })
      }
      return savedCurrentRevision ? 'saved' : 'changed'
    } catch (error: any) {
      const message = getApiErrorMessage(error, '保存失败，请检查网络后重试。')
      setSaveError(message)
      if (announce) setOperationFeedback({ kind: 'error', message })
      return 'failed'
    } finally {
      setSaving(false)
    }
  }

  const validateCurrentDoc = async (): Promise<'passed' | 'issues' | 'stale' | 'failed'> => {
    if (!doc) return 'failed'
    const validationRevision = editRevisionRef.current
    setValidationStatus('running')
    setValidationError(null)

    const saveResult = await saveDoc({ announce: false })
    if (saveResult === 'failed') {
      setValidationError('保存失败，未执行校验。请保存后重试。')
      setValidationStatus('error')
      return 'failed'
    }
    if (saveResult === 'changed' || validationRevision !== editRevisionRef.current) {
      setValidationStatus('stale')
      return 'stale'
    }

    try {
      const res = await api.post<{ issues: CheckIssue[] }>(`/api/layout/docs/${doc.id}/check`)
      if (validationRevision !== editRevisionRef.current) {
        setValidationStatus('stale')
        return 'stale'
      }
      const nextIssues = res.data.issues || []
      setIssues(nextIssues)
      const nextStatus = nextIssues.length > 0 ? 'issues' : 'passed'
      setValidationStatus(nextStatus)
      return nextStatus
    } catch (error: any) {
      setValidationError(getApiErrorMessage(error, '校验失败，请检查网络后重试。'))
      setValidationStatus('error')
      return 'failed'
    }
  }

  const runCheck = async () => {
    setOperationFeedback(null)
    await validateCurrentDoc()
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
    markDocEdited()
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
    if (!doc || exporting) return
    setExporting(true)
    setOperationFeedback({ kind: 'info', message: '正在检查当前内容并准备导出...' })
    try {
      const latest = await recheck()
      const missingNow = Object.entries(latest)
        .filter(([, ok]) => !ok)
        .map(([name]) => name)

      if (missingNow.length > 0) {
        setInstallerOpen(true)
        setOperationFeedback({ kind: 'error', message: '导出已停止：请先安装必需字体。' })
        return
      }

      const validationResult = await validateCurrentDoc()
      if (validationResult === 'issues') {
        setOperationFeedback({ kind: 'error', message: '导出已停止：请先处理规范校验中的问题。' })
        return
      }
      if (validationResult === 'stale') {
        setOperationFeedback({ kind: 'error', message: '导出已停止：校验期间内容发生了变化，请重试。' })
        return
      }
      if (validationResult !== 'passed') {
        setOperationFeedback({ kind: 'error', message: '导出已停止：当前内容未能通过校验。' })
        return
      }

      const exportRevision = editRevisionRef.current
      const res = await api.post(`/api/layout/docs/${doc.id}/exportDocx`, null, { responseType: 'blob' })
      if (exportRevision !== editRevisionRef.current) {
        setValidationStatus('stale')
        setOperationFeedback({ kind: 'error', message: '导出已停止：生成期间内容发生了变化，请重新导出。' })
        return
      }
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.title || '公文'}.docx`
      a.click()
      URL.revokeObjectURL(url)
      setOperationFeedback({ kind: 'success', message: '导出成功，文件已开始下载。' })
    } catch (error: any) {
      setOperationFeedback({ kind: 'error', message: getApiErrorMessage(error, '导出失败，请稍后重试。') })
    } finally {
      setExporting(false)
    }
  }

  const aiRewriteSelection = async () => {
    const editor = editorRef.current
    if (!editor || !doc) return

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

    const requestId = ++aiRequestRef.current
    const requestDocId = doc.id
    setAiRewriting(true)
    setRewritePreview(null)
    try {
      const res = await api.post<{
        message: string
        provider: string
        model: string
        rewritten: string
      }>('/api/layout/ai/rewrite', { text: selectedText, mode: aiMode }, { timeout: 120000 })
      if (
        !mountedRef.current ||
        requestId !== aiRequestRef.current ||
        routeDocIdRef.current !== requestDocId
      ) {
        return
      }
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
      if (
        !mountedRef.current ||
        requestId !== aiRequestRef.current ||
        routeDocIdRef.current !== requestDocId
      ) {
        return
      }
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
      if (
        mountedRef.current &&
        requestId === aiRequestRef.current &&
        routeDocIdRef.current === requestDocId
      ) {
        setAiRewriting(false)
      }
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
    if (!confirmDiscardUnsavedEditorChanges()) return
    setOperationFeedback({ kind: 'info', message: `正在导入“${file.name}”...` })
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('unitId', doc.unitId)
      form.append('docType', doc.docType)
      form.append('preserveFormatting', 'true')
      form.append('title', resolveImportedDocTitle(file.name))
      form.append('sourceDocId', doc.id)

      const res = await api.post<{ docId: string; importReport: any }>('/api/layout/docs/importDocx', form)
      if (!mountedRef.current) return
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
      setOperationFeedback({ kind: 'success', message: '导入完成，正在打开新文档。' })
      alert(messages.length > 0 ? `导入完成：${messages.join('；')}` : '导入完成')
      dirtyRef.current = false
      setDirty(false)
      navigate(`/layout/docs/${res.data.docId}`)
    } catch (error: any) {
      if (!mountedRef.current) return
      setOperationFeedback({ kind: 'error', message: getApiErrorMessage(error, 'DOCX 导入失败，请重试。') })
    }
  }

  const hasFixedTemplateTitleContent = useMemo(
    () => hasFixedTemplateTitle((doc?.structuredFields?.topicTemplateRules as Record<string, any> | null | undefined) || null),
    [doc?.structuredFields?.topicTemplateRules],
  )
  const previewTitleText = resolvePreviewTitleText(doc?.title || '', doc?.structuredFields || null)
  const previewMainToText = hasFixedTemplateTitleContent ? '' : doc?.structuredFields?.mainTo || ''
  const saveState = formatSaveState(saving, dirty, Boolean(saveError), lastSavedAt)
  const operationInProgress = activeOperation !== null
  const editorLocked = activeOperation === 'export' || activeOperation === 'import' || exporting

  if (!doc || doc.id !== id) {
    return (
      <div className="page doc-editor-page module-workbench-page">
        {loadError ? (
          <section className="glass-card" role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={() => void loadBase()}>
              重新加载
            </button>
          </section>
        ) : (
          '加载中...'
        )}
      </div>
    )
  }

  const aiOperationAnnouncement =
    aiElapsedSeconds < 10
      ? '智能润色已开始，请保持当前页面打开。'
      : `智能润色仍在处理，已等待 ${Math.floor(aiElapsedSeconds / 10) * 10} 秒。`

  return (
    <main className="page doc-editor-page module-workbench-page">
      <EditorUnsavedNavigationGuard when={dirty} />
      <section className="glass-card editor-command-bar" aria-busy={aiRewriting || operationInProgress}>
        <div className="editor-command-row">
          <input
            className="doc-title-input"
            value={doc.title}
            onChange={(e) => setDocField({ title: e.target.value })}
            placeholder="文档标题"
            aria-label="文档名称"
            disabled={editorLocked}
          />
          <div className="row-gap">
            <button
              type="button"
              onClick={() => void runExclusiveEditorOperation('save', () => saveDoc())}
              disabled={operationInProgress}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <span className={`save-state ${saveState.className}`} role="status" aria-live="polite">
              {saveState.text}
            </span>
            <button type="button" onClick={handleImportClick} disabled={operationInProgress}>
              {activeOperation === 'import' ? '导入中...' : '导入 DOCX'}
            </button>
            <button
              type="button"
              onClick={() => void runExclusiveEditorOperation('export', exportDocx)}
              disabled={operationInProgress}
            >
              {exporting ? '导出准备中...' : '导出 DOCX'}
            </button>
            <select
              value={aiMode}
              aria-label="智能润色模式"
              onChange={(e) => setAiMode(e.target.value as 'formal' | 'concise' | 'polish')}
              disabled={aiRewriting || editorLocked}
            >
              <option value="formal">智能体模式：正式</option>
              <option value="concise">智能体模式：精简</option>
              <option value="polish">智能体模式：润色</option>
            </select>
            <button type="button" onClick={aiRewriteSelection} disabled={aiRewriting || editorLocked}>
              {aiRewriting ? `生成预览中 ${aiElapsedSeconds} 秒` : rewritePreview ? '重新润色预览' : '智能润色选中'}
            </button>
          </div>
        </div>
        {aiRewriting && (
          <>
            <p className="ai-operation-status">智能润色正在处理，已等待 {aiElapsedSeconds} 秒，请保持当前页面打开。</p>
            <span className="summary-operation-announcement" role="status" aria-live="polite" aria-atomic="true">
              {aiOperationAnnouncement}
            </span>
          </>
        )}
        {operationFeedback && (
          <p
            className={`editor-operation-feedback ${operationFeedback.kind}`}
            role={operationFeedback.kind === 'error' ? 'alert' : 'status'}
            aria-live={operationFeedback.kind === 'error' ? 'assertive' : 'polite'}
          >
            {operationFeedback.message}
          </p>
        )}
      </section>

      <input
        ref={importInputRef}
        type="file"
        accept=".docx"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void runExclusiveEditorOperation('import', () => handleImportFile(f))
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
              disabled={editorLocked}
            />
          </label>
          <div className="row-gap">
            <button type="button" onClick={applyRewritePreview} disabled={!rewritePreview.rewritten.trim() || editorLocked}>
              替换正文
            </button>
            <button type="button" onClick={() => setRewritePreview(null)} disabled={editorLocked}>
              取消
            </button>
          </div>
        </div>
      )}

      <div className="editor-layout">
        <StructuredFormPanel
          value={doc.structuredFields}
          onChange={(next) => setDocField({ structuredFields: { ...next } })}
          disabled={editorLocked}
        />

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
          editable={!editorLocked}
        />

        <ValidationPanel
          issues={issues}
          status={validationStatus}
          errorMessage={validationError}
          editingDisabled={operationInProgress}
          onCheck={() => void runExclusiveEditorOperation('check', runCheck)}
          onOneClickLayout={doOneClickLayout}
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
