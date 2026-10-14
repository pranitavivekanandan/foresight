import { useEffect, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { Badge, Dot, Icon, PageHeader, PrototypeTag, StoredLocallyTag, Toggle } from '../components/ui'
import { useData, useRules, useToast } from '../context/contexts'
import {
  RULE_METRICS,
  OPERATORS,
  emptyDraft,
  validateRuleDraft,
  draftToRule,
  evaluateRuleStatus,
  formatThreshold,
  scopeLabel,
  ruleSummary,
  datapointsPerHour,
  previewPredictions,
  rulesToJson,
} from '../rules'
import { downloadText, timestampForFilename } from '../download'
import { formatDuration, formatPercent } from '../format'
import { BACKEND_SAMPLE_INTERVAL_MS } from '../constants'
import './RulesPage.css'

const STATUS_DISPLAY = {
  monitoring: { tone: 'healthy', label: 'Monitoring' },
  triggered: { tone: 'critical', label: 'Triggered' },
  predicted: { tone: 'warning', label: 'Breach predicted' },
  'no-data': { tone: 'muted', label: 'No data' },
}

export default function RulesPage() {
  const { query } = useOutletContext() ?? { query: '' }
  const [searchParams, setSearchParams] = useSearchParams()
  const { rules, source, saveRule, removeRule } = useRules()
  const { histories, summaries } = useData()
  const toast = useToast()
  const [draft, setDraft] = useState(emptyDraft)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const formRef = useRef(null)
  const firstFieldRef = useRef(null)

  const historyData = Object.fromEntries(Object.entries(histories).map(([id, h]) => [id, h?.data ?? []]))
  const containers = summaries.map((s) => ({ containerId: s.containerId, containerName: s.containerName }))
  const q = query.trim().toLowerCase()
  const visibleRules = rules.filter(
    (r) => !q || `${r.metric} ${RULE_METRICS[r.metric]?.label} ${scopeLabel(r.scope, containers)} ${r.escalation}`.toLowerCase().includes(q),
  )
  const scopeCount = draft.scope === 'all' ? containers.length : 1
  const scopeName = scopeLabel(draft.scope, containers)
  const preview = draft.predictive ? previewPredictions(draft, historyData, containers) : []

  function focusForm() {
    formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    firstFieldRef.current?.focus()
  }

  // /rules?create=1 (from the dashboard's + button) focuses the form once.
  useEffect(() => {
    if (searchParams.get('create')) {
      focusForm()
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  function update(field) {
    return (e) => setDraft({ ...draft, [field]: e.target.value })
  }

  async function submit(e) {
    e.preventDefault()
    const found = validateRuleDraft(draft)
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    const where = await saveRule(draftToRule(draft))
    setSaving(false)
    setDraft(emptyDraft())
    toast.show(where === 'remote' ? 'Rule saved to the backend' : 'Rule saved (stored locally — /api/rules not available)')
  }

  return (
    <>
      <PageHeader
        title="Alert Rule Configuration"
        subtitle="Configure threshold-based and predictive alerting logic for your infrastructure."
        actions={
          <>
            <button type="button" className="btn" onClick={() => downloadText(rulesToJson(rules), `foresight-rules-${timestampForFilename()}.json`, 'application/json')}>
              <Icon name="file-export" /> Export Config
            </button>
            <button type="button" className="btn btn-primary" onClick={focusForm}>
              <Icon name="plus" /> Create New Rule
            </button>
          </>
        }
      />

      <p className="info-note backend-note">
        <Icon name="info-circle" />{' '}
        {source === 'remote'
          ? 'Rules are loaded from GET /api/rules.'
          : 'These rules drive the dashboard and prediction displays in this browser. The backend alert evaluator is still configured by environment variables (ALERT_METRIC=memPercent, ALERT_THRESHOLD default 90) because /api/rules does not exist yet.'}
      </p>

      <section className="card rules-table-card">
        <div className="card-title-row">
          <h2>
            Active Alerting Rules {source === 'local' ? <StoredLocallyTag /> : <Badge tone="info">from /api/rules</Badge>}
          </h2>
          <span className="tag tag-green">{rules.length} total rules</span>
        </div>
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Scope</th>
                <th>Threshold</th>
                <th>Escalation</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visibleRules.map((rule) => {
                const status = STATUS_DISPLAY[evaluateRuleStatus(rule, historyData)]
                const metric = RULE_METRICS[rule.metric]
                return (
                  <tr key={rule.id}>
                    <td>
                      <span className="rule-metric">
                        <Icon name={metric?.icon ?? 'chart-line'} className="accent" />
                        <strong className="mono">{rule.metric}</strong>
                        {rule.predictive && <span className="tag tag-plain" title="Uses predict.js trend forecasting">Predictive</span>}
                      </span>
                    </td>
                    <td className="muted">{scopeLabel(rule.scope, containers)}</td>
                    <td className="mono strong">{formatThreshold(rule)}</td>
                    <td className="muted">{rule.escalation}</td>
                    <td>
                      <span className={`rule-status text-${status.tone}`}><Dot tone={status.tone} /> {status.label}</span>
                    </td>
                    <td>
                      {source === 'local' && !String(rule.id).startsWith('default-') && (
                        <button type="button" className="icon-button small" aria-label={`Delete rule ${rule.metric} ${formatThreshold(rule)}`} onClick={() => removeRule(rule.id)}>
                          <Icon name="trash" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {visibleRules.length === 0 && (
                <tr><td colSpan={6} className="muted">No rules match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rules-layout">
        <form className="card create-rule" ref={formRef} onSubmit={submit} noValidate>
          <div className="card-title-row">
            <h2><Icon name="bell-plus" className="accent" /> Create New Rule</h2>
            <span className="tag tag-plain">Draft</span>
          </div>
          <div className="card-pad create-rule-body">
            <div className="form-row">
              <label className="field-label">
                <span className="eyebrow">Select metric</span>
                <select ref={firstFieldRef} className="select" value={draft.metric} onChange={update('metric')} aria-label="Select metric">
                  {Object.entries(RULE_METRICS).map(([key, m]) => (
                    <option key={key} value={key}>{m.label}</option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                <span className="eyebrow">Service scope</span>
                <select className="select" value={draft.scope} onChange={update('scope')} aria-label="Service scope">
                  <option value="all">All containers</option>
                  {containers.map((c) => (
                    <option key={c.containerId} value={c.containerId}>{c.containerName}</option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <span className="eyebrow">Condition &amp; threshold</span>
              <div className="condition-row">
                <span>If metric is</span>
                <select className="select" value={draft.operator} onChange={update('operator')} aria-label="Condition">
                  {Object.entries(OPERATORS).map(([key, op]) => (
                    <option key={key} value={key}>{op.label}</option>
                  ))}
                </select>
                <span className="input-suffix">
                  <input className="input" type="number" min="0" max="100" step="1" value={draft.value} onChange={update('value')} placeholder="0" aria-label="Threshold value" />
                  <span>%</span>
                </span>
                <span>for a duration of</span>
                <span className="input-suffix">
                  <input className="input" type="number" min="0" max="1440" step="1" value={draft.durationMin} onChange={update('durationMin')} aria-label="Duration in minutes" />
                  <span>min</span>
                </span>
              </div>
              {Object.values(errors).map((msg) => (
                <p key={msg} className="field-error">{msg}</p>
              ))}
            </div>

            <div className="predictive-box">
              <span className="predictive-icon"><Icon name="chart-arrows-vertical" /></span>
              <div>
                <strong>Enable predictive alerting</strong>
                <p className="muted small">Uses trend forecasting (linear regression in predict.js) to warn before the threshold is crossed.</p>
              </div>
              <Toggle checked={draft.predictive} onChange={(value) => setDraft({ ...draft, predictive: value })} label="Enable predictive alerting" />
            </div>

            {draft.predictive && (
              <div className="predictive-preview">
                <span className="eyebrow">Live preview from current history</span>
                {draft.operator !== 'gt' ? (
                  <p className="muted small">Predictive alerting applies to “greater than” rules.</p>
                ) : preview.length === 0 ? (
                  <p className="muted small">{draft.value === '' ? 'Enter a threshold to preview.' : 'No in-scope container has history yet.'}</p>
                ) : (
                  <ul>
                    {preview.map((p) => (
                      <li key={p.containerId}>
                        <Dot tone={p.willBreach ? 'warning' : 'healthy'} /> <strong>{p.containerName}</strong>{' '}
                        <span className="muted">
                          {!p.hasEnoughData
                            ? 'not enough data'
                            : p.willBreach
                              ? `now ${formatPercent(p.currentValue)} → projected to cross ${draft.value}% in ~${formatDuration(p.minutesToBreach)}`
                              : `now ${formatPercent(p.currentValue)} → no breach projected`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { setDraft(emptyDraft()); setErrors({}) }}>Discard</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save & Activate Rule'}</button>
            </div>
          </div>
        </form>

        <aside className="rules-side">
          <section className="card escalation-card">
            <div className="card-title-row">
              <h2><Icon name="git-fork" className="text-info" /> Escalation Policy</h2>
              <PrototypeTag>Prototype, not connected</PrototypeTag>
            </div>
            <div className="card-pad">
              <ol className="timeline">
                <li>
                  <span className="timeline-dot healthy" />
                  <div className="timeline-card">
                    <div className="timeline-head"><span className="accent">Step 1</span><span className="eyebrow">Immediate</span></div>
                    <p>Notify On-Call via Slack channel #ops-alerts</p>
                    <div className="timeline-tags"><span className="tag tag-plain"><Icon name="brand-slack" /> Slack</span><span className="tag tag-plain"><Icon name="mail" /> Email</span></div>
                  </div>
                </li>
                <li>
                  <span className="timeline-dot info" />
                  <div className="timeline-card">
                    <div className="timeline-head"><span className="text-info">Step 2</span><span className="eyebrow">After 15 mins</span></div>
                    <p>If unacknowledged, escalate to Engineering Team Lead</p>
                  </div>
                </li>
              </ol>
              <button type="button" className="btn btn-block add-tier" onClick={() => toast.simulated('Add Escalation Tier')}>
                <Icon name="circle-plus" /> Add Escalation Tier
              </button>
            </div>
          </section>

          <section className="card card-pad rule-summary">
            <span className="eyebrow">Rule summary</span>
            <p><Icon name="info-circle" className="accent" /><span>{ruleSummary(draft, scopeName)}</span></p>
            <p>
              <Icon name="database" className="accent" />
              <span>
                It would analyse about <strong className="mono">{datapointsPerHour(scopeCount, BACKEND_SAMPLE_INTERVAL_MS).toLocaleString()}</strong> datapoints
                per hour ({scopeCount} container{scopeCount === 1 ? '' : 's'} × {Math.round(3600_000 / BACKEND_SAMPLE_INTERVAL_MS)} readings/h at the
                backend&apos;s {BACKEND_SAMPLE_INTERVAL_MS / 1000}s sampling).
              </span>
            </p>
            {draft.predictive && (
              <p><Icon name="trending-up" className="accent" /><span>Predictive: warns when the fitted trend reaches the threshold within 24 h.</span></p>
            )}
          </section>
        </aside>
      </div>
    </>
  )
}
