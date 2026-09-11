export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo-row">
        <i className="ti ti-activity" aria-hidden="true"></i>
        <span>Foresight</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <div className="nav-item active">
          <i className="ti ti-layout-dashboard" aria-hidden="true"></i>
          <span>Dashboard</span>
        </div>
        <div className="nav-item">
          <i className="ti ti-bell" aria-hidden="true"></i>
          <span>Alerts</span>
        </div>
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