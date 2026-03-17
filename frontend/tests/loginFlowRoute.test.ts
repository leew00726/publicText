import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('login flow routing', () => {
  it('navigates to employee company library after login', () => {
    const source = readFileSync(resolve(__dirname, '../src/pages/LoginPage.tsx'), 'utf-8')
    expect(source).toContain("import { LAYOUT_HOME_PATH } from '../utils/layoutNavigation'")
    expect(source).toContain('navigate(LAYOUT_HOME_PATH')
    expect(source).not.toContain("navigate('/workspace'")
  })
})
