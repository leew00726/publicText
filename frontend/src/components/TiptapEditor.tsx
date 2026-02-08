import { useEffect } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'

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
    .replace(/[。；，、,.!?？！：:;]+$/g, '')
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

export function TiptapEditor({ value, syncToken, onChange, onReady, titleText, mainToText, signOffText, dateText, attachments }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
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
        <div className="editor-paper-shell">
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
