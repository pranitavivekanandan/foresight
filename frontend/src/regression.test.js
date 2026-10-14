import { describe, it, expect } from 'vitest'
import {
  toPoints,
  linearFit,
  rSquared,
  forecastAt,
  predictionHalfWidth,
  minutesUntil,
  projectionHorizon,
  forecastSeries,
} from './regression'
import { predictBreach } from './predict'

const T0 = Date.parse('2026-01-01T00:00:00Z')
const at = (minute, memPercent) => ({ timestamp: new Date(T0 + minute * 60000).toISOString(), memPercent })

// y = 60 + 1x for x = 0..10
const linear = Array.from({ length: 11 }, (_, i) => at(i, 60 + i))

describe('toPoints', () => {
  // Like predict.js, null coerces to 0 and counts as a reading; undefined and
  // non-numeric strings are dropped.
  it('drops invalid rows and measures x in minutes from the first valid one', () => {
    const points = toPoints([{ timestamp: 'bad', memPercent: 1 }, at(2, 50), at(5, undefined), at(4, 'x'), at(6, 55)])
    expect(points.map((p) => [p.x, p.y])).toEqual([[0, 50], [4, 55]])
  })

  it('returns [] for non-array input', () => {
    expect(toPoints(undefined)).toEqual([])
  })
})

describe('linearFit', () => {
  it('needs at least two points', () => {
    expect(linearFit([at(0, 50)])).toEqual({ hasEnoughData: false })
  })

  it('recovers slope and intercept of a perfect line with R squared 1', () => {
    const fit = linearFit(linear)
    expect(fit.slope).toBeCloseTo(1)
    expect(fit.intercept).toBeCloseTo(60)
    expect(fit.rSquared).toBeCloseTo(1)
    expect(fit.residualStd).toBeCloseTo(0)
    expect(fit.currentValue).toBe(70)
    expect(fit.spanMinutes).toBe(10)
  })

  it('agrees with predict.js on the slope', () => {
    const noisy = [at(0, 60), at(1, 63), at(2, 61), at(3, 66), at(4, 65), at(5, 69)]
    expect(linearFit(noisy).slope).toBeCloseTo(predictBreach(noisy).slope)
  })

  it('returns null R squared for a perfectly flat series', () => {
    const flat = [at(0, 50), at(1, 50), at(2, 50)]
    const fit = linearFit(flat)
    expect(fit.slope).toBe(0)
    expect(fit.rSquared).toBeNull()
  })

  it('gives a low R squared for pure noise', () => {
    const noise = [at(0, 50), at(1, 60), at(2, 50), at(3, 60), at(4, 50), at(5, 60)]
    expect(rSquared(noise)).toBeLessThan(0.2)
  })

  it('handles identical timestamps (sxx = 0) without dividing by zero', () => {
    const fit = linearFit([at(0, 10), at(0, 20)])
    expect(fit.slope).toBe(0)
    expect(fit.intercept).toBe(15)
  })
})

describe('rSquared', () => {
  it('is null when there is not enough data', () => {
    expect(rSquared([])).toBeNull()
  })
})

describe('forecastAt', () => {
  it('extends the fitted line forward and caps at 100', () => {
    const fit = linearFit(linear)
    expect(forecastAt(fit, 5)).toBeCloseTo(75)
    expect(forecastAt(fit, 240)).toBe(100)
  })

  it('floors at 0 for a falling line', () => {
    const falling = [at(0, 10), at(1, 5)]
    expect(forecastAt(linearFit(falling), 60)).toBe(0)
  })

  it('returns null without a fit', () => {
    expect(forecastAt({ hasEnoughData: false }, 10)).toBeNull()
  })
})

describe('predictionHalfWidth', () => {
  it('is zero for a perfect fit and widens further out for a noisy one', () => {
    expect(predictionHalfWidth(linearFit(linear), 10)).toBeCloseTo(0)
    const noisy = linearFit([at(0, 60), at(1, 63), at(2, 61), at(3, 66), at(4, 65), at(5, 69)])
    expect(predictionHalfWidth(noisy, 30)).toBeGreaterThan(predictionHalfWidth(noisy, 1))
  })

  it('is zero with fewer than three points', () => {
    expect(predictionHalfWidth(linearFit([at(0, 1), at(1, 2)]), 5)).toBe(0)
  })
})

describe('minutesUntil', () => {
  it('returns minutes from the last reading to the threshold', () => {
    expect(minutesUntil(linearFit(linear), 90)).toBeCloseTo(20)
  })

  it('returns null for flat/falling lines or a threshold already passed', () => {
    expect(minutesUntil(linearFit([at(0, 50), at(1, 50)]), 90)).toBeNull()
    expect(minutesUntil(linearFit(linear), 65)).toBeNull()
  })
})

describe('projectionHorizon', () => {
  it('reaches the threshold when it is within the cap', () => {
    // span 10 min, minHorizon 30 -> cap 30; threshold 20 min away
    expect(projectionHorizon(linearFit(linear), 90)).toEqual({ minutes: expect.closeTo(20), reachesThreshold: true })
  })

  it('stops at the cap when the threshold is far away', () => {
    const result = projectionHorizon(linearFit(linear), 99, { minHorizon: 5 })
    expect(result.reachesThreshold).toBe(false)
    expect(result.minutes).toBe(10)
    expect(result.minutesToThreshold).toBeCloseTo(29)
  })

  it('is zero without a fit', () => {
    expect(projectionHorizon({ hasEnoughData: false }, 90)).toEqual({ minutes: 0, reachesThreshold: false })
  })
})

describe('forecastSeries', () => {
  it('starts at the last reading and ends at the horizon', () => {
    const fit = linearFit(linear)
    const series = forecastSeries(fit, 20, 4)
    expect(series).toHaveLength(5)
    expect(series[0].timestamp).toBe(fit.lastTimestamp)
    expect(series[0].value).toBeCloseTo(70)
    expect(series[4].value).toBeCloseTo(90)
    series.forEach((p) => {
      expect(p.lower).toBeLessThanOrEqual(p.value)
      expect(p.upper).toBeGreaterThanOrEqual(p.value)
    })
  })

  it('is empty for a zero horizon', () => {
    expect(forecastSeries(linearFit(linear), 0)).toEqual([])
  })
})
