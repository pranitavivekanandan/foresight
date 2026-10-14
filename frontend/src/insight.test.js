import { describe, it, expect } from 'vitest'
import { fitStrength, trendInsight } from './insight'

const fit = (overrides) => ({ hasEnoughData: true, slope: 0, intercept: 50, lastX: 10, currentValue: 50, rSquared: null, ...overrides })

describe('fitStrength', () => {
  it('buckets R squared', () => {
    expect(fitStrength(null)).toBeNull()
    expect(fitStrength(0.9)).toBe('strong')
    expect(fitStrength(0.5)).toBe('moderate')
    expect(fitStrength(0.1)).toBe('weak')
  })
})

describe('trendInsight', () => {
  it('handles missing data', () => {
    expect(trendInsight({ metricName: 'Memory', fit: { hasEnoughData: false }, threshold: 90 })).toMatch(/Not enough readings/)
  })

  it('describes a stable series', () => {
    expect(trendInsight({ metricName: 'Memory', fit: fit({ slope: 0.001 }), threshold: 90 })).toBe(
      'Memory is stable at 50.0% (+0.06% per hour); no breach of 90% is projected.',
    )
  })

  it('projects time to threshold for a rising series and reports fit strength', () => {
    // slope 1%/min from 60 at x=10 -> 70 now, 20 min to 90
    const text = trendInsight({ metricName: 'Memory', fit: fit({ slope: 1, intercept: 60, currentValue: 70, rSquared: 0.95 }), threshold: 90 })
    expect(text).toBe(
      'Memory is rising at +60.00% per hour (now 70.0%); at this rate it would cross 90% in about 20 min. The straight-line fit explains 95% of the variation (R squared), so treat this projection as strong.',
    )
  })

  it('notes when the threshold is already exceeded', () => {
    expect(trendInsight({ metricName: 'CPU', fit: fit({ slope: 0.1, intercept: 90, currentValue: 92 }), threshold: 80 })).toMatch(/already above the 80% threshold/)
  })

  it('handles a rising line whose fitted value is past the threshold while the reading is not', () => {
    expect(trendInsight({ metricName: 'CPU', fit: fit({ slope: 0.1, intercept: 90, currentValue: 70 }), threshold: 80 })).toBe(
      'CPU is rising at +6.00% per hour (now 70.0%).',
    )
  })

  it('describes a falling series', () => {
    expect(trendInsight({ metricName: 'Memory', fit: fit({ slope: -0.1 }), threshold: 90 })).toMatch(/falling at -6.00% per hour/)
  })
})
