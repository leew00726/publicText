import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { GovDoc, Topic, Unit } from '../api/types'

const DOC_TYPE_LABEL: Record<string, string> = {
  qingshi: '请示',
  jiyao: '纪要',
  han: '函',
  tongzhi: '通知',
}

export function DocsListPage() {
  const navigate = useNavigate()

  const [docs, setDocs] = useState<GovDoc[]>([])
  const [companies, setCompanies] = useState<Unit[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const [companyId, setCompanyId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [title, setTitle] = useState('')

  const loadDocsAndCompanies = async () => {
    setLoading(true)
    try {
      const [docRes, companyRes] = await Promise.all([api.get<GovDoc[]>('/api/docs'), api.get<Unit[]>('/api/companies')])
      setDocs(docRes.data)
      setCompanies(companyRes.data)

      const firstCompanyId = companyRes.data[0]?.id || ''
      setCompanyId((prev) => prev || firstCompanyId)
    } finally {
      setLoading(false)
    }
  }

  const loadTopics = async (nextCompanyId: string) => {
    if (!nextCompanyId) {
      setTopics([])
      setTopicId('')
      return
    }
    const res = await api.get<Topic[]>('/api/topics', { params: { companyId: nextCompanyId } })
    setTopics(res.data)
    setTopicId((prev) => (prev && res.data.some((t) => t.id === prev) ? prev : res.data[0]?.id || ''))
  }

  useEffect(() => {
    void loadDocsAndCompanies()
  }, [])

  useEffect(() => {
    void loadTopics(companyId)
  }, [companyId])

  const companyMap = useMemo(() => Object.fromEntries(companies.map((item) => [item.id, item.name])), [companies])

  const createDocFromTopic = async () => {
    const selectedTopic = topics.find((item) => item.id === topicId)
    if (!companyId) {
      alert('请先选择公司')
      return
    }
    if (!selectedTopic) {
      alert('请先选择题材')
      return
    }

    setCreating(true)
    try {
      const created = await api.post<{ id: string }>(`/api/topics/${selectedTopic.id}/docs`, {
        title: title.trim() || `${selectedTopic.name}（新建）`,
      })
      navigate(`/docs/${created.data.id}`)
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '新建文档失败'
      alert(String(detail))
    } finally {
      setCreating(false)
    }
  }

  const removeDoc = async (doc: GovDoc) => {
    const ok = window.confirm(`确认删除《${doc.title}》吗？此操作不可恢复。`)
    if (!ok) return
    await api.delete(`/api/docs/${doc.id}`)
    await loadDocsAndCompanies()
  }

  return (
    <div className="page">
      <div className="header-row">
        <h2>公文列表</h2>
        <div className="row-gap">
          <button type="button" onClick={() => navigate('/')}>
            返回公司与题材
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>新建公文（按公司 + 题材）</h3>
        <div className="row-gap">
          <label>
            公司
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {companies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            题材
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!topics.length}>
              {topics.length === 0 ? <option value="">暂无题材</option> : null}
              {topics.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            标题（可选）
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="不填则自动使用题材名" />
          </label>
          <button type="button" onClick={() => void createDocFromTopic()} disabled={creating || !companyId || !topicId}>
            {creating ? '创建中...' : '新建文档'}
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
              <th>公司</th>
              <th>题材</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.title}</td>
                <td>{DOC_TYPE_LABEL[doc.docType] || doc.docType}</td>
                <td>{companyMap[doc.unitId] || doc.unitId}</td>
                <td>{doc.structuredFields.topicName || '-'}</td>
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
