import { Fragment, useState } from 'react'
import { resolveAlert, BackendUnreachableError } from '../api'
import {
  groupAlerts,
  filterAlerts,
  sortAlertGroups,
  paginate,
  alertsToCsv,
  alertStatus,
  alertSeverity,
  alertTitle,
  metricLabel,
} from '../alertsUtils'
import { thresholdFor } from '../rules'
import { severityLabel } from '../severity'
import { formatDuration, formatPercent } from '../format'
import { Icon } from './ui'
import { downloadText, timestampForFilename } from '../download'

const STATUS_LABELS = { active: 'Active', acknowledged: 'Acknowledged', resolved: 'Resolved' }
const SEVERITY_TONES = { critical: 'critical', high: 'high', warning: 'warning' }

function formatFired(time) {
  if (!time) return ''
  const d = new Date(time)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay ? d.toLocaleTimeString() : `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`
}

function shortDescription(alert) {
  const breach = alert.predictedBreachMinutes > 0 ? `breach in ~${formatDuration(alert.predictedBreachMinutes)}` : 'threshold breached'
  return `${metricLabel(alert.metric)} ${formatPercent(alert.currentValue)} · ${breach}`
}

function AlertRow({ alert, status, rules, hasChildren, expanded, onToggle, onSelect, onResolve, onAcknowledge, resolvingId }) {
  const severity = alertSeverity(alert)
  return (
    <tr
      className="alert-row clickable"
      onClick={() => onSelect(alert)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect(alert)
      }}
    >
      <td className="chevron-cell">
        {hasChildren && (
          <button
            type="button"
            className="alert-expand-toggle icon-button small"
            aria-label={expanded ? 'Collapse grouped alerts' : 'Expand grouped alerts'}
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            <Icon name={expanded ? 'chevron-down' : 'chevron-right'} className={expanded ? 'accent' : ''} />
          </button>
        )}
      </td>
      <td>
        <span className={`severity severity-${SEVERITY_TONES[severity]}`}>
          <span className="dot" /> {severityLabel(severity)}
        </span>
      </td>
      <td className="title-cell">
        <strong>{alertTitle(alert, thresholdFor(rules, alert.metric, alert.containerId))}</strong>
        <span className="muted alert-description" title={alert.explanation}>{alert.explanation}</span>
      </td>
      <td>
        <span className="service-pill mono">{alert.containerName}</span>
      </td>
      <td className="muted nowrap">{formatFired(alert.time)}</td>
      <td>
        <span className={`status-pill status-${status}`}>{STATUS_LABELS[status]}</span>
      </td>
      <td className="actions-cell">
        <button
          type="button"
          className={`icon-button small${status === 'acknowledged' ? ' on' : ''}`}
          aria-label={status === 'acknowledged' ? 'Remove acknowledgement' : 'Acknowledge alert'}
          title="Acknowledge (saved in this browser)"
          disabled={alert.resolved}
          onClick={(e) => {
            e.stopPropagation()
            onAcknowledge(alert.id, status !== 'acknowledged')
          }}
        >
          <Icon name="circle-check" />
        </button>
        <button
          type="button"
          className="icon-button small"
          aria-label="Resolve alert"
          title="Resolve (PATCH /api/alerts/:id/resolve)"
          disabled={alert.resolved || resolvingId === alert.id}
          onClick={(e) => {
            e.stopPropagation()
            onResolve(alert.id)
          }}
        >
          <Icon name={resolvingId === alert.id ? 'loader-2' : 'checks'} />
        </button>
        <button
          type="button"
          className="icon-button small"
          aria-label="View alert"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(alert)
          }}
        >
          <Icon name="eye" />
        </button>
      </td>
    </tr>
  )
}

function ChildRow({ alert, status, onSelect }) {
  return (
    <tr className="alert-row-child clickable" onClick={() => onSelect(alert)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onSelect(alert)}>
      <td />
      <td colSpan={4}>
        <div className="child-content">
          <Icon name="corner-down-right" className="muted" />
          <div>
            <span className="child-title">
              Instance: <strong>{alert.containerName}</strong>
            </span>
            <span className="muted child-description">{shortDescription(alert)}</span>
          </div>
        </div>
      </td>
      <td>
        <span className={`status-pill small status-${status}`}>{STATUS_LABELS[status]}</span>
      </td>
      <td className="muted nowrap child-time">{formatFired(alert.time)}</td>
    </tr>
  )
}

