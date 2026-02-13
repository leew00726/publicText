import { useEffect, type CSSProperties } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import Heading from '@tiptap/extension-heading'
import Paragraph from '@tiptap/extension-paragraph'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import type { RedheadTemplate } from '../api/types'

interface AttachmentPreviewItem {
  index: number
  name: string
}

interface Props {
  value: any
  syncToken: number
  onChange: (json: any) => void
  onReady: (editor: Editor | null) => void
  titleText?: string
  mainToText?: string
  signOffText?: string
  dateText?: string
  attachments?: AttachmentPreviewItem[]
  redheadTemplate?: RedheadTemplate | null
  showRedhead?: boolean
  unitName?: string
  signatory?: string
  topicTemplateRules?: Record<string, any> | null
}

const ALLOWED_TAGS = new Set([
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'STRONG',
  'B',
  'UL',
  'OL',
  'LI',
  'TABLE',
  'TBODY',
  'THEAD',
  'TR',
  'TD',
  'TH',
  'BR',
])

const RE_SUFFIX_LINE =
  /^(主\s*持(?:\s*人|\s*者)?|参\s*(?:加|会)(?:\s*人|\s*人员|\s*名单)?|列\s*席(?:\s*人|\s*人员)?|出\s*席(?:\s*人|\s*人员)?|记\s*录(?:\s*人|\s*员)?|发\s*(?:送|至|文)|主\s*送|抄\s*送|分\s*送)\s*[：:]/
const RE_SUFFIX_LINE_CAPTURE =
  /^((?:主\s*持(?:\s*人|\s*者)?|参\s*(?:加|会)(?:\s*人|\s*人员|\s*名单)?|列\s*席(?:\s*人|\s*人员)?|出\s*席(?:\s*人|\s*人员)?|记\s*录(?:\s*人|\s*员)?|发\s*(?:送|至|文)|主\s*送|抄\s*送|分\s*送)\s*[：:])(\s*.*)$/

function sanitizeHtmlForPaste(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const sanitizeNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true)
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return null
    const el = node as HTMLElement
    if (!ALLOWED_TAGS.has(el.tagName)) {
      const frag = document.createDocumentFragment()
      for (const child of Array.from(el.childNodes)) {
        const clean = sanitizeNode(child)
        if (clean) frag.appendChild(clean)
      }
      return frag
    }

    const cleanEl = document.createElement(el.tagName.toLowerCase())
    for (const child of Array.from(el.childNodes)) {
      const clean = sanitizeNode(child)
      if (clean) cleanEl.appendChild(clean)
    }
    return cleanEl
  }

  const bodyFrag = document.createDocumentFragment()
  for (const child of Array.from(doc.body.childNodes)) {
    const clean = sanitizeNode(child)
    if (clean) bodyFrag.appendChild(clean)
  }

  const wrapper = document.createElement('div')
  wrapper.appendChild(bodyFrag)
  return wrapper.innerHTML
}

function normalizeAttachmentName(name: string): string {
  return (name || '')
    .trim()
    .replace(/\.[a-zA-Z0-9]{1,8}$/g, '')
    .replace(/[。；，、.!?！？;:]+$/g, '')
}

function formatDateZh(dateStr?: string): string {
  if (!dateStr) return ''
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return dateStr.trim()
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  return `${year}年${month}月${day}日`
}

function _toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const num = Number(value)
  if (Number.isNaN(num) || !Number.isFinite(num)) return null
  return num
}

function _toColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  const hex = raw.startsWith('#') ? raw.slice(1) : raw
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null
  return `#${hex.toUpperCase()}`
}

