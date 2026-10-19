import { Link } from 'react-router-dom'
import { useToast } from '../context/contexts'
import { Badge, Breadcrumbs, Dot, Icon, MiniBars, PrototypeTag } from './ui'
import {
  alertCode,
  alertSeverity,
  alertThreshold,
  alertTitle,
  anomalyHeading,
  changeOverHistory,
  highlightPercents,
  metricLabel,
} from '../alertsUtils'
import { severityLabel } from '../severity'
import { formatDuration, formatMb, formatPercent, formatUsd } from '../format'
import { COST_RESTART_UNIT, COST_UPGRADE_UNIT } from '../constants'

function Highlighted({ text, current }) {
  return highlightPercents(text, { current }).map((segment, i) =>
    segment.tone ? (
      <strong key={i} className={segment.tone === 'current' ? 'text-critical' : 'text-strong'}>
        {segment.text}
      </strong>
    ) : (
      <span key={i}>{segment.text}</span>
    ),
  )
}

function CostLabel({ value, unit }) {
  return (
    <span className="cost-chip mono" title="Estimate computed by the backend cost service, not real billing data">
      {formatUsd(value)}
      {/* TODO(cost-unit): set COST_*_UNIT in constants.js once the unit is confirmed. */}
      <small>{unit ?? 'est. · unit unconfirmed'}</small>
    </span>
  )
}

