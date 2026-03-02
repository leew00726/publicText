import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { clearEmployeeSession, listModulesByRole, loadEmployeeSession } from '../utils/employeeAuth'

export function ModuleHubPage() {
  const navigate = useNavigate()
  const session = loadEmployeeSession()

  const modules = useMemo(() => listModulesByRole(session?.role ?? 'staff'), [session?.role])

  if (!session) {
    return null
  }

  return (
    <main className="module-shell">
      <section className="module-header">
        <div>
          <p className="module-kicker">欢迎回来</p>
          <h1>员工工作台</h1>
          <p className="module-user">
            当前用户：{session.username}
            <span className={`role-badge ${session.role}`}>{session.role === 'admin' ? '管理员' : '普通员工'}</span>
          </p>
        </div>
        <button
          type="button"
          className="logout-btn"
          onClick={() => {
            clearEmployeeSession()
            navigate('/', { replace: true })
          }}
        >
          退出登录
        </button>
      </section>

      <section className="module-grid" aria-label="系统模块">
        {modules.map((moduleItem) => (
          <article className={`module-card ${moduleItem.enabled ? '' : 'locked'}`} key={moduleItem.key}>
            <p className="module-tag">{moduleItem.key.toUpperCase()}</p>
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
