import { describe, it, expect } from 'vitest'
import { analyzeTrend } from './trend'

// Two points `minutesApart` apart produce an exact two-point slope
// (dy / dx), matching the least-squares result for n=2.
function twoPoints(firstValue, secondValue, minutesApart = 1, field = 'memPercent') {
  const base = Date.parse('2026-01-01T00:00:00Z')
  return [
    { timestamp: new Date(base).toISOString(), [field]: firstValue },
    { timestamp: new Date(base + minutesApart * 60000).toISOString(), [field]: secondValue },
  ]
}

describe('analyzeTrend', () => {
  it('reports insufficient data for fewer than 2 points', () => {
    expect(analyzeTrend([])).toEqual({ hasEnoughData: false })
    expect(analyzeTrend([{ timestamp: new Date().toISOString(), memPercent: 10 }])).toEqual({
      hasEnoughData: false,
    })
  })

  it('is stable exactly at the +0.05 slope boundary (not increasing)', () => {
    const result = analyzeTrend(twoPoints(50, 50.05))
    expect(result.direction).toBe('stable')
  })

  it('is stable exactly at the -0.05 slope boundary (not decreasing)', () => {
    const result = analyzeTrend(twoPoints(50, 49.95))
    expect(result.direction).toBe('stable')
  })

  it('is increasing once slope clears +0.05', () => {
    const result = analyzeTrend(twoPoints(50, 50.1))
    expect(result.direction).toBe('increasing')
    expect(result.slope).toBeGreaterThan(0.05)
  })

  it('is decreasing once slope clears -0.05', () => {
    const result = analyzeTrend(twoPoints(50, 49.9))
    expect(result.direction).toBe('decreasing')
    expect(result.slope).toBeLessThan(-0.05)
  })

  it('returns the last value as currentValue', () => {
    const result = analyzeTrend(twoPoints(50, 60))
    expect(result.currentValue).toBe(60)
  })
})