function _normalizeFontFamilyStack(fontFamilyRaw: string): string {
  const family = fontFamilyRaw.trim().replace(/^['"]+|['"]+$/g, '')
  const compact = family.replace(/\s+/g, '')
  if (!compact) return 'var(--font-main)'

  if (compact.includes('仿宋')) {
    return '"仿宋_GB2312", "FangSong_GB2312", "仿宋", "FangSong", var(--font-main)'
  }
  if (compact.includes('黑体')) {
    return '"黑体", "SimHei", "Heiti SC", var(--font-ui)'
  }
  if (compact.includes('楷体')) {
    return '"楷体_GB2312", "KaiTi_GB2312", "楷体", "KaiTi", var(--font-main)'
  }
  if (compact.includes('宋体')) {
    return '"宋体", "SimSun", var(--font-main)'
  }
  if (compact.includes('方正小标宋')) {
    return '"方正小标宋简", "方正小标宋简体", "方正小标宋", "小标宋", var(--font-main)'
  }

  const escaped = family.replace(/"/g, '\\"')
  return `"${escaped}", var(--font-main)`
}

function _getNodeText(node: any): string {
  if (!node) return ''
  if (node.type === 'text') return String(node.text || '')
  if (!Array.isArray(node.content)) return ''
  return node.content.map((child: any) => _getNodeText(child)).join('')
}

function _isSuffixLineText(text: string): boolean {
  return RE_SUFFIX_LINE.test((text || '').trim())
}

function _buildInlineStyle(attrs: Record<string, unknown>, nodeText: string = ''): string {
  const styles: string[] = []
  const dividerRed = attrs.dividerRed === true

  if (dividerRed) {
    styles.push('border-bottom:2pt solid #D40000')
    styles.push('height:0')
    styles.push('line-height:0')
    styles.push('font-size:0')
    styles.push('margin:4pt 0 12pt 0')
    styles.push('text-indent:0')
    return styles.join(';')
  }

  const textAlign = typeof attrs.textAlign === 'string' ? attrs.textAlign.trim() : ''
  if (textAlign) styles.push(`text-align:${textAlign}`)

  const fontFamily = typeof attrs.fontFamily === 'string' ? attrs.fontFamily.trim() : ''
  if (fontFamily) styles.push(`font-family:${_normalizeFontFamilyStack(fontFamily)}`)

  const fontSizePt = _toFiniteNumber(attrs.fontSizePt)
  if (fontSizePt !== null) styles.push(`font-size:${fontSizePt}pt`)

  if (attrs.bold === true) styles.push('font-weight:700')
  if (attrs.bold === false) styles.push('font-weight:400')

  const color = _toColor(attrs.colorHex)
  if (color) styles.push(`color:${color}`)

  const lineSpacingPt = _toFiniteNumber(attrs.lineSpacingPt)
  if (lineSpacingPt !== null) styles.push(`line-height:${lineSpacingPt}pt`)

  if (textAlign === 'center' || textAlign === 'right') {
    styles.push('text-indent:0')
  } else {
    const firstLineIndentPt = _toFiniteNumber(attrs.firstLineIndentPt)
    if (firstLineIndentPt !== null) {
      styles.push(`text-indent:${firstLineIndentPt}pt`)
    } else {
      const firstLineIndentChars = _toFiniteNumber(attrs.firstLineIndentChars)
      if (firstLineIndentChars !== null) {
        styles.push(`text-indent:${firstLineIndentChars}em`)
      }
    }
  }

  if (_isSuffixLineText(nodeText)) {
    styles.push('text-align:left')
    styles.push('font-family:var(--pt-body-font-family)')
    styles.push('font-size:var(--pt-body-font-size)')
    styles.push('line-height:var(--pt-body-line-height)')
    styles.push('font-weight:400')
    styles.push('text-indent:var(--pt-body-text-indent, 2em)')
  }

  return styles.join(';')
}

function _mergeStyle(existing: unknown, generated: string): string {
  const base = typeof existing === 'string' ? existing.trim() : ''
  if (!base) return generated
  if (!generated) return base
  return `${base};${generated}`
}

const StyledParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...(this.parent?.() || {}),
      textAlign: { default: null },
      fontFamily: { default: null },
      fontSizePt: { default: null },
      bold: { default: null },
      colorHex: { default: null },
      lineSpacingPt: { default: null },
      firstLineIndentPt: { default: null },
      firstLineIndentChars: { default: null },
      dividerRed: { default: null },
    }
  },
  renderHTML({ node, HTMLAttributes }) {
    const generated = _buildInlineStyle(HTMLAttributes, _getNodeText(node))
    const mergedStyle = _mergeStyle(HTMLAttributes.style, generated)
    return ['p', { ...HTMLAttributes, style: mergedStyle }, 0]
  },
})

const StyledHeading = Heading.extend({
  addAttributes() {
    return {
      ...(this.parent?.() || {}),
      textAlign: { default: null },
      fontFamily: { default: null },
      fontSizePt: { default: null },
      bold: { default: null },
      colorHex: { default: null },
      lineSpacingPt: { default: null },
      firstLineIndentPt: { default: null },
      firstLineIndentChars: { default: null },
    }
  },
  renderHTML({ node, HTMLAttributes }) {
    const level = this.options.levels.includes(node.attrs.level) ? node.attrs.level : this.options.levels[0]
    const generated = _buildInlineStyle(HTMLAttributes)
    const mergedStyle = _mergeStyle(HTMLAttributes.style, generated)
    return [`h${level}`, { ...HTMLAttributes, style: mergedStyle }, 0]
  },
})

