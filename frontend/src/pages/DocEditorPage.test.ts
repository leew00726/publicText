import { describe, expect, it } from 'vitest'

import { resolvePreviewTitleText, sanitizeTemplateBodyContent } from './DocEditorPage'

describe('resolvePreviewTitleText', () => {
  it('does not fall back to doc.title for template-backed docs when structured title is empty', () => {
    expect(
      resolvePreviewTitleText('云成数科2025年资源协同报告', {
        title: '',
        topicTemplateRules: {
          contentTemplate: {
            titleMode: 'dynamic',
          },
          title: {
            fontFamily: '方正小标宋简体',
          },
        },
      }),
    ).toBe('')
  })

  it('still falls back to doc.title for non-template docs', () => {
    expect(
      resolvePreviewTitleText('普通文档标题', {
        title: '',
        topicTemplateRules: null,
      }),
    ).toBe('普通文档标题')
  })

  it('does not fall back to doc.title for legacy topic-backed docs without embedded rules', () => {
    expect(
      resolvePreviewTitleText('云成数科2025年资源协同报告', {
        title: '',
        topicTemplateRules: null,
        topicTemplateId: 'tpl-1',
        topicId: 'topic-1',
        topicName: '资源协同报告',
      }),
    ).toBe('')
  })

  it('strips stale title-like leading nodes from template-backed body content', () => {
    const body = sanitizeTemplateBodyContent(
      {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: '华能云成数字产融科技（雄安）有限公司' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '云成数科2025年资源协同报告' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '2025年第1期' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '（请在此输入正文）' }] },
        ],
      },
      {
        title: '',
        topicTemplateId: 'tpl-1',
        topicTemplateRules: {
          contentTemplate: {
            titleMode: 'dynamic',
          },
        },
      },
    )

    const texts = (body.content || []).map((node: any) =>
      ((node.content || []) as any[]).map((part: any) => String(part?.text || '')).join(''),
    )
    expect(texts).toContain('华能云成数字产融科技（雄安）有限公司')
    expect(texts).toContain('2025年第1期')
    expect(texts).not.toContain('云成数科2025年资源协同报告')
  })
})
