import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('login flow routing', () => {
  it('navigates to the workspace hub after login', () => {
    const source = readFileSync(resolve(__dirname, '../src/pages/LoginPage.tsx'), 'utf-8')
    expect(source).toContain("navigate('/workspace'")
    expect(source).not.toContain('navigate(LAYOUT_HOME_PATH')
  })
})
