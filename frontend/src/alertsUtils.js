// Pure data helpers for the alerts UI — no React, no DOM, so they can be unit
// tested directly and reused by both AlertsFeed and anything else that needs
// to reason about the alert list.

// Groups a flat alert list into { root, children } pairs. An alert is a root
// when groupedWith is null, or when groupedWith points at an id that isn't in
// the given list (e.g. the root was filtered out by status) — in that case
// the child is promoted to root so it doesn't disappear from the feed.
export function groupAlerts(alerts) {
  const byId = new Map(alerts.map((alert) => [alert.id, alert]))
  const childrenByRootId = new Map()
  const roots = []

  for (const alert of alerts) {
    if (alert.groupedWith != null && byId.has(alert.groupedWith)) {
      const siblings = childrenByRootId.get(alert.groupedWith) || []
      siblings.push(alert)
      childrenByRootId.set(alert.groupedWith, siblings)
    } else {
      roots.push(alert)
    }
  }

  return roots.map((root) => ({
    root,
    children: childrenByRootId.get(root.id) || [],
  }))
}

// Filters a flat alert list by resolution status.
export function filterAlertsByStatus(alerts, status) {
  if (status === 'resolved') return alerts.filter((alert) => alert.resolved)
  return alerts.filter((alert) => !alert.resolved)
}
