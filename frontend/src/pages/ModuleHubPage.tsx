import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { GovDoc } from '../api/types'
import { listModulesByRole, loadEmployeeSession, type EmployeeModule, type ModuleKey } from '../utils/employeeAuth'
import { formatServerDateTime } from '../utils/time'

type ModulePresentation = {
  eyebrow: string
  heading: string
  summary: string
  steps: string[]
  accentClass: string
}

const MODULE_PRESENTATIONS: Record<ModuleKey, ModulePresentation> = {
  summary: {
    eyebrow: '公文总结',
    heading: '快速形成结构化摘要',
    summary: '上传材料或直接粘贴正文，按固定输出要求整理重点内容与决策信息。',
    steps: ['上传材料', '输入要求', '生成并导出'],
    accentClass: 'is-summary',
  },
  knowledge: {
    eyebrow: '知识库',
    heading: '沉淀可调阅公文材料',
    summary: '上传本地公文文档，形成可检索的写作参考库。',
    steps: ['上传材料', '沉淀索引', '总结调用'],
    accentClass: 'is-knowledge',
  },
  layout: {
    eyebrow: '公文排版',
    heading: '按题材进入正文编排流程',
    summary: '从题材库、模板版本到正文编辑与导出，统一处理整套发文流程。',
    steps: ['选择题材', '编辑正文', '导出归档'],
    accentClass: 'is-layout',
  },
  management: {
    eyebrow: '公文管理',
    heading: '集中维护模板与权限边界',
    summary: '管理公司、题材、模板版本和文档资产，保障发文流程持续可控。',
    steps: ['维护公司', '治理题材', '管理模板'],
    accentClass: 'is-management',
  },
}

type RecentDocSource = Pick<GovDoc, 'id' | 'title' | 'status' | 'updatedAt'> & {
  structuredFields?: Partial<GovDoc['structuredFields']>
}

type RecentDocRow = {
  id: string
  index: string
  title: string
  meta: string
  status: string
}

const RECENT_DOC_LIMIT = 3
const DOC_STATUS_LABELS: Record<string, string> = {
  draft: '编辑中',
  published: '已完成',
  archived: '已归档',
}

