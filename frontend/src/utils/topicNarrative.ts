type AnyRecord = Record<string, any>

const RULE_PATH_ORDER = [
  'title.fontFamily',
  'title.fontSizePt',
  'title.textAlign',
  'title.arrangement',
  'body.fontFamily',
  'body.fontSizePt',
  'body.lineSpacingPt',
  'body.spaceBeforePt',
  'body.spaceAfterPt',
  'body.firstLineIndentChars',
  'body.firstLineIndentPt',
  'references.citationOrder',
  'references.yearBrackets',
  'attachments.spacingBeforeLines',
  'attachments.indentChars',
  'attachments.itemSuffixPunctuation',
  'attachments.wrapAlign',
  'attachments.useBookTitleMarks',
  'signature.spacingBeforeLines',
  'page.marginsCm.top',
  'page.marginsCm.bottom',
  'page.marginsCm.left',
  'page.marginsCm.right',
  'headings.level1.fontFamily',
  'headings.level1.fontSizePt',
  'headings.level2.fontFamily',
  'headings.level2.fontSizePt',
  'headings.level3.fontFamily',
  'headings.level3.fontSizePt',
  'headings.level4.fontFamily',
  'headings.level4.fontSizePt',
]

const PATH_LABEL: Record<string, string> = {
  'title.fontFamily': '主标题字体',
  'title.fontSizePt': '主标题字号',
  'title.textAlign': '主标题对齐方式',
  'title.arrangement': '主标题排列方式',
  'body.fontFamily': '正文字体',
  'body.fontSizePt': '正文字号',
  'body.lineSpacingPt': '正文行距',
  'body.spaceBeforePt': '正文段前间距',
  'body.spaceAfterPt': '正文段后间距',
  'body.firstLineIndentChars': '正文首行缩进',
  'body.firstLineIndentPt': '正文首行缩进',
  'references.citationOrder': '引用公文顺序',
  'references.yearBrackets': '文号年份括号',
  'attachments.spacingBeforeLines': '附件前空行',
  'attachments.indentChars': '附件缩进',
  'attachments.itemSuffixPunctuation': '附件序号后标点',
  'attachments.wrapAlign': '附件回行对齐',
  'attachments.useBookTitleMarks': '附件名称书名号',
  'signature.spacingBeforeLines': '落款前空行',
  'page.marginsCm.top': '页面上边距',
  'page.marginsCm.bottom': '页面下边距',
  'page.marginsCm.left': '页面左边距',
  'page.marginsCm.right': '页面右边距',
  'headings.level1.fontFamily': '一级标题字体',
  'headings.level1.fontSizePt': '一级标题字号',
  'headings.level2.fontFamily': '二级标题字体',
  'headings.level2.fontSizePt': '二级标题字号',
  'headings.level3.fontFamily': '三级标题字体',
  'headings.level3.fontSizePt': '三级标题字号',
  'headings.level4.fontFamily': '四级标题字体',
  'headings.level4.fontSizePt': '四级标题字号',
}

function readPath(source: AnyRecord, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = source
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in (current as AnyRecord))) {
      return undefined
    }
    current = (current as AnyRecord)[part]
  }
  return current
}

function formatRuleLine(path: string, value: unknown): string {
  const label = PATH_LABEL[path] || path
  if (path === 'title.arrangement' && typeof value === 'string') {
    const arrangementLabel: Record<string, string> = {
      trapezoid: '梯形排列',
      standard: '常规排列',
    }
    return `${label}建议为 ${arrangementLabel[value] || value}。`
  }

  if (path === 'title.textAlign' && typeof value === 'string') {
    const alignLabel: Record<string, string> = {
      left: '左对齐',
      center: '居中',
      right: '右对齐',
      justify: '两端对齐',
    }
    return `${label}建议为 ${alignLabel[value] || value}。`
  }

  if (path === 'body.firstLineIndentChars' && typeof value === 'number') {
    return `${label}建议为首行左空 ${value} 格。`
  }

  if (path === 'references.citationOrder' && typeof value === 'string') {
    const orderLabel: Record<string, string> = {
      titleThenDocNo: '先引标题后引发号',
      docNoThenTitle: '先引发号后引标题',
    }
    return `${label}建议为 ${orderLabel[value] || value}。`
  }

  if (path === 'references.yearBrackets' && typeof value === 'string') {
    return `${label}建议使用 ${value}。`
  }

  if (path === 'attachments.itemSuffixPunctuation' && typeof value === 'string') {
    return `${label}建议为 ${value === 'none' ? '不加标点' : '加句点'}。`
  }

  if (path === 'attachments.wrapAlign' && typeof value === 'string') {
    return `${label}建议为 ${value === 'text' ? '与文字对齐' : '按段落缩进对齐'}。`
  }

  if (path === 'attachments.useBookTitleMarks' && typeof value === 'boolean') {
    return `${label}建议${value ? '保留' : '不加'}书名号。`
  }

  if (typeof value === 'string') {
    return `${label}建议使用 ${value}。`
  }

  if (typeof value === 'number') {
    if (path.endsWith('Lines')) return `${label}建议为 ${value} 行。`
    if (path === 'attachments.indentChars') return `${label}建议为左空 ${value} 格。`
    if (path.includes('marginsCm')) return `${label}建议为 ${value} 厘米。`
    return `${label}建议为 ${value} 磅。`
  }

  return `${label}建议值为 ${String(value)}。`
}

function confidenceLevel(confidence: number): string {
  if (confidence >= 0.9) return '高'
  if (confidence >= 0.7) return '中'
  return '低'
}

export function summarizeRulesAsNarrative(inferredRules: AnyRecord): string[] {
  const lines = RULE_PATH_ORDER.map((path) => {
    const value = readPath(inferredRules, path)
    if (value === undefined || value === null || value === '') return null
    return formatRuleLine(path, value)
  }).filter((item): item is string => Boolean(item))

  const contentTemplate = inferredRules?.contentTemplate as AnyRecord | undefined
  if (contentTemplate && typeof contentTemplate === 'object') {
    const leadingCount = Array.isArray(contentTemplate.leadingNodes) ? contentTemplate.leadingNodes.length : 0
    const trailingCount = Array.isArray(contentTemplate.trailingNodes) ? contentTemplate.trailingNodes.length : 0
    if (leadingCount > 0 || trailingCount > 0) {
      lines.push(`已抽取固定前置区块 ${leadingCount} 段、固定后置区块 ${trailingCount} 段，新建正文将自动带出。`)
    }
  }

  if (lines.length > 0) return lines
  return ['暂无可读版式规则，请先上传可解析训练材料。']
}

export function summarizeConfidenceAsNarrative(confidenceReport: AnyRecord): string[] {
  const sortedPaths = Object.keys(confidenceReport).sort((a, b) => {
    const ai = RULE_PATH_ORDER.indexOf(a)
    const bi = RULE_PATH_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  const lines = sortedPaths
    .map((path) => {
      const item = confidenceReport[path] as { confidence?: unknown; samples?: unknown } | undefined
      if (!item) return null

      const confidence = typeof item.confidence === 'number' ? item.confidence : null
      const samples = typeof item.samples === 'number' ? item.samples : null
      if (confidence === null || samples === null) return null

      const percent = Math.round(confidence * 100)
      const label = PATH_LABEL[path] || path
      return `${label}：置信度${confidenceLevel(confidence)}（${percent}%），样本数 ${samples}。`
    })
    .filter((item): item is string => Boolean(item))

  if (lines.length > 0) return lines
  return ['暂无置信度数据，请先完成训练材料分析。']
}
