import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../api/client'
import type { Topic, Unit } from '../api/types'

const TOPIC_STATUS_LABEL: Record<string, string> = {
  active: '启用',
  disabled: '停用',
}

export function TopicListPage() {
  const { companyId = '' } = useParams()
  const navigate = useNavigate()

  const [companies, setCompanies] = useState<Unit[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const load = async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const [companyRes, topicRes] = await Promise.all([
        api.get<Unit[]>('/api/companies'),
        api.get<Topic[]>('/api/topics', { params: { companyId } }),
      ])
      setCompanies(companyRes.data)
      setTopics(topicRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [companyId])

  const currentCompany = useMemo(() => companies.find((item) => item.id === companyId), [companies, companyId])

  const createTopic = async () => {
    const topicName = name.trim()
    if (!topicName) {
      alert('请输入题材名称')
      return
    }

    setCreating(true)
    try {
      await api.post<Topic>('/api/topics', {
        companyId,
        name: topicName,
        description: description.trim() || undefined,
      })
      setName('')
      setDescription('')
      await load()
    } catch (error: any) {
      const message = error?.response?.data?.detail || '新建题材失败'
      alert(String(message))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="page">
      <div className="header-row">
        <h2>题材库{currentCompany ? ` - ${currentCompany.name}` : ''}</h2>
        <button type="button" onClick={() => navigate('/')}>
          返回公司选择
        </button>
      </div>

      <div className="unit-editor-card">
        <strong>新建题材</strong>
        <div className="row-gap">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：周例会纪要" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="题材说明（可选）" />
          <button type="button" onClick={() => void createTopic()} disabled={creating || !companyId}>
            {creating ? '创建中...' : '创建题材'}
          </button>
        </div>
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : topics.length === 0 ? (
        <p>该公司题材库为空，请先新建题材并上传训练材料。</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>题材名称</th>
              <th>编码</th>
              <th>状态</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((topic) => (
              <tr key={topic.id}>
                <td>{topic.name}</td>
                <td>{topic.code}</td>
                <td>{TOPIC_STATUS_LABEL[topic.status] || topic.status}</td>
                <td>{new Date(topic.updatedAt).toLocaleString()}</td>
                <td>
                  <button type="button" onClick={() => navigate(`/topics/${topic.id}`)}>
                    进入
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
