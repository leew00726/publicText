import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  createExclusiveOperationGate,
  formatSaveState,
  resolveImportedDocTitle,
  resolvePreviewTitleText,
  sanitizeTemplateBodyContent,
} from './DocEditorPage'

describe('editor operation gate', () => {
  it('rejects a second write operation until the first one settles', async () => {
    const gate = createExclusiveOperationGate()
    let releaseFirst!: () => void
    const firstPending = new Promise<void>((resolveFirst) => {
      releaseFirst = resolveFirst
    })
    const calls: string[] = []

    const first = gate.run(async () => {
      calls.push('first:start')
      await firstPending
      calls.push('first:end')
      return 'saved'
    })

    expect(gate.isLocked()).toBe(true)
    const rejected = await gate.run(async () => {
      calls.push('second:start')
      return 'should-not-run'
    })
    expect(rejected).toEqual({ started: false })
    expect(calls).toEqual(['first:start'])

    releaseFirst()
    await expect(first).resolves.toEqual({ started: true, value: 'saved' })
    expect(gate.isLocked()).toBe(false)
    expect(calls).toEqual(['first:start', 'first:end'])
  })
})

describe('DOCX import context', () => {
  it('uses the uploaded filename instead of duplicating the current document title', () => {
    expect(resolveImportedDocTitle('交互体验测试稿.DOCX')).toBe('交互体验测试稿')
    expect(resolveImportedDocTitle(' 附件材料.docx ')).toBe('附件材料')
    expect(resolveImportedDocTitle('.docx')).toBe('导入文档')
  })

  it('sends the current document id so the backend can copy topic metadata', () => {
    const source = readFileSync(resolve(__dirname, './DocEditorPage.tsx'), 'utf8')
    expect(source).toContain("form.append('sourceDocId', doc.id)")
    expect(source).toContain("form.append('title', resolveImportedDocTitle(file.name))")
  })
})

describe('formatSaveState', () => {
  it('shows in-flight and failure states before dirty state', () => {
    expect(formatSaveState(true, true, true, null)).toEqual({ className: 'saving', text: '保存中...' })
    expect(formatSaveState(false, true, true, null)).toEqual({ className: 'error', text: '保存失败，请重试' })
  })

  it('distinguishes unsaved content from a saved document', () => {
    expect(formatSaveState(false, true, false, null)).toEqual({ className: 'dirty', text: '未保存' })
    expect(formatSaveState(false, false, false, null)).toEqual({ className: 'saved', text: '已保存' })
  })
})

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

  it('preserves every imported DOCX body node when topic context is attached', () => {
    const importedBody = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '关于专项工作的通知' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '正文内容' }] },
      ],
    }

    expect(
      sanitizeTemplateBodyContent(
        importedBody,
        {
          title: '',
          topicId: 'topic-1',
          topicName: '通知',
          topicTemplateId: 'tpl-1',
          topicTemplateRules: { contentTemplate: { titleMode: 'dynamic' } },
        },
        true,
      ),
    ).toBe(importedBody)
  })
})
