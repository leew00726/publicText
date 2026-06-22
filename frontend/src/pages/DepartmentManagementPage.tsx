import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { api } from '../api/client'
import type { Department, GovDoc, Unit } from '../api/types'
import { formatServerDateTime } from '../utils/time'


const DOC_TYPE_LABELS: Record<GovDoc['docType'], string> = {
  qingshi: '请示',
  jiyao: '纪要',
  han: '函',
  tongzhi: '通知',
}

const DOC_STATUS_LABELS: Record<string, string> = {
  draft: '编辑中',
  published: '已完成',
  archived: '已归档',
}


type DepartmentManagementPageProps = {
  initialCompanyName?: string
  initialDepartments?: Department[]
  initialDocuments?: GovDoc[]
}

export function DepartmentManagementPage({
  initialCompanyName = '',
  initialDepartments = [],
  initialDocuments = [],
}: DepartmentManagementPageProps) {
  const { companyId = '' } = useParams()
  const navigate = useNavigate()
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [companyName, setCompanyName] = useState(initialCompanyName)
  const [departments, setDepartments] = useState<Department[]>(initialDepartments)
  const [documents, setDocuments] = useState<GovDoc[]>(initialDocuments)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(initialDepartments[0]?.id || '')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(initialDepartments.length === 0 && initialDocuments.length === 0)
  const [errorMessage, setErrorMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploadError, setUploadError] = useState('')

  const load = async () => {
    if (!companyId) return
    setLoading(true)
    setErrorMessage('')
    try {
      const [departmentResponse, companyResponse, documentResponse] = await Promise.all([
        api.get<Department[]>(`/api/management/units/${companyId}/departments`),
        api.get<Unit[]>('/api/management/companies'),
        api.get<GovDoc[]>('/api/layout/docs', { params: { unitId: companyId } }),
      ])
      const nextDepartments = departmentResponse.data
      const company = companyResponse.data.find((item) => item.id === companyId)
      setDepartments(nextDepartments)
      setDocuments(documentResponse.data)
      setCompanyName(company?.name || '公司部门')
      setSelectedDepartmentId((current) => (
        nextDepartments.some((item) => item.id === current) ? current : nextDepartments[0]?.id || ''
      ))
    } catch (error: any) {
      setErrorMessage(String(error?.response?.data?.detail || '部门和公文数据加载失败，请稍后重试。'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialDepartments.length > 0 || initialDocuments.length > 0) return
    void load()
  }, [companyId])

  const uploadDocument = async (file?: File) => {
    if (!file || !companyId || uploading) return
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setUploadMessage('')
      setUploadError('仅支持 DOCX 文件')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadMessage('')
      setUploadError('文件大小不能超过 20MB')
      return
    }

    const title = file.name.replace(/\.docx$/i, '') || '导入文档'
    const docType: GovDoc['docType'] = title.includes('纪要')
      ? 'jiyao'
      : title.includes('通知')
        ? 'tongzhi'
        : title.includes('函')
          ? 'han'
          : 'qingshi'
    const form = new FormData()
    form.append('file', file)
    form.append('unitId', companyId)
    form.append('docType', docType)
    form.append('preserveFormatting', 'true')
    form.append('title', title)

    setUploading(true)
    setUploadMessage('')
    setUploadError('')
    try {
      await api.post<{ docId: string; importReport: any }>('/api/layout/docs/importDocx', form, {
        timeout: 180000,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await load()
      setUploadMessage(`上传成功：${title}`)
    } catch (error: any) {
      setUploadError(String(error?.response?.data?.detail || '文件上传失败，请稍后重试。'))
    } finally {
      setUploading(false)
    }
  }

  const selectedDepartment = useMemo(
    () => departments.find((item) => item.id === selectedDepartmentId) || departments[0],
    [departments, selectedDepartmentId],
  )
  const totalMembers = useMemo(
    () => departments.reduce((sum, item) => sum + item.memberCount, 0),
    [departments],
  )
  const visibleDocuments = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return documents
    return documents.filter((document) => (
      document.title.toLowerCase().includes(keyword)
      || String(document.structuredFields?.title || '').toLowerCase().includes(keyword)
      || String(document.structuredFields?.docNo || '').toLowerCase().includes(keyword)
      || String(document.structuredFields?.topicName || '').toLowerCase().includes(keyword)
      || DOC_TYPE_LABELS[document.docType].includes(keyword)
      || String(DOC_STATUS_LABELS[document.status] || document.status).toLowerCase().includes(keyword)
    ))
  }, [documents, query])

  return (
    <main className="page workspace-page module-workbench-page department-management-page">
      <header className="department-overview-header">
        <div className="department-overview-copy">
          <span className="department-overview-eyebrow">公司组织</span>
          <h1>部门总览</h1>
          <p>{companyName || '正在读取公司信息'}</p>
        </div>
        <div className="department-overview-actions">
          <div className="department-overview-stat">
            <span>组织部门</span>
            <strong>{departments.length} 个部门</strong>
          </div>
          <div className="department-overview-stat">
            <span>在册人员</span>
            <strong>{totalMembers} 人</strong>
          </div>
          {companyId ? (
            <Link className="department-topic-link" to={`/management/companies/${companyId}/topics`}>
              进入题材管理
            </Link>
          ) : (
            <span className="department-topic-link is-disabled">进入题材管理</span>
          )}
        </div>
      </header>

      {errorMessage ? (
        <section className="inline-status-card department-error-state">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => void load()}>重新加载</button>
        </section>
      ) : null}

      <section className="department-directory-layout">
        <aside className="department-index-panel" aria-label="部门列表">
          <div className="department-panel-heading">
            <div>
              <span>组织架构</span>
              <h2>全部部门</h2>
            </div>
          </div>

          {loading ? (
            <div className="department-loading-state">正在加载部门...</div>
          ) : departments.length === 0 ? (
            <div className="department-loading-state">暂无部门数据</div>
          ) : (
            <div className="department-index-list">
              {departments.map((department) => {
                const selected = selectedDepartment?.id === department.id
                return (
                  <button
                    key={department.id}
                    type="button"
                    className={selected ? 'department-index-item is-active' : 'department-index-item'}
                    aria-pressed={selected}
                    onClick={() => setSelectedDepartmentId(department.id)}
                  >
                    <span>{department.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        <section className="department-document-panel" aria-label="公司公文列表">
          <div className="department-document-header">
            <div className="department-document-title">
              <span>公文列表</span>
              <h2>{companyName || '公司公文'}</h2>
              <p>{loading ? '正在同步公文...' : `共 ${documents.length} 份公文`}</p>
            </div>
            <div className="department-document-tools">
              <label className="department-search-field">
                <span>搜索公文</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="标题、文号或题材"
                  disabled={loading || documents.length === 0}
                />
              </label>
              <button
                type="button"
                className="department-upload-button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={!companyId || uploading}
              >
                {uploading ? '上传中...' : '上传文件'}
              </button>
              <input
                ref={uploadInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  void uploadDocument(file)
                  event.currentTarget.value = ''
                }}
              />
            </div>
          </div>

          {uploadMessage || uploadError ? (
            <div
              className={uploadError ? 'department-upload-feedback is-error' : 'department-upload-feedback is-success'}
              role={uploadError ? 'alert' : 'status'}
            >
              {uploadError || uploadMessage}
            </div>
          ) : null}

          <div className="department-document-table-wrap">
            <table className="data-table department-document-table">
              <thead>
                <tr>
                  <th>公文标题</th>
                  <th>文种</th>
                  <th>更新时间</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {visibleDocuments.length > 0 ? visibleDocuments.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <div className="department-document-name">
                        <button
                          type="button"
                          className="department-document-link"
                          onClick={() => navigate(`/layout/docs/${document.id}`)}
                        >
                          {document.title || document.structuredFields?.title || '未命名公文'}
                        </button>
                        {document.structuredFields?.docNo ? <span>{document.structuredFields.docNo}</span> : null}
                      </div>
                    </td>
                    <td>{DOC_TYPE_LABELS[document.docType]}</td>
                    <td>{formatServerDateTime(document.updatedAt)}</td>
                    <td>
                      <span className={`document-status is-${document.status}`}>
                        {DOC_STATUS_LABELS[document.status] || document.status || '待处理'}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="department-document-empty">
                      {loading ? '正在加载公文...' : query ? '没有匹配的公文' : '该公司暂无公文'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  )
}
