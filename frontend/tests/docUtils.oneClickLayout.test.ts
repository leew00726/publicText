import { describe, expect, it } from 'vitest'

import { applyOneClickLayoutWithFields } from '../src/utils/docUtils'

const BASE_FIELDS = {
  title: '',
  mainTo: '',
  signOff: '',
  docNo: '',
  signatory: '',
  copyNo: '',
  date: '',
  exportWithRedhead: false,
  attachments: [],
}

describe('one-click layout normalization', () => {
  it('should keep long （一） sentence as paragraph instead of heading', () => {
    const body = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: {},
          content: [
            {
              type: 'text',
              text: '（一）工作专班要尽快与招标公司商定系统互联上线的具体时间。明确后及时向公司领导汇报。',
            },
          ],
        },
      ],
    }

    const result = applyOneClickLayoutWithFields(body, BASE_FIELDS as any)
    expect(result.body.content[0].type).toBe('paragraph')
    expect(result.body.content[0].attrs.firstLineIndentChars).toBe(2)
  })

  it('should restore leading nodes and normalize fixed suffix lines to body style', () => {
    const body = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'center', firstLineIndentChars: 2, fontFamily: '错误字体' },
          content: [{ type: 'text', text: '华能云成数字产融科技(雄安)有限公司' }],
        },
        {
          type: 'paragraph',
          attrs: {},
          content: [{ type: 'text', text: '一、测试标题' }],
        },
        {
          type: 'paragraph',
          attrs: { fontFamily: '黑体', bold: true, firstLineIndentChars: 2 },
          content: [{ type: 'text', text: '参会人员：金刚善' }],
        },
        {
          type: 'paragraph',
          attrs: {},
          content: [{ type: 'text', text: '尾部占位文本' }],
        },
      ],
    }

    const structuredFields = {
      ...BASE_FIELDS,
      topicTemplateRules: {
        body: {
          fontFamily: '仿宋_GB2312',
          fontSizePt: 16,
          lineSpacingPt: 28,
          firstLineIndentPt: 32,
        },
        contentTemplate: {
          leadingNodes: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'center',
                firstLineIndentChars: 0,
                fontFamily: '方正小标宋简体',
                colorHex: '#FF0000',
              },
              content: [{ type: 'text', text: '华能云成数字产融科技(雄安)有限公司' }],
            },
          ],
          trailingNodes: [
            {
              type: 'paragraph',
              attrs: { fontFamily: '黑体', bold: true, firstLineIndentChars: 2 },
              content: [{ type: 'text', text: '参会人员：金刚善' }],
            },
            {
              type: 'paragraph',
              attrs: { dividerRed: true },
              content: [],
            },
            {
              type: 'paragraph',
              attrs: { fontFamily: '仿宋', firstLineIndentChars: 2 },
              content: [{ type: 'text', text: '王振宇、刘冬冬、徐国涛' }],
            },
          ],
        },
      },
    }

    const result = applyOneClickLayoutWithFields(body, structuredFields as any)
    const firstNode = result.body.content[0]
    expect(firstNode.type).toBe('paragraph')
    expect(firstNode.attrs.textAlign).toBe('center')
    expect(firstNode.attrs.firstLineIndentChars).toBe(0)
    expect(firstNode.attrs.fontFamily).toBe('方正小标宋简体')

    const hostNode = result.body.content.find((node: any) => {
      const text = node?.content?.[0]?.text || ''
      return node?.type === 'paragraph' && text.includes('参会人员')
    })
    expect(hostNode).toBeTruthy()
    expect(hostNode.attrs.fontFamily).toBe('仿宋_GB2312')
    expect(hostNode.attrs.bold).toBe(false)
    expect(hostNode.attrs.textAlign).toBe('left')

    const dividerNode = result.body.content.find(
      (node: any) => node?.type === 'paragraph' && node?.attrs?.dividerRed === true,
    )
    expect(dividerNode).toBeTruthy()

    const continuationNode = result.body.content.find((node: any) => {
      const text = node?.content?.[0]?.text || ''
      return node?.type === 'paragraph' && text.includes('王振宇')
    })
    expect(continuationNode).toBeTruthy()
    expect(continuationNode.attrs.fontFamily).toBe('仿宋_GB2312')
  })
})
