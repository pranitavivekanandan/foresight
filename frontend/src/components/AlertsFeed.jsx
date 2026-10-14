import { useState } from 'react'
import { resolveAlert, BackendUnreachableError } from '../api'
import { groupAlerts, filterAlertsByStatus } from '../alertsUtils'

function AlertRow({ alert, isChild, hasChildren, expanded, onToggle, onSelect, onResolve, resolvingId }) {
  return (
    <div
      className={`alert-row${isChild ? ' alert-row-child' : ''}`}
      onClick={() => onSelect(alert)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect(alert)
      }}
    >
      {!isChild && hasChildren && (
        <button
          type="button"
          className="alert-expand-toggle"
          aria-label={expanded ? 'Collapse grouped alerts' : 'Expand grouped alerts'}
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
        >
          {expanded ? '▾' : '▸'}
        </button>
      )}
      <div className="alert-row-main">
        <strong>{alert.containerName}</strong>
        <span className="muted">{alert.explanation}</span>
      </div>
      <span className="alert-row-metric">{alert.metric}</span>
      <span className="alert-row-time">{alert.time ? new Date(alert.time).toLocaleTimeString() : ''}</span>
      <span className={`badge ${alert.resolved ? 'healthy' : 'critical'}`}>
        {alert.resolved ? 'Resolved' : 'Active'}
      </span>
      <button
        type="button"
        className="resolve-button small"
        disabled={alert.resolved || resolvingId === alert.id}
        onClick={(e) => {
          e.stopPropagation()
          onResolve(alert.id)
        }}
      >
        {resolvingId === alert.id ? 'Resolving…' : 'Resolve'}
      </button>
    </div>
  )
}

export default function AlertsFeed({ alerts, onSelectAlert, onAlertsChanged }) {
  const [statusFilter, setStatusFilter] = useState('active')
  const [expandedRootIds, setExpandedRootIds] = useState(() => new Set())
  const [resolvingId, setResolvingId] = useState(null)
  const [error, setError] = useState(null)

  const filtered = filterAlertsByStatus(alerts, statusFilter)
  const groups = groupAlerts(filtered)

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

  return (
    <div className="alerts-feed">
      <div className="alerts-feed-header">
        <h2>Alerts</h2>
        <label className="status-filter">
          <span>Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
      </div>

      {error && <p className="load-error">{error}</p>}

      {groups.length === 0 ? (
        <p className="empty-state">No {statusFilter} alerts.</p>
      ) : (
        <div className="alerts-table" role="table">
          {groups.map(({ root, children }) => (
            <div key={root.id} className="alert-group">
              <AlertRow
                alert={root}
                isChild={false}
                hasChildren={children.length > 0}
                expanded={expandedRootIds.has(root.id)}
                onToggle={() => toggleExpanded(root.id)}
                onSelect={onSelectAlert}
                onResolve={handleResolve}
                resolvingId={resolvingId}
              />
              {expandedRootIds.has(root.id) &&
                children.map((child) => (
                  <AlertRow
                    key={child.id}
                    alert={child}
                    isChild
                    hasChildren={false}
                    onSelect={onSelectAlert}
                    onResolve={handleResolve}
                    resolvingId={resolvingId}
                  />
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
