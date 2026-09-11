export function predictBreach(data, field = 'memPercent', threshold = 90) {
  const validPoints = data
    .map((entry) => ({
      timestamp: new Date(entry.timestamp).getTime(),
      value: Number(entry[field]),
    }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value))

  if (validPoints.length < 2) {
    return { hasEnoughData: false }
  }

  const firstTimestamp = validPoints[0].timestamp
  const points = validPoints.map((point) => ({
    x: (point.timestamp - firstTimestamp) / 60000,
    y: point.value,
  }))
  const xMean = points.reduce((sum, point) => sum + point.x, 0) / points.length
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length
  const numerator = points.reduce(
    (sum, point) => sum + (point.x - xMean) * (point.y - yMean),
    0,
  )
  const denominator = points.reduce(
    (sum, point) => sum + (point.x - xMean) ** 2,
    0,
  )
  if (denominator === 0) {
    return {
      hasEnoughData: true,
      willBreach: false,
      currentValue: points[points.length - 1].y,
      slope: 0,
    }
  }
  const slope = numerator / denominator
  const intercept = yMean - slope * xMean
  const currentValue = points[points.length - 1].y

  if (slope <= 0) {
    return { hasEnoughData: true, willBreach: false, currentValue, slope }
  }

  const lastX = points[points.length - 1].x
  const minutesToBreach = (threshold - (slope * lastX + intercept)) / slope
  const isAlreadyBreached = currentValue >= threshold

  return {
    hasEnoughData: true,
    willBreach: minutesToBreach > 0 || isAlreadyBreached,
    currentValue,
    slope,
    minutesToBreach: Math.max(0, Math.round(minutesToBreach)),
  }
}