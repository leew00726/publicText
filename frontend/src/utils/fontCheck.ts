export const REQUIRED_FONTS = ['方正小标宋简', '仿宋_GB2312', '楷体_GB2312', '黑体'] as const

export type FontStatus = Record<(typeof REQUIRED_FONTS)[number], boolean>

const CACHE_KEY = 'required-font-status-v1'

function canvasDetect(fontName: string): boolean {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const text = '公文排版字体检测123ABC'
  const size = '32px'

  ctx.font = `${size} serif`
  const serif = ctx.measureText(text).width

  ctx.font = `${size} sans-serif`
  const sans = ctx.measureText(text).width

  ctx.font = `${size} "${fontName}", serif`
  const targetSerif = ctx.measureText(text).width

  ctx.font = `${size} "${fontName}", sans-serif`
  const targetSans = ctx.measureText(text).width

  return Math.abs(targetSerif - serif) > 0.1 || Math.abs(targetSans - sans) > 0.1
}

function fontApiDetect(fontName: string): boolean {
  if (!('fonts' in document) || !document.fonts?.check) return false
  return document.fonts.check(`16px "${fontName}"`)
}

export async function detectRequiredFonts(): Promise<FontStatus> {
  if ('fonts' in document && document.fonts?.ready) {
    await document.fonts.ready
  }

  const status = {} as FontStatus
  for (const font of REQUIRED_FONTS) {
    const viaApi = fontApiDetect(font)
    const viaCanvas = canvasDetect(font)
    status[font] = viaApi || viaCanvas
  }

  localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), status }))
  return status
}

export function getCachedFontStatus(): FontStatus | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.status) return null
    return parsed.status as FontStatus
  } catch {
    return null
  }
}

export function missingFonts(status: FontStatus): string[] {
  return REQUIRED_FONTS.filter((f) => !status[f])
}
