import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import MetricChart from '../components/MetricChart'
import { Badge, Breadcrumbs, EmptyState, Icon, PageHeader, PrototypeTag, Sparkline } from '../components/ui'
import { useData, useRules, useToast } from '../context/contexts'
import { getContainerHistory, BackendUnreachableError } from '../api'
import { linearFit, forecastAt, forecastSeries, projectionHorizon } from '../regression'
import { analyzeTrend } from '../trend'
import { thresholdFor } from '../rules'
import { TIME_RANGES, filterHistoryByRange, historyCoverage } from '../containers'
import { alertCode, correlatedContainers, latestAlertFor } from '../alertsUtils'
import { trendInsight } from '../insight'
import { downsample } from '../chartGeometry'
import { formatAgo, formatDuration, formatMb, formatPercent, minutesBetween } from '../format'
import { BACKEND_SAMPLE_INTERVAL_MS, HISTORY_MAX_LIMIT } from '../constants'
import './MetricDetailPage.css'

const METRICS = {
  memory: { field: 'memPercent', title: 'Memory Utilization', name: 'Memory', noun: 'memory exhaustion' },
  cpu: { field: 'cpuPercent', title: 'CPU Utilization', name: 'CPU', noun: 'CPU saturation' },
}

const FORECAST_MINUTES = 240

function trendBadge(data, field) {
  const trend = analyzeTrend(data, field)
  if (!trend.hasEnoughData) return <Badge tone="muted">n/a</Badge>
  const perHour = trend.slope * 60
  const text = `${perHour >= 0 ? '+' : ''}${perHour.toFixed(1)}%/h`
  if (trend.direction === 'increasing') return <Badge tone="warning" icon="trending-up">{text}</Badge>
  if (trend.direction === 'decreasing') return <Badge tone="info" icon="trending-down">{text}</Badge>
  return <Badge tone="muted" icon="minus">Steady</Badge>
}

function capacityStatus(memPercent, threshold) {
  if (!Number.isFinite(memPercent)) return { tone: 'muted', label: 'No data' }
  if (memPercent >= threshold) return { tone: 'critical', label: 'Critical' }
  if (memPercent >= threshold - 10) return { tone: 'warning', label: 'Near limit' }
  return { tone: 'healthy', label: 'Healthy' }
}

