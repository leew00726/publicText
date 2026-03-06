import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import { listModulesByRole, loadEmployeeSession } from '../utils/employeeAuth'

export function ModuleHubPage() {
  const navigate = useNavigate()
  const session = loadEmployeeSession()

  const modules = useMemo(() => listModulesByRole(session?.role ?? 'staff'), [session?.role])

  if (!session) {
    return null
  }

  return (
    <main className="page workspace-page">
      <PageHeader
        eyebrow="Workspace"
        title="员工工作台"
        description="在统一应用壳中进入公文总结、公文排版和公文管理模块，继续各自的工作流。"
        meta={
          <>
            <span className="soft-pill">员工 {session.username}</span>
            <span className={`soft-pill ${session.role === 'admin' ? 'is-admin' : ''}`}>
              {session.role === 'admin' ? '管理员' : '普通员工'}
            </span>
            <span className="soft-pill">所属公司 {session.companyName || '云成数科'}</span>
          </>
        }
      />

      <section className="workspace-summary-grid">
        <article className="glass-card spotlight-card">
          <p className="spotlight-kicker">Today</p>
          <h2>统一的蓝白工作台</h2>
          <p>所有入口都收敛到同一套导航和卡片系统中，后续权限细分只需要继续扩展这套壳层。</p>
        </article>

        <article className="glass-card spotlight-card secondary">
          <p className="spotlight-kicker">Company</p>
          <h2>{session.companyName || '云成数科'}</h2>
          <p>登录后已自动识别所属公司，你后续的题材库、文档库和管理视图都会围绕这家公司展开。</p>
        </article>
      </section>

      <section className="module-grid" aria-label="系统模块">
        {modules.map((moduleItem) => (
          <article className={`glass-card module-card ${moduleItem.enabled ? '' : 'locked'}`} key={moduleItem.key}>
            <div className="module-card-header">
              <p className="module-tag">{moduleItem.key.toUpperCase()}</p>
              <span className={`status-pill ${moduleItem.enabled ? 'ready' : 'muted'}`}>
                {moduleItem.enabled ? '可进入' : '暂无权限'}
              </span>
            </div>
            <h2>{moduleItem.title}</h2>
            <p>{moduleItem.description}</p>
            <button
              type="button"
              className="module-enter-btn"
              disabled={!moduleItem.enabled}
              onClick={() => {
                if (!moduleItem.enabled) return
                navigate(moduleItem.entryPath)
              }}
            >
              {moduleItem.enabled ? '进入模块' : '暂无权限'}
            </button>
          </article>
        ))}
      </section>
    </main>
  )
}
