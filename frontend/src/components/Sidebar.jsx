import { NavLink, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'layout-dashboard', match: (path) => path === '/' || path.startsWith('/services') },
  { to: '/alerts', label: 'Alerts', icon: 'bell-ringing', match: (path) => path.startsWith('/alerts') },
  { to: '/rules', label: 'Rules', icon: 'adjustments-horizontal', match: (path) => path.startsWith('/rules') },
  { to: '/settings', label: 'Settings', icon: 'settings', match: (path) => path.startsWith('/settings') },
]

export default function Sidebar() {
  const { pathname } = useLocation()

  return (
    <aside className="sidebar">
      <div className="logo-block">
        <div className="logo-row">
          <span className="logo-mark"><i className="ti ti-chart-line" aria-hidden="true"></i></span>
          <span>Foresight</span>
        </div>
        <span className="logo-caption">Infrastructure Monitoring</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`nav-item${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <i className={`ti ti-${item.icon}`} aria-hidden="true"></i>
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Static: there is no authentication in this app. */}
      <div className="user-chip" title="Static placeholder — no login in this app">
        <span className="avatar">DO</span>
        <div>
          <strong>Demo Operator</strong>
          <span>SRE Lead</span>
        </div>
      </div>
    </aside>
  )
}
