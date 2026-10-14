import { useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import DashboardCard from '../components/DashboardCard'
import { Dot, EmptyState, Icon, PageHeader } from '../components/ui'
import { useData } from '../context/contexts'
import { containerTone, dashboardSummary, filterContainers, sortContainers } from '../containers'
import { formatAgo, formatDuration, formatMb, formatPercent } from '../format'
import './DashboardPage.css'

// Production / Staging are disabled: the backend collects no environment
// label for containers, so there is nothing real to filter on.
const TABS = [
  { id: 'all', label: 'All Services' },
  { id: 'production', label: 'Production', disabled: true },
  { id: 'staging', label: 'Staging', disabled: true },
  { id: 'critical', label: 'Critical Only' },
]

const SORTS = [
  { id: 'health', label: 'Health' },
  { id: 'name', label: 'Name' },
  { id: 'memory', label: 'Memory' },
  { id: 'cpu', label: 'CPU' },
]

function ListView({ items }) {
  const navigate = useNavigate()
  return (
    <div className="card table-card">
      <table className="data-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>CPU %</th>
            <th>Memory %</th>
            <th>Memory used</th>
            <th>Predicted breach</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr
              key={s.containerId}
              className="clickable"
              tabIndex={0}
              onClick={() => navigate(`/services/${encodeURIComponent(s.containerId)}/memory`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/services/${encodeURIComponent(s.containerId)}/memory`)}
            >
              <td>
                <span className="service-name"><Dot tone={containerTone(s)} /> {s.containerName}</span>
              </td>
              <td className="mono">{formatPercent(s.latest?.cpuPercent)}</td>
              <td className="mono">{formatPercent(s.latest?.memPercent)}</td>
              <td className="mono">{s.latest ? `${formatMb(s.latest.memUsedMB)} / ${formatMb(s.latest.memLimitMB)}` : '—'}</td>
              <td className={s.predictedBreachMinutes != null ? 'text-critical' : 'muted'}>
                {s.hasAlert ? 'Alert active' : s.predictedBreachMinutes != null ? `~${formatDuration(s.predictedBreachMinutes)}` : 'Not projected'}
              </td>
              <td className="muted">{s.latest ? formatAgo(s.minutesSinceUpdate) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DashboardPage() {
  const { query } = useOutletContext() ?? { query: '' }
  const { loaded, summaries, alerts, discoverySource, alertsError, health } = useData()
  const [tab, setTab] = useState('all')
  const [view, setView] = useState('grid')
  const [sort, setSort] = useState('health')

  const summary = dashboardSummary(summaries, alerts ?? [])
  const visible = sortContainers(filterContainers(summaries, { tab, query }), sort)
  const fromAlerts = summaries.filter((s) => s.source === 'alert').length

  return (
    <>
      <PageHeader
        title="Infrastructure Overview"
        subtitle="Real-time status of your containers"
        actions={
          <div className="pill-group">
            <span className="pill"><Dot tone="healthy" /> {summary.reporting} Services Active</span>
            <span className="pill-divider" />
            <span className="pill pill-critical"><Dot tone="critical" /> {summary.pendingAlerts} Alerts Pending</span>
          </div>
        }
      />

      {health && !health.ok && (
        <p className="load-error">Backend is unreachable — make sure the server is running on port 5000.</p>
      )}
      {alertsError && <p className="load-error">Alerts could not be loaded: {alertsError}</p>}

      <section className="summary-strip card" aria-label="Risk summary">
        <div>
          <span className="eyebrow">Services at risk</span>
          <strong className={`mono ${summary.atRisk ? 'text-critical' : 'accent'}`}>
            {summary.atRisk} <span className="muted">/ {summary.total}</span>
          </strong>
        </div>
        <div>
          <span className="eyebrow">Soonest predicted breach</span>
          <strong className={summary.soonest ? 'text-critical' : 'muted'}>
            {summary.soonest ? `${summary.soonest.containerName} in ~${formatDuration(summary.soonest.minutes)}` : 'None projected'}
          </strong>
        </div>
        <div>
          <span className="eyebrow">Container source</span>
          <span className="muted small">
            {discoverySource === 'env'
              ? 'Discovery failed — using VITE_CONTAINER_IDS'
              : discoverySource === 'api'
                ? 'Live from /api/stats/containers'
                : '…'}
            {fromAlerts > 0 && ` + ${fromAlerts} from unresolved alerts`}
          </span>
        </div>
      </section>

      <div className="dashboard-toolbar">
        <div className="tab-group" role="tablist" aria-label="Filter services">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              disabled={t.disabled}
              title={t.disabled ? 'No environment labels are collected for containers yet' : undefined}
              className={`tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <div className="view-toggle" role="group" aria-label="View">
            <button type="button" className={view === 'grid' ? 'active' : ''} aria-pressed={view === 'grid'} aria-label="Grid view" onClick={() => setView('grid')}>
              <Icon name="layout-grid" />
            </button>
            <button type="button" className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} aria-label="List view" onClick={() => setView('list')}>
              <Icon name="list" />
            </button>
          </div>
          <label className="sort-select">
            <span>Sort by:</span>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!loaded && <p className="loading-state">Loading containers…</p>}

      {loaded && visible.length === 0 && (
        <div className="card">
          <EmptyState icon="server-off" title={summaries.length === 0 ? 'No containers found' : 'No services match this filter'}>
            {summaries.length === 0
              ? 'The backend returned no running containers and VITE_CONTAINER_IDS is empty.'
              : tab === 'critical'
                ? 'No container has an unresolved alert or a predicted breach.'
                : 'Try a different search.'}
          </EmptyState>
        </div>
      )}

      {loaded && visible.length > 0 && view === 'grid' && (
        <section className="cards-grid" aria-label="Container status">
          {visible.map((s) => (
            <DashboardCard key={s.containerId} summary={s} />
          ))}
        </section>
      )}

      {loaded && visible.length > 0 && view === 'list' && <ListView items={visible} />}

      <Link to="/rules?create=1" className="fab" aria-label="Create alert rule" title="Create alert rule">
        <Icon name="plus" />
      </Link>
    </>
  )
}
