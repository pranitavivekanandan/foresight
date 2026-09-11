function getPoints(data, field, width, height, padding, min, max) {
  const range = max - min || 1

  return data
    .map((entry, index) => {
      const value = Number(entry[field])
      if (!Number.isFinite(value)) return null

      const x = padding + (index / Math.max(data.length - 1, 1)) * (width - padding * 2)
      const y = height - padding - ((value - min) / range) * (height - padding * 2)
      return `${x},${y}`
    })
    .filter(Boolean)
    .join(' ')
}

export default function TrendChart({ data }) {
  const width = 360
  const height = 132
  const padding = 18
  const values = data.flatMap((entry) => [entry.cpuPercent, entry.memPercent])
    .map(Number)
    .filter(Number.isFinite)
  const min = Math.min(0, ...values)
  const max = Math.max(100, ...values)
  const cpuPoints = getPoints(data, 'cpuPercent', width, height, padding, min, max)
  const memoryPoints = getPoints(data, 'memPercent', width, height, padding, min, max)
  const firstTime = data[0]?.timestamp
  const lastTime = data[data.length - 1]?.timestamp

  return (
    <div className="trend-chart" aria-label="CPU and memory usage trend">
      <div className="trend-legend">
        <span><i className="legend-dot cpu-dot"></i>CPU</span>
        <span><i className="legend-dot memory-dot"></i>Memory</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <line x1="18" y1="18" x2="18" y2="114" className="chart-axis" />
        <line x1="18" y1="114" x2="342" y2="114" className="chart-axis" />
        <polyline points={cpuPoints} className="chart-line cpu-line" />
        <polyline points={memoryPoints} className="chart-line memory-line" />
      </svg>
      <div className="trend-times">
        <span>{firstTime ? new Date(firstTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        <span>{lastTime ? new Date(lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
      </div>
    </div>
  )
}