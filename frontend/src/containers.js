// Container discovery and per-container summaries for the dashboard.
// Pure functions: they take fetched data in and return plain objects.

import { predictBreach } from './predict'
import { thresholdFor } from './rules'
import { minutesBetween } from './format'
import { PREDICTION_LOOKAHEAD_MINUTES, STALE_AFTER_MINUTES } from './constants'

export function parseEnvContainerIds(raw) {
  return String(raw || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

// Builds the container list from, in order: the live discovery endpoint (or
// VITE_CONTAINER_IDS when discovery failed), then any container that has an
// unresolved alert. The alert source matters because the discovery endpoint
// only lists *running* Docker containers, while alerts can reference
// containers that only exist in the database (e.g. seeded demo data).
export function mergeContainerSources({ discovered, envIds = [], alerts = [] }) {
  const result = []
  const seen = new Set()
  const add = (containerId, containerName, source) => {
    if (!containerId || seen.has(containerId)) return
    seen.add(containerId)
    result.push({ containerId, containerName: containerName || containerId, source })
  }

  if (Array.isArray(discovered)) {
    discovered.forEach((c) => add(c.containerId, c.containerName, 'discovered'))
  } else {
    envIds.forEach((id) => add(id, id, 'env'))
  }
  alerts
    .filter((a) => !a.resolved)
    .forEach((a) => add(a.containerId, a.containerName, 'alert'))
  return result
}

function isActiveBreach(prediction) {
  return Boolean(
    prediction?.hasEnoughData &&
      prediction.willBreach &&
      prediction.minutesToBreach <= PREDICTION_LOOKAHEAD_MINUTES,
  )
}

export function summarizeContainer({ container, history, alerts = [], rules = [], now = Date.now() }) {
  const data = Array.isArray(history?.data) ? history.data : []
  const latest = data[data.length - 1] ?? null
  const memThreshold = thresholdFor(rules, 'memPercent', container.containerId)
  const cpuThreshold = thresholdFor(rules, 'cpuPercent', container.containerId)
  const memPrediction = predictBreach(data, 'memPercent', memThreshold)
  const cpuPrediction = predictBreach(data, 'cpuPercent', cpuThreshold)
  const unresolvedAlerts = alerts.filter((a) => a.containerId === container.containerId && !a.resolved)
  const minutesSinceUpdate = latest ? minutesBetween(latest.timestamp, now) : null

  const memBreachMinutes = isActiveBreach(memPrediction) ? memPrediction.minutesToBreach : null
  const cpuBreachMinutes = isActiveBreach(cpuPrediction) ? cpuPrediction.minutesToBreach : null
  const breachMinutes = [memBreachMinutes, cpuBreachMinutes].filter((m) => m != null)
  const predictedBreachMinutes = breachMinutes.length ? Math.min(...breachMinutes) : null
  const hasAlert = unresolvedAlerts.length > 0
  const atRisk = hasAlert || predictedBreachMinutes != null

  return {
    containerId: container.containerId,
    containerName: history?.containerName || container.containerName,
    source: container.source,
    data,
    latest,
    memThreshold,
    cpuThreshold,
    memPrediction,
    cpuPrediction,
    memBreachMinutes,
    cpuBreachMinutes,
    unresolvedAlerts,
    hasAlert,
    predictedBreachMinutes,
    atRisk,
    minutesSinceUpdate,
    reporting: minutesSinceUpdate != null && minutesSinceUpdate <= STALE_AFTER_MINUTES,
    error: history?.error ?? null,
  }
}

// Status-dot tone for a container summary.
export function containerTone(summary) {
  if (!summary.latest) return 'muted'
  if (summary.hasAlert) return 'critical'
  if (summary.predictedBreachMinutes != null) return 'warning'
  return summary.reporting ? 'healthy' : 'muted'
}

// Lower is less healthy. Alerts first, then soonest predicted breach, then
// highest memory use; containers with no data go last.
export function healthScore(summary) {
  if (!summary.latest) return Number.POSITIVE_INFINITY
  if (summary.hasAlert) return 0
  if (summary.predictedBreachMinutes != null) return 1 + summary.predictedBreachMinutes / PREDICTION_LOOKAHEAD_MINUTES
  return 3 - (Number(summary.latest.memPercent) || 0) / 100
}

export function sortContainers(list, key) {
  const copy = [...list]
  const byName = (a, b) => a.containerName.localeCompare(b.containerName)
  const latestValue = (s, field) => (s.latest ? Number(s.latest[field]) || 0 : -1)
  switch (key) {
    case 'name':
      return copy.sort(byName)
    case 'memory':
      return copy.sort((a, b) => latestValue(b, 'memPercent') - latestValue(a, 'memPercent') || byName(a, b))
    case 'cpu':
      return copy.sort((a, b) => latestValue(b, 'cpuPercent') - latestValue(a, 'cpuPercent') || byName(a, b))
    default:
      return copy.sort((a, b) => healthScore(a) - healthScore(b) || byName(a, b))
  }
}

export function filterContainers(list, { tab = 'all', query = '' } = {}) {
  const q = query.trim().toLowerCase()
  return list.filter((s) => {
    if (tab === 'critical' && !s.atRisk) return false
    if (q && !`${s.containerName} ${s.containerId}`.toLowerCase().includes(q)) return false
    return true
  })
}

export function dashboardSummary(list, alerts = []) {
  const withBreach = list.filter((s) => s.predictedBreachMinutes != null)
  const soonest = withBreach.reduce(
    (best, s) => (best == null || s.predictedBreachMinutes < best.predictedBreachMinutes ? s : best),
    null,
  )
  return {
    total: list.length,
    reporting: list.filter((s) => s.reporting).length,
    atRisk: list.filter((s) => s.atRisk).length,
    pendingAlerts: alerts.filter((a) => !a.resolved).length,
    soonest: soonest ? { containerName: soonest.containerName, minutes: soonest.predictedBreachMinutes } : null,
  }
}

// Status bar text from real signals only: backend /health plus whether each
// container has reported recently.
export function systemStatus({ healthOk, reporting, total }) {
  if (healthOk === null || healthOk === undefined) return { tone: 'muted', text: 'Checking backend…' }
  if (!healthOk) return { tone: 'critical', text: 'Backend unreachable' }
  if (total === 0) return { tone: 'muted', text: 'Backend healthy · no containers found' }
  if (reporting === total) return { tone: 'healthy', text: 'All system nodes operational' }
  return { tone: 'warning', text: `${reporting} of ${total} containers reporting` }
}
