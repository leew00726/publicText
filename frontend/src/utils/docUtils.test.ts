import { describe, expect, it } from 'vitest'

import type { StructuredFields } from '../api/types'
import { applyOneClickLayoutWithFields } from './docUtils'

function paragraph(text: string) {
  return {
    type: 'paragraph',
    attrs: {},
    content: text ? [{ type: 'text', text }] : [],
  }
}

function collectText(body: any): string[] {
  return (Array.isArray(body?.content) ? body.content : []).map((node: any) =>
    Array.isArray(node?.content) ? node.content.map((part: any) => part?.text || '').join('') : '',
  )
}

describe('applyOneClickLayoutWithFields', () => {
  it('keeps user-authored body content when template fixed nodes exceed current content length', () => {
    const body = {
      type: 'doc',
      content: [
        paragraph('要点一：项目当前进展与问题'),
        paragraph('1. 当前董事会系统开发存在约500个bug，问题数量较多。'),
        paragraph('2. 测试团队主要精力集中在主流程测试。'),
      ],
    }

    const structuredFields: StructuredFields = {
      title: '',
      mainTo: '',
      signOff: '',
      docNo: '',
      signatory: '',
      copyNo: '',
      date: '',
      exportWithRedhead: false,
      attachments: [],
      topicTemplateRules: {
        body: {
          fontFamily: '仿宋_GB2312',
          fontSizePt: 16,
          lineSpacingPt: 28,
          firstLineIndentChars: 2,
        },
        contentTemplate: {
          leadingNodes: [paragraph('公司名称'), paragraph('会议纪要标题')],
          trailingNodes: [paragraph('发送：董事长'), paragraph('抄送：综合部')],
        },
      },
    }

    const result = applyOneClickLayoutWithFields(body, structuredFields)
    const textLines = collectText(result.body)

    expect(textLines.some((line) => line.includes('项目当前进展与问题'))).toBe(true)
    expect(textLines.some((line) => line.includes('当前董事会系统开发存在约500个bug'))).toBe(true)
    expect(textLines.some((line) => line.includes('测试团队主要精力集中在主流程测试'))).toBe(true)
  })

  it('normalizes references and attachment formatting according to template rules', () => {
    const body = {
      type: 'doc',
      content: [
        paragraph('请参照华能（2026）3号《试点工作通知》执行。'),
        paragraph('附件：'),
        paragraph('1. 《实施方案》'),
      ],
    }

    const structuredFields: StructuredFields = {
      title: '',
      mainTo: '',
      signOff: '',
      docNo: '',
      signatory: '',
      copyNo: '',
      date: '',
      exportWithRedhead: false,
      attachments: [],
      topicTemplateRules: {
        references: {
          citationOrder: 'titleThenDocNo',
          yearBrackets: '〔〕',
        },
        attachments: {
          itemSuffixPunctuation: 'none',
          useBookTitleMarks: false,
        },
      },
    }

    const result = applyOneClickLayoutWithFields(body, structuredFields)
    const textLines = collectText(result.body)

    expect(textLines).toContain('请参照《试点工作通知》（华能〔2026〕3号）执行。')
    expect(result.structuredFields.attachments).toEqual([{ index: 1, name: '实施方案' }])
  })

  it('removes list markers during one-click layout but keeps list text as plain paragraphs', () => {
    const body = {
      type: 'doc',
      content: [
        paragraph('一、核心业务模式'),
        {
          type: 'orderedList',
          attrs: { start: 1 },
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  attrs: {},
                  content: [{ type: 'text', text: '新能源建设保理：针对集团新能源项目开展融资。' }],
                },
              ],
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  attrs: {},
                  content: [{ type: 'text', text: '累计投放规模：截至目前累计投放56亿元。' }],
                },
              ],
            },
          ],
        },
      ],
    }

    const structuredFields: StructuredFields = {
      title: '',
      mainTo: '',
      signOff: '',
      docNo: '',
      signatory: '',
      copyNo: '',
      date: '',
      exportWithRedhead: false,
      attachments: [],
      topicTemplateRules: null,
    }

    const result = applyOneClickLayoutWithFields(body, structuredFields)
    const nodeTypes = (Array.isArray(result.body?.content) ? result.body.content : []).map((node: any) => node?.type)
    const textLines = collectText(result.body)

    expect(nodeTypes).not.toContain('orderedList')
    expect(nodeTypes).not.toContain('bulletList')
    expect(nodeTypes.filter((type: string) => type === 'paragraph')).toHaveLength(2)
    expect(textLines).toContain('新能源建设保理：针对集团新能源项目开展融资。')
    expect(textLines).toContain('累计投放规模：截至目前累计投放56亿元。')
  })

  it('treats numeric dunhao lines as second-level headings and keeps numbering continuous', () => {
    const body = {
      type: 'doc',
      content: [
        paragraph('一、核心主管部门——雄安新区管委会改革发展局'),
        paragraph('二、归口管理部门——雄安新区综合执法局'),
        paragraph('三、协同监管单位'),
        paragraph('四、标准制定流程'),
        paragraph('1、改革发展局牵头（金融监管分局、人行雄安营管部配合）提出供应链金融标准需求与框架。'),
        paragraph('2、联合行业主体（央企保理、数科平台、金融机构）起草标准文本。'),
        paragraph('3、向省级主管部门报送，并由其组织技术审查与发布。'),
        paragraph('五、对接建议'),
      ],
    }

    const structuredFields: StructuredFields = {
      title: '雄安新区供应链金融相关标准制定',
      mainTo: '',
      signOff: '',
      docNo: '',
      signatory: '',
      copyNo: '',
      date: '',
      exportWithRedhead: false,
      attachments: [],
      topicTemplateRules: null,
    }

    const result = applyOneClickLayoutWithFields(body, structuredFields)
    const standardFlowItems = result.body.content.slice(4, 7)
    const itemTexts = standardFlowItems.map((node: any) => collectText({ content: [node] })[0])

    expect(standardFlowItems.map((node: any) => node.type)).toEqual(['heading', 'heading', 'heading'])
    expect(standardFlowItems.map((node: any) => node.attrs?.level)).toEqual([2, 2, 2])
    expect(itemTexts).toEqual([
      '1、改革发展局牵头（金融监管分局、人行雄安营管部配合）提出供应链金融标准需求与框架。',
      '2、联合行业主体（央企保理、数科平台、金融机构）起草标准文本。',
      '3、向省级主管部门报送，并由其组织技术审查与发布。',
    ])
  })
})
