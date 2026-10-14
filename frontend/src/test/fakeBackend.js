// Smoke tests: each route renders against a fake backend. The fake mirrors
// the real endpoints that exist today; /api/rules and /api/cost-table 404.
const NOW = Date.now()
const history = (id, name, start, step) => ({
  containerId: id,
  containerName: name,
  count: 10,
  data: Array.from({ length: 10 }, (_, i) => ({
    timestamp: new Date(NOW - (9 - i) * 60000).toISOString(),
    cpuPercent: 20 + i,
    memPercent: start + i * step,
    memUsedMB: 500 + i * 10,
    memLimitMB: 2048,
  })),
})

export const HISTORIES = {
  'demo-api': history('demo-api', 'demo-api', 70, 2),
  'demo-worker': history('demo-worker', 'demo-worker', 40, 0),
}

export const ALERTS = [
  {
    id: 1,
    time: new Date(NOW - 60000).toISOString(),
    containerId: 'demo-api',
    containerName: 'demo-api',
    metric: 'memPercent',
    currentValue: 88,
    predictedBreachMinutes: 4,
    explanation: "demo-api's memPercent has been climbing steadily (currently 88.0%) and is projected to cross 90% in about 4 minutes.",
    costRestartUsd: 0.0007,
    costUpgradeUsd: 30.37,
    groupedWith: null,
    resolved: false,
  },
  {
    id: 2,
    time: new Date(NOW - 30000).toISOString(),
    containerId: 'demo-worker',
    containerName: 'demo-worker',
    metric: 'memPercent',
    currentValue: 80,
    predictedBreachMinutes: 45,
    explanation: "demo-worker's memPercent has been climbing steadily (currently 80.0%) and is projected to cross 90% in about 45 minutes.",
    costRestartUsd: 0.0007,
    costUpgradeUsd: 30.37,
    groupedWith: 1,
    resolved: false,
  },
]

function json(body, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })
}

export function fakeBackend(url, options = {}) {
  const path = String(url).replace(/^https?:\/\/[^/]+/, '')
  if (path === '/health') return json({ status: 'ok' })
  if (path === '/api/stats/containers') return json([{ containerId: 'demo-api', containerName: 'demo-api' }])
  if (path === '/api/alerts') return json(ALERTS)
  const historyMatch = /^\/api\/stats\/([^/]+)\/history/.exec(path)
  if (historyMatch) return json(HISTORIES[decodeURIComponent(historyMatch[1])] ?? { containerId: historyMatch[1], containerName: null, count: 0, data: [] })
  const resolveMatch = /^\/api\/alerts\/(\d+)\/resolve$/.exec(path)
  if (resolveMatch && options.method === 'PATCH') return json({ ...ALERTS[0], resolved: true })
  return json({ error: 'not found' }, 404)
}


