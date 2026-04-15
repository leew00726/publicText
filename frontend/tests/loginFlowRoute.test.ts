import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('login flow routing', () => {
  it('navigates to the workspace hub after login', () => {
    const source = readFileSync(resolve(__dirname, '../src/pages/LoginPage.tsx'), 'utf-8')
    expect(source).toContain("navigate('/workspace'")
    expect(source).not.toContain('navigate(LAYOUT_HOME_PATH')
  })

  it('uses the backend auth endpoint instead of client-side role selection', () => {
    const source = readFileSync(resolve(__dirname, '../src/pages/LoginPage.tsx'), 'utf-8')
    expect(source).toContain("/api/auth/login")
    expect(source).not.toContain('角色（占位）')
    expect(source).not.toContain('ensureEmployeeCompany')
  })

  it('keeps the minimal staged login presentation', () => {
    const pageSource = readFileSync(resolve(__dirname, '../src/pages/LoginPage.tsx'), 'utf-8')
    const styleSource = readFileSync(resolve(__dirname, '../src/styles/pages.css'), 'utf-8')

    expect(pageSource).toContain('云矩公文管理平台')
    expect(pageSource).toContain('auth-scene-ready')
    expect(pageSource).toContain('setTimeout(() => setSceneReady(true), 1250)')
    expect(pageSource).toContain('员工号')
    expect(pageSource).toContain('密码')
    expect(pageSource).not.toContain('Employee Login')
    expect(styleSource).toContain('@keyframes authTitleAppear')
    expect(styleSource).toContain('@keyframes authTitleSettle')
    expect(styleSource).toContain('@keyframes authFormReveal')
    expect(styleSource).toContain('.auth-title-stage')
    expect(styleSource).toContain('.auth-login-panel')
    expect(styleSource).toContain('letter-spacing: 0.14em')
    expect(styleSource).toContain('authTitleSettle 970ms')
    expect(styleSource).toContain('scale(0.56)')
    expect(styleSource).toContain('height: 100dvh')
    expect(styleSource).toContain('overflow: hidden')
    expect(styleSource).toContain('box-sizing: border-box')
  })
})
