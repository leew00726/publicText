import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('management module page', () => {
  it('redirects the removed management landing page directly into company management', () => {
    const appSource = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf-8')
    const authSource = readFileSync(resolve(__dirname, '../src/utils/employeeAuth.ts'), 'utf-8')

    expect(appSource).not.toContain("import { ManagementModulePage }")
    expect(appSource).toContain('<Route path="/management" element={<Navigate to="/management/companies" replace />} />')
    expect(authSource).toContain("entryPath: '/management/companies'")
  })
})
