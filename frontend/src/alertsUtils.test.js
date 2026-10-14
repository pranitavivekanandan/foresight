import { describe, it, expect } from 'vitest'
import {
  groupAlerts,
  filterAlertsByStatus,
  metricLabel,
  parseThresholdFromExplanation,
  alertThreshold,
  alertTitle,
  alertCode,
  alertStatus,
  alertSeverity,
  filterAlerts,
  paginate,
  alertsToCsv,
  latestAlertFor,
  correlatedContainers,
  sortAlertGroups,
  changeOverHistory,
  highlightPercents,
} from './alertsUtils'

const base = {
  metric: 'memPercent',
  currentValue: 85,
  explanation: "api's memPercent has been climbing steadily (currently 85.0%) and is projected to cross 90% in about 12 minutes.",
  resolved: false,
  groupedWith: null,
}
const a1 = { ...base, id: 1, time: '2026-01-01T00:00:00Z', containerId: 'api', containerName: 'api', predictedBreachMinutes: 12 }
const a2 = { ...base, id: 2, time: '2026-01-01T00:01:00Z', containerId: 'worker', containerName: 'worker', predictedBreachMinutes: 40, groupedWith: 1 }
const a3 = { ...base, id: 3, time: '2026-01-01T00:02:00Z', containerId: 'db', containerName: 'db', predictedBreachMinutes: 300, groupedWith: 1, resolved: true }
const a4 = { ...base, id: 4, time: '2026-01-01T00:03:00Z', containerId: 'cache', containerName: 'cache', predictedBreachMinutes: 5 }
const all = [a1, a2, a3, a4]

describe('existing helpers still behave', () => {
  it('groups and filters by status', () => {
    expect(groupAlerts(all).map((g) => [g.root.id, g.children.map((c) => c.id)])).toEqual([
      [1, [2, 3]],
      [4, []],
    ])
    expect(filterAlertsByStatus(all, 'resolved')).toEqual([a3])
  })
})

describe('labels and thresholds', () => {
  it('labels metrics and codes', () => {
    expect(metricLabel('memPercent')).toBe('Memory')
    expect(metricLabel('disk')).toBe('disk')
    expect(alertCode(7)).toBe('ALR-7')
  })

  it('parses the threshold out of both explanation templates', () => {
    expect(parseThresholdFromExplanation(base.explanation)).toBe(90)
    expect(parseThresholdFromExplanation("x has already crossed 95% (currently 97.0%)")).toBe(95)
    expect(parseThresholdFromExplanation('no number here')).toBeNull()
    expect(alertThreshold({ explanation: '' }, 80)).toBe(80)
    expect(alertTitle(a1, 70)).toBe('Memory predicted to breach 90%')
  })
})

describe('status and severity', () => {
  it('derives status from resolved and acknowledgements', () => {
    expect(alertStatus(a1)).toBe('active')
    expect(alertStatus(a1, [1])).toBe('acknowledged')
    expect(alertStatus(a3, [3])).toBe('resolved')
  })

  it('derives severity from breach minutes', () => {
    expect([a1, a2, a3].map(alertSeverity)).toEqual(['critical', 'high', 'warning'])
  })
})

describe('filterAlerts', () => {
  it('filters by status, severity and query', () => {
    expect(filterAlerts(all, { status: 'acknowledged' }, [2]).map((a) => a.id)).toEqual([2])
    expect(filterAlerts(all, { status: 'active' }, [2]).map((a) => a.id)).toEqual([1, 4])
    expect(filterAlerts(all, { severity: 'critical' }).map((a) => a.id)).toEqual([1, 4])
    expect(filterAlerts(all, { query: 'WORK' }).map((a) => a.id)).toEqual([2])
    expect(filterAlerts(all)).toHaveLength(4)
  })
})

describe('paginate', () => {
  const items = [1, 2, 3, 4, 5]
  it('slices and reports the range', () => {
    expect(paginate(items, 2, 2)).toEqual({ items: [3, 4], page: 2, totalPages: 3, total: 5, start: 3, end: 4 })
  })
  it('clamps the page and handles empty lists', () => {
    expect(paginate(items, 9, 2).page).toBe(3)
    expect(paginate(items, 0, 2).page).toBe(1)
    expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, totalPages: 1, total: 0, start: 0, end: 0 })
  })
})

describe('alertsToCsv', () => {
  it('writes a header and escapes quotes, commas and newlines', () => {
    const csv = alertsToCsv([{ ...a1, explanation: 'say "hi", ok\nnext' }], [1])
    const [header, line] = csv.split('\n')
    expect(header.split(',')).toContain('severity')
    expect(line.startsWith('1,2026-01-01T00:00:00Z,api,api,memPercent,85,12,critical,acknowledged,,')).toBe(true)
    expect(csv).toContain('"say ""hi"", ok\nnext"')
  })
})

describe('correlation', () => {
  it('finds the latest alert for a container', () => {
    expect(latestAlertFor([a1, { ...a1, id: 9, time: '2026-02-01T00:00:00Z' }], 'api').id).toBe(9)
    expect(latestAlertFor(all, 'nope')).toBeNull()
  })

  it('lists other containers in the same grouped_with group', () => {
    expect(correlatedContainers(all, 'api').map((c) => c.containerId)).toEqual(['worker', 'db'])
    expect(correlatedContainers(all, 'worker').map((c) => [c.containerId, c.isRoot])).toEqual([
      ['api', true],
      ['db', false],
    ])
    expect(correlatedContainers(all, 'cache')).toEqual([])
    expect(correlatedContainers(all, 'unknown')).toEqual([])
  })
})

describe('sortAlertGroups', () => {
  it('puts unresolved, more severe, newer groups first', () => {
    const groups = [{ root: a3 }, { root: a2 }, { root: a1 }, { root: a4 }]
    expect(sortAlertGroups(groups).map((g) => g.root.id)).toEqual([4, 1, 2, 3])
  })
})

describe('changeOverHistory', () => {
  it('reports first, last and elapsed minutes', () => {
    const data = [
      { timestamp: '2026-01-01T00:00:00Z', memPercent: 60 },
      { timestamp: '2026-01-01T00:08:00Z', memPercent: 85 },
    ]
    expect(changeOverHistory(data)).toEqual({ start: 60, current: 85, minutes: 8 })
    expect(changeOverHistory(data.slice(0, 1))).toBeNull()
  })
})

describe('highlightPercents', () => {
  it('tags the current value and other percentages', () => {
    const segments = highlightPercents('now 85.0% will cross 90% soon', { current: 85 })
    expect(segments).toEqual([
      { text: 'now ', tone: null },
      { text: '85.0%', tone: 'current' },
      { text: ' will cross ', tone: null },
      { text: '90%', tone: 'number' },
      { text: ' soon', tone: null },
    ])
    expect(highlightPercents('')).toEqual([])
  })
})
