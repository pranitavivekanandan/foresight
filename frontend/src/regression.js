// Least-squares line fit used by the metric detail and alert detail screens.
// predict.js keeps its own copy of the slope math untouched (its return shape
// is mirrored by the backend's alertEvaluator and covered by regression
// tests); this module adds the extra numbers the UI needs on top of it:
// intercept, R squared, and the residual spread used for the forecast band.

// Same point extraction as predict.js: x is minutes since the first valid
// reading, y is the metric value. Invalid rows are dropped.
export function toPoints(data, field = 'memPercent') {
  const valid = (Array.isArray(data) ? data : [])
    .map((entry) => ({
      timestamp: new Date(entry.timestamp).getTime(),
      value: Number(entry[field]),
    }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value))

  if (valid.length === 0) return []
  const first = valid[0].timestamp
  return valid.map((point) => ({
    timestamp: point.timestamp,
    x: (point.timestamp - first) / 60000,
    y: point.value,
  }))
}

export function linearFit(data, field = 'memPercent') {
  const points = toPoints(data, field)
  if (points.length < 2) return { hasEnoughData: false }

  const n = points.length
  const xMean = points.reduce((sum, p) => sum + p.x, 0) / n
  const yMean = points.reduce((sum, p) => sum + p.y, 0) / n
  const sxx = points.reduce((sum, p) => sum + (p.x - xMean) ** 2, 0)
  const sxy = points.reduce((sum, p) => sum + (p.x - xMean) * (p.y - yMean), 0)
  const slope = sxx === 0 ? 0 : sxy / sxx
  const intercept = yMean - slope * xMean

  const ssTot = points.reduce((sum, p) => sum + (p.y - yMean) ** 2, 0)
  const ssRes = points.reduce((sum, p) => sum + (p.y - (slope * p.x + intercept)) ** 2, 0)
  // A perfectly flat series has no variance to explain, so R squared is
  // undefined rather than 0 or 1 — callers show "n/a".
  const rSquared = ssTot === 0 ? null : Math.max(0, 1 - ssRes / ssTot)
  const residualStd = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0

  const last = points[n - 1]
  return {
    hasEnoughData: true,
    n,
    slope,
    intercept,
    rSquared,
    residualStd,
    xMean,
    sxx,
    firstTimestamp: points[0].timestamp,
    lastTimestamp: last.timestamp,
    lastX: last.x,
    currentValue: last.y,
    spanMinutes: last.x,
  }
}

export function rSquared(data, field = 'memPercent') {
  const fit = linearFit(data, field)
  return fit.hasEnoughData ? fit.rSquared : null
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, value))
}

// Value of the fitted line `minutesAhead` after the last reading, capped to
// the 0-100 percent range.
export function forecastAt(fit, minutesAhead) {
  if (!fit?.hasEnoughData) return null
  return clampPercent(fit.slope * (fit.lastX + minutesAhead) + fit.intercept)
}

// Half-width of an approximate 95% prediction interval at `minutesAhead`.
// Uses z = 1.96 rather than a t quantile, so it is an approximation; the UI
// labels the band accordingly.
export function predictionHalfWidth(fit, minutesAhead) {
  if (!fit?.hasEnoughData || fit.n < 3) return 0
  const x = fit.lastX + minutesAhead
  const leverage = fit.sxx === 0 ? 0 : (x - fit.xMean) ** 2 / fit.sxx
  return 1.96 * fit.residualStd * Math.sqrt(1 + 1 / fit.n + leverage)
}

// Minutes after the last reading at which the fitted line reaches `threshold`.
// null when the line is flat/falling or already past the threshold.
export function minutesUntil(fit, threshold) {
  if (!fit?.hasEnoughData || fit.slope <= 0) return null
  const minutes = (threshold - (fit.slope * fit.lastX + fit.intercept)) / fit.slope
  return minutes > 0 ? minutes : null
}

// How far the dashed forecast line should extend. It runs to the threshold
// when that is reasonably close, otherwise it stops at a horizon proportional
// to the history shown so the historical part of the chart stays readable.
export function projectionHorizon(fit, threshold, { minHorizon = 30, spanMultiplier = 1 } = {}) {
  if (!fit?.hasEnoughData) return { minutes: 0, reachesThreshold: false }
  const cap = Math.max(minHorizon, fit.spanMinutes * spanMultiplier)
  const toThreshold = minutesUntil(fit, threshold)
  if (toThreshold != null && toThreshold <= cap) {
    return { minutes: toThreshold, reachesThreshold: true }
  }
  return { minutes: cap, reachesThreshold: false, minutesToThreshold: toThreshold }
}

// Points for the dashed forecast line plus the band around it, from the last
// reading out to `horizonMinutes`.
export function forecastSeries(fit, horizonMinutes, steps = 12) {
  if (!fit?.hasEnoughData || horizonMinutes <= 0) return []
  const series = []
  for (let i = 0; i <= steps; i++) {
    const ahead = (horizonMinutes * i) / steps
    const raw = fit.slope * (fit.lastX + ahead) + fit.intercept
    const half = predictionHalfWidth(fit, ahead)
    series.push({
      timestamp: fit.lastTimestamp + ahead * 60000,
      value: clampPercent(raw),
      lower: clampPercent(raw - half),
      upper: clampPercent(raw + half),
    })
  }
  return series
}
