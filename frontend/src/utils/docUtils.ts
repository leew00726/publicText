import type { StructuredFields } from '../api/types'

const TAIL_PUNCT = ['。', '！', '？', '；', '：', '.', '!', '?', ';', ':']

const RE_H1 = /^[一二三四五六七八九十百千万零〇两]+、/
const RE_H2 = /^[（(][一二三四五六七八九十百千万零〇两]+[）)]/
const RE_H3 = /^\d+[\.．、]/
const RE_H4 = /^[（(]\d+[）)]/
const RE_ATTACHMENT_LABEL = /^附件\s*[:：]\s*(.*)$/
const RE_ATTACHMENT_ITEM = /^(\d+)[\.．、]\s*(.+)$/

function toZh(num: number): string {
  const map = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (num <= 10) return num === 10 ? '十' : map[num]
  if (num < 20) return `十${map[num - 10]}`
  const tens = Math.floor(num / 10)
  const rem = num % 10
  return rem === 0 ? `${map[tens]}十` : `${map[tens]}十${map[rem]}`
}

function getNodeText(node: any): string {
  if (!node) return ''
  if (node.type === 'text') return node.text || ''
  if (!Array.isArray(node.content)) return ''
  return node.content.map((child: any) => getNodeText(child)).join('')
}

function setNodeText(node: any, text: string) {
  const trimmed = text.trim()
  node.content = trimmed ? [{ type: 'text', text: trimmed }] : []
}

function normalizeCommonText(text: string): string {
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/,/g, '，')
    .replace(/:/g, '：')
    .replace(/;/g, '；')
    .replace(/\?/g, '？')
    .replace(/!/g, '！')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function normalizeTailPunctuation(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed

  const tailMap: Record<string, string> = {
    '.': '。',
    '!': '！',
    '?': '？',
    ';': '；',
    ':': '：',
  }

  const tail = trimmed.slice(-1)
  if (tailMap[tail]) {
    return `${trimmed.slice(0, -1)}${tailMap[tail]}`
  }

  return trimmed
}

function normalizeHeadingPunctuation(level: number, text: string): string {
  const normalized = normalizeTailPunctuation(normalizeCommonText(text))
  if (!normalized) return normalized

  const hasPunct = TAIL_PUNCT.includes(normalized.slice(-1))

  if (level === 1 && hasPunct) {
    return normalized.slice(0, -1)
  }

  if ((level === 3 || level === 4) && !hasPunct) {
    return `${normalized}。`
  }

  return normalized
}

function replaceHeadingPrefix(level: number, text: string, value: number): string {
  const raw = text.trim()
  const withoutPrefix =
    level === 1
      ? raw.replace(/^[一二三四五六七八九十百千万零〇两]+、\s*/, '')
      : level === 2
        ? raw.replace(/^[（(][一二三四五六七八九十百千万零〇两]+[）)]\s*/, '')
        : level === 3
          ? raw.replace(/^\d+[\.．、]\s*/, '')
          : raw.replace(/^[（(]\d+[）)]\s*/, '')

  const prefix =
    level === 1
      ? `${toZh(value)}、`
      : level === 2
        ? `（${toZh(value)}）`
        : level === 3
          ? `${value}.`
          : `（${value}）`

  return `${prefix}${withoutPrefix}`
}

function detectHeadingLevel(text: string): 1 | 2 | 3 | 4 | null {
  const t = normalizeCommonText(text)
  if (!t) return null
  if (RE_H1.test(t)) return 1
  if (RE_H2.test(t)) return 2
  if (RE_H3.test(t)) return 3
  if (RE_H4.test(t)) return 4
  return null
}

function normalizeAttachmentName(name: string): string {
  return name
    .trim()
    .replace(/\.[a-zA-Z0-9]{1,8}$/g, '')
    .replace(/[。；，、,.!?？！：:;]+$/g, '')
}

function isLikelyTitleLine(text: string): boolean {
  const t = normalizeCommonText(text)
  if (!t) return false
  if (t.length < 8 || t.length > 60) return false
  if (detectHeadingLevel(t)) return false
  if (RE_ATTACHMENT_LABEL.test(t)) return false
  if (t.endsWith('：')) return false
  return /关于|通知|请示|函|纪要/.test(t)
}

function isLikelyMainTo(text: string): boolean {
  const t = normalizeCommonText(text)
  if (!t) return false
  if (t.length > 80) return false
  if (detectHeadingLevel(t)) return false
  return t.endsWith('：')
}

function extractFirstNonEmptyIndex(content: any[]): number {
  for (let i = 0; i < content.length; i += 1) {
    const node = content[i]
    if (!node || (node.type !== 'paragraph' && node.type !== 'heading')) continue
    if (normalizeCommonText(getNodeText(node))) return i
  }
  return -1
}

function ensureAttachmentBlankLine(docJson: any): any {
  const content = Array.isArray(docJson?.content) ? docJson.content : []
  for (let i = 1; i < content.length; i += 1) {
    const current = content[i]
    if (!current || (current.type !== 'paragraph' && current.type !== 'heading')) continue
    const text = getNodeText(current).trim()
    if (!/^附件：/.test(text)) continue

    const prev = content[i - 1]
    const prevText = getNodeText(prev).trim()
    if (prev?.type === 'paragraph' && prevText === '') continue

    content.splice(i, 0, { type: 'paragraph', attrs: { firstLineIndentChars: 2 }, content: [] })
    i += 1
  }

  docJson.content = content
  return docJson
}

function trimLeadingBlankParagraphs(docJson: any): any {
  const content = Array.isArray(docJson?.content) ? [...docJson.content] : []
  while (content.length > 0) {
    const first = content[0]
    if (!first || (first.type !== 'paragraph' && first.type !== 'heading')) break
    if (normalizeCommonText(getNodeText(first))) break
    content.shift()
  }
  docJson.content = content
  return docJson
}

