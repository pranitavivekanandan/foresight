import { useEffect, useState } from 'react'
import { NavLink, useOutletContext, useParams } from 'react-router-dom'
import { Badge, Dot, EmptyState, Icon, PageHeader, PrototypeTag, StoredLocallyTag } from '../components/ui'
import { useData, useToast } from '../context/contexts'
import { getCostTable, BackendUnreachableError } from '../api'
import { systemStatus } from '../containers'
import { readJson, writeJson, STORAGE_KEYS } from '../storage'
import {
  ROLES,
  SAMPLE_TEAM,
  INTEGRATION_TYPES,
  DEFAULT_INTEGRATIONS,
  validateMember,
  addMember,
  updateMemberRole,
  removeById,
  addIntegration,
  updateIntegrationTarget,
  costsFromAlerts,
  flattenForTable,
} from '../settings'
import { formatUsd, initials } from '../format'
import { alertCode } from '../alertsUtils'
import { COST_RESTART_UNIT, COST_UPGRADE_UNIT } from '../constants'
import './SettingsPage.css'

const TABS = [
  { id: 'team', label: 'Team', icon: 'users' },
  { id: 'integrations', label: 'Integrations', icon: 'plug-connected' },
  { id: 'cost', label: 'Cost Table', icon: 'receipt' },
  { id: 'security', label: 'Security', icon: 'shield-lock' },
]

function usePersistentList(key, fallback) {
  const [list, setList] = useState(() => readJson(key, fallback))
  const update = (next) => {
    setList(next)
    writeJson(key, next)
  }
  return [list, update]
}

