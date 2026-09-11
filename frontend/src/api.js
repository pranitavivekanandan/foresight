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
