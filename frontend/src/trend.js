export function analyzeTrend(data, field = 'memPercent') {
  const points = data
    .map((entry) => ({
      timestamp: new Date(entry.timestamp).getTime(),
      value: Number(entry[field]),
    }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value))

  if (points.length < 2) {
    return { hasEnoughData: false }
  }

  const firstTimestamp = points[0].timestamp
  const elapsedMinutes = points.map((point) => (point.timestamp - firstTimestamp) / 60000)
  const xMean = elapsedMinutes.reduce((sum, value) => sum + value, 0) / elapsedMinutes.length
  const yMean = points.reduce((sum, point) => sum + point.value, 0) / points.length
  const numerator = points.reduce(
    (sum, point, index) => sum + (elapsedMinutes[index] - xMean) * (point.value - yMean),
    0,
  )
  const denominator = elapsedMinutes.reduce(
    (sum, value) => sum + (value - xMean) ** 2,
    0,
  )
  const slope = denominator === 0 ? 0 : numerator / denominator
  const direction = slope > 0.05 ? 'increasing' : slope < -0.05 ? 'decreasing' : 'stable'

  return {
    hasEnoughData: true,
    currentValue: points[points.length - 1].value,
    direction,
    slope,
  }
}