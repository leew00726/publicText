import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Editor } from '@tiptap/react'

import { api } from '../api/client'
import type { CheckIssue, GovDoc, RedheadTemplate, Unit } from '../api/types'
import { FontInstallModal } from '../components/FontInstallModal'
import { FontStatusBar } from '../components/FontStatusBar'
import { StructuredFormPanel } from '../components/StructuredFormPanel'
import { TiptapEditor } from '../components/TiptapEditor'
import { ValidationPanel } from '../components/ValidationPanel'
import { useFontCheck } from '../hooks/useFontCheck'
import { applyOneClickLayoutWithFields, normalizeDocNoBracket } from '../utils/docUtils'

const DEFAULT_STRUCTURED_FIELDS = {
  title: '',
  mainTo: '',
  signOff: '',
  docNo: '',
  signatory: '',
  copyNo: '',
  date: '',
  exportWithRedhead: true,
  attachments: [] as Array<{ index: number; name: string }>,
}

function normalizeDoc(doc: GovDoc): GovDoc {
  return {
    ...doc,
    structuredFields: {
      ...DEFAULT_STRUCTURED_FIELDS,
      ...(doc.structuredFields || {}),
      attachments: Array.isArray(doc.structuredFields?.attachments) ? doc.structuredFields.attachments : [],
      exportWithRedhead: doc.structuredFields?.exportWithRedhead !== false,
    },
  }
}

export function DocEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [doc, setDoc] = useState<GovDoc | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [templates, setTemplates] = useState<RedheadTemplate[]>([])
  const [issues, setIssues] = useState<CheckIssue[]>([])
  const [syncToken, setSyncToken] = useState(0)
  const [saving, setSaving] = useState(false)
  const [installerOpen, setInstallerOpen] = useState(false)

  const editorRef = useRef<Editor | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const { status, missing, ready, checking, recheck } = useFontCheck()

  const loadBase = useCallback(async () => {
    const unitRes = await api.get<Unit[]>('/api/units')
    setUnits(unitRes.data)

    if (!id) return
    const docRes = await api.get<GovDoc>(`/api/docs/${id}`)
    setDoc(normalizeDoc(docRes.data))
  }, [id])

  const loadTemplates = useCallback(async (unitId: string) => {
    const res = await api.get<RedheadTemplate[]>('/api/redheadTemplates', { params: { unitId } })
    setTemplates(res.data)
  }, [])

  useEffect(() => {
    void loadBase()
  }, [loadBase])

  useEffect(() => {
    if (doc?.unitId) {
      void loadTemplates(doc.unitId)
    }
  }, [doc?.unitId, loadTemplates])

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
        structuredFields: {
          ...doc.structuredFields,
          docNo: normalizeDocNoBracket(doc.structuredFields.docNo),
        },
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
    const nextFields = {
      ...result.structuredFields,
      docNo: normalizeDocNoBracket(result.structuredFields.docNo),
    }

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
    if (doc.redheadTemplateId) form.append('redheadTemplateId', doc.redheadTemplateId)

    const res = await api.post<{ docId: string; importReport: any }>('/api/docs/importDocx', form)
    alert(`导入完成：未识别标题 ${res.data.importReport.unrecognizedTitleCount} 段`) // MVP
    navigate(`/docs/${res.data.docId}`)
  }

  const currentTemplateList = useMemo(() => templates, [templates])

  if (!doc) {
    return <div className="page">加载中...</div>
  }

  return (
    <div className="page doc-editor-page">
      <div className="header-row">
        <Link to="/">返回列表</Link>
        <input
          className="doc-title-input"
          value={doc.title}
          onChange={(e) => setDocField({ title: e.target.value })}
          placeholder="文档标题"
        />
        <select value={doc.docType} onChange={(e) => setDocField({ docType: e.target.value as GovDoc['docType'] })}>
          <option value="qingshi">请示</option>
          <option value="jiyao">纪要</option>
          <option value="han">函</option>
          <option value="tongzhi">通知</option>
        </select>
        <select
          value={doc.unitId}
          onChange={(e) => {
            const unitId = e.target.value
            setDocField({ unitId, redheadTemplateId: null })
            void loadTemplates(unitId)
          }}
        >
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={doc.redheadTemplateId || ''}
          onChange={(e) => setDocField({ redheadTemplateId: e.target.value || null })}
          disabled={!doc.structuredFields.exportWithRedhead}
        >
          <option value="">请选择红头模板</option>
          {currentTemplateList.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name} v{tpl.version} {tpl.isDefault ? '(默认)' : ''}
            </option>
          ))}
        </select>
        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={doc.structuredFields.exportWithRedhead}
            onChange={(e) =>
              setDocField({
                structuredFields: {
                  ...doc.structuredFields,
                  exportWithRedhead: e.target.checked,
                },
              })
            }
          />
          导出含红头
        </label>
        <button type="button" onClick={saveDoc} disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </button>
        <button type="button" onClick={handleImportClick}>
          导入 DOCX
        </button>
        <button type="button" onClick={exportDocx} disabled={!ready}>
          导出 DOCX
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

      <div className="editor-layout">
        <StructuredFormPanel
          value={doc.structuredFields}
          onChange={(next) => setDocField({ structuredFields: { ...next, docNo: normalizeDocNoBracket(next.docNo) } })}
        />

        <TiptapEditor
          value={doc.body}
          syncToken={syncToken}
          onChange={(json) => setDocField({ body: json })}
          onReady={(editor) => {
            editorRef.current = editor
          }}
          titleText={doc.structuredFields.title || doc.title}
          mainToText={doc.structuredFields.mainTo}
          signOffText={doc.structuredFields.signOff}
          dateText={doc.structuredFields.date}
          attachments={doc.structuredFields.attachments}
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
