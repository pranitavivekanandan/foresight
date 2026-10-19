// localStorage wrappers. Storage can be unavailable (private mode, blocked
// site data), so every access is guarded and falls back to the given default.

const PREFIX = 'foresight:'

export function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeJson(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export const STORAGE_KEYS = {
  acknowledged: 'acknowledged-alerts',
  assignees: 'alert-assignees',
  rules: 'rules',
  team: 'team-members',
  integrations: 'integrations',
}