function applyBodyLayoutOnly(body: any): any {
  const cloned = structuredClone(body || { type: 'doc', content: [] })
  const content = Array.isArray(cloned.content) ? cloned.content : []
  let inAttachmentBlock = false

  for (const node of content) {
    if (!node || (node.type !== 'paragraph' && node.type !== 'heading')) continue

    const text = normalizeCommonText(getNodeText(node))
    if (!text) {
      node.type = 'paragraph'
      node.attrs = { ...(node.attrs || {}), firstLineIndentChars: 2 }
      setNodeText(node, '')
      continue
    }

    const attachmentLabel = text.match(RE_ATTACHMENT_LABEL)
    if (attachmentLabel) {
      inAttachmentBlock = true
      node.type = 'paragraph'
      node.attrs = { ...(node.attrs || {}), firstLineIndentChars: 2 }
      const rest = (attachmentLabel[1] || '').trim()
      setNodeText(node, rest ? `附件：${normalizeAttachmentName(rest)}` : '附件：')
      continue
    }

    if (inAttachmentBlock) {
      const attachmentItem = text.match(RE_ATTACHMENT_ITEM)
      if (attachmentItem) {
        node.type = 'paragraph'
        node.attrs = { ...(node.attrs || {}), firstLineIndentChars: 2 }
        const index = Number(attachmentItem[1])
        const name = normalizeAttachmentName(attachmentItem[2])
        setNodeText(node, `${index}. ${name}`)
        continue
      }
      inAttachmentBlock = false
    }

    const level = detectHeadingLevel(text)
    if (level) {
      node.type = 'heading'
      node.attrs = { level }
      setNodeText(node, normalizeHeadingPunctuation(level, text))
    } else {
      node.type = 'paragraph'
      node.attrs = { ...(node.attrs || {}), firstLineIndentChars: 2 }
      setNodeText(node, normalizeTailPunctuation(text))
    }
  }

  return ensureAttachmentBlankLine(renumberHeadings(trimLeadingBlankParagraphs(cloned)))
}

function extractStructuredFieldsFromBody(body: any, structuredFields: StructuredFields): { body: any; structuredFields: StructuredFields } {
  const nextBody = structuredClone(body || { type: 'doc', content: [] })
  const nextFields: StructuredFields = structuredClone(structuredFields)
  const content = Array.isArray(nextBody.content) ? [...nextBody.content] : []

  // 抽取标题（通常为正文第一行）
  if (!nextFields.title.trim()) {
    const idx = extractFirstNonEmptyIndex(content)
    if (idx >= 0) {
      const text = normalizeCommonText(getNodeText(content[idx]))
      if (isLikelyTitleLine(text)) {
        nextFields.title = text
        content.splice(idx, 1)
      }
    }
  }

  // 抽取主送
  if (!nextFields.mainTo.trim()) {
    const idx = extractFirstNonEmptyIndex(content)
    if (idx >= 0) {
      const text = normalizeCommonText(getNodeText(content[idx]))
      if (isLikelyMainTo(text)) {
        nextFields.mainTo = text
        content.splice(idx, 1)
      }
    }
  }

  // 抽取附件列表
  if (!nextFields.attachments?.length) {
    for (let i = 0; i < content.length; i += 1) {
      const text = normalizeCommonText(getNodeText(content[i]))
      const label = text.match(RE_ATTACHMENT_LABEL)
      if (!label) continue

      const attachments: { index: number; name: string }[] = []
      const labelRest = (label[1] || '').trim()
      if (labelRest) {
        attachments.push({ index: 1, name: normalizeAttachmentName(labelRest) })
      }

      let end = i
      for (let j = i + 1; j < content.length; j += 1) {
        const line = normalizeCommonText(getNodeText(content[j]))
        const item = line.match(RE_ATTACHMENT_ITEM)
        if (!item) break
        attachments.push({ index: Number(item[1]), name: normalizeAttachmentName(item[2]) })
        end = j
      }

      if (attachments.length) {
        nextFields.attachments = attachments
        content.splice(i, end - i + 1)
      }
      break
    }
  }

  nextBody.content = content
  return { body: nextBody, structuredFields: nextFields }
}

export function renumberHeadings(body: any): any {
  const cloned = structuredClone(body || { type: 'doc', content: [] })
  const counters = [0, 0, 0, 0, 0]

  for (const node of cloned.content || []) {
    if (node.type !== 'heading') continue
    const level = Number(node.attrs?.level || 1)
    if (level < 1 || level > 4) continue

    for (let i = level + 1; i <= 4; i += 1) counters[i] = 0
    counters[level] += 1

    const current = getNodeText(node)
    const next = normalizeHeadingPunctuation(level, replaceHeadingPrefix(level, current || '', counters[level]))
    setNodeText(node, next)
  }

  return cloned
}

export function applyOneClickLayout(body: any): any {
  return applyBodyLayoutOnly(body)
}

export function applyOneClickLayoutWithFields(body: any, structuredFields: StructuredFields): { body: any; structuredFields: StructuredFields } {
  const extracted = extractStructuredFieldsFromBody(body, structuredFields)
  return {
    body: applyBodyLayoutOnly(extracted.body),
    structuredFields: extracted.structuredFields,
  }
}

// 兼容旧调用
export function applyOneClickTemplate(body: any): any {
  return applyOneClickLayout(body)
}

export function normalizeDocNoBracket(docNo: string): string {
  return (docNo || '').replace(/\(([0-9]{2,4})\)/g, '〔$1〕').replace(/（([0-9]{2,4})）/g, '〔$1〕')
}
