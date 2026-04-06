import { describe, expect, it } from 'vitest'

import { summarizeRulesAsNarrative } from './topicNarrative'

describe('summarizeRulesAsNarrative', () => {
  it('includes title font rules in the narrative output', () => {
    const lines = summarizeRulesAsNarrative({
      title: {
        fontFamily: '方正小标宋简',
        arrangement: 'trapezoid',
      },
      references: {
        citationOrder: 'titleThenDocNo',
      },
      signature: {
        spacingBeforeLines: 2,
      },
    })

    expect(lines).toContain('主标题字体建议使用 方正小标宋简。')
    expect(lines).toContain('主标题排列方式建议为 梯形排列。')
    expect(lines).toContain('引用公文顺序建议为 先引标题后引发号。')
    expect(lines).toContain('落款前空行建议为 2 行。')
  })
})
