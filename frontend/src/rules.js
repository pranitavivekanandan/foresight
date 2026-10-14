// Alert rule logic: defaults, validation, threshold lookup, and status
// evaluation against real container history. No React or storage here.

import { predictBreach } from './predict'
import {
  MEM_THRESHOLD_PERCENT,
  CPU_THRESHOLD_PERCENT,
  PREDICTION_LOOKAHEAD_MINUTES,
} from './constants'

export const RULE_METRICS = {
  memPercent: { label: 'Memory %', short: 'Memory', icon: 'ti-database' },
  cpuPercent: { label: 'CPU %', short: 'CPU', icon: 'ti-cpu' },
}

export const OPERATORS = {
  gt: { label: 'greater than', symbol: '>' },
  lt: { label: 'less than', symbol: '<' },
}

// Seeded when /api/rules is unavailable. memPercent 90 matches the backend's
// ALERT_THRESHOLD default; cpuPercent 80 matches the frontend's CPU default
// (the backend does not currently evaluate CPU at all).
export const DEFAULT_RULES = [
  {
    id: 'default-mem',
    metric: 'memPercent',
    scope: 'all',
    operator: 'gt',
    value: MEM_THRESHOLD_PERCENT,
    durationMin: 0,
    predictive: true,
    escalation: 'Dashboard alert',
  },
  {
    id: 'default-cpu',
    metric: 'cpuPercent',
    scope: 'all',
    operator: 'gt',
    value: CPU_THRESHOLD_PERCENT,
    durationMin: 0,
    predictive: true,
    escalation: 'Dashboard alert',
  },
]

const FALLBACK_THRESHOLDS = {
  memPercent: MEM_THRESHOLD_PERCENT,
  cpuPercent: CPU_THRESHOLD_PERCENT,
}

export function emptyDraft() {
  return { metric: 'memPercent', scope: 'all', operator: 'gt', value: '', durationMin: 5, predictive: false }
}

export function validateRuleDraft(draft) {
  const errors = {}
  if (!RULE_METRICS[draft.metric]) errors.metric = 'Choose a metric.'
  if (!OPERATORS[draft.operator]) errors.operator = 'Choose a condition.'
  const value = Number(draft.value)
  if (draft.value === '' || !Number.isFinite(value) || value <= 0 || value > 100) {
    errors.value = 'Enter a percentage between 0 and 100.'
  }
  const duration = Number(draft.durationMin)
  if (!Number.isInteger(duration) || duration < 0 || duration > 1440) {
    errors.durationMin = 'Duration must be a whole number of minutes (0-1440).'
  }
  if (!draft.scope) errors.scope = 'Choose a scope.'
  return errors
}

export function draftToRule(draft, id = `rule-${Date.now()}`) {
  return {
    id,
    metric: draft.metric,
    scope: draft.scope,
    operator: draft.operator,
    value: Number(draft.value),
    durationMin: Number(draft.durationMin),
    predictive: Boolean(draft.predictive),
    escalation: draft.escalation || 'Dashboard alert',
  }
}

export function ruleAppliesTo(rule, containerId) {
  return rule.scope === 'all' || rule.scope === containerId
}

// The threshold the UI should use for a metric on a container: the lowest
// "greater than" rule value that applies to it, else the built-in default.
// Lowest wins so the UI warns as soon as any applicable rule would.
export function thresholdFor(rules, metric, containerId) {
  const values = (rules || [])
    .filter((rule) => rule.metric === metric && rule.operator === 'gt' && ruleAppliesTo(rule, containerId))
    .map((rule) => Number(rule.value))
    .filter(Number.isFinite)
  return values.length ? Math.min(...values) : FALLBACK_THRESHOLDS[metric]
}

export function formatThreshold(rule) {
  const symbol = OPERATORS[rule.operator]?.symbol ?? '>'
  const duration = Number(rule.durationMin) > 0 ? ` for ${rule.durationMin}m` : ' (any reading)'
  return `${symbol} ${rule.value}%${duration}`
}

export function scopeLabel(scope, containers = []) {
  if (scope === 'all') return 'All containers'
  const match = containers.find((c) => c.containerId === scope)
  return match?.containerName || (scope ? `${scope.slice(0, 12)}…` : '')
}

function compare(operator, value, threshold) {
  return operator === 'lt' ? value < threshold : value > threshold
}

// True when every reading in the last `durationMin` minutes meets the
// condition (or, with duration 0, the latest reading does).
export function conditionSustained(data, rule, now = Date.now()) {
  const readings = (data || [])
    .map((entry) => ({ t: new Date(entry.timestamp).getTime(), v: Number(entry[rule.metric]) }))
    .filter((r) => Number.isFinite(r.t) && Number.isFinite(r.v))
  if (readings.length === 0) return false
  const latest = readings[readings.length - 1]
  const duration = Number(rule.durationMin) || 0
  if (duration === 0) return compare(rule.operator, latest.v, rule.value)
  const windowStart = now - duration * 60000
  // Need at least one reading at or before the window start, otherwise we
  // cannot claim the condition held for the whole duration.
  if (readings[0].t > windowStart) return false
  const inWindow = readings.filter((r) => r.t >= windowStart)
  return inWindow.length > 0 && inWindow.every((r) => compare(rule.operator, r.v, rule.value))
}

// 'triggered' if the condition is currently sustained on any container in
// scope; 'predicted' if predictive alerting is on and predict.js projects a
// breach within the lookahead window; 'monitoring' otherwise; 'no-data' when
// no in-scope container has history.
export function evaluateRuleStatus(rule, histories, now = Date.now()) {
  const inScope = Object.entries(histories || {}).filter(
    ([containerId, data]) => ruleAppliesTo(rule, containerId) && Array.isArray(data) && data.length > 0,
  )
  if (inScope.length === 0) return 'no-data'
  if (inScope.some(([, data]) => conditionSustained(data, rule, now))) return 'triggered'
  if (rule.predictive && rule.operator === 'gt') {
    const predicted = inScope.some(([, data]) => {
      const p = predictBreach(data, rule.metric, rule.value)
      return p.hasEnoughData && p.willBreach && p.minutesToBreach <= PREDICTION_LOOKAHEAD_MINUTES
    })
    if (predicted) return 'predicted'
  }
  return 'monitoring'
}

export function datapointsPerHour(containerCount, sampleIntervalMs) {
  if (!containerCount || !sampleIntervalMs) return 0
  return Math.round((3600_000 / sampleIntervalMs) * containerCount)
}

export function ruleSummary(draft, scopeName) {
  const metric = RULE_METRICS[draft.metric]?.short ?? draft.metric
  const operator = OPERATORS[draft.operator]?.label ?? 'greater than'
  const value = draft.value === '' ? '—' : draft.value
  const duration = Number(draft.durationMin) > 0 ? ` sustained for ${draft.durationMin} min` : ''
  return `This rule checks ${metric} on ${scopeName} and fires when it is ${operator} ${value}%${duration}.`
}
