import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  createEmployeeSession,
  type EmployeeRole,
  loadEmployeeSession,
  saveEmployeeSession,
  validateEmployeeLogin,
} from '../utils/employeeAuth'
import { ensureEmployeeCompany } from '../utils/employeeCompany'

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<EmployeeRole>('staff')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (loadEmployeeSession()) {
      navigate('/layout/company-home', { replace: true })
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
      const company = await ensureEmployeeCompany(validation.normalizedUsername)
      const session = createEmployeeSession(validation.normalizedUsername, role, {
        id: company.id,
        name: company.name,
      })
      saveEmployeeSession(session)
      navigate('/layout/company-home', { replace: true })
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '加载所属公司失败，请联系管理员'
      alert(String(detail))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-scene">
        <article className="auth-brand-panel">
          <h1 className="auth-title">云矩公文管理平台</h1>
        </article>

        <section className="auth-login-panel" aria-labelledby="employee-login-title">
          <p className="auth-kicker">Employee Login</p>
          <h2 id="employee-login-title" className="auth-form-title">
            员工登录
          </h2>
          <p className="auth-form-copy">输入工号和密码后即可进入当前员工所属公司的公文工作台。</p>

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
                placeholder="请输入密码（至少 6 位）"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {passwordError ? <p className="auth-error">{passwordError}</p> : null}

            <label htmlFor="employee-role">
              角色（占位）
              <select id="employee-role" value={role} onChange={(event) => setRole(event.target.value as EmployeeRole)}>
                <option value="staff">普通员工</option>
                <option value="admin">管理员</option>
              </select>
            </label>

            <button type="submit" className="auth-submit-btn" disabled={submitting}>
              {submitting ? '登录中...' : '登录系统'}
            </button>
          </form>

          <p className="auth-inline-note">当前为前端占位登录，后续可直接替换为后端鉴权接口。</p>
        </section>
      </section>
    </main>
  )
}
