import { Link } from 'react-router-dom'
import { sparklinePath, percentBars } from '../chartGeometry'

export function Icon({ name, className = '' }) {
  return <i className={`ti ti-${name} ${className}`} aria-hidden="true"></i>
}

export function Dot({ tone = 'healthy' }) {
  return <span className={`dot dot-${tone}`} aria-hidden="true"></span>
}

// Visible honesty labels.
export function PrototypeTag({ children = 'Prototype' }) {
  return (
    <span className="tag tag-prototype" title="Not connected to real infrastructure">
      <Icon name="flask" /> {children}
    </span>
  )
}

export function StoredLocallyTag() {
  return (
    <span className="tag tag-local" title="Saved in this browser's localStorage only">
      <Icon name="device-floppy" /> stored locally
    </span>
  )
}

export function Badge({ tone = 'muted', children, icon }) {
  return (
    <span className={`badge badge-${tone}`}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  )
}

export function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="breadcrumb-item">
          {i > 0 && <Icon name="chevron-right" className="breadcrumb-sep" />}
          {item.to ? (
            <Link to={item.to} className={item.accent ? 'accent' : ''}>{item.label}</Link>
          ) : (
            <span className={item.accent ? 'accent' : ''}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

export function PageHeader({ title, subtitle, actions, breadcrumbs }) {
  return (
    <header className="page-header">
      <div>
        {breadcrumbs}
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function Sparkline({ values, tone = 'healthy', width = 160, height = 36, label, minSpan = 2 }) {
  const path = sparklinePath(values, { width, height, minSpan })
  if (!path) return <div className="sparkline sparkline-empty" style={{ height }}>not enough data</div>
  return (
    <svg className={`sparkline sparkline-${tone}`} style={{ height }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <path d={path} />
    </svg>
  )
}

export function MiniBars({ values, tone = 'healthy', width = 200, height = 56, label }) {
  const bars = percentBars(values, { width, height })
  if (bars.length === 0) return <div className="sparkline sparkline-empty" style={{ height }}>no data</div>
  return (
    <svg className={`mini-bars mini-bars-${tone}`} style={{ height }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {bars.map((bar, i) => (
        <rect key={i} x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx="2" />
      ))}
    </svg>
  )
}

export function EmptyState({ icon = 'inbox', title, children }) {
  return (
    <div className="empty-state">
      <Icon name={icon} />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}

export function Toggle({ checked, onChange, label, id }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  )
}
