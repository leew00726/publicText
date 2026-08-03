import type { TemplateRules } from '../api/types'

export const DEFAULT_PAGE_MARGINS_CM = {
  top: 3.7,
  bottom: 3.5,
  left: 2.7,
  right: 2.5,
} as const

type MarginSide = keyof typeof DEFAULT_PAGE_MARGINS_CM

function toMargin(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 10) return undefined
  return Math.round(number * 1000) / 1000
}

function readMargin(source: unknown, side: MarginSide): number | undefined {
  if (!source || typeof source !== 'object') return undefined
  const record = source as Record<string, unknown>
  return toMargin(record[side]) ?? toMargin(record[`${side}Cm`])
}

export function normalizeTemplateRules(value: unknown): TemplateRules {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const rules = { ...source } as TemplateRules
  const legacyPage = source.pageMargins
  const sourcePage = source.page && typeof source.page === 'object' ? (source.page as Record<string, unknown>) : {}
  const sourceMargins =
    sourcePage.marginsCm && typeof sourcePage.marginsCm === 'object'
      ? (sourcePage.marginsCm as Record<string, unknown>)
      : {}
  const margins: Partial<Record<MarginSide, number>> = {}

  ;(Object.keys(DEFAULT_PAGE_MARGINS_CM) as MarginSide[]).forEach((side) => {
    const valueForSide = readMargin(sourceMargins, side) ?? readMargin(sourcePage, side) ?? readMargin(legacyPage, side)
    if (valueForSide !== undefined) margins[side] = valueForSide
  })

  delete (rules as Record<string, unknown>).pageMargins
  rules.schemaVersion = 1
  if (Object.keys(margins).length > 0 || Object.keys(sourcePage).length > 0) {
    rules.page = {
      ...sourcePage,
      marginsCm: margins,
    }
    ;(['top', 'bottom', 'left', 'right'] as MarginSide[]).forEach((side) => {
      delete (rules.page as Record<string, unknown>)[side]
      delete (rules.page as Record<string, unknown>)[`${side}Cm`]
    })
  }
  return rules
}

export function resolveLayoutSpec(
  value: unknown,
  fallbackMargins?: Partial<{ top: number; bottom: number; left: number; right: number }>,
) {
  const rules = normalizeTemplateRules(value)
  const margins = rules.page?.marginsCm || {}
  return {
    schemaVersion: 1 as const,
    page: {
      paper: 'A4' as const,
      marginsCm: {
        top: margins.top ?? fallbackMargins?.top ?? DEFAULT_PAGE_MARGINS_CM.top,
        bottom: margins.bottom ?? fallbackMargins?.bottom ?? DEFAULT_PAGE_MARGINS_CM.bottom,
        left: margins.left ?? fallbackMargins?.left ?? DEFAULT_PAGE_MARGINS_CM.left,
        right: margins.right ?? fallbackMargins?.right ?? DEFAULT_PAGE_MARGINS_CM.right,
      },
    },
    title: rules.title || {},
    body: rules.body || {},
    headings: rules.headings || {},
  }
}

export type TemplateRuleCoverage = {
  key: 'title' | 'body' | 'headings' | 'page'
  label: string
  status: 'captured' | 'defaulted'
  detail: string
}

export function getTemplateRuleCoverage(value: unknown): TemplateRuleCoverage[] {
  const rules = normalizeTemplateRules(value)
  const pageMargins = rules.page?.marginsCm || {}
  const title = rules.title || {}
  const body = rules.body || {}
  const headings = rules.headings || {}
  const hasMargins = (['top', 'bottom', 'left', 'right'] as const).every((side) => pageMargins[side] !== undefined)
  const headingLevels = ['level1', 'level2', 'level3', 'level4'].filter((level) => {
    const style = headings[level]
    return Boolean(style?.fontFamily || style?.fontSizePt || style?.lineSpacingPt)
  })

  return [
    {
      key: 'title',
      label: '主标题',
      status: title.fontFamily || title.fontSizePt || title.textAlign ? 'captured' : 'defaulted',
      detail: title.fontFamily || title.fontSizePt || title.textAlign ? '已保存标题字体、字号或对齐规则' : '使用系统默认标题规则',
    },
    {
      key: 'body',
      label: '正文',
      status: body.fontFamily || body.fontSizePt || body.lineSpacingPt || body.firstLineIndentChars ? 'captured' : 'defaulted',
      detail:
        body.fontFamily || body.fontSizePt || body.lineSpacingPt || body.firstLineIndentChars
          ? '已保存正文字体、字号、行距或缩进规则'
          : '使用系统默认正文规则',
    },
    {
      key: 'headings',
      label: '层级标题',
      status: headingLevels.length > 0 ? 'captured' : 'defaulted',
      detail: headingLevels.length > 0 ? `已识别 ${headingLevels.length} 个标题层级` : '尚未识别标题层级规则',
    },
    {
      key: 'page',
      label: '页面边距',
      status: hasMargins ? 'captured' : 'defaulted',
      detail: hasMargins
        ? `上 ${pageMargins.top} / 下 ${pageMargins.bottom} / 左 ${pageMargins.left} / 右 ${pageMargins.right} 厘米`
        : '缺失项将使用系统默认页边距',
    },
  ]
}
