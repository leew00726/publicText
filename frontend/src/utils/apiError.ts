function formatLocation(loc: unknown): string {
  if (!Array.isArray(loc) || loc.length === 0) return ''
  const parts = loc.filter((item) => item !== 'body').map((item) => String(item))
  return parts.join('.')
}

function formatDetailEntry(entry: unknown): string | null {
  if (typeof entry === 'string') return entry
  if (!entry || typeof entry !== 'object') return null

  const maybeRecord = entry as { msg?: unknown; loc?: unknown; detail?: unknown }
  if (typeof maybeRecord.msg === 'string') {
    const location = formatLocation(maybeRecord.loc)
    return location ? `${location}：${maybeRecord.msg}` : maybeRecord.msg
  }

  if ('detail' in maybeRecord) {
    return formatApiErrorDetail(maybeRecord.detail, '')
  }

  return null
}

export function formatApiErrorDetail(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail

  if (Array.isArray(detail)) {
    const messages = detail.map(formatDetailEntry).filter((item): item is string => Boolean(item && item.trim()))
    return messages.length ? messages.join('\n') : fallback
  }

  const singleMessage = formatDetailEntry(detail)
  if (singleMessage && singleMessage.trim()) return singleMessage

  return fallback
}

export function getApiErrorMessage(error: unknown, fallback: string, timeoutMessage?: string): string {
  const maybeError = error as {
    code?: unknown
    response?: { data?: { detail?: unknown } }
    message?: unknown
  } | null

  if (maybeError?.code === 'ECONNABORTED' && timeoutMessage) {
    return timeoutMessage
  }

  const detail = maybeError?.response?.data?.detail
  const formatted = formatApiErrorDetail(detail, '')
  if (formatted) return formatted

  if (typeof maybeError?.message === 'string' && maybeError.message.trim()) {
    return maybeError.message
  }

  return fallback
}