export default function AlertDetail({
  alert,
  onBack,
  onResolve,
  resolving,
  history = [],
  fitRSquared = null,
  fallbackThreshold = 90,
  acknowledged = false,
  onAcknowledge,
  assignee = '',
  onAssigneeChange,
}) {
  const toast = useToast()
  if (!alert) return null

  const severity = alertSeverity(alert)
  const threshold = alertThreshold(alert, fallbackThreshold)
  const change = changeOverHistory(history, alert.metric)
  const label = metricLabel(alert.metric)
  const latest = history[history.length - 1]

  return (
    <div className="alert-detail">
      <Breadcrumbs items={[{ label: 'Alerts', to: '/alerts' }, { label: alertCode(alert.id), accent: true }]} />
      <div className="alert-detail-title">
        <h1>{alertTitle(alert, fallbackThreshold)}</h1>
        <div className="alert-detail-service">
          <Badge tone={severity === 'critical' ? 'solid-critical' : severity} icon="alert-triangle">
            {severityLabel(severity)}
          </Badge>
          <Link to={`/services/${encodeURIComponent(alert.containerId)}/${alert.metric === 'cpuPercent' ? 'cpu' : 'memory'}`} className="muted">
            {alert.containerName}
          </Link>
        </div>
      </div>

      <section className="card hero-card">
        <span className="hero-icon"><Icon name="alert-triangle" /></span>
        <div className="hero-body">
          <h2 className="hero-heading">{anomalyHeading(alert.metric)}</h2>
          {change ? (
            <p className="hero-text">
              {label} {change.current >= change.start ? 'rose' : 'fell'} from{' '}
              <strong className="text-healthy">{formatPercent(change.start)}</strong> to{' '}
              <strong className="text-critical">{formatPercent(change.current)}</strong> over{' '}
              {formatDuration(change.minutes)}.
            </p>
          ) : (
            <p className="hero-text">
              {label} was at <strong className="text-critical">{formatPercent(alert.currentValue)}</strong> when this alert fired.
            </p>
          )}
          <p className="hero-explanation">
            <Highlighted text={alert.explanation} current={alert.currentValue} />
          </p>
          <div className="hero-meta">
            <span>
              <Icon name="clock" />{' '}
              {alert.predictedBreachMinutes > 0 ? (
                <>Predicted to breach {threshold}% in <strong>{Math.round(alert.predictedBreachMinutes)} minutes</strong> (at fire time)</>
              ) : (
                <>Threshold {threshold}% <strong>already breached</strong> at fire time</>
              )}
            </span>
            <span>
              <Icon name="chart-dots" /> Fit (R²):{' '}
              <strong className="mono">{fitRSquared != null ? fitRSquared.toFixed(2) : 'n/a'}</strong>
              <span className="muted"> over last {history.length} readings</span>
            </span>
          </div>
        </div>
      </section>

      <section className="option-cards">
        <div className="card option-card">
          <div className="option-head">
            <div>
              <h3>Restart Service</h3>
              <p className="muted">Releases cached memory and transient leaks.</p>
            </div>
            <CostLabel value={alert.costRestartUsd} unit={COST_RESTART_UNIT} />
          </div>
          <div className="option-tags">
            <span className="tag tag-plain">Temporary fix</span>
            <PrototypeTag />
          </div>
          <button type="button" className="btn btn-block" onClick={() => toast.simulated('Restart service')}>
            <Icon name="refresh" /> Restart service now
          </button>
        </div>

        <div className="card option-card recommended">
          <div className="option-head">
            <div>
              <h3>
                Upgrade <span className="tag tag-green">Recommended</span>
              </h3>
              <p className="muted">Permanent fix for growing workload demands.</p>
            </div>
            <CostLabel value={alert.costUpgradeUsd} unit={COST_UPGRADE_UNIT} />
          </div>
          <div className="option-tags">
            <span className="tag tag-green">Permanent fix</span>
            <PrototypeTag />
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={() => toast.simulated('Apply upgrade')}>
            <Icon name="bolt" /> Apply upgrade now
          </button>
        </div>
      </section>
      <p className="muted cost-note">Costs are estimates from the backend cost service (public on-demand pricing), not real billing data.</p>

      <section className="bar-cards">
        <div className="card card-pad">
          <div className="bar-card-head"><span className="eyebrow">CPU utilization</span><strong className="mono text-healthy">{formatPercent(latest?.cpuPercent)}</strong></div>
          <MiniBars values={history.map((r) => r.cpuPercent)} tone="healthy" label="CPU utilization, recent readings" />
        </div>
        <div className="card card-pad">
          <div className="bar-card-head"><span className="eyebrow">Memory</span><strong className="mono text-critical">{formatPercent(latest?.memPercent)}</strong></div>
          <MiniBars values={history.map((r) => r.memPercent)} tone="critical" label="Memory percent, recent readings" />
        </div>
        <div className="card card-pad">
          <div className="bar-card-head"><span className="eyebrow">Memory used (MB)</span><strong className="mono text-info">{latest ? `${formatMb(latest.memUsedMB)} / ${formatMb(latest.memLimitMB)}` : '—'}</strong></div>
          <MiniBars
            values={history.map((r) => (Number(r.memLimitMB) > 0 ? (Number(r.memUsedMB) / Number(r.memLimitMB)) * 100 : NaN))}
            tone="info"
            label="Memory used relative to limit, recent readings"
          />
        </div>
      </section>

      <footer className="action-bar card">
        <div className="action-bar-info">
          <div>
            <span className="eyebrow">Status</span>
            <span className="status-value">
              <Dot tone={alert.resolved ? 'healthy' : 'critical'} /> {alert.resolved ? 'Resolved' : 'Unresolved'}
              {!alert.resolved && acknowledged && <Badge tone="info">Acknowledged</Badge>}
            </span>
          </div>
          <label className="assignee">
            <span className="eyebrow">Assigned to <span className="tag tag-local">stored locally</span></span>
            <input
              className="input"
              value={assignee}
              placeholder="Unassigned"
              onChange={(e) => onAssigneeChange?.(e.target.value)}
              aria-label="Assigned to"
            />
          </label>
        </div>
        <div className="action-bar-buttons">
          <button type="button" className="btn" onClick={onBack} title="Back to the feed without changing anything">
            Dismiss
          </button>
          <button type="button" className="btn" onClick={() => toast.simulated('Escalate')}>
            <Icon name="arrow-forward-up" /> Escalate
          </button>
          {!alert.resolved && (
            <button type="button" className="btn btn-danger-outline" onClick={() => onResolve(alert.id)} disabled={resolving}>
              <Icon name="check" /> {resolving ? 'Resolving…' : 'Resolve'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onAcknowledge?.(!acknowledged)}
            disabled={alert.resolved}
            title="Acknowledgement is saved in this browser only"
          >
            <Icon name="circle-check" /> {acknowledged ? 'Acknowledged' : 'Acknowledge Alert'}
          </button>
        </div>
      </footer>
    </div>
  )
}
