import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../api/client'
import type { AuthLoginResponse } from '../api/types'
import {
  createEmployeeSession,
  loadEmployeeSession,
  saveEmployeeSession,
  validateEmployeeLogin,
} from '../utils/employeeAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (loadEmployeeSession()) {
      navigate('/workspace', { replace: true })
    }
  }, [navigate])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    const validation = validateEmployeeLogin(username, password)
    setUsernameError(validation.usernameError)
    setPasswordError(validation.passwordError)

    if (!validation.valid) return

    setSubmitting(true)
    try {
      const resp = await api.post<AuthLoginResponse>('/api/auth/login', {
        username: validation.normalizedUsername,
        password,
      })
      const session = createEmployeeSession(resp.data.employeeNo, resp.data.role, {
        id: resp.data.companyId,
        name: resp.data.companyName,
        employeeName: resp.data.name,
      })
      saveEmployeeSession(session)
      navigate('/workspace', { replace: true })
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '登录失败，请检查工号或密码'
      alert(String(detail))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-scene">
        <div className="auth-stage-orbit auth-stage-orbit-left" aria-hidden="true" />
        <div className="auth-stage-orbit auth-stage-orbit-right" aria-hidden="true" />

        <div className="auth-stage-title-wrap" aria-hidden="true">
          <p className="auth-stage-kicker">Workspace Access</p>
          <h1 className="auth-stage-title">云矩公文管理平台</h1>
        </div>

        <article className="auth-brand-panel auth-panel-reveal">
          <div className="auth-brand-copy">
            <p className="auth-kicker">YUNJU DOCUMENT HUB</p>
            <h2 className="auth-title">统一进入总结、排版与治理流程</h2>
            <p className="auth-subtitle">
              登录后直接落到员工所属公司的工作区。工号负责识别人员，界面展示姓名，业务模块沿用当前蓝白工作台。
            </p>
          </div>

          <div className="auth-metric-grid">
            <div className="auth-metric">
              <strong>平台标题入场</strong>
              <span>首屏先显示“云矩公文管理平台”，再缩小沉降到工作区语境中。</span>
            </div>
            <div className="auth-metric">
              <strong>登录卡片渐显</strong>
              <span>登录组件随后出现，避免一打开就显得拥挤，整体层次更清楚。</span>
            </div>
            <div className="auth-metric">
              <strong>姓名化显示</strong>
              <span>登录后工作台和右上角展示员工姓名，不再把工号当作对外展示字段。</span>
            </div>
          </div>

          <div className="auth-pill-row">
            <span className="soft-pill">云矩公文管理平台</span>
            <span className="soft-pill">默认密码 000000</span>
            <span className="soft-pill">员工姓名展示</span>
          </div>
        </article>

        <section className="auth-login-panel auth-panel-reveal" aria-labelledby="employee-login-title">
          <div className="auth-login-panel-copy">
            <p className="auth-kicker">Employee Login</p>
            <h2 id="employee-login-title" className="auth-form-title">
              员工登录
            </h2>
            <p className="auth-form-copy">输入工号和密码后进入所属公司工作区，默认初始密码为 000000。</p>
          </div>

          <form className="auth-form" onSubmit={submit} noValidate>
            <label htmlFor="employee-username">
              员工工号
              <input
                id="employee-username"
                name="username"
                autoComplete="username"
                placeholder="请输入员工工号"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            {usernameError ? <p className="auth-error">{usernameError}</p> : null}

            <label htmlFor="employee-password">
              登录密码
              <input
                id="employee-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="请输入密码，初始密码为 000000"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {passwordError ? <p className="auth-error">{passwordError}</p> : null}

            <button type="submit" className="auth-submit-btn" disabled={submitting}>
              {submitting ? '登录中...' : '登录系统'}
            </button>
          </form>

          <p className="auth-inline-note">当前已启用员工名单登录，工作台将优先展示姓名。</p>
        </section>
      </section>
    </main>
  )
}
