import { describe, it, expect } from 'vitest'
import { predictBreach } from './predict'

// Builds history rows `minutesOffset` apart, starting at `baseTime`.
function series(pointsWithMinuteOffsets, baseTime = Date.parse('2026-01-01T00:00:00Z'), field = 'memPercent') {
  return pointsWithMinuteOffsets.map(([minutesOffset, value]) => ({
    timestamp: new Date(baseTime + minutesOffset * 60000).toISOString(),
    [field]: value,
  }))
}

describe('predictBreach', () => {
  it('computes the exact slope and minutesToBreach for a known linear series', () => {
    // 1-minute spacing, memPercent rising by exactly 10/min: 50, 60, 70.
    const data = series([[0, 50], [1, 60], [2, 70]])
    const result = predictBreach(data, 'memPercent', 90)

    expect(result.hasEnoughData).toBe(true)
    expect(result.slope).toBeCloseTo(10, 10)
    expect(result.currentValue).toBe(70)
    expect(result.willBreach).toBe(true)
    expect(result.minutesToBreach).toBe(2)
  })

  it('reports no breach for a flat series', () => {
    const data = series([[0, 50], [1, 50], [2, 50]])
    const result = predictBreach(data, 'memPercent', 90)

    expect(result.hasEnoughData).toBe(true)
    expect(result.willBreach).toBe(false)
    expect(result.slope).toBe(0)
  })

  it('reports no breach for a decreasing series', () => {
    const data = series([[0, 70], [1, 60], [2, 50]])
    const result = predictBreach(data, 'memPercent', 90)

    expect(result.hasEnoughData).toBe(true)
    expect(result.willBreach).toBe(false)
    expect(result.slope).toBe(-10)
    expect(result.currentValue).toBe(50)
  })

  it('reports insufficient data for fewer than 2 points', () => {
    expect(predictBreach([], 'memPercent', 90)).toEqual({ hasEnoughData: false })
    expect(predictBreach(series([[0, 50]]), 'memPercent', 90)).toEqual({ hasEnoughData: false })
  })

  it('filters out points with invalid timestamps or NaN values', () => {
    const data = [
      { timestamp: 'not-a-date', memPercent: 50 },
      { timestamp: new Date().toISOString(), memPercent: 'not-a-number' },
    ]
    expect(predictBreach(data, 'memPercent', 90)).toEqual({ hasEnoughData: false })
  })

  it('flags an already-breached current value with willBreach true and minutesToBreach 0', () => {
    // Current value already past the threshold even though the regression's
    // raw projection for "90" lies in the past (negative minutesToBreach).
    const data = series([[0, 95], [1, 96], [2, 97]])
    const result = predictBreach(data, 'memPercent', 90)

    expect(result.willBreach).toBe(true)
    expect(result.currentValue).toBe(97)
    expect(result.minutesToBreach).toBe(0)
  })

  it('treats identical timestamps as zero slope with no breach', () => {
    const sameTime = new Date().toISOString()
    const data = [
      { timestamp: sameTime, memPercent: 50 },
      { timestamp: sameTime, memPercent: 95 },
    ]
    const result = predictBreach(data, 'memPercent', 90)

    expect(result.hasEnoughData).toBe(true)
    expect(result.willBreach).toBe(false)
    expect(result.slope).toBe(0)
  })

  it('supports a custom field and threshold', () => {
    const data = series([[0, 40], [1, 50], [2, 60]], undefined, 'cpuPercent')
    const result = predictBreach(data, 'cpuPercent', 55)

    expect(result.hasEnoughData).toBe(true)
    expect(result.willBreach).toBe(true)
    expect(result.currentValue).toBe(60)
  })
})
