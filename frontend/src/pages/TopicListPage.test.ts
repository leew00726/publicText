import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('TopicListPage management actions', () => {
  it('does not expose the document library from public document management', () => {
    const source = fs.readFileSync(new URL('./TopicListPage.tsx', import.meta.url), 'utf8')
    const managementBranch = source.match(/\{canManageTopic \? \(\s*<>([\s\S]*?)<\/>\s*\) : \(/)?.[1] || ''
    const layoutBranch = source.match(/\) : \(\s*<>([\s\S]*?)<\/>\s*\)\}/)?.[1] || ''

    expect(managementBranch).toContain('模板训练')
    expect(managementBranch).not.toContain('文档库')
    expect(managementBranch).not.toContain('/layout/topics/${topic.id}/library')
    expect(layoutBranch).toContain('文档库')
    expect(layoutBranch).toContain('/layout/topics/${topic.id}/library')
  })
})