function getDocTimestamp(value: string): number {
  const timestamp = Date.parse(value || '')
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export function buildRecentDocRows(docs: RecentDocSource[]): RecentDocRow[] {
  return [...docs]
    .sort((a, b) => getDocTimestamp(b.updatedAt) - getDocTimestamp(a.updatedAt))
    .slice(0, RECENT_DOC_LIMIT)
    .map((doc, index) => ({
      id: doc.id,
      index: String(index + 1).padStart(2, '0'),
      title: doc.title || doc.structuredFields?.title || '未命名文档',
      meta: `${doc.structuredFields?.topicName || '公文排版'} · ${formatServerDateTime(doc.updatedAt)}`,
      status: DOC_STATUS_LABELS[doc.status] || doc.status || '待处理',
    }))
}

export function ModuleHubPage() {
  const navigate = useNavigate()
  const session = loadEmployeeSession()
  const [recentDocs, setRecentDocs] = useState<RecentDocRow[]>([])
  const [recentDocsLoading, setRecentDocsLoading] = useState(false)
  const [recentDocsError, setRecentDocsError] = useState<string | null>(null)

  const modules = useMemo(() => listModulesByRole(session?.role ?? 'staff'), [session?.role])
  const enabledModules = useMemo(() => modules.filter((moduleItem) => moduleItem.enabled), [modules])
  const primaryModule = useMemo(() => modules.find((moduleItem) => moduleItem.key === 'layout') || null, [modules])
  const secondaryModules = useMemo(
    () =>
      (['summary', 'knowledge', 'management'] as ModuleKey[])
        .map((moduleKey) => modules.find((moduleItem) => moduleItem.key === moduleKey))
        .filter((moduleItem): moduleItem is EmployeeModule => Boolean(moduleItem)),
    [modules],
  )
  const companyName = session?.companyName || '云成数科'
  const roleLabel = session?.role === 'admin' ? '管理员' : '普通员工'
  const displayName = session?.displayName || session?.username || '同事'
  const sessionKey = session?.username || ''
  const recentDocCountLabel = recentDocsLoading ? '同步中' : recentDocsError ? '异常' : `${recentDocs.length} 条`

  useEffect(() => {
    if (!sessionKey) return

    let cancelled = false
    setRecentDocsLoading(true)
    setRecentDocsError(null)
    void api.get<GovDoc[]>('/api/layout/docs')
      .then((res) => {
        if (cancelled) return
        setRecentDocs(buildRecentDocRows(res.data))
      })
      .catch((error: any) => {
        if (cancelled) return
        const detail = error?.response?.data?.detail || '最近文档加载失败'
        setRecentDocsError(String(detail))
      })
      .finally(() => {
        if (cancelled) return
        setRecentDocsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sessionKey])

  if (!session) {
    return null
  }

  return (
    <main className="page workspace-page workspace-dashboard">
      <section className="glass-card workspace-panel">
        <section className="workspace-hero" aria-label="工作台概览">
          <div className="workspace-hero-copy">
            <p className="workspace-hero-kicker">今日工作台</p>
            <h2>欢迎回来，{displayName}</h2>
          </div>
          <div className="workspace-overview-stats">
            <div className="workspace-overview-stat">
              <span>公司归属</span>
              <strong>{companyName}</strong>
            </div>
            <div className="workspace-overview-stat">
              <span>当前角色</span>
              <strong>{roleLabel}</strong>
            </div>
            <div className="workspace-overview-stat">
              <span>可用模块</span>
              <strong>{enabledModules.length} 个</strong>
            </div>
          </div>
          <span className="workspace-module-count">当前可用 {enabledModules.length} 个模块</span>
        </section>

        {primaryModule ? <PrimaryModuleCard moduleItem={primaryModule} onEnter={() => navigate(primaryModule.entryPath)} /> : null}

        <section className="workspace-secondary-modules" aria-label="当前可用模块">
          {secondaryModules.map((moduleItem) => (
            <SecondaryModuleCard key={moduleItem.key} moduleItem={moduleItem} onEnter={() => navigate(moduleItem.entryPath)} />
          ))}
        </section>

        <section className="workspace-recent-docs" aria-label="最近文档">
          <div className="workspace-recent-header">
            <div className="workspace-recent-heading">
              <h3>最近文档</h3>
              <span className="workspace-recent-count">{recentDocCountLabel}</span>
            </div>
            <button
              type="button"
              className="workspace-text-button"
              aria-label="查看全部最近文档"
              onClick={() => navigate(primaryModule?.entryPath || '/layout')}
            >
              查看全部
            </button>
          </div>
          <ul className="workspace-recent-list">
            {recentDocsLoading ? (
              <li className="workspace-recent-state">正在加载最近文档...</li>
            ) : recentDocsError ? (
              <li className="workspace-recent-state">{recentDocsError}</li>
            ) : recentDocs.length === 0 ? (
              <li className="workspace-recent-state">暂无最近文档</li>
            ) : (
              recentDocs.map((doc) => (
                <li key={doc.id}>
                  <span className="workspace-recent-index">{doc.index}</span>
                  <button type="button" className="workspace-recent-title" onClick={() => navigate(`/layout/docs/${doc.id}`)}>
                    {doc.title}
                  </button>
                  <span className="workspace-recent-meta">{doc.meta}</span>
                  <span className="workspace-recent-status">{doc.status}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </section>
    </main>
  )
}

function PrimaryModuleCard({ moduleItem, onEnter }: { moduleItem: EmployeeModule; onEnter: () => void }) {
  const presentation = MODULE_PRESENTATIONS[moduleItem.key]

  return (
    <article
      className={`workspace-primary-module workspace-module-card ${presentation.accentClass} ${
        moduleItem.enabled ? '' : 'locked'
      }`}
    >
      <div className="module-card-copy">
        <h2>{moduleItem.title}</h2>
      </div>

      <div className="workspace-primary-flow" aria-label={`${moduleItem.title}流程概览`}>
        {presentation.steps.map((step) => (
          <div key={step} className="workspace-flow-step">
            <strong>{step}</strong>
          </div>
        ))}
      </div>

      <div className="module-card-footer">
        <button type="button" className="module-enter-btn" disabled={!moduleItem.enabled} onClick={onEnter}>
          {moduleItem.enabled ? `进入${moduleItem.title}` : '暂无权限'}
        </button>
      </div>
    </article>
  )
}

function SecondaryModuleCard({ moduleItem, onEnter }: { moduleItem: EmployeeModule; onEnter: () => void }) {
  const presentation = MODULE_PRESENTATIONS[moduleItem.key]

  return (
    <article className={`workspace-secondary-module workspace-module-card ${presentation.accentClass} ${moduleItem.enabled ? '' : 'locked'}`}>
      <div className="module-card-copy">
        <span className="module-card-eyebrow">
          <span className="workspace-module-tier">协同模块</span>
          <span>{presentation.eyebrow}</span>
        </span>
        <h2>{moduleItem.title}</h2>
        <strong>{presentation.heading}</strong>
        <p>{presentation.summary}</p>
      </div>

      <p className="workspace-secondary-flow">{presentation.steps.join(' / ')}</p>

      <div className="module-card-footer">
        <button type="button" className="workspace-link-button" disabled={!moduleItem.enabled} onClick={onEnter}>
          {moduleItem.enabled ? `进入${moduleItem.title}` : '暂无权限'}
        </button>
      </div>
    </article>
  )
}