const SuffixLineDecoration = Extension.create({
  name: 'suffixLineDecoration',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (node.type.name !== 'paragraph') return
              const text = node.textContent || ''
              const match = text.match(RE_SUFFIX_LINE_CAPTURE)
              if (!match) return

              const labelLength = match[1]?.length || 0
              if (labelLength <= 0) return

              const from = pos + 1
              const to = pos + node.nodeSize - 1
              const labelTo = Math.min(from + labelLength, to)

              decorations.push(Decoration.inline(from, labelTo, { class: 'suffix-line-label' }))
              if (to > labelTo) {
                decorations.push(Decoration.inline(labelTo, to, { class: 'suffix-line-body' }))
              }
            })

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})

const PAGE_WIDTH_CM = 21

function resolveBindText(
  bind: string,
  fixedText: string | null | undefined,
  bindMap: Record<string, string>,
): string {
  if (bind === 'fixedText') return fixedText || ''
  return bindMap[bind] || ''
}

function resolveXInCm(
  anchor: 'marginLeft' | 'center' | 'marginRight',
  offsetCm: number,
  margins: { left: number; right: number },
): number {
  if (anchor === 'center') return PAGE_WIDTH_CM / 2 + offsetCm
  if (anchor === 'marginRight') return PAGE_WIDTH_CM - margins.right + offsetCm
  return margins.left + offsetCm
}

function _resolveFontFamilyWithFallback(primary: unknown, fallbackStack: string): string {
  const name = typeof primary === 'string' ? primary.trim() : ''
  if (!name) return fallbackStack
  return `"${name}", ${fallbackStack}`
}

function _resolveWeight(value: unknown, fallback: '400' | '700'): '400' | '700' {
  if (value === true || value === 700) return '700'
  if (value === false || value === 400) return '400'
  return fallback
}

function _resolveIndent(valuePt: unknown, valueChars: unknown, fallback: string): string {
  const indentPt = _toFiniteNumber(valuePt)
  if (indentPt !== null) return `${indentPt}pt`

  const indentChars = _toFiniteNumber(valueChars)
  if (indentChars !== null) return `${indentChars}em`

  return fallback
}

