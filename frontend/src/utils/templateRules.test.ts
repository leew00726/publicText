import { describe, expect, it } from 'vitest'

import { getTemplateRuleCoverage, normalizeTemplateRules, resolveLayoutSpec } from './templateRules'

describe('templateRules', () => {
  it('migrates the legacy AI pageMargins shape', () => {
    const rules = normalizeTemplateRules({
      pageMargins: {
        topCm: 3.7,
        bottomCm: 3.5,
        leftCm: 2.8,
        rightCm: 2.6,
      },
    })

    expect(rules.page?.marginsCm).toEqual({
      top: 3.7,
      bottom: 3.5,
      left: 2.8,
      right: 2.6,
    })
    expect(rules).not.toHaveProperty('pageMargins')
  })

  it('resolves defaults only for missing margin sides', () => {
    expect(resolveLayoutSpec({ page: { marginsCm: { left: 2.8, right: 2.6 } } }).page.marginsCm).toEqual({
      top: 3.7,
      bottom: 3.5,
      left: 2.8,
      right: 2.6,
    })
  })

  it('reports page rules as captured when all four sides are present', () => {
    const coverage = getTemplateRuleCoverage({
      page: { marginsCm: { top: 3.7, bottom: 3.5, left: 2.8, right: 2.6 } },
    })

    expect(coverage.find((item) => item.key === 'page')).toMatchObject({
      status: 'captured',
      detail: '上 3.7 / 下 3.5 / 左 2.8 / 右 2.6 厘米',
    })
  })
})
