import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../api/client'
import type { Topic, TopicTemplate } from '../api/types'
import { pickDefaultTopicTemplateId } from '../utils/topicCompose'
import { summarizeRulesAsNarrative } from '../utils/topicNarrative'

type CreateDocResponse = {
  id: string
}

export function TopicComposePage() {
  const { topicId = '' } = useParams()
  const navigate = useNavigate()

  const [topic, setTopic] = useState<Topic | null>(null)
  const [templates, setTemplates] = useState<TopicTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const load = async () => {
    if (!topicId) return
    setLoading(true)
    try {
      const [topicRes, templateRes] = await Promise.all([
        api.get<Topic>(`/api/topics/${topicId}`),
        api.get<TopicTemplate[]>(`/api/topics/${topicId}/templates`),
      ])
      setTopic(topicRes.data)
      setTemplates(templateRes.data)
      setSelectedTemplateId(pickDefaultTopicTemplateId(templateRes.data))
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '加载题材失败'
      alert(String(detail))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [topicId])

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) || null,
    [templates, selectedTemplateId],
  )
  const selectedTemplateNarrative = useMemo(
    () => (selectedTemplate ? summarizeRulesAsNarrative(selectedTemplate.rules || {}) : []),
    [selectedTemplate],
  )

  const goTrainPage = () => {
    if (!topicId) return
    navigate(`/topics/${topicId}/train`)
  }

  const createDoc = async () => {
    if (!topicId) return
    if (!selectedTemplateId) {
      alert('请先选择模板')
      return
    }

    setCreating(true)
    try {
      const res = await api.post<CreateDocResponse>(`/api/topics/${topicId}/docs`, {
        title: title.trim() || undefined,
        topicTemplateId: selectedTemplateId,
      })
      navigate(`/docs/${res.data.id}`)
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '创建正文失败'
      alert(String(detail))
    } finally {
      setCreating(false)
    }
  }

  const deleteSelectedTemplate = async () => {
    if (!topicId || !selectedTemplate) return
    const confirmed = window.confirm(
      `确认删除模板 v${selectedTemplate.version}${selectedTemplate.effective ? '（当前生效）' : ''}？`,
    )
    if (!confirmed) return

    setDeletingTemplateId(selectedTemplate.id)
    setMessage('')
    try {
      await api.delete(`/api/topics/${topicId}/templates/${selectedTemplate.id}`)
      setMessage(`模板 v${selectedTemplate.version} 已删除。`)
      await load()
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '删除模板失败'
      alert(String(detail))
    } finally {
      setDeletingTemplateId(null)
    }
  }

  return (
    <div className="page">
      <div className="header-row">
        <h2>正文编辑入口{topic ? ` - ${topic.name}` : ''}</h2>
      </div>

      {message ? <div className="unit-editor-card">{message}</div> : null}

      {loading ? (
        <p>加载中...</p>
      ) : !topic ? (
        <p>题材不存在或加载失败。</p>
      ) : templates.length === 0 ? (
        <div className="panel">
          <h3>当前还没有可用模板</h3>
          <p>请先上传材料训练并确认模板，然后再开始正文编辑。</p>
          <div className="row-gap">
            <button type="button" onClick={goTrainPage}>
              新建模板（进入训练）
            </button>
          </div>
        </div>
      ) : (
        <div className="panel">
          <h3>选择模板并进入正文编辑</h3>
          <label>
            模板版本
            <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  v{item.version} {item.effective ? '（当前生效）' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            文档标题（可选）
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${topic.name}（新建）`} />
          </label>
          <div className="row-gap">
            <button type="button" onClick={() => void createDoc()} disabled={creating}>
              {creating ? '创建中...' : '进入正文编辑'}
            </button>
            <button type="button" onClick={goTrainPage}>
              新建模板（进入训练）
            </button>
            <button
              type="button"
              onClick={() => void deleteSelectedTemplate()}
              disabled={!selectedTemplate || deletingTemplateId === selectedTemplate?.id}
            >
              {deletingTemplateId === selectedTemplate?.id ? '删除中...' : '删除当前模板'}
            </button>
          </div>
          {selectedTemplate ? (
            <div className="topic-template-summary">
              <p>
                当前选择：模板 v{selectedTemplate.version}
                {selectedTemplate.effective ? '（生效中）' : ''}
              </p>
              <h4>当前模板明细</h4>
              <ul className="narrative-list">
                {selectedTemplateNarrative.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