function TeamSection({ query }) {
  const [members, setMembers] = usePersistentList(STORAGE_KEYS.team, SAMPLE_TEAM)
  const [inviting, setInviting] = useState(false)
  const [draft, setDraft] = useState({ name: '', email: '', role: 'Operator' })
  const [errors, setErrors] = useState({})
  const [menuFor, setMenuFor] = useState(null)

  const q = query.trim().toLowerCase()
  const visible = members.filter((m) => !q || `${m.name} ${m.email} ${m.role}`.toLowerCase().includes(q))

  function submit(e) {
    e.preventDefault()
    const found = validateMember(draft, members)
    setErrors(found)
    if (Object.keys(found).length) return
    setMembers(addMember(members, draft))
    setDraft({ name: '', email: '', role: 'Operator' })
    setInviting(false)
  }

  return (
    <section className="card">
      <div className="card-title-row">
        <div>
          <h2>Team Members <PrototypeTag /> <StoredLocallyTag /></h2>
          <p>Control access and permissions for your team. No accounts or invitations are sent — this table lives in your browser.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setInviting((v) => !v)}>
          <Icon name="user-plus" /> Invite member
        </button>
      </div>

      {inviting && (
        <form className="invite-form" onSubmit={submit} noValidate>
          <label className="field-label">
            <span className="eyebrow">Name</span>
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="Member name" />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>
          <label className="field-label">
            <span className="eyebrow">Email</span>
            <input className="input" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} aria-label="Member email" />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </label>
          <label className="field-label">
            <span className="eyebrow">Role</span>
            <select className="select" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} aria-label="Member role">
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <div className="invite-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setInviting(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add to table</button>
          </div>
        </form>
      )}

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Last active</th>
              <th aria-label="Row menu" />
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <tr key={m.id}>
                <td>
                  <span className="member-name">
                    <span className="avatar small">{initials(m.name)}</span>
                    <strong>{m.name}</strong>
                    {m.sample && <span className="tag tag-plain">Sample</span>}
                  </span>
                </td>
                <td className="muted">{m.email}</td>
                <td>
                  <select className="select compact" value={m.role} aria-label={`Role for ${m.name}`} onChange={(e) => setMembers(updateMemberRole(members, m.id, e.target.value))}>
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td className="muted">{m.lastActive}</td>
                <td className="row-menu-cell">
                  <button type="button" className="icon-button small" aria-label={`Menu for ${m.name}`} onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}>
                    <Icon name="dots-vertical" />
                  </button>
                  {menuFor === m.id && (
                    <div className="row-menu card">
                      <button type="button" onClick={() => { setMembers(removeById(members, m.id)); setMenuFor(null) }}>
                        <Icon name="trash" /> Remove from table
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={5} className="muted">No team members match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function IntegrationsSection() {
  const toast = useToast()
  const [integrations, setIntegrations] = usePersistentList(STORAGE_KEYS.integrations, DEFAULT_INTEGRATIONS)
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <section>
      <div className="section-title">
        <h2>Active Integrations</h2>
        <PrototypeTag>Prototype · not connected</PrototypeTag>
        <StoredLocallyTag />
      </div>
      <div className="integrations-grid">
        {integrations.map((item) => {
          const type = INTEGRATION_TYPES[item.type]
          return (
            <div key={item.id} className="card card-pad integration-card">
              <div className="integration-head">
                <span className={`integration-logo logo-${item.type}`}><Icon name={type.icon} /></span>
                <div>
                  <strong>{type.label}</strong>
                  <span className="muted small">{type.description}</span>
                </div>
                <Badge tone="healthy">
                  <Dot tone="healthy" /> Connected
                </Badge>
              </div>
              <p className="muted small simulated-note">“Connected” is a prototype state — no messages are sent.</p>
              <label className="field-label">
                <span className="eyebrow">Webhook URL</span>
                <input
                  className="input mono"
                  value={item.target}
                  placeholder={type.placeholder}
                  onChange={(e) => setIntegrations(updateIntegrationTarget(integrations, item.id, e.target.value))}
                  aria-label={`${type.label} webhook URL`}
                />
              </label>
              <div className="integration-actions">
                <button type="button" className="btn btn-block" onClick={() => toast.simulated(`Test ${type.label} connection`)}>
                  Test connection
                </button>
                <button type="button" className="icon-button" aria-label={`Remove ${type.label}`} onClick={() => setIntegrations(removeById(integrations, item.id))}>
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          )
        })}

        <button type="button" className="card add-integration" onClick={() => setModalOpen(true)}>
          <span className="add-icon"><Icon name="plus" /></span>
          <strong>Add New Integration</strong>
          <span className="muted small">PagerDuty, Discord, Datadog…</span>
        </button>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add integration" onClick={() => setModalOpen(false)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              Add integration
              <button type="button" className="icon-button small" aria-label="Close" onClick={() => setModalOpen(false)}><Icon name="x" /></button>
            </h3>
            <div className="modal-options">
              {['pagerduty', 'discord', 'datadog'].map((key) => (
                <button
                  key={key}
                  type="button"
                  className="modal-option"
                  onClick={() => {
                    setIntegrations(addIntegration(integrations, key))
                    setModalOpen(false)
                    toast.show(`${INTEGRATION_TYPES[key].label} card added (prototype, stored locally)`)
                  }}
                >
                  <span className={`integration-logo logo-${key}`}><Icon name={INTEGRATION_TYPES[key].icon} /></span>
                  <span>
                    <strong>{INTEGRATION_TYPES[key].label}</strong>
                    <span className="muted small"> — {INTEGRATION_TYPES[key].description}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="muted small" style={{ marginTop: 12 }}>Prototype: adds a card only. Nothing is connected.</p>
          </div>
        </div>
      )}
    </section>
  )
}

function CostTableSection() {
  const { alerts } = useData()
  const [result, setResult] = useState({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    getCostTable()
      .then((res) => !cancelled && setResult(res.available ? { status: 'ok', data: res.data } : { status: 'missing' }))
      .catch((err) => !cancelled && setResult({ status: 'error', message: err instanceof BackendUnreachableError ? err.message : err.message }))
    return () => {
      cancelled = true
    }
  }, [])

  const fromAlerts = costsFromAlerts(alerts)

  return (
    <section className="card">
      <div className="card-title-row">
        <div>
          <h2>Cost Table</h2>
          <p>Cost estimates the backend attaches to alerts. These are estimates from public on-demand pricing, not billing data.</p>
        </div>
      </div>
      <div className="card-pad cost-body">
        {result.status === 'loading' && <p className="loading-state">Checking GET /api/cost-table…</p>}

        {result.status === 'ok' && (
          <table className="data-table">
            <thead><tr><th>Field</th><th>Value</th></tr></thead>
            <tbody>
              {flattenForTable(result.data).map((row) => (
                <tr key={row.key}><td className="mono">{row.key}</td><td className="mono">{String(row.value)}</td></tr>
              ))}
            </tbody>
          </table>
        )}

        {(result.status === 'missing' || result.status === 'error') && (
          <>
            <p className="info-note">
              <Icon name="info-circle" />{' '}
              {result.status === 'missing'
                ? 'Endpoint not available: GET /api/cost-table returned 404 on this backend.'
                : `Could not reach GET /api/cost-table (${result.message}).`}{' '}
              Showing the cost fields from the most recent alert instead.
            </p>
            {fromAlerts ? (
              <table className="data-table">
                <thead><tr><th>Option</th><th>Estimate</th><th>Unit</th><th>Source</th></tr></thead>
                <tbody>
                  <tr>
                    <td><strong>Restart service</strong><br /><span className="muted small">alerts.cost_restart_usd</span></td>
                    <td className="mono">{formatUsd(fromAlerts.costRestartUsd)}</td>
                    {/* TODO(cost-unit): confirm and set COST_RESTART_UNIT in constants.js */}
                    <td className="muted">{COST_RESTART_UNIT ?? 'USD · unit unconfirmed'}</td>
                    <td className="muted">{alertCode(fromAlerts.alertId)} · {new Date(fromAlerts.time).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td><strong>Upgrade instance</strong><br /><span className="muted small">alerts.cost_upgrade_usd</span></td>
                    <td className="mono">{formatUsd(fromAlerts.costUpgradeUsd)}</td>
                    {/* TODO(cost-unit): confirm and set COST_UPGRADE_UNIT in constants.js */}
                    <td className="muted">{COST_UPGRADE_UNIT ?? 'USD · unit unconfirmed'}</td>
                    <td className="muted">{alertCode(fromAlerts.alertId)} · {new Date(fromAlerts.time).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <EmptyState icon="receipt-off" title="No cost data yet">No alert with cost estimates has been recorded.</EmptyState>
            )}
            <p className="muted small cost-explainer">
              How the backend computes these (backend/services/costService.js defaults, overridable by COST_* environment variables):
              restart = on-demand hourly price of the restart tier (t3.medium, us-east-1) × 1/60; upgrade = (t3.large − t3.medium hourly price) × 730 h.
              Prices come from a live pricing fetch or its cached seed file.
            </p>
          </>
        )}
      </div>
    </section>
  )
}

function SecuritySection() {
  return (
    <section className="card">
      <EmptyState icon="shield-lock" title="Security settings — planned feature">
        SSO, API keys and audit logs are not implemented yet.
      </EmptyState>
    </section>
  )
}

export default function SettingsPage() {
  const { tab = 'team' } = useParams()
  const { query } = useOutletContext() ?? { query: '' }
  const { health, summaries } = useData()
  const reporting = summaries.filter((s) => s.reporting).length
  const status = systemStatus({ healthOk: health?.ok ?? null, reporting, total: summaries.length })

  return (
    <>
      <PageHeader title="Organization Settings" subtitle="Manage your team workspace, service integrations, and resource allocation." />
      <div className="settings-layout">
        <nav className="settings-tabs" aria-label="Settings sections">
          {TABS.map((t) => (
            <NavLink key={t.id} to={`/settings/${t.id}`} className={() => `settings-tab${tab === t.id ? ' active' : ''}${t.id === 'security' ? ' separated' : ''}`}>
              <Icon name={t.icon} /> {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="settings-content">
          {tab === 'team' && (
            <>
              <TeamSection query={query} />
              <IntegrationsSection />
            </>
          )}
          {tab === 'integrations' && <IntegrationsSection />}
          {tab === 'cost' && <CostTableSection />}
          {tab === 'security' && <SecuritySection />}

          <div className="card settings-status">
            <span className="status-dots" aria-hidden="true"><Dot tone={status.tone} /><Dot tone="info" /></span>
            <span>{status.text}</span>
            <span className="eyebrow latency">
              Latency: <span className="mono accent">{health?.latencyMs != null ? `${health.latencyMs}ms` : 'n/a'}</span>
              <span className="muted"> (GET /health)</span>
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