export default function MetricDetailPage() {
  const { containerId, metric = 'memory' } = useParams()
  const config = METRICS[metric] ?? METRICS.memory
  const { field } = config
  const { alerts, summaries, lastRefreshed } = useData()
  const { rules } = useRules()
  const toast = useToast()
  const [range, setRange] = useState('6h')
  const [state, setState] = useState({ history: null, error: null, forId: null })

  // Pull the longest history the backend allows and filter it client-side by
  // range. Refetches whenever the shared poll ticks.
  useEffect(() => {
    let cancelled = false
    getContainerHistory(containerId, HISTORY_MAX_LIMIT)
      .then((history) => !cancelled && setState({ history, error: null, forId: containerId }))
      .catch((error) => !cancelled && setState((prev) => ({ history: prev.forId === containerId ? prev.history : null, error, forId: containerId })))
    return () => {
      cancelled = true
    }
  }, [containerId, lastRefreshed])

  const history = state.forId === containerId ? state.history : null
  const summary = summaries.find((s) => s.containerId === containerId)
  const containerName = history?.containerName || summary?.containerName || containerId
  const threshold = thresholdFor(rules, field, containerId)
  const rangeMinutes = TIME_RANGES.find((r) => r.id === range).minutes

  const derived = useMemo(() => {
    const rows = filterHistoryByRange(history?.data ?? [], rangeMinutes)
    const fit = linearFit(rows, field)
    const horizon = projectionHorizon(fit, threshold, { minHorizon: 30, spanMultiplier: 0.5 })
    return {
      rows,
      fit,
      horizon,
      coverage: historyCoverage(rows),
      forecast: forecastSeries(fit, horizon.minutes, 16),
      forecastValue: forecastAt(fit, FORECAST_MINUTES),
      chartHistory: downsample(rows, 300).map((r) => ({ timestamp: new Date(r.timestamp).getTime(), value: Number(r[field]) })),
    }
  }, [history, rangeMinutes, field, threshold])

  const { rows, fit, horizon, coverage, forecast, forecastValue, chartHistory } = derived
  const latest = rows[rows.length - 1] ?? history?.data?.[history.data.length - 1] ?? null
  const latestAlert = latestAlertFor(alerts ?? [], containerId)
  const correlated = correlatedContainers(alerts ?? [], containerId)
  const fitPercent = fit.hasEnoughData && fit.rSquared != null ? Math.round(fit.rSquared * 100) : null
  const memLimit = latest ? Number(latest.memLimitMB) : null
  const capacity = capacityStatus(latest ? Number(latest.memPercent) : NaN, thresholdFor(rules, 'memPercent', containerId))
  const maxSpanHours = (HISTORY_MAX_LIMIT * BACKEND_SAMPLE_INTERVAL_MS) / 3600_000

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Services', to: '/' },
              { label: containerName, accent: true },
              { label: config.title },
            ]}
          />
        }
        title={config.title}
        subtitle={
          <>
            Analyzing predicted {config.noun} for <span className="accent">{containerName}</span>
          </>
        }
        actions={
          <div className="detail-controls">
            <div className="confidence">
              <div className="confidence-head">
                <span className="eyebrow"><Icon name="sparkles" /> Prediction confidence · Fit (R²)</span>
                <strong className="mono accent">{fitPercent != null ? `${fitPercent}%` : 'n/a'}</strong>
              </div>
              <div className="progress" role="progressbar" aria-label="Fit (R squared)" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fitPercent ?? 0}>
                <span style={{ width: `${fitPercent ?? 0}%` }} />
              </div>
            </div>
            <div className="range-toggle" role="group" aria-label="Time range">
              {TIME_RANGES.map((r) => (
                <button key={r.id} type="button" className={range === r.id ? 'active' : ''} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="metric-switch">
        {Object.entries(METRICS).map(([key, m]) => (
          <Link key={key} to={`/services/${encodeURIComponent(containerId)}/${key}`} className={`tab${key === metric ? ' active' : ''}`}>
            {m.name}
          </Link>
        ))}
      </div>

      {state.error && (
        <p className="load-error">
          {state.error instanceof BackendUnreachableError ? state.error.message : `Could not load history: ${state.error.message}`}
        </p>
      )}

      <section className="card chart-card">
        <div className="chart-card-head">
          <div className="stat-pair">
            <div>
              <span className="eyebrow">Current</span>
              <strong className="big-stat">{latest ? formatPercent(latest[field]) : '—'}</strong>
              {field === 'memPercent' && latest && <span className="muted mono">{formatMb(latest.memUsedMB)}</span>}
            </div>
            <div className="stat-divider" />
            <div>
              <span className="eyebrow">Forecast (4h)</span>
              <strong className="big-stat text-info">{forecastValue != null ? formatPercent(forecastValue) : '—'}</strong>
              {field === 'memPercent' && forecastValue != null && Number.isFinite(memLimit) && (
                <span className="muted mono">≈ {formatMb((forecastValue / 100) * memLimit)}</span>
              )}
            </div>
          </div>
          <div className="chart-legend">
            <span><i className="legend-swatch historical" /> Historical Data</span>
            <span><i className="legend-swatch predicted" /> Predicted Trend</span>
            <span><i className="legend-swatch band" /> ≈95% band</span>
          </div>
        </div>

        {history === null && !state.error && <p className="loading-state chart-empty">Loading history…</p>}
        {history !== null && rows.length < 2 && (
          <EmptyState icon="chart-line" title="Not enough readings in this range">
            {history.data.length === 0 ? 'No history stored for this container yet.' : 'Try a longer time range.'}
          </EmptyState>
        )}
        {rows.length >= 2 && <MetricChart history={chartHistory} forecast={forecast} threshold={threshold} label={config.name} />}

        <div className="chart-foot muted">
          <span>
            {coverage.count} readings covering {formatDuration(coverage.spanMinutes)}
            {coverage.count >= HISTORY_MAX_LIMIT && rangeMinutes / 60 > maxSpanHours && ` — the backend returns at most ${HISTORY_MAX_LIMIT} readings (≈${maxSpanHours.toFixed(1)} h at ${BACKEND_SAMPLE_INTERVAL_MS / 1000}s sampling)`}
            {coverage.count > 0 && coverage.spanMinutes < rangeMinutes * 0.9 && coverage.count < HISTORY_MAX_LIMIT && ' — that is all the history stored for this range'}
          </span>
          <span>
            {fit.hasEnoughData && fit.slope > 0
              ? horizon.reachesThreshold
                ? `Trend reaches ${threshold}% in ~${formatDuration(horizon.minutes)}`
                : horizon.minutesToThreshold != null
                  ? `Trend reaches ${threshold}% in ~${formatDuration(horizon.minutesToThreshold)} (beyond chart)`
                  : `Already above ${threshold}%`
              : fit.hasEnoughData
                ? 'Flat or falling trend — no breach projected'
                : ''}
          </span>
        </div>
      </section>

      <section className="mini-cards">
        <div className="card card-pad mini-card">
          <div className="mini-card-head">
            <span className="eyebrow">CPU usage</span>
            {trendBadge(rows, 'cpuPercent')}
          </div>
          <strong className="mid-stat">{latest ? formatPercent(latest.cpuPercent) : '—'}</strong>
          <Sparkline values={rows.slice(-120).map((r) => r.cpuPercent)} height={56} minSpan={10} label="CPU sparkline" />
        </div>
        <div className="card card-pad mini-card">
          <div className="mini-card-head">
            <span className="eyebrow">Memory</span>
            {trendBadge(rows, 'memPercent')}
          </div>
          <strong className="mid-stat">{latest ? formatPercent(latest.memPercent) : '—'}</strong>
          <Sparkline values={rows.slice(-120).map((r) => r.memPercent)} height={56} minSpan={10} label="Memory sparkline" />
        </div>
        <div className="card card-pad mini-card">
          <div className="mini-card-head">
            <span className="eyebrow">Memory used / limit</span>
            <Badge tone={capacity.tone}>{capacity.label}</Badge>
          </div>
          <strong className="mid-stat">{latest ? formatMb(latest.memUsedMB) : '—'}</strong>
          <span className="muted mono">of {latest ? formatMb(latest.memLimitMB) : '—'} limit</span>
          <p className="muted not-collected">Request rate / error rate: n/a (not collected)</p>
        </div>
      </section>

      <section className="bottom-panels">
        <div className="card card-pad insight-panel">
          <div className="insight-head">
            <span className="insight-icon"><Icon name="bulb" /></span>
            <div>
              <h3>Insight Engine Analysis</h3>
              <span className="muted small">
                {latestAlert
                  ? <>From <Link className="accent" to={`/alerts/${latestAlert.id}`}>{alertCode(latestAlert.id)}</Link> · {formatAgo(minutesBetween(latestAlert.time))}</>
                  : 'Generated from the current trend (no alert for this container)'}
              </span>
            </div>
          </div>
          <p className="insight-text">
            {latestAlert ? latestAlert.explanation : trendInsight({ metricName: config.name, fit, threshold })}
          </p>
          <div className="insight-actions">
            <button type="button" className="btn btn-primary" onClick={() => toast.simulated('Run Heap Dump')}>
              <Icon name="file-analytics" /> Run Heap Dump
            </button>
            <button type="button" className="btn" onClick={() => toast.simulated('Rollback Service')}>
              <Icon name="arrow-back-up" /> Rollback Service
            </button>
            <PrototypeTag>Prototype actions</PrototypeTag>
          </div>
        </div>

        <div className="card card-pad correlation-panel">
          <span className="eyebrow">Service correlation</span>
          <p className="muted small">Containers whose alerts are grouped with this container&apos;s latest alert (grouped_with).</p>
          {correlated.length === 0 ? (
            <EmptyState icon="link-off" title="No correlated services">
              {latestAlert ? 'This alert was not grouped with any other container.' : 'This container has no alerts.'}
            </EmptyState>
          ) : (
            <ul className="correlation-list">
              {correlated.map((c) => (
                <li key={c.containerId}>
                  <Link to={`/alerts/${c.alertId}`} className="correlation-item">
                    <span className="correlation-icon"><Icon name="server-2" /></span>
                    <span>
                      <strong>{c.containerName}</strong>
                      <span className="muted small">{c.isRoot ? 'Root alert' : 'Grouped alert'} · {alertCode(c.alertId)}</span>
                    </span>
                    {c.resolved ? (
                      <Icon name="circle-check" className="text-healthy correlation-status" />
                    ) : (
                      <Icon name="alert-triangle" className="text-warning correlation-status" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}
