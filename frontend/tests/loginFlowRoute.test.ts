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

  it('keeps the cinematic 云矩公文管理平台 login presentation', () => {
    const pageSource = readFileSync(resolve(__dirname, '../src/pages/LoginPage.tsx'), 'utf-8')
    const styleSource = readFileSync(resolve(__dirname, '../src/styles/pages.css'), 'utf-8')

    expect(pageSource).toContain('云矩公文管理平台')
    expect(pageSource).toContain('auth-stage-title')
    expect(styleSource).toContain('@keyframes authStageTitleReveal')
    expect(styleSource).toContain('@keyframes authPanelFadeIn')
  })
})
