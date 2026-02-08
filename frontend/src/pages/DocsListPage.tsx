import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { GovDoc, RedheadTemplate, Unit } from '../api/types'

const EMPTY_BODY = {
  type: 'doc',
  content: [
    { type: 'paragraph', attrs: { firstLineIndentChars: 2 }, content: [{ type: 'text', text: '请输入正文内容。' }] },
  ],
}

const DOC_TYPE_LABEL: Record<GovDoc['docType'], string> = {
  qingshi: '请示',
  jiyao: '纪要',
  han: '函',
  tongzhi: '通知',
}

export function DocsListPage() {
  const [docs, setDocs] = useState<GovDoc[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(false)

  const [unitName, setUnitName] = useState('')
  const [unitCode, setUnitCode] = useState('')
  const [creatingUnit, setCreatingUnit] = useState(false)

  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const [docRes, unitRes] = await Promise.all([api.get<GovDoc[]>('/api/docs'), api.get<Unit[]>('/api/units')])
      setDocs(docRes.data)
      setUnits(unitRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const unitMap = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u.name])), [units])

  const createDoc = async (docType: GovDoc['docType']) => {
    if (!units.length) {
      alert('请先新增单位')
      return
    }
    const unit = units[0]
    const tplRes = await api.get<RedheadTemplate[]>('/api/redheadTemplates', { params: { unitId: unit.id } })
    const defaultTemplate = tplRes.data.find((t) => t.isDefault) || tplRes.data[0]
    const defaultTitle = docType === 'tongzhi' ? '新建通知' : '新建公文'

    const payload = {
      title: defaultTitle,
      docType,
      unitId: unit.id,
      redheadTemplateId: defaultTemplate?.id || null,
      status: 'draft',
      structuredFields: {
        title: '',
        mainTo: '',
        signOff: '',
        docNo: '',
        signatory: '',
        copyNo: '',
        date: '',
        exportWithRedhead: true,
        attachments: [],
      },
      body: EMPTY_BODY,
    }

    const res = await api.post<{ id: string }>('/api/docs', payload)
    navigate(`/docs/${res.data.id}`)
  }

  const removeDoc = async (doc: GovDoc) => {
    const ok = window.confirm(`确认删除《${doc.title}》吗？此操作不可恢复。`)
    if (!ok) return

    await api.delete(`/api/docs/${doc.id}`)
    await load()
  }

  const createUnit = async () => {
    const name = unitName.trim()
    if (!name) {
      alert('单位名称不能为空')
      return
    }

    setCreatingUnit(true)
    try {
      const res = await api.post<Unit>('/api/units', {
        name,
        code: unitCode.trim() || undefined,
      })
      setUnitName('')
      setUnitCode('')
      await load()
      alert(`已新增单位：${res.data.name}`)
    } catch (error: any) {
      const message = error?.response?.data?.detail || '新增单位失败'
      alert(String(message))
    } finally {
      setCreatingUnit(false)
    }
  }

  return (
    <div className="page">
      <div className="header-row">
        <h2>公文列表</h2>
        <div className="row-gap">
          <button type="button" onClick={() => createDoc('qingshi')}>
            新建请示
          </button>
          <button type="button" onClick={() => createDoc('jiyao')}>
            新建纪要
          </button>
          <button type="button" onClick={() => createDoc('han')}>
            新建函
          </button>
          <button type="button" onClick={() => createDoc('tongzhi')}>
            新建通知
          </button>
        </div>
      </div>

      <div className="unit-editor-card">
        <strong>新增单位</strong>
        <div className="row-gap">
          <input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="单位名称（必填）" />
          <input value={unitCode} onChange={(e) => setUnitCode(e.target.value)} placeholder="单位编码（可选）" />
          <button type="button" onClick={() => void createUnit()} disabled={creatingUnit}>
            {creatingUnit ? '新增中...' : '新增单位'}
          </button>
        </div>
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>类型</th>
              <th>单位</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.title}</td>
                <td>{DOC_TYPE_LABEL[doc.docType] || doc.docType}</td>
                <td>{unitMap[doc.unitId] || doc.unitId}</td>
                <td>{new Date(doc.updatedAt).toLocaleString()}</td>
                <td className="row-gap">
                  <button type="button" onClick={() => navigate(`/docs/${doc.id}`)}>
                    编辑
                  </button>
                  <button type="button" onClick={() => void removeDoc(doc)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
