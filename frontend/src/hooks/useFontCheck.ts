import { useCallback, useEffect, useMemo, useState } from 'react'
import { detectRequiredFonts, getCachedFontStatus, missingFonts, type FontStatus, REQUIRED_FONTS } from '../utils/fontCheck'

export function useFontCheck() {
  const [status, setStatus] = useState<FontStatus>(
    () =>
      getCachedFontStatus() || {
        '方正小标宋简': false,
        '仿宋_GB2312': false,
        '楷体_GB2312': false,
        '黑体': false,
      },
  )
  const [checking, setChecking] = useState(false)

  const recheck = useCallback(async () => {
    setChecking(true)
    try {
      const latest = await detectRequiredFonts()
      setStatus(latest)
      return latest
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    if (!getCachedFontStatus()) {
      void recheck()
    }
  }, [recheck])

  const missing = useMemo(() => missingFonts(status), [status])
  const ready = missing.length === 0

  return {
    requiredFonts: REQUIRED_FONTS,
    status,
    missing,
    ready,
    checking,
    recheck,
  }
}
