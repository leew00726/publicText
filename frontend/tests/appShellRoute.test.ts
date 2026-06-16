import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('app shell routing', () => {
  it('wraps authenticated routes in the shared app shell', () => {
    const source = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf-8')

    expect(source).toContain("import { AppShell } from './components/AppShell'")
    expect(source).toContain('<AppShell>')
    expect(source).toContain('KnowledgeBasePage')
    expect(source).toContain('path="/knowledge"')
    expect(source).toContain("withShell('knowledge.home', <KnowledgeBasePage />)")
    expect(source).not.toContain('<GlobalBackButton />')
    expect(source).not.toContain('MeetingMinutesPage')
    expect(source).not.toContain('/meeting-minutes')
    expect(source).not.toContain('workspace.meetingMinutes')
  })
})
