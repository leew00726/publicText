import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('workspace entry routing', () => {
  it('sends authenticated users to the workspace hub from the root and fallback routes', () => {
    const source = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf-8')

    expect(source).toContain('return <Navigate to="/workspace" replace />')
    expect(source).toContain("return <Navigate to={loadEmployeeSession() ? '/workspace' : '/'} replace />")
  })
})
