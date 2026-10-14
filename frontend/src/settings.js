// Data helpers for the Organization Settings screen. Team members and
// integrations are prototype data kept in localStorage; nothing here talks
// to real infrastructure.

export const ROLES = ['Owner', 'Admin', 'Operator']

// Sample rows so the prototype table is not empty. Flagged `sample` so the
// UI can label them as example data, not real accounts.
export const SAMPLE_TEAM = [
  { id: 'sample-1', name: 'Alex Sterling', email: 'alex.s@example.com', role: 'Owner', lastActive: 'Sample data', sample: true },
  { id: 'sample-2', name: 'Jordan Miller', email: 'j.miller@example.com', role: 'Admin', lastActive: 'Sample data', sample: true },
  { id: 'sample-3', name: 'Riley Thorne', email: 'r.thorne@example.com', role: 'Operator', lastActive: 'Sample data', sample: true },
]

export const INTEGRATION_TYPES = {
  slack: { label: 'Slack', icon: 'brand-slack', description: 'Push alerts to your channels.', placeholder: 'https://hooks.slack.com/services/…' },
  pagerduty: { label: 'PagerDuty', icon: 'bell-ringing', description: 'Page the on-call engineer.', placeholder: 'PagerDuty integration key' },
  discord: { label: 'Discord', icon: 'brand-discord', description: 'Post alerts to a Discord channel.', placeholder: 'https://discord.com/api/webhooks/…' },
  datadog: { label: 'Datadog', icon: 'dog', description: 'Forward events to Datadog.', placeholder: 'Datadog API key' },
}

export const DEFAULT_INTEGRATIONS = [{ id: 'slack-1', type: 'slack', target: '' }]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateMember({ name, email, role }, existing = []) {
  const errors = {}
  if (!String(name || '').trim()) errors.name = 'Enter a name.'
  if (!EMAIL_PATTERN.test(String(email || '').trim())) errors.email = 'Enter a valid email.'
  else if (existing.some((m) => m.email.toLowerCase() === email.trim().toLowerCase())) errors.email = 'That email is already on the team.'
  if (!ROLES.includes(role)) errors.role = 'Choose a role.'
  return errors
}

export function addMember(list, { name, email, role }, id = `member-${Date.now()}`) {
  return [...list, { id, name: name.trim(), email: email.trim(), role, lastActive: 'Invited', sample: false }]
}

export function updateMemberRole(list, id, role) {
  return list.map((m) => (m.id === id ? { ...m, role } : m))
}

export function removeById(list, id) {
  return list.filter((item) => item.id !== id)
}

export function addIntegration(list, type, id = `${type}-${Date.now()}`) {
  return [...list, { id, type, target: '' }]
}

export function updateIntegrationTarget(list, id, target) {
  return list.map((item) => (item.id === id ? { ...item, target } : item))
}

// Fallback for the Cost Table tab when GET /api/cost-table does not exist:
// the most recent alert that carries cost estimates.
export function costsFromAlerts(alerts) {
  const withCosts = (alerts || [])
    .filter((a) => a.costRestartUsd != null || a.costUpgradeUsd != null)
    .sort((a, b) => new Date(b.time) - new Date(a.time))
  const latest = withCosts[0]
  if (!latest) return null
  return {
    alertId: latest.id,
    time: latest.time,
    costRestartUsd: latest.costRestartUsd,
    costUpgradeUsd: latest.costUpgradeUsd,
  }
}

// Flattens an unknown JSON payload from /api/cost-table into label/value
// rows so whatever the backend returns can be shown without assumptions.
export function flattenForTable(value, prefix = '') {
  if (value === null || typeof value !== 'object') return [{ key: prefix || 'value', value }]
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value)
  if (entries.length === 0) return [{ key: prefix || 'value', value: Array.isArray(value) ? '[]' : '{}' }]
  return entries.flatMap(([k, v]) => flattenForTable(v, prefix ? `${prefix}.${k}` : k))
}
