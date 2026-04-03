import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { listModulesByRole, loadEmployeeSession, type EmployeeModule, type ModuleKey } from '../utils/employeeAuth'

type ModulePresentation = {
  tag: string
  eyebrow: string
  heading: string
  summary: string
  steps: string[]
  accentClass: string
}

const MODULE_PRESENTATIONS: Record<ModuleKey, ModulePresentation> = {
  summary: {
    tag: 'SUMMARY',
    eyebrow: '提炼归纳',
    heading: '快速形成结构化摘要',
    summary: '上传材料或直接粘贴正文，按固定输出要求整理重点内容与决策信息。',
    steps: ['上传材料', '输入要求', '生成并导出'],
    accentClass: 'is-summary',
  },
  layout: {
    tag: 'LAYOUT',
    eyebrow: '排版输出',
    heading: '按题材进入正文编排流程',
    summary: '从题材库、模板版本到正文编辑与导出，统一处理整套发文流程。',
    steps: ['进入题材库', '选择模板', '编辑并导出'],
    accentClass: 'is-layout',
  },
  management: {
    tag: 'MANAGEMENT',
    eyebrow: '治理配置',
    heading: '集中维护模板与权限边界',
    summary: '管理公司、题材、模板版本和文档资产，保障发文流程持续可控。',
    steps: ['维护公司', '治理题材', '管理模板'],
    accentClass: 'is-management',
  },
  meetingMinutes: {
    tag: 'MINUTES',
    eyebrow: '会务沉淀',
    heading: '预留会议纪要协同入口',
    summary: '当前先开放前端占位模块，后续将接入会议纪要整理、分发与归档流程。',
    steps: ['录入会议材料', '生成纪要草稿', '同步待办事项'],
    accentClass: 'is-meeting',
  },
}

export function ModuleHubPage() {
  const navigate = useNavigate()
  const session = loadEmployeeSession()

  const modules = useMemo(() => listModulesByRole(session?.role ?? 'staff'), [session?.role])
  const enabledModules = useMemo(() => modules.filter((moduleItem) => moduleItem.enabled), [modules])
  const companyName = session?.companyName || '云成数科'
  const roleLabel = session?.role === 'admin' ? '管理员' : '普通员工'

  if (!session) {
    return null
  }

  return (
    <main className="page workspace-page workspace-dashboard">
      <section className="glass-card workspace-hero">
        <div className="workspace-hero-copy">
          <p className="workspace-hero-kicker">今日工作台</p>
          <h2>欢迎回来，{session.username}</h2>
          <div className="workspace-hero-pills" aria-label="工作台概览">
            <span className="soft-pill">公司归属 {companyName}</span>
            <span className={`soft-pill ${session.role === 'admin' ? 'is-admin' : ''}`}>当前角色 {roleLabel}</span>
            <span className="soft-pill">当前可用 {enabledModules.length} 个模块</span>
          </div>
        </div>
      </section>

      <section className="module-grid workspace-module-grid" aria-label="当前可用模块">
        {modules.map((moduleItem) => (
          <ModuleCard key={moduleItem.key} moduleItem={moduleItem} onEnter={() => navigate(moduleItem.entryPath)} />
        ))}
      </section>
    </main>
  )
}

function ModuleCard({ moduleItem, onEnter }: { moduleItem: EmployeeModule; onEnter: () => void }) {
  const presentation = MODULE_PRESENTATIONS[moduleItem.key]

  return (
    <article
      className={`glass-card module-card workspace-module-card ${presentation.accentClass} ${
        moduleItem.enabled ? '' : 'locked'
      }`}
    >
      <div className="module-card-topline">
        <p className="module-tag">{presentation.tag}</p>
        <span className={`status-pill ${moduleItem.enabled ? 'ready' : 'muted'}`}>
          {moduleItem.enabled ? '可进入' : '暂无权限'}
        </span>
      </div>

      <div className="module-card-copy">
        <span className="module-card-eyebrow">{presentation.eyebrow}</span>
        <h2>{moduleItem.title}</h2>
        <strong>{presentation.heading}</strong>
        <p>{presentation.summary}</p>
      </div>

      <ul className="module-card-steps" aria-label={`${moduleItem.title}流程概览`}>
        {presentation.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>

      <div className="module-card-footer">
        <p>{moduleItem.description}</p>
        <button type="button" className="module-enter-btn" disabled={!moduleItem.enabled} onClick={onEnter}>
          {moduleItem.enabled ? `进入${moduleItem.title}` : '暂无权限'}
        </button>
      </div>
    </article>
  )
}
