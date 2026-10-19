import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Dot } from './ui'
import { useData } from '../context/contexts'
import { systemStatus } from '../containers'
import { formatClock } from '../format'

const SEARCH_PLACEHOLDERS = [
  [/^\/services/, 'Search metrics…'],
  [/^\/alerts\/.+/, 'Search infrastructure…'],
  [/^\/alerts/, 'Search alerts, services, or nodes…'],
  [/^\/rules/, 'Search rules…'],
  [/^\/settings/, 'Search settings…'],
  [/^\//, 'Search services, nodes, or clusters…'],
]

function placeholderFor(pathname) {
  return SEARCH_PLACEHOLDERS.find(([pattern]) => pattern.test(pathname))[1]
}

function TopBar({ query, onQueryChange }) {
  const { pathname } = useLocation()
  const { alerts } = useData()
  const activeCount = (alerts ?? []).filter((a) => !a.resolved).length

  return (
    <div className="top-bar">
      <label className="search-box">
        <i className="ti ti-search" aria-hidden="true"></i>
        <input
          type="search"
          placeholder={placeholderFor(pathname)}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search"
        />
      </label>
      <div className="top-bar-actions">
        <Link
          to="/alerts"
          className="icon-button"
          aria-label={activeCount ? `Alerts (${activeCount} active)` : 'Alerts'}
          title={activeCount ? `${activeCount} active alert${activeCount === 1 ? '' : 's'}` : 'No active alerts'}
        >
          <i className="ti ti-bell" aria-hidden="true"></i>
          {activeCount > 0 && <span className="bell-dot" data-testid="bell-dot" />}
        </Link>
        <Link to="/settings" className="icon-button" aria-label="Settings">
          <i className="ti ti-settings" aria-hidden="true"></i>
        </Link>
      </div>
    </div>
  )
}

function StatusBar() {
  const { health, summaries, lastRefreshed } = useData()
  const reporting = summaries.filter((s) => s.reporting).length
  const status = systemStatus({ healthOk: health?.ok ?? null, reporting, total: summaries.length })

  return (
    <footer className="status-bar">
      <div className="status-items">
        <span><Dot tone={status.tone} /> {status.text}</span>
        <span>
          <Dot tone={health?.ok ? 'healthy' : health ? 'critical' : 'muted'} /> Backend /health:{' '}
          <span className="mono">{health ? (health.ok ? `ok · ${health.latencyMs} ms` : 'down') : '…'}</span>
        </span>
        <span>
          <Dot tone="info" /> Containers reporting: <span className="mono">{reporting}/{summaries.length}</span>
        </span>
      </div>
      <span className="mono">Last refreshed: {formatClock(lastRefreshed)}</span>
    </footer>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  // Search text is per screen: keyed by path so it clears on navigation.
  const [search, setSearch] = useState({ path: pathname, query: '' })
  const query = search.path === pathname ? search.query : ''

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-column">
        <TopBar query={query} onQueryChange={(value) => setSearch({ path: pathname, query: value })} />
        <main className="main-content">
          <Outlet context={{ query }} />
        </main>
        <StatusBar />
      </div>
    </div>
  )
}