export default function AlertsFeed({
  alerts,
  onSelectAlert,
  onAlertsChanged,
  acknowledgedIds = [],
  onToggleAcknowledged = () => {},
  rules = [],
  query = '',
  pageSize = 8,
}) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [expandedRootIds, setExpandedRootIds] = useState(() => new Set())
  const [resolvingId, setResolvingId] = useState(null)
  const [error, setError] = useState(null)

  const filtered = filterAlerts(alerts, { status: statusFilter, severity: severityFilter, query }, acknowledgedIds)
  const groups = sortAlertGroups(groupAlerts(filtered))
  const pageInfo = paginate(groups, page, pageSize)
  const groupedCount = groups.reduce((sum, g) => sum + g.children.length, 0)

  function toggleExpanded(rootId) {
    setExpandedRootIds((prev) => {
      const next = new Set(prev)
      if (next.has(rootId)) next.delete(rootId)
      else next.add(rootId)
      return next
    })
  }

  async function handleResolve(id) {
    setError(null)
    setResolvingId(id)
    try {
      await resolveAlert(id)
      onAlertsChanged?.()
    } catch (err) {
      setError(err instanceof BackendUnreachableError ? err.message : `Failed to resolve alert: ${err.message}`)
    } finally {
      setResolvingId(null)
    }
  }

  function changeFilter(setter) {
    return (e) => {
      setter(e.target.value)
      setPage(1)
    }
  }

  return (
    <div className="alerts-feed">
      <div className="alerts-feed-header">
        <div>
          <h1>Active Alerts Feed</h1>
          <p className="page-subtitle">Real-time infrastructure anomalies and system threshold violations.</p>
        </div>
        <div className="feed-filters">
          <label className="field-label">
            <span className="eyebrow">Status</span>
            <select className="select" value={statusFilter} onChange={changeFilter(setStatusFilter)} aria-label="Status filter">
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <label className="field-label">
            <span className="eyebrow">Severity</span>
            <select className="select" value={severityFilter} onChange={changeFilter(setSeverityFilter)} aria-label="Severity filter">
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="warning">Warning</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={filtered.length === 0}
            onClick={() => downloadText(alertsToCsv(filtered, acknowledgedIds), `foresight-alerts-${timestampForFilename()}.csv`, 'text/csv;charset=utf-8')}
          >
            <Icon name="download" /> Export Logs
          </button>
        </div>
      </div>

      {error && <p className="load-error">{error}</p>}

      <div className="card table-card">
        {groups.length === 0 ? (
          <p className="empty-state">
            {alerts.length === 0 ? 'No active alerts.' : 'No alerts match these filters.'}
          </p>
        ) : (
          <table className="data-table alerts-table">
            <thead>
              <tr>
                <th aria-label="Expand" />
                <th>Severity</th>
                <th>Alert title</th>
                <th>Service</th>
                <th>Time fired</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageInfo.items.map(({ root, children }) => (
                <Fragment key={root.id}>
                  <AlertRow
                    alert={root}
                    status={alertStatus(root, acknowledgedIds)}
                    rules={rules}
                    hasChildren={children.length > 0}
                    expanded={expandedRootIds.has(root.id)}
                    onToggle={() => toggleExpanded(root.id)}
                    onSelect={onSelectAlert}
                    onResolve={handleResolve}
                    onAcknowledge={onToggleAcknowledged}
                    resolvingId={resolvingId}
                  />
                  {expandedRootIds.has(root.id) &&
                    children.map((child) => (
                      <ChildRow key={child.id} alert={child} status={alertStatus(child, acknowledgedIds)} onSelect={onSelectAlert} />
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}

        <div className="table-footer">
          <span className="muted">
            Showing {pageInfo.start}–{pageInfo.end} of {pageInfo.total} alerts
            {groupedCount > 0 && ` · ${groupedCount} grouped beneath`}
          </span>
          <div className="pager">
            <button type="button" className="icon-button small" aria-label="Previous page" disabled={pageInfo.page <= 1} onClick={() => setPage(pageInfo.page - 1)}>
              <Icon name="chevron-left" />
            </button>
            <span className="mono muted">{pageInfo.page} / {pageInfo.totalPages}</span>
            <button type="button" className="icon-button small" aria-label="Next page" disabled={pageInfo.page >= pageInfo.totalPages} onClick={() => setPage(pageInfo.page + 1)}>
              <Icon name="chevron-right" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
