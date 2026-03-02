import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  createEmployeeSession,
  type EmployeeRole,
  loadEmployeeSession,
  saveEmployeeSession,
  validateEmployeeLogin,
} from '../utils/employeeAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<EmployeeRole>('staff')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    if (loadEmployeeSession()) {
      navigate('/workspace', { replace: true })
    }
  }, [navigate])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const validation = validateEmployeeLogin(username, password)
    setUsernameError(validation.usernameError)
    setPasswordError(validation.passwordError)

    if (!validation.valid) return

    const session = createEmployeeSession(validation.normalizedUsername, role)
    saveEmployeeSession(session)
    navigate('/workspace', { replace: true })
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="employee-login-title">
        <p className="auth-kicker">PublicText 办公系统</p>
        <h1 id="employee-login-title" className="auth-title">
          员工登录
        </h1>
        <p className="auth-subtitle">登录后进入模块工作台，不同角色会显示不同权限。</p>

        <form className="auth-form" onSubmit={submit} noValidate>
          <label htmlFor="employee-username">员工账号</label>
          <input
            id="employee-username"
            name="username"
            autoComplete="username"
            placeholder="请输入员工账号"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          {usernameError ? <p className="auth-error">{usernameError}</p> : null}

          <label htmlFor="employee-password">登录密码</label>
          <input
            id="employee-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="请输入密码（至少 6 位）"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {passwordError ? <p className="auth-error">{passwordError}</p> : null}

          <label htmlFor="employee-role">角色（占位）</label>
          <select id="employee-role" value={role} onChange={(event) => setRole(event.target.value as EmployeeRole)}>
            <option value="staff">普通员工</option>
            <option value="admin">管理员</option>
          </select>

          <button type="submit" className="auth-submit-btn">
            登录系统
          </button>
        </form>

        <p className="auth-hint">当前为前端占位登录，后续可直接替换为后端鉴权接口。</p>
      </section>
    </main>
  )
}
