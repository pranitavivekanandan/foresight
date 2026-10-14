import { buildMetricChart } from '../chartGeometry'
import { formatClock } from '../format'

const WIDTH = 900
const HEIGHT = 300

function tickLabel(timestamp, spanMs) {
  const d = new Date(timestamp)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (spanMs > 36 * 3600_000) return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`
  return `${hh}:${mm}`
}

// Large historical + forecast chart for the metric detail screen. All the
// geometry comes from buildMetricChart; this only draws it.
export default function MetricChart({ history, forecast, threshold, label }) {
  const chart = buildMetricChart({
    history,
    forecast,
    threshold,
    width: WIDTH,
    height: HEIGHT,
    pad: { top: 18, right: 24, bottom: 30, left: 44 },
  })
  if (!chart) return null

  const spanMs = chart.xTicks[chart.xTicks.length - 1].timestamp - chart.xTicks[0].timestamp
  // The forecast runs to the right of the live point, so its label sits to
  // the left unless the point is near the left edge.
  const liveLabelLeft = chart.live.x > 260

  return (
    <svg className="metric-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${label} history and forecast`}>
      <defs>
        <linearGradient id="hist-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--green)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {chart.yTicks.map((tick) => (
        <g key={tick.value}>
          <line x1={chart.pad.left} x2={WIDTH - chart.pad.right} y1={tick.y} y2={tick.y} className="grid-line" />
          <text x={chart.pad.left - 8} y={tick.y + 4} className="axis-label" textAnchor="end">{tick.value}%</text>
        </g>
      ))}
      {chart.xTicks.map((tick, i) => (
        <text key={i} x={tick.x} y={HEIGHT - 8} className="axis-label" textAnchor={i === 0 ? 'start' : i === chart.xTicks.length - 1 ? 'end' : 'middle'}>
          {tickLabel(tick.timestamp, spanMs)}
        </text>
      ))}

      {chart.thresholdY != null && (
        <g>
          <line x1={chart.pad.left} x2={WIDTH - chart.pad.right} y1={chart.thresholdY} y2={chart.thresholdY} className="threshold-line" />
          <text x={chart.pad.left + 6} y={chart.thresholdY - 6} className="threshold-label">Threshold {threshold}%</text>
        </g>
      )}

      {chart.band && <path d={chart.band} className="forecast-band" />}
      <path d={`${chart.historical} L${chart.live.x},${HEIGHT - chart.pad.bottom} L${chart.pad.left},${HEIGHT - chart.pad.bottom} Z`} fill="url(#hist-fill)" stroke="none" />
      <path d={chart.historical} className="historical-line" />
      {chart.forecastLine && <path d={chart.forecastLine} className="forecast-line" />}

      <circle cx={chart.live.x} cy={chart.live.y} r="5" className="live-point" />
      <text
        x={chart.live.x + (liveLabelLeft ? -10 : 10)}
        y={chart.live.y - 10}
        className="live-label"
        textAnchor={liveLabelLeft ? 'end' : 'start'}
      >
        Live Point · {chart.live.value.toFixed(1)}% · {formatClock(history[history.length - 1].timestamp)}
      </text>
    </svg>
  )
}
