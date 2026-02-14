function normalizeServerDateInput(input: string): string {
  let value = input.trim()
  if (value.includes(" ")) {
    value = value.replace(" ", "T")
  }
  value = value.replace(/(\.\d{3})\d+/, "$1")
  const hasTimezone = /(Z|[+\-]\d{2}:\d{2})$/i.test(value)
  if (!hasTimezone) {
    value = `${value}Z`
  }
  return value
}

export function formatServerDateTime(value?: string | null): string {
  const raw = (value || "").trim()
  if (!raw) return "-"

  const normalized = normalizeServerDateInput(raw)
  const date = new Date(normalized)
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleString()
  }

  const fallback = new Date(raw)
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toLocaleString()
  }

  return raw
}

