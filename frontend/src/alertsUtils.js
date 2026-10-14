import { severityFromMinutes, severityRank } from './severity'

// Pure data helpers for the alerts UI — no React, no DOM, so they can be unit
// tested directly and reused by both AlertsFeed and anything else that needs
// to reason about the alert list.

// Groups a flat alert list into { root, children } pairs. An alert is a root
// when groupedWith is null, or when groupedWith points at an id that isn't in
// the given list (e.g. the root was filtered out by status) — in that case
// the child is promoted to root so it doesn't disappear from the feed.
export function groupAlerts(alerts) {
  const byId = new Map(alerts.map((alert) => [alert.id, alert]))
  const childrenByRootId = new Map()
  const roots = []

  for (const alert of alerts) {
    if (alert.groupedWith != null && byId.has(alert.groupedWith)) {
      const siblings = childrenByRootId.get(alert.groupedWith) || []
      siblings.push(alert)
      childrenByRootId.set(alert.groupedWith, siblings)
    } else {
      roots.push(alert)
    }
  }

  return roots.map((root) => ({
    root,
    children: childrenByRootId.get(root.id) || [],
  }))
}

// Filters a flat alert list by resolution status.
export function filterAlertsByStatus(alerts, status) {
  if (status === 'resolved') return alerts.filter((alert) => alert.resolved)
  return alerts.filter((alert) => !alert.resolved)
}

// ---------------------------------------------------------------------------
// Feed / detail helpers added for the alerts screens.


const METRIC_LABELS = { memPercent: 'Memory', cpuPercent: 'CPU' }

export function metricLabel(metric) {
  return METRIC_LABELS[metric] ?? metric
}

// The backend does not store the threshold on the alert row, but its
// explanation text always contains "cross(ed) N%". Returns null if absent.
export function parseThresholdFromExplanation(explanation) {
  const match = /cross(?:ed)?\s+(\d+(?:\.\d+)?)%/i.exec(explanation || '')
  return match ? Number(match[1]) : null
}

export function alertThreshold(alert, fallback) {
  return parseThresholdFromExplanation(alert?.explanation) ?? fallback
}

export function alertTitle(alert, fallbackThreshold) {
  const threshold = alertThreshold(alert, fallbackThreshold)
  return `${metricLabel(alert.metric)} predicted to breach ${threshold}%`
}

export function alertCode(id) {
  return `ALR-${id}`
}

// Status combines the backend's resolved flag with acknowledgements, which
// are frontend-only (localStorage) because the backend has no ack field.
export function alertStatus(alert, acknowledgedIds = []) {
  if (alert.resolved) return 'resolved'
  return acknowledgedIds.includes(alert.id) ? 'acknowledged' : 'active'
}

export function alertSeverity(alert) {
  return severityFromMinutes(alert.predictedBreachMinutes)
}

export function filterAlerts(alerts, { status = 'all', severity = 'all', query = '' } = {}, acknowledgedIds = []) {
  const q = query.trim().toLowerCase()
  return alerts.filter((alert) => {
    if (status !== 'all' && alertStatus(alert, acknowledgedIds) !== status) return false
    if (severity !== 'all' && alertSeverity(alert) !== severity) return false
    if (q && !`${alert.containerName} ${alert.metric} ${alert.explanation}`.toLowerCase().includes(q)) return false
    return true
  })
}

export function paginate(items, page, pageSize) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), totalPages)
  const startIndex = (current - 1) * pageSize
  const slice = items.slice(startIndex, startIndex + pageSize)
  return {
    items: slice,
    page: current,
    totalPages,
    total,
    start: total === 0 ? 0 : startIndex + 1,
    end: startIndex + slice.length,
  }
}

function csvCell(value) {
  const text = value == null ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function alertsToCsv(alerts, acknowledgedIds = []) {
  const header = [
    'id', 'time', 'container_id', 'container_name', 'metric', 'current_value',
    'predicted_breach_minutes', 'severity', 'status', 'grouped_with',
    'cost_restart_usd', 'cost_upgrade_usd', 'explanation',
  ]
  const rows = alerts.map((a) => [
    a.id, a.time, a.containerId, a.containerName, a.metric, a.currentValue,
    a.predictedBreachMinutes, alertSeverity(a), alertStatus(a, acknowledgedIds), a.groupedWith,
    a.costRestartUsd, a.costUpgradeUsd, a.explanation,
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
}

export function latestAlertFor(alerts, containerId) {
  return (
    alerts
      .filter((a) => a.containerId === containerId)
      .sort((a, b) => new Date(b.time) - new Date(a.time))[0] ?? null
  )
}

// Other containers whose alerts share a grouped_with group with this
// container's latest alert. One entry per container.
export function correlatedContainers(alerts, containerId) {
  const own = latestAlertFor(alerts, containerId)
  if (!own) return []
  const rootId = own.groupedWith ?? own.id
  const seen = new Set([containerId])
  const result = []
  for (const alert of alerts) {
    const inGroup = alert.id === rootId || alert.groupedWith === rootId
    if (!inGroup || seen.has(alert.containerId)) continue
    seen.add(alert.containerId)
    result.push({
      containerId: alert.containerId,
      containerName: alert.containerName,
      alertId: alert.id,
      resolved: alert.resolved,
      isRoot: alert.id === rootId,
    })
  }
  return result
}

export function sortAlertGroups(groups) {
  return [...groups].sort(
    (a, b) =>
      Number(a.root.resolved) - Number(b.root.resolved) ||
      severityRank(alertSeverity(a.root)) - severityRank(alertSeverity(b.root)) ||
      new Date(b.root.time) - new Date(a.root.time),
  )
}

// Start/current values over a container's recent history, for the alert
// detail headline ("Memory rose from 60% to 85% over 30 minutes").
export function changeOverHistory(data, field = 'memPercent') {
  const rows = (data || []).filter((r) => Number.isFinite(Number(r[field])) && Number.isFinite(new Date(r.timestamp).getTime()))
  if (rows.length < 2) return null
  const first = rows[0]
  const last = rows[rows.length - 1]
  return {
    start: Number(first[field]),
    current: Number(last[field]),
    minutes: (new Date(last.timestamp) - new Date(first.timestamp)) / 60000,
  }
}

// Splits text into plain and highlighted segments. Every "N%" is a number
// segment; the one matching `current` (to 1 dp) is tagged 'current'.
export function highlightPercents(text, { current } = {}) {
  const segments = []
  const pattern = /(\d+(?:\.\d+)?)%/g
  let lastIndex = 0
  let match
  while ((match = pattern.exec(text || '')) !== null) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), tone: null })
    const value = Number(match[1])
    const tone = Number.isFinite(current) && value.toFixed(1) === Number(current).toFixed(1) ? 'current' : 'number'
    segments.push({ text: match[0], tone })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < (text || '').length) segments.push({ text: text.slice(lastIndex), tone: null })
  return segments
}
