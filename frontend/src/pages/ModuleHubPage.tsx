import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { HologramLogo } from '../components/HologramLogo'
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
      <HologramLogo />

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
