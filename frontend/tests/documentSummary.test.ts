import { describe, expect, it } from 'vitest'

import { isSupportedSummaryFileName, suggestSummaryExportTitle } from '../src/utils/documentSummary'

describe('document summary helpers', () => {
  it('accepts supported file extensions', () => {
    expect(isSupportedSummaryFileName('会议纪要.docx')).toBe(true)
    expect(isSupportedSummaryFileName('政策解读.pdf')).toBe(true)
    expect(isSupportedSummaryFileName('草稿.TXT')).toBe(true)
    expect(isSupportedSummaryFileName('photo.png')).toBe(false)
  })

  it('builds readable export title from source file name', () => {
    expect(suggestSummaryExportTitle('年度总结.docx')).toBe('年度总结_总结')
    expect(suggestSummaryExportTitle('')).toBe('公文总结')
  })
})
