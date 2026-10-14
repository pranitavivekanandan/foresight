const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// Thrown when the fetch itself fails — i.e. the backend process is not listening.
export class BackendUnreachableError extends Error {
  constructor() {
    super('Backend is unreachable — make sure the server is running on port 5000')
    this.name = 'BackendUnreachableError'
  }
}

// Thrown when the backend responds but returns an error status for a specific container.
export class ContainerFetchError extends Error {
  constructor(containerId, status) {
    super(`Server returned HTTP ${status} for container "${containerId}"`)
    this.name = 'ContainerFetchError'
    this.containerId = containerId
    this.status = status
  }
}

export async function getContainerHistory(containerId, limit = 100) {
  let response

  try {
    response = await fetch(
      `${API_BASE_URL}/api/stats/${encodeURIComponent(containerId)}/history?limit=${limit}`,
      { signal: AbortSignal.timeout(5000) },
    )
  } catch {
    // fetch() throws a TypeError when the server is unreachable (connection refused,
    // DNS failure) or an AbortError when our timeout fires. Either way it means
    // the backend process is not up.
    throw new BackendUnreachableError()
  }

  if (!response.ok) {
    throw new ContainerFetchError(containerId, response.status)
  }

  const body = await response.json()

  // The backend wraps rows in { containerId, containerName, count, data: [...] }.
  // Guard against an unexpected shape so callers get a clear error instead of a
  // silent "no data" card.
  if (!body || !Array.isArray(body.data)) {
    throw new Error(`Unexpected response format for container "${containerId}"`)
  }

  return body
}

export async function getAlerts() {
  let response

  try {
    response = await fetch(`${API_BASE_URL}/api/alerts`, {
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new BackendUnreachableError()
  }

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status} for GET /api/alerts`)
  }

  const body = await response.json()

  if (!Array.isArray(body)) {
    throw new Error('Unexpected response format for alerts')
  }

  return body
}

// GET /api/stats/containers — live Docker containers known to the backend.
export async function getContainers() {
  let response

  try {
    response = await fetch(`${API_BASE_URL}/api/stats/containers`, {
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new BackendUnreachableError()
  }

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status} for GET /api/stats/containers`)
  }

  const body = await response.json()

  if (!Array.isArray(body)) {
    throw new Error('Unexpected response format for containers')
  }

  return body
}

// GET /health, timed. Never throws: the status bar just needs ok + latency.
export async function getHealth() {
  const started = performance.now()
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(5000) })
    const latencyMs = Math.round(performance.now() - started)
    if (!response.ok) return { ok: false, latencyMs }
    const body = await response.json()
    return { ok: body?.status === 'ok', latencyMs }
  } catch {
    return { ok: false, latencyMs: null }
  }
}

// For endpoints the frontend wants but the backend may not have yet
// (/api/rules, /api/cost-table). A 404 resolves to { available: false } so
// the caller can switch to its local fallback; other failures still throw.
async function requestOptional(path, options = {}) {
  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, { signal: AbortSignal.timeout(5000), ...options })
  } catch {
    throw new BackendUnreachableError()
  }

  if (response.status === 404 || response.status === 405 || response.status === 501) {
    return { available: false }
  }

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status} for ${options.method || 'GET'} ${path}`)
  }

  return { available: true, data: await response.json() }
}

export function getRules() {
  return requestOptional('/api/rules')
}

export function createRule(rule) {
  return requestOptional('/api/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  })
}

export function getCostTable() {
  return requestOptional('/api/cost-table')
}

export async function resolveAlert(id) {
  let response

  try {
    response = await fetch(`${API_BASE_URL}/api/alerts/${encodeURIComponent(id)}/resolve`, {
      method: 'PATCH',
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new BackendUnreachableError()
  }

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status} for PATCH /api/alerts/${id}/resolve`)
  }

  return response.json()
}
