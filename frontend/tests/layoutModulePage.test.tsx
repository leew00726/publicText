import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('layout entry route', () => {
  it('redirects the removed layout landing page directly into the formal layout flow', () => {
    const appSource = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf-8')
    const shellSource = readFileSync(resolve(__dirname, '../src/components/AppShell.tsx'), 'utf-8')

    expect(appSource).not.toContain("import { LayoutModulePage }")
    expect(appSource).toContain('<Route path="/layout" element={<Navigate to={LAYOUT_HOME_PATH} replace />} />')
    expect(shellSource).toContain("path: LAYOUT_HOME_PATH")
  })
})
