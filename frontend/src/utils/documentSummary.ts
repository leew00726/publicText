const SUPPORTED_SUMMARY_EXTENSIONS = ['.docx', '.pdf', '.txt']

export function isSupportedSummaryFileName(fileName: string): boolean {
  const normalized = (fileName || '').trim().toLowerCase()
  if (!normalized) return false
  return SUPPORTED_SUMMARY_EXTENSIONS.some((ext) => normalized.endsWith(ext))
}

export function suggestSummaryExportTitle(sourceFileName: string): string {
  const normalized = (sourceFileName || '').trim()
  if (!normalized) return '公文总结'

  const lastDot = normalized.lastIndexOf('.')
  const stem = lastDot > 0 ? normalized.slice(0, lastDot) : normalized
  const cleaned = stem.trim()
  if (!cleaned) return '公文总结'
  return `${cleaned}_总结`
}
