import { describe, it, expect } from 'vitest'
import {
  parseEnvContainerIds,
  mergeContainerSources,
  summarizeContainer,
  sortContainers,
  filterContainers,
  dashboardSummary,
  healthScore,
  systemStatus,
  containerTone,
  filterHistoryByRange,
  historyCoverage,
} from './containers'

const NOW = Date.parse('2026-01-01T01:00:00Z')
const row = (minsAgo, memPercent, cpuPercent = 10) => ({
  timestamp: new Date(NOW - minsAgo * 60000).toISOString(),
  memPercent,
  cpuPercent,
  memUsedMB: 100,
  memLimitMB: 200,
})

describe('parseEnvContainerIds', () => {
  it('splits and trims', () => {
    expect(parseEnvContainerIds(' a, b ,,c ')).toEqual(['a', 'b', 'c'])
    expect(parseEnvContainerIds(undefined)).toEqual([])
  })
})

describe('mergeContainerSources', () => {
  const alerts = [
    { containerId: 'demo-api', containerName: 'demo-api', resolved: false },
    { containerId: 'old', containerName: 'old', resolved: true },
    { containerId: 'live-1', containerName: 'live', resolved: false },
  ]

  it('prefers discovered containers and adds unresolved-alert containers', () => {
    const result = mergeContainerSources({
      discovered: [{ containerId: 'live-1', containerName: 'live' }],
      envIds: ['env-1'],
      alerts,
    })
    expect(result).toEqual([
      { containerId: 'live-1', containerName: 'live', source: 'discovered' },
      { containerId: 'demo-api', containerName: 'demo-api', source: 'alert' },
    ])
  })

  it('falls back to env ids when discovery failed', () => {
    const result = mergeContainerSources({ discovered: null, envIds: ['env-1'], alerts: [] })
    expect(result).toEqual([{ containerId: 'env-1', containerName: 'env-1', source: 'env' }])
  })
})

describe('summarizeContainer', () => {
  const container = { containerId: 'a', containerName: 'api', source: 'discovered' }

  it('flags a rising container as at risk with a predicted breach', () => {
    const history = { containerName: 'api', data: [row(3, 60), row(2, 70), row(1, 80), row(0, 85)] }
    const s = summarizeContainer({ container, history, now: NOW })
    expect(s.atRisk).toBe(true)
    expect(s.hasAlert).toBe(false)
    expect(s.predictedBreachMinutes).toBeGreaterThanOrEqual(0)
    expect(s.memBreachMinutes).toBe(s.predictedBreachMinutes)
    expect(s.cpuBreachMinutes).toBeNull()
    expect(s.reporting).toBe(true)
    expect(s.memThreshold).toBe(90)
  })

  it('uses rule thresholds', () => {
    const history = { data: [row(1, 50), row(0, 50)] }
    const rules = [{ metric: 'memPercent', scope: 'a', operator: 'gt', value: 40 }]
    const s = summarizeContainer({ container, history, rules, now: NOW })
    expect(s.memThreshold).toBe(40)
  })

  it('marks unresolved alerts and stale data', () => {
    const history = { data: [row(30, 50), row(20, 50)] }
    const s = summarizeContainer({
      container,
      history,
      alerts: [{ containerId: 'a', resolved: false }, { containerId: 'a', resolved: true }],
      now: NOW,
    })
    expect(s.hasAlert).toBe(true)
    expect(s.unresolvedAlerts).toHaveLength(1)
    expect(s.reporting).toBe(false)
    expect(s.minutesSinceUpdate).toBe(20)
  })

  it('handles missing history', () => {
    const s = summarizeContainer({ container, history: null, now: NOW })
    expect(s.latest).toBeNull()
    expect(s.atRisk).toBe(false)
    expect(s.containerName).toBe('api')
  })

  it('ignores breaches projected beyond the lookahead window', () => {
    // +0.001% per minute from 50 -> ~40000 min to reach 90
    const history = { data: [row(10, 50), row(0, 50.01)] }
    const s = summarizeContainer({ container, history, now: NOW })
    expect(s.memPrediction.willBreach).toBe(true)
    expect(s.predictedBreachMinutes).toBeNull()
    expect(s.atRisk).toBe(false)
  })
})

