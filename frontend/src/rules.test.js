import { describe, it, expect } from 'vitest'
import {
  DEFAULT_RULES,
  emptyDraft,
  validateRuleDraft,
  draftToRule,
  thresholdFor,
  formatThreshold,
  scopeLabel,
  conditionSustained,
  evaluateRuleStatus,
  datapointsPerHour,
  ruleSummary,
} from './rules'

const NOW = Date.parse('2026-01-01T01:00:00Z')
const minsAgo = (m, memPercent, cpuPercent = 10) => ({
  timestamp: new Date(NOW - m * 60000).toISOString(),
  memPercent,
  cpuPercent,
})

describe('DEFAULT_RULES', () => {
  it('match the backend memory default (90) and frontend CPU default (80)', () => {
    expect(DEFAULT_RULES.map((r) => [r.metric, r.value])).toEqual([
      ['memPercent', 90],
      ['cpuPercent', 80],
    ])
  })
})

describe('validateRuleDraft', () => {
  it('requires a value in (0, 100]', () => {
    expect(validateRuleDraft(emptyDraft()).value).toBeDefined()
    expect(validateRuleDraft({ ...emptyDraft(), value: '150' }).value).toBeDefined()
    expect(validateRuleDraft({ ...emptyDraft(), value: '85' })).toEqual({})
  })

  it('rejects bad duration, metric, operator and scope', () => {
    const errors = validateRuleDraft({ metric: 'disk', operator: 'eq', value: '50', durationMin: 1.5, scope: '' })
    expect(Object.keys(errors).sort()).toEqual(['durationMin', 'metric', 'operator', 'scope'])
  })
})

describe('draftToRule', () => {
  it('coerces numbers and keeps the id', () => {
    expect(draftToRule({ ...emptyDraft(), value: '85', durationMin: '5', predictive: 1 }, 'r1')).toEqual({
      id: 'r1',
      metric: 'memPercent',
      scope: 'all',
      operator: 'gt',
      value: 85,
      durationMin: 5,
      predictive: true,
      escalation: 'Dashboard alert',
    })
  })
})

describe('thresholdFor', () => {
  it('falls back to the defaults when no rule applies', () => {
    expect(thresholdFor([], 'memPercent', 'a')).toBe(90)
    expect(thresholdFor(undefined, 'cpuPercent', 'a')).toBe(80)
  })

  it('uses the lowest applicable greater-than rule', () => {
    const rules = [
      ...DEFAULT_RULES,
      { metric: 'memPercent', scope: 'a', operator: 'gt', value: 75 },
      { metric: 'memPercent', scope: 'b', operator: 'gt', value: 50 },
      { metric: 'memPercent', scope: 'all', operator: 'lt', value: 10 },
    ]
    expect(thresholdFor(rules, 'memPercent', 'a')).toBe(75)
    expect(thresholdFor(rules, 'memPercent', 'c')).toBe(90)
  })
})

describe('formatThreshold / scopeLabel', () => {
  it('formats with and without duration', () => {
    expect(formatThreshold({ operator: 'gt', value: 85, durationMin: 5 })).toBe('> 85% for 5m')
    expect(formatThreshold({ operator: 'lt', value: 10, durationMin: 0 })).toBe('< 10% (any reading)')
  })

  it('names scopes from discovered containers', () => {
    expect(scopeLabel('all')).toBe('All containers')
    expect(scopeLabel('abc', [{ containerId: 'abc', containerName: 'api' }])).toBe('api')
    expect(scopeLabel('0123456789abcdef')).toBe('0123456789ab…')
  })
})

describe('conditionSustained', () => {
  const rule = { metric: 'memPercent', operator: 'gt', value: 80, durationMin: 5 }

  it('is true only when every reading in the window is above the value', () => {
    const data = [minsAgo(10, 70), minsAgo(6, 85), minsAgo(3, 86), minsAgo(0, 88)]
    expect(conditionSustained(data, rule, NOW)).toBe(true)
    const dipped = [minsAgo(10, 70), minsAgo(6, 85), minsAgo(3, 79), minsAgo(0, 88)]
    expect(conditionSustained(dipped, rule, NOW)).toBe(false)
  })

  it('is false when history does not cover the whole duration', () => {
    expect(conditionSustained([minsAgo(2, 95), minsAgo(0, 95)], rule, NOW)).toBe(false)
  })

  it('checks only the latest reading when duration is 0', () => {
    expect(conditionSustained([minsAgo(1, 10), minsAgo(0, 81)], { ...rule, durationMin: 0 }, NOW)).toBe(true)
    expect(conditionSustained([], rule, NOW)).toBe(false)
  })

  it('supports less-than rules', () => {
    expect(conditionSustained([minsAgo(0, 5)], { ...rule, operator: 'lt', value: 10, durationMin: 0 }, NOW)).toBe(true)
  })
})

describe('evaluateRuleStatus', () => {
  const rule = { metric: 'memPercent', scope: 'all', operator: 'gt', value: 90, durationMin: 0, predictive: true }

  it('reports no-data when no container in scope has history', () => {
    expect(evaluateRuleStatus(rule, {}, NOW)).toBe('no-data')
    expect(evaluateRuleStatus({ ...rule, scope: 'x' }, { y: [minsAgo(0, 50)] }, NOW)).toBe('no-data')
  })

  it('reports triggered when the threshold is crossed', () => {
    expect(evaluateRuleStatus(rule, { a: [minsAgo(1, 80), minsAgo(0, 95)] }, NOW)).toBe('triggered')
  })

  it('reports predicted for a rising trend only when predictive is on', () => {
    const rising = { a: [minsAgo(3, 60), minsAgo(2, 65), minsAgo(1, 70), minsAgo(0, 75)] }
    expect(evaluateRuleStatus(rule, rising, NOW)).toBe('predicted')
    expect(evaluateRuleStatus({ ...rule, predictive: false }, rising, NOW)).toBe('monitoring')
  })

  it('reports monitoring for a flat series', () => {
    expect(evaluateRuleStatus(rule, { a: [minsAgo(1, 50), minsAgo(0, 50)] }, NOW)).toBe('monitoring')
  })
})

describe('datapointsPerHour / ruleSummary', () => {
  it('computes readings per hour from the sample interval', () => {
    expect(datapointsPerHour(3, 10_000)).toBe(1080)
    expect(datapointsPerHour(0, 10_000)).toBe(0)
  })

  it('describes the draft in plain words', () => {
    expect(ruleSummary({ metric: 'cpuPercent', operator: 'gt', value: '85', durationMin: 5 }, 'All containers')).toBe(
      'This rule checks CPU on All containers and fires when it is greater than 85% sustained for 5 min.',
    )
    expect(ruleSummary({ metric: 'memPercent', operator: 'lt', value: '', durationMin: 0 }, 'api')).toBe(
      'This rule checks Memory on api and fires when it is less than —%.',
    )
  })
})
