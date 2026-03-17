import { describe, expect, it } from 'vitest'

import { summarizeRulesAsNarrative } from './topicNarrative'

describe('summarizeRulesAsNarrative', () => {
  it('includes title font rules in the narrative output', () => {
    const lines = summarizeRulesAsNarrative({
      title: {
        fontFamily: '方正小标宋简',
      },
    })

    expect(lines).toContain('主标题字体建议使用 方正小标宋简。')
  })
})
