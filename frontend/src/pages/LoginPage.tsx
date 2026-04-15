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
  const [sceneReady, setSceneReady] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (loadEmployeeSession()) {
      navigate('/workspace', { replace: true })
      return
    }

    const timeoutId = window.setTimeout(() => setSceneReady(true), 1250)
    return () => window.clearTimeout(timeoutId)
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
      <section className={`auth-scene ${sceneReady ? 'auth-scene-ready' : ''}`}>
        <div className="auth-title-stage" aria-hidden="true">
          <h1 className="auth-title">云矩公文管理平台</h1>
        </div>

        <section className="auth-login-panel" aria-label="员工登录">
          <form className="auth-form" onSubmit={submit} noValidate>
            <label htmlFor="employee-username">
              员工号
              <input
                id="employee-username"
                name="username"
                autoComplete="username"
                placeholder="请输入员工号"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            {usernameError ? <p className="auth-error">{usernameError}</p> : null}

            <label htmlFor="employee-password">
              密码
              <input
                id="employee-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="请输入密码"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {passwordError ? <p className="auth-error">{passwordError}</p> : null}

            <button type="submit" className="auth-submit-btn" disabled={submitting}>
              {submitting ? '登录中...' : '登录'}
            </button>
          </form>
        </section>
      </section>
    </main>
  )
}
