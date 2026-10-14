// Display formatting only — no data decisions live here.

export function formatPercent(value, digits = 1) {
  return Number.isFinite(Number(value)) && value !== null ? `${Number(value).toFixed(digits)}%` : '—'
}

// Restart costs from the backend are fractions of a cent, so small values get
// more decimals instead of rounding to $0.00.
export function formatUsd(value) {
  if (value == null || !Number.isFinite(Number(value))) return 'n/a'
  const number = Number(value)
  const digits = Math.abs(number) > 0 && Math.abs(number) < 0.01 ? 4 : 2
  return `$${number.toFixed(digits)}`
}

export function formatMb(value) {
  if (!Number.isFinite(Number(value))) return '—'
  const mb = Number(value)
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`
}

function pad(n) {
  return String(n).padStart(2, '0')
}

export function formatClock(date) {
  if (!date) return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function minutesBetween(from, to = Date.now()) {
  const start = new Date(from).getTime()
  const end = new Date(to).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return Math.max(0, (end - start) / 60000)
}

export function formatAgo(minutes) {
  if (minutes == null) return 'never'
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${Math.floor(minutes)} min ago`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`
  return `${Math.floor(minutes / (60 * 24))} d ago`
}

export function formatDuration(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return '—'
  if (minutes < 1) return '<1 min'
  if (minutes < 120) return `${Math.round(minutes)} min`
  if (minutes < 60 * 48) return `${(minutes / 60).toFixed(1)} h`
  return `${(minutes / (60 * 24)).toFixed(1)} d`
}

export function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}
