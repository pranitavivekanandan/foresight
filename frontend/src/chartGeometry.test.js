import { describe, it, expect } from 'vitest'
import { linearScale, sparkDomain, sparklinePath, percentBars, downsample, buildMetricChart } from './chartGeometry'

describe('linearScale', () => {
  it('maps domain to range and handles a zero-width domain', () => {
    expect(linearScale([0, 10], [0, 100])(5)).toBe(50)
    expect(linearScale([0, 10], [100, 0])(10)).toBe(0)
    expect(linearScale([5, 5], [0, 100])(5)).toBe(50)
  })
})

describe('sparkDomain', () => {
  it('widens a near-flat series to the minimum span', () => {
    expect(sparkDomain([50, 50.2])).toEqual([49.1, 51.1])
    expect(sparkDomain([10, 40])).toEqual([10, 40])
    expect(sparkDomain([])).toEqual([0, 1])
  })
})

describe('sparklinePath', () => {
  it('needs two finite values', () => {
    expect(sparklinePath([1])).toBe('')
    expect(sparklinePath([1, 'x'])).toBe('')
  })

  it('draws from left pad to right pad with high values near the top', () => {
    const path = sparklinePath([0, 100], { width: 100, height: 20, pad: 0 })
    expect(path).toBe('M0.0,20.0 L100.0,0.0')
  })
})

describe('percentBars', () => {
  it('keeps the last N values on a 0-100 scale', () => {
    const bars = percentBars([10, 50, 100, 150], { width: 30, height: 10, gap: 0, count: 3 })
    expect(bars).toHaveLength(3)
    expect(bars.map((b) => b.height)).toEqual([5, 10, 10])
    expect(bars[0].width).toBe(10)
    expect(bars[2].x).toBe(20)
    expect(percentBars([])).toEqual([])
  })
})

describe('downsample', () => {
  it('keeps first and last and caps the length', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => i)
    const out = downsample(rows, 10)
    expect(out).toHaveLength(10)
    expect(out[0]).toBe(0)
    expect(out[9]).toBe(999)
    expect(downsample([1, 2], 10)).toEqual([1, 2])
    expect(downsample(undefined)).toEqual([])
  })
})

describe('buildMetricChart', () => {
  const history = [
    { timestamp: 0, value: 60 },
    { timestamp: 60000, value: 70 },
  ]

  it('returns null without data', () => {
    expect(buildMetricChart({ history: [], threshold: 90 })).toBeNull()
  })

  it('places the live point at the last reading and includes the threshold', () => {
    const chart = buildMetricChart({
      history,
      forecast: [
        { timestamp: 60000, value: 70, lower: 68, upper: 72 },
        { timestamp: 180000, value: 90, lower: 85, upper: 95 },
      ],
      threshold: 90,
      width: 400,
      height: 200,
      pad: { top: 0, right: 0, bottom: 0, left: 0 },
    })
    expect(chart.historical.startsWith('M0.0,')).toBe(true)
    expect(chart.forecastLine).toMatch(/^M/)
    expect(chart.band.endsWith('Z')).toBe(true)
    expect(chart.live.value).toBe(70)
    expect(chart.live.x).toBeCloseTo(400 / 3)
    expect(chart.thresholdY).not.toBeNull()
    expect(chart.yTicks[0].value).toBe(50)
    expect(chart.xTicks).toHaveLength(5)
  })

  it('omits forecast paths when there is no forecast', () => {
    const chart = buildMetricChart({ history, threshold: 90 })
    expect(chart.forecastLine).toBe('')
    expect(chart.band).toBe('')
  })
})
