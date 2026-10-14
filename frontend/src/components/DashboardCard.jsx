import { Link } from 'react-router-dom'
import { analyzeTrend } from '../trend'
import { containerTone } from '../containers'
import { formatAgo, formatDuration, formatMb, formatPercent } from '../format'
import { Badge, Dot, Icon, Sparkline } from './ui'

function MetricBlock({ label, field, summary, threshold, breachMinutes }) {
  const value = summary.latest ? Number(summary.latest[field]) : null
  // Red when the latest reading is already over the rule threshold, amber
  // when it is only projected to cross it within the lookahead window.
  const tone = Number.isFinite(value) && value >= threshold ? 'critical' : breachMinutes != null ? 'warning' : 'healthy'
  const trend = analyzeTrend(summary.data, field)

  return (
    <div className="metric-block">
      <div className="metric-block-head">
        <span>{label}</span>
        <strong className={`text-${tone}`} title={breachMinutes != null ? `Projected to cross ${threshold}% in ~${formatDuration(breachMinutes)}` : `Threshold ${threshold}%`}>
          {formatPercent(value)}
        </strong>
      </div>
      <div className="metric-block-chart">
        <Sparkline
          values={summary.data.map((row) => row[field])}
          tone={tone}
          minSpan={10}
          label={`${label} trend, ${trend.hasEnoughData ? trend.direction : 'not enough data'}`}
        />
      </div>
    </div>
  )
}

export default function DashboardCard({ summary }) {
  const { containerId, containerName, latest, error } = summary
  const tone = containerTone(summary)
  const to = `/services/${encodeURIComponent(containerId)}/memory`

  const footerLeft = error
    ? <span className="text-critical">History unavailable</span>
    : summary.predictedBreachMinutes != null
      ? <span className="text-critical">Breach in ~{formatDuration(summary.predictedBreachMinutes)}</span>
      : latest
        ? <span className="mono">{formatMb(latest.memUsedMB)} / {formatMb(latest.memLimitMB)}</span>
        : <span className="muted">No data yet</span>

  return (
    <Link to={to} className={`card service-card${summary.atRisk ? ' at-risk' : ''}`} aria-label={`${containerName}: open memory detail`}>
      <div className="service-card-head">
        <span className="service-name">
          <Dot tone={tone} />
          <span title={containerId}>{containerName}</span>
        </span>
        {summary.hasAlert && (
          <Badge tone="critical" icon="alert-triangle">
            {summary.unresolvedAlerts.length} Alert
          </Badge>
        )}
        {!summary.hasAlert && summary.predictedBreachMinutes != null && (
          <Badge tone="critical" icon="alert-triangle">Alert · predicted</Badge>
        )}
      </div>

      {latest ? (
        <>
          <MetricBlock label="CPU %" field="cpuPercent" summary={summary} threshold={summary.cpuThreshold} breachMinutes={summary.cpuBreachMinutes} />
          <MetricBlock label="Memory %" field="memPercent" summary={summary} threshold={summary.memThreshold} breachMinutes={summary.memBreachMinutes} />
        </>
      ) : (
        <div className="empty-state compact">
          <strong>{error ? 'Could not load history' : 'No historical data available yet.'}</strong>
          <p>{error ? error.message : 'Prediction will appear after sufficient metrics are collected.'}</p>
        </div>
      )}

      <div className="service-card-foot">
        {footerLeft}
        <span className="muted">
          <Icon name="clock" /> {latest ? `updated ${formatAgo(summary.minutesSinceUpdate)}` : '—'}
        </span>
      </div>
    </Link>
  )
}
