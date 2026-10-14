// Severity is derived on the frontend from how soon the breach is predicted;
// the backend stores only predictedBreachMinutes, not a severity level.
export const SEVERITIES = ['critical', 'high', 'warning']

export function severityFromMinutes(minutes) {
  const value = Number(minutes)
  if (!Number.isFinite(value)) return 'warning'
  if (value <= 15) return 'critical'
  if (value <= 60) return 'high'
  return 'warning'
}

export function severityLabel(severity) {
  return severity ? severity[0].toUpperCase() + severity.slice(1) : ''
}

// Lower rank = more urgent; used for sorting.
export function severityRank(severity) {
  const index = SEVERITIES.indexOf(severity)
  return index === -1 ? SEVERITIES.length : index
}
