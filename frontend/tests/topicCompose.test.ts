import { describe, expect, it } from 'vitest'

import { pickDefaultTopicTemplateId } from '../src/utils/topicCompose'

type Template = {
  id: string
  version: number
  effective: boolean
}

describe('topic compose helpers', () => {
  it('prefers effective template as default', () => {
    const templates: Template[] = [
      { id: 'tpl-v2', version: 2, effective: true },
      { id: 'tpl-v1', version: 1, effective: false },
    ]
    expect(pickDefaultTopicTemplateId(templates)).toBe('tpl-v2')
  })

  it('falls back to first template when no effective template', () => {
    const templates: Template[] = [
      { id: 'tpl-v2', version: 2, effective: false },
      { id: 'tpl-v1', version: 1, effective: false },
    ]
    expect(pickDefaultTopicTemplateId(templates)).toBe('tpl-v2')
  })

  it('returns empty id when no templates', () => {
    expect(pickDefaultTopicTemplateId([])).toBe('')
  })
})
