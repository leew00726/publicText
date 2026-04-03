import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../api/client'
import type { Topic, TopicTemplate } from '../api/types'
import { loadEmployeeSession } from '../utils/employeeAuth'
import { canAccessPage, canPerformAction } from '../utils/pagePermissions'
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
  const role = loadEmployeeSession()?.role || 'staff'
  const canEnterManagementTrain = canAccessPage(role, 'management.topicTrain')
  const canDeleteTemplate = canPerformAction(role, 'management.template.delete')

  const load = async () => {
    if (!topicId) return
    setLoading(true)
    try {
      const [topicRes, templateRes] = await Promise.all([
        api.get<Topic>(`/api/management/topics/${topicId}`),
        api.get<TopicTemplate[]>(`/api/management/topics/${topicId}/templates`),
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
    navigate(`/management/topics/${topicId}/train`)
  }

  const createDoc = async () => {
    if (!topicId) return
    if (!selectedTemplateId) {
      alert('请先选择模板')
      return
    }

    setCreating(true)
    try {
      const res = await api.post<CreateDocResponse>(`/api/management/topics/${topicId}/docs`, {
        title: title.trim() || undefined,
        topicTemplateId: selectedTemplateId,
      })
      navigate(`/layout/docs/${res.data.id}`)
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '创建正文失败'
      alert(String(detail))
    } finally {
      setCreating(false)
    }
  }

  const deleteSelectedTemplate = async () => {
    if (!canDeleteTemplate) {
      alert('当前账号无删除模板权限，请联系管理员处理。')
      return
    }
    if (!topicId || !selectedTemplate) return
    const confirmed = window.confirm(
      `确认删除模板 v${selectedTemplate.version}${selectedTemplate.effective ? '（当前生效）' : ''}？`,
    )
    if (!confirmed) return

    setDeletingTemplateId(selectedTemplate.id)
    setMessage('')
    try {
      await api.delete(`/api/management/topics/${topicId}/templates/${selectedTemplate.id}`)
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
    <main className="page workspace-page layout-page-scale">
      {message ? <div className="inline-status-card">{message}</div> : null}

      {loading ? (
        <div className="workspace-table-card">加载中...</div>
      ) : !topic ? (
        <div className="workspace-table-card">题材不存在或加载失败。</div>
      ) : templates.length === 0 ? (
        <section className="panel">
          <h3>当前还没有可用模板</h3>
          <p>请先进入模板训练页，通过文字要求直接生成模板，或上传样本提取规则后确认模板，再开始正文编辑。</p>
          {canEnterManagementTrain ? (
            <div className="row-gap">
              <button type="button" onClick={goTrainPage}>
                新建模板（进入训练）
              </button>
            </div>
          ) : (
            <p>当前账号无模板训练权限，请联系管理员在“公文管理”模块创建模板。</p>
          )}
        </section>
      ) : (
        <section className="panel">
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
            {canEnterManagementTrain ? (
              <button type="button" onClick={goTrainPage}>
                新建模板（进入训练）
              </button>
            ) : null}
            {canDeleteTemplate ? (
              <button
                type="button"
                onClick={() => void deleteSelectedTemplate()}
                disabled={!selectedTemplate || deletingTemplateId === selectedTemplate?.id}
              >
                {deletingTemplateId === selectedTemplate?.id ? '删除中...' : '删除当前模板'}
              </button>
            ) : null}
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
        </section>
      )}
    </main>
  )
}
