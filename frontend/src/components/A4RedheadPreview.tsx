import type { RedheadTemplate } from '../api/types'

interface Props {
  template: RedheadTemplate
  selectedId?: string
  unitName?: string
  docNo?: string
  signatory?: string
  copyNo?: string
}

const SCALE = 20 // px per cm
const PAGE_WIDTH = 21
const PAGE_HEIGHT = 29.7
const SAFE_TOP = 3.7

function bindValue(bind: string, fixedText: string | null | undefined, data: Record<string, string>): string {
  if (bind === 'fixedText') return fixedText || ''
  return data[bind] || ''
}

function xToCm(anchor: 'marginLeft' | 'center' | 'marginRight', offsetCm: number, margins: { left: number; right: number }) {
  if (anchor === 'center') return PAGE_WIDTH / 2 + offsetCm
  if (anchor === 'marginRight') return PAGE_WIDTH - margins.right + offsetCm
  return margins.left + offsetCm
}

export function A4RedheadPreview({ template, selectedId, unitName, docNo, signatory, copyNo }: Props) {
  const margins = template.page.marginsCm
  const bindMap = {
    unitName: unitName || '某某单位',
    docNo: docNo || '某文〔2026〕1号',
    signatory: signatory || '签发人',
    copyNo: copyNo || '份号001',
    fixedText: '',
  }

  return (
    <div className="a4-preview-wrap">
      <div className="a4-preview" style={{ width: PAGE_WIDTH * SCALE, height: PAGE_HEIGHT * SCALE }}>
        <div
          className="margin-box"
          style={{
            left: margins.left * SCALE,
            top: margins.top * SCALE,
            width: (PAGE_WIDTH - margins.left - margins.right) * SCALE,
            height: (PAGE_HEIGHT - margins.top - margins.bottom) * SCALE,
          }}
        />
        <div className="safe-top" style={{ top: 0, height: SAFE_TOP * SCALE }} />

        {template.elements
          .filter((e) => e.enabled)
          .map((e) => {
            const xCm = xToCm(e.x.anchor, e.x.offsetCm, margins)
            const left = xCm * SCALE
            const top = e.yCm * SCALE
            const selected = selectedId === e.id

            if (e.type === 'line') {
              const widthCm = e.line?.lengthMode === 'custom' ? e.line.lengthCm || 8 : PAGE_WIDTH - margins.left - margins.right
              const lineLeft = e.line?.lengthMode === 'custom' ? left : margins.left * SCALE
              return (
                <div
                  key={e.id}
                  className={`preview-element line ${selected ? 'selected' : ''}`}
                  style={{
                    left: lineLeft,
                    top,
                    width: widthCm * SCALE,
                    borderTopWidth: `${e.line?.thicknessPt || 1.5}px`,
                    borderTopColor: e.line?.color || '#d40000',
                  }}
                />
              )
            }

            const txt = bindValue(e.bind, e.fixedText, bindMap)
            if (!txt && !e.visibleIfEmpty) return null

            const align = e.text?.align || 'left'
            const translateX = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0'

            return (
              <div
                key={e.id}
                className={`preview-element text ${selected ? 'selected' : ''}`}
                style={{
                  left,
                  top,
                  transform: `translateX(${translateX})`,
                  textAlign: align,
                  color: e.text?.font.color || '#000',
                  fontSize: `${(e.text?.font.sizePt || 16) * 1.1}px`,
                  fontWeight: e.text?.font.bold ? 700 : 400,
                }}
              >
                {txt}
              </div>
            )
          })}
      </div>
    </div>
  )
}
