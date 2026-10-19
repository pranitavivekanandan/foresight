import { describe, it, expect } from 'vitest'
import { severityFromMinutes, severityLabel, severityRank } from './severity'

describe('severityFromMinutes', () => {
  it.each([
    [0, 'critical'],
    [15, 'critical'],
    [15.5, 'high'],
    [60, 'high'],
    [61, 'warning'],
    [5000, 'warning'],
  ])('%s minutes -> %s', (minutes, expected) => {
    expect(severityFromMinutes(minutes)).toBe(expected)
  })

  it('treats a missing value as warning rather than inventing urgency', () => {
    expect(severityFromMinutes(undefined)).toBe('warning')
    expect(severityFromMinutes('abc')).toBe('warning')
  })
})

describe('severityLabel / severityRank', () => {
  it('capitalises and ranks', () => {
    expect(severityLabel('high')).toBe('High')
    expect(severityLabel('')).toBe('')
    expect(severityRank('critical')).toBeLessThan(severityRank('warning'))
    expect(severityRank('unknown')).toBe(3)
  })
})