export function TiptapEditor({
  value,
  syncToken,
  onChange,
  onReady,
  titleText,
  mainToText,
  signOffText,
  dateText,
  attachments,
  redheadTemplate,
  showRedhead,
  unitName,
  signatory,
  topicTemplateRules,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ paragraph: false, heading: false }),
      StyledParagraph,
      StyledHeading.configure({ levels: [1, 2, 3, 4] }),
      SuffixLineDecoration,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getJSON())
    },
    editorProps: {
      handlePaste(view, event) {
        const html = event.clipboardData?.getData('text/html')
        if (!html) return false
        event.preventDefault()
        const cleaned = sanitizeHtmlForPaste(html)
        const tr = view.state.tr
        view.dispatch(tr)
        editor?.commands.insertContent(cleaned)
        return true
      },
    },
  })

  useEffect(() => {
    onReady(editor)
    return () => onReady(null)
  }, [editor, onReady])

  useEffect(() => {
    if (!editor) return
    editor.commands.setContent(value || { type: 'doc', content: [] }, false)
  }, [editor, syncToken, value])

  const title = (titleText || '').trim()
  const mainTo = (mainToText || '').trim()
  const hasFrontmatter = Boolean(title || mainTo)

  const previewSignOff = (signOffText || '').trim()
  const previewDate = formatDateZh(dateText)
  const previewAttachments = (attachments || [])
    .filter((item) => normalizeAttachmentName(item.name))
    .map((item, idx) => ({ index: idx + 1, name: normalizeAttachmentName(item.name) }))

  const hasSignDateBlock = Boolean(previewSignOff || previewDate)
  const hasTailmatter = Boolean(hasSignDateBlock || previewAttachments.length)
  const activeRedheadTemplate = showRedhead && redheadTemplate ? redheadTemplate : null
  const redheadMargins = {
    top: activeRedheadTemplate?.page?.marginsCm?.top ?? 3.7,
    bottom: activeRedheadTemplate?.page?.marginsCm?.bottom ?? 3.5,
    left: activeRedheadTemplate?.page?.marginsCm?.left ?? 2.7,
    right: activeRedheadTemplate?.page?.marginsCm?.right ?? 2.5,
  }
  const redheadBindMap = {
    unitName: (unitName || '').trim() || '某某单位',
    signatory: (signatory || '').trim(),
    fixedText: '',
  }

  const bodyRules = (topicTemplateRules?.body as Record<string, unknown> | undefined) || {}
  const headingRules = (topicTemplateRules?.headings as Record<string, any> | undefined) || {}
  const suffixLabelRules = (topicTemplateRules?.suffixLabel as Record<string, unknown> | undefined) || {}
  const level1Rules = (headingRules.level1 as Record<string, unknown> | undefined) || {}
  const level2Rules = (headingRules.level2 as Record<string, unknown> | undefined) || {}
  const level3Rules = (headingRules.level3 as Record<string, unknown> | undefined) || {}
  const level4Rules = (headingRules.level4 as Record<string, unknown> | undefined) || {}

  const bodyFontSizePt = _toFiniteNumber(bodyRules.fontSizePt) ?? 16
  const bodyLineHeightPt = _toFiniteNumber(bodyRules.lineSpacingPt) ?? 28
  const bodyIndent = _resolveIndent(bodyRules.firstLineIndentPt, bodyRules.firstLineIndentChars, '2em')
  const bodyFontFamily = _resolveFontFamilyWithFallback(
    bodyRules.fontFamily,
    '"仿宋_GB2312", "FangSong_GB2312", "仿宋", "FangSong", var(--font-main)',
  )

  const h1LineHeightPt = _toFiniteNumber(level1Rules.lineSpacingPt) ?? bodyLineHeightPt
  const h2LineHeightPt = _toFiniteNumber(level2Rules.lineSpacingPt) ?? bodyLineHeightPt
  const h3LineHeightPt = _toFiniteNumber(level3Rules.lineSpacingPt) ?? bodyLineHeightPt
  const h4LineHeightPt = _toFiniteNumber(level4Rules.lineSpacingPt) ?? bodyLineHeightPt

  const previewRuleVars: CSSProperties = {
    ['--pt-body-font-family' as any]: bodyFontFamily,
    ['--pt-body-font-size' as any]: `${bodyFontSizePt}pt`,
    ['--pt-body-line-height' as any]: `${bodyLineHeightPt}pt`,
    ['--pt-body-text-indent' as any]: bodyIndent,
    ['--pt-suffix-label-font-family' as any]: _resolveFontFamilyWithFallback(
      suffixLabelRules.fontFamily || '黑体',
      '"黑体", "SimHei", "Heiti SC", var(--font-ui)',
    ),
    ['--pt-suffix-label-font-weight' as any]: _resolveWeight(suffixLabelRules.bold, '400'),

    ['--pt-h1-font-family' as any]: _resolveFontFamilyWithFallback(level1Rules.fontFamily, '"黑体", "SimHei", "Heiti SC", var(--font-ui)'),
    ['--pt-h1-font-size' as any]: `${_toFiniteNumber(level1Rules.fontSizePt) ?? bodyFontSizePt}pt`,
    ['--pt-h1-font-weight' as any]: _resolveWeight(level1Rules.bold, '700'),
    ['--pt-h1-line-height' as any]: `${h1LineHeightPt}pt`,
    ['--pt-h1-text-indent' as any]: _resolveIndent(level1Rules.firstLineIndentPt, level1Rules.firstLineIndentChars, '2em'),

    ['--pt-h2-font-family' as any]: _resolveFontFamilyWithFallback(level2Rules.fontFamily, '"黑体", "SimHei", "Heiti SC", var(--font-ui)'),
    ['--pt-h2-font-size' as any]: `${_toFiniteNumber(level2Rules.fontSizePt) ?? bodyFontSizePt}pt`,
    ['--pt-h2-font-weight' as any]: _resolveWeight(level2Rules.bold, '400'),
    ['--pt-h2-line-height' as any]: `${h2LineHeightPt}pt`,
    ['--pt-h2-text-indent' as any]: _resolveIndent(level2Rules.firstLineIndentPt, level2Rules.firstLineIndentChars, '2em'),

    ['--pt-h3-font-family' as any]: _resolveFontFamilyWithFallback(
      level3Rules.fontFamily,
      '"仿宋_GB2312", "FangSong_GB2312", "仿宋", "FangSong", var(--font-main)',
    ),
    ['--pt-h3-font-size' as any]: `${_toFiniteNumber(level3Rules.fontSizePt) ?? bodyFontSizePt}pt`,
    ['--pt-h3-font-weight' as any]: _resolveWeight(level3Rules.bold, '400'),
    ['--pt-h3-line-height' as any]: `${h3LineHeightPt}pt`,
    ['--pt-h3-text-indent' as any]: _resolveIndent(level3Rules.firstLineIndentPt, level3Rules.firstLineIndentChars, '2em'),

    ['--pt-h4-font-family' as any]: _resolveFontFamilyWithFallback(
      level4Rules.fontFamily,
      '"仿宋_GB2312", "FangSong_GB2312", "仿宋", "FangSong", var(--font-main)',
    ),
    ['--pt-h4-font-size' as any]: `${_toFiniteNumber(level4Rules.fontSizePt) ?? bodyFontSizePt}pt`,
    ['--pt-h4-font-weight' as any]: _resolveWeight(level4Rules.bold, '400'),
    ['--pt-h4-line-height' as any]: `${h4LineHeightPt}pt`,
    ['--pt-h4-text-indent' as any]: _resolveIndent(level4Rules.firstLineIndentPt, level4Rules.firstLineIndentChars, '2em'),
  }

  const editorContentClass = [
    'editor-content',
    hasFrontmatter ? 'has-frontmatter' : '',
    title ? 'has-title' : '',
    mainTo ? 'has-main-to' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (!editor) return <div className="editor-shell">编辑器加载中...</div>

  return (
    <div className="editor-shell">
      <div className={editorContentClass}>
        <div className="editor-paper-shell" style={previewRuleVars}>
          {activeRedheadTemplate && (
            <div className="editor-redhead-overlay" aria-hidden="true">
              {activeRedheadTemplate.elements
                .filter((e) => e.enabled)
                .map((e) => {
                  const xCm = resolveXInCm(e.x.anchor, e.x.offsetCm, redheadMargins)
                  const topCm = e.yCm

                  if (e.type === 'line') {
                    const widthCm =
                      e.line?.lengthMode === 'custom' ? e.line.lengthCm || 8 : PAGE_WIDTH_CM - redheadMargins.left - redheadMargins.right
                    const leftCm = e.line?.lengthMode === 'custom' ? xCm : redheadMargins.left
                    return (
                      <div
                        key={e.id}
                        className="editor-redhead-line"
                        style={{
                          left: `${leftCm}cm`,
                          top: `${topCm}cm`,
                          width: `${widthCm}cm`,
                          borderTopWidth: `${e.line?.thicknessPt || 1.5}pt`,
                          borderTopColor: e.line?.color || '#d40000',
                        }}
                      />
                    )
                  }

                  const text = resolveBindText(e.bind, e.fixedText, redheadBindMap)
                  if (!text && !e.visibleIfEmpty) return null

                  const align = e.text?.align || 'left'
                  const translateX = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0'

                  return (
                    <div
                      key={e.id}
                      className="editor-redhead-text"
                      style={{
                        left: `${xCm}cm`,
                        top: `${topCm}cm`,
                        transform: `translateX(${translateX})`,
                        textAlign: align,
                        color: e.text?.font.color || '#000000',
                        fontSize: `${e.text?.font.sizePt || 16}pt`,
                        fontWeight: e.text?.font.bold ? 700 : 400,
                        fontFamily: `${e.text?.font.family || '仿宋_GB2312'}, var(--font-main)`,
                      }}
                    >
                      {text}
                    </div>
                  )
                })}
            </div>
          )}

          {hasFrontmatter && (
            <div className="frontmatter-layer" aria-hidden="true">
              <div className={`frontmatter-paper ${title ? 'has-title' : 'no-title'}`}>
                {title && <p className="frontmatter-title">{title}</p>}
                {mainTo && <p className="frontmatter-main-to">{mainTo}</p>}
              </div>
            </div>
          )}

          <EditorContent editor={editor} className="editor-prose-wrapper" />

          {hasTailmatter && (
            <div className="tailmatter-section" aria-hidden="true">
              {hasSignDateBlock && (
                <div className="tailmatter-sign-date">
                  {previewSignOff && <p className="tailmatter-signoff">{previewSignOff}</p>}
                  {previewDate && <p className="tailmatter-date">{previewDate}</p>}
                </div>
              )}

              {previewAttachments.length > 0 && (
                <div className="tailmatter-attachments">
                  <p className="tailmatter-attach-label">附件：</p>
                  {previewAttachments.map((item) => (
                    <p key={`tail-attachment-${item.index}`} className="tailmatter-attach-item">
                      {item.index}. {item.name}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
