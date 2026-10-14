export default function Sidebar({ view, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="logo-row">
        <i className="ti ti-activity" aria-hidden="true"></i>
        <span>Foresight</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <button
          type="button"
          className={`nav-item${view === 'dashboard' ? ' active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <i className="ti ti-layout-dashboard" aria-hidden="true"></i>
          <span>Dashboard</span>
        </button>
        <button
          type="button"
          className={`nav-item${view === 'alerts' ? ' active' : ''}`}
          onClick={() => onNavigate('alerts')}
        >
          <i className="ti ti-bell" aria-hidden="true"></i>
          <span>Alerts</span>
        </button>
        <div className="nav-item">
          <i className="ti ti-adjustments" aria-hidden="true"></i>
          <span>Rules</span>
        </div>
        <div className="nav-item">
          <i className="ti ti-settings" aria-hidden="true"></i>
          <span>Settings</span>
        </div>
      </nav>
    </aside>
  )
}