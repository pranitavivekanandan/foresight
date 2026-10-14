// SVG geometry for sparklines, bar charts and the metric detail chart.
// Returns plain strings/numbers; components only place them in <svg>.

export function linearScale([d0, d1], [r0, r1]) {
  const span = d1 - d0
  return (value) => (span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0))
}

function finiteValues(values) {
  return values.map(Number).filter(Number.isFinite)
}

// Domain for a sparkline: data min/max, widened to at least `minSpan` so
// tiny noise on a flat series is not stretched into dramatic waves.
export function sparkDomain(values, minSpan = 2) {
  const finite = finiteValues(values)
  if (finite.length === 0) return [0, 1]
  let lo = Math.min(...finite)
  let hi = Math.max(...finite)
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2
    lo = mid - minSpan / 2
    hi = mid + minSpan / 2
  }
  return [lo, hi]
}

export function sparklinePath(values, { width = 120, height = 32, pad = 2, minSpan = 2 } = {}) {
  const finite = finiteValues(values)
  if (finite.length < 2) return ''
  const x = linearScale([0, finite.length - 1], [pad, width - pad])
  const y = linearScale(sparkDomain(finite, minSpan), [height - pad, pad])
  return finite
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ')
}

// Bars on a fixed 0-100 percent scale so heights are comparable across cards.
export function percentBars(values, { width = 160, height = 48, gap = 4, count = 8 } = {}) {
  const finite = finiteValues(values).slice(-count)
  if (finite.length === 0) return []
  const barWidth = (width - gap * (finite.length - 1)) / finite.length
  return finite.map((v, i) => {
    const clamped = Math.min(100, Math.max(0, v))
    const h = Math.max(1, (clamped / 100) * height)
    return { x: i * (barWidth + gap), y: height - h, width: barWidth, height: h, value: v }
  })
}

// Downsample to at most `max` points by taking evenly spaced rows (keeps the
// first and last). Rendering 1000 points in a small SVG adds nothing.
export function downsample(rows, max = 200) {
  if (!Array.isArray(rows) || rows.length <= max) return rows || []
  const step = (rows.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => rows[Math.round(i * step)])
}

function pathFrom(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
}

// Layout for the large metric chart. `history` is [{timestamp, value}],
// `forecast` is [{timestamp, value, lower, upper}] starting at the last reading.
export function buildMetricChart({ history, forecast = [], threshold, width = 800, height = 280, pad = { top: 16, right: 16, bottom: 28, left: 40 } }) {
  const points = (history || []).filter((p) => Number.isFinite(p.value) && Number.isFinite(p.timestamp))
  if (points.length === 0) return null

  const times = [...points.map((p) => p.timestamp), ...forecast.map((p) => p.timestamp)]
  const t0 = Math.min(...times)
  const t1 = Math.max(...times)
  const values = [
    ...points.map((p) => p.value),
    ...forecast.flatMap((p) => [p.lower, p.upper]),
    threshold,
  ].filter(Number.isFinite)
  const yMin = Math.max(0, Math.floor((Math.min(...values) - 5) / 10) * 10)
  const yMax = Math.min(100, Math.ceil((Math.max(...values) + 5) / 10) * 10)

  const x = linearScale([t0, t1 === t0 ? t0 + 60000 : t1], [pad.left, width - pad.right])
  const y = linearScale([yMin, yMax === yMin ? yMin + 1 : yMax], [height - pad.bottom, pad.top])

  const historical = pathFrom(points.map((p) => [x(p.timestamp), y(p.value)]))
  const forecastLine = forecast.length > 1 ? pathFrom(forecast.map((p) => [x(p.timestamp), y(p.value)])) : ''
  const band =
    forecast.length > 1
      ? `${pathFrom([
          ...forecast.map((p) => [x(p.timestamp), y(p.upper)]),
          ...[...forecast].reverse().map((p) => [x(p.timestamp), y(p.lower)]),
        ])} Z`
      : ''
  const last = points[points.length - 1]

  const yTicks = []
  const step = yMax - yMin > 40 ? 20 : 10
  for (let v = yMin; v <= yMax; v += step) yTicks.push({ value: v, y: y(v) })

  const xTicks = Array.from({ length: 5 }, (_, i) => {
    const t = t0 + ((t1 - t0) * i) / 4
    return { timestamp: t, x: x(t) }
  })

  return {
    width,
    height,
    pad,
    historical,
    forecastLine,
    band,
    live: { x: x(last.timestamp), y: y(last.value), value: last.value },
    thresholdY: Number.isFinite(threshold) && threshold >= yMin && threshold <= yMax ? y(threshold) : null,
    yTicks,
    xTicks,
  }
}