describe('sorting and filtering', () => {
  const make = (name, mem, cpu, extra = {}) => ({
    containerId: name,
    containerName: name,
    latest: { memPercent: mem, cpuPercent: cpu },
    hasAlert: false,
    predictedBreachMinutes: null,
    atRisk: false,
    ...extra,
  })
  const list = [
    make('b', 50, 90),
    make('a', 70, 10),
    make('c', 20, 20, { hasAlert: true, atRisk: true }),
    make('d', 30, 30, { predictedBreachMinutes: 10, atRisk: true }),
    { ...make('e', 0, 0), latest: null },
  ]

  it('sorts by health: alerts, then predicted breach, then memory, no-data last', () => {
    expect(sortContainers(list, 'health').map((s) => s.containerName)).toEqual(['c', 'd', 'a', 'b', 'e'])
    expect(healthScore(list[4])).toBe(Infinity)
  })

  it('sorts by name, memory and cpu', () => {
    expect(sortContainers(list, 'name').map((s) => s.containerName)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(sortContainers(list, 'memory').map((s) => s.containerName)).toEqual(['a', 'b', 'd', 'c', 'e'])
    expect(sortContainers(list, 'cpu').map((s) => s.containerName)).toEqual(['b', 'd', 'c', 'a', 'e'])
  })

  it('filters critical-only and by search query', () => {
    expect(filterContainers(list, { tab: 'critical' }).map((s) => s.containerName)).toEqual(['c', 'd'])
    expect(filterContainers(list, { query: ' A ' }).map((s) => s.containerName)).toEqual(['a'])
    expect(filterContainers(list)).toHaveLength(5)
  })

  it('summarises counts and the soonest breach', () => {
    const summary = dashboardSummary(
      [...list, make('f', 1, 1, { predictedBreachMinutes: 5, reporting: true })],
      [{ resolved: false }, { resolved: true }],
    )
    expect(summary).toEqual({
      total: 6,
      reporting: 1,
      atRisk: 2,
      pendingAlerts: 1,
      soonest: { containerName: 'f', minutes: 5 },
    })
    expect(dashboardSummary([]).soonest).toBeNull()
  })
})

describe('systemStatus', () => {
  it('reflects health and reporting counts', () => {
    expect(systemStatus({ healthOk: null }).text).toMatch(/Checking/)
    expect(systemStatus({ healthOk: false }).tone).toBe('critical')
    expect(systemStatus({ healthOk: true, reporting: 0, total: 0 }).text).toMatch(/no containers/)
    expect(systemStatus({ healthOk: true, reporting: 3, total: 3 }).text).toBe('All system nodes operational')
    expect(systemStatus({ healthOk: true, reporting: 2, total: 3 })).toEqual({ tone: 'warning', text: '2 of 3 containers reporting' })
  })
})

describe('containerTone', () => {
  it('maps state to a dot tone', () => {
    const base = { latest: {}, hasAlert: false, predictedBreachMinutes: null, reporting: true }
    expect(containerTone({ ...base, latest: null })).toBe('muted')
    expect(containerTone({ ...base, hasAlert: true })).toBe('critical')
    expect(containerTone({ ...base, predictedBreachMinutes: 3 })).toBe('warning')
    expect(containerTone(base)).toBe('healthy')
    expect(containerTone({ ...base, reporting: false })).toBe('muted')
  })
})

describe('filterHistoryByRange / historyCoverage', () => {
  const rows = [row(120, 1), row(50, 2), row(10, 3), row(0, 4)]

  it('keeps rows inside the range', () => {
    expect(filterHistoryByRange(rows, 60, NOW).map((r) => r.memPercent)).toEqual([2, 3, 4])
    expect(filterHistoryByRange(rows, 5, NOW)).toHaveLength(1)
    expect(filterHistoryByRange(undefined, 5, NOW)).toEqual([])
  })

  it('reports how much time the rows cover', () => {
    expect(historyCoverage(rows)).toEqual({ count: 4, spanMinutes: 120, from: rows[0].timestamp })
    expect(historyCoverage([])).toEqual({ count: 0, spanMinutes: 0, from: null })
  })
})
