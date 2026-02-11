import { describe, expect, it } from 'vitest'

import { summarizeConfidenceAsNarrative, summarizeRulesAsNarrative } from '../src/utils/topicNarrative'

describe('topic narrative formatter', () => {
  it('should convert inferred rules into Chinese natural-language lines', () => {
    const lines = summarizeRulesAsNarrative({
      body: {
        fontFamily: 'SimHei',
        fontSizePt: 16,
      },
      page: {
        marginsCm: {
          top: 3.7,
        },
      },
      headings: {},
    })

    expect(lines).toContain('正文字体建议使用 SimHei。')
    expect(lines).toContain('正文字号建议为 16 磅。')
    expect(lines).toContain('页面上边距建议为 3.7 厘米。')
  })

  it('should convert confidence report into readable Chinese lines', () => {
    const lines = summarizeConfidenceAsNarrative({
      'body.fontFamily': { confidence: 1, samples: 5 },
      'body.fontSizePt': { confidence: 0.8, samples: 5 },
    })

    expect(lines).toContain('正文字体：置信度高（100%），样本数 5。')
    expect(lines).toContain('正文字号：置信度中（80%），样本数 5。')
  })
})
