import { useEffect, useState } from 'react'
import { getContainerHistory, BackendUnreachableError } from './api'
import DashboardCard from './components/DashboardCard'
import Sidebar from './components/Sidebar'
import { predictBreach } from './predict'
import './App.css'

// How often to re-fetch all container histories (milliseconds).
const POLL_INTERVAL_MS = 30_000

// Read the comma-separated container IDs from the environment.
// Set VITE_CONTAINER_IDS in your .env file to match whatever IDs are in the DB.
// Example: VITE_CONTAINER_IDS=my-api,my-worker
const containerIds = (import.meta.env.VITE_CONTAINER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)

// Fetch all containers in parallel. Returns one result object per ID regardless
// of success or failure — callers decide how to render each.
async function fetchAllContainers() {
  const settled = await Promise.allSettled(
    containerIds.map((id) => getContainerHistory(id)),
  )

  return containerIds.map((id, index) => {
    const result = settled[index]
    if (result.status === 'fulfilled') {
      const history = result.value
      return {
        id,
        history,
        // Linear regression over the history to predict when memory / CPU will
        // breach the threshold. See predict.js for the math.
        prediction: predictBreach(history.data),
        cpuPrediction: predictBreach(history.data, 'cpuPercent', 80),
        error: null,
      }
    }
    return { id, history: null, prediction: null, cpuPrediction: null, error: result.reason }
  })
}

function App() {
  // null = first load not yet complete; array = data (may include per-item errors).
  const [containers, setContainers] = useState(null)
  // True when at least one fetch failed because the backend wasn't reachable at all.
  const [backendUnreachable, setBackendUnreachable] = useState(false)

  useEffect(() => {
    if (containerIds.length === 0) {
      // Nothing to fetch; show the config hint immediately.
      setContainers([])
      return
    }

    async function load() {
      const results = await fetchAllContainers()
      const anyUnreachable = results.some((r) => r.error instanceof BackendUnreachableError)
      setBackendUnreachable(anyUnreachable)
      setContainers(results)
    }

    load()

    // Keep cards fresh without requiring a manual page reload.
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const activeCount =
    containers?.filter((c) => Array.isArray(c.history?.data) && c.history.data.length > 0)
      .length ?? 0

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1>Infrastructure overview</h1>
            <p>Real-time status of your containers</p>
          </div>
          <span className="service-pill">
            {activeCount} active service{activeCount === 1 ? '' : 's'}
          </span>
        </header>

        {/* Show a single banner when the backend process itself is down, so the
            user knows this is a connectivity problem, not a data problem. */}
        {backendUnreachable && (
          <p className="load-error">
            Backend is unreachable — make sure the server is running on port 5000
            and that the Vite proxy is configured correctly.
          </p>
        )}

        <section className="cards-grid" aria-label="Container status">
          {containers === null && (
            <p className="loading-state">Loading container history…</p>
          )}

          {containers !== null && containerIds.length === 0 && (
            <p className="load-error">
              No containers configured. Add{' '}
              <code>VITE_CONTAINER_IDS=your-container-id</code> to your{' '}
              <code>.env</code> file and restart the dev server.
            </p>
          )}

          {containers !== null &&
            containers.map(({ id, history, prediction, cpuPrediction, error }) => {
              // Per-card error: render an inline error card instead of nothing,
              // so the user can see which container failed and why.
              if (error) {
                return (
                  <div key={id} className="card">
                    <div className="card-heading">
                      <h2>{id}</h2>
                    </div>
                    <p className="load-error">
                      {error instanceof BackendUnreachableError
                        ? 'Backend unreachable'
                        : error.message}
                    </p>
                  </div>
                )
              }

              return (
                <DashboardCard
                  key={id}
                  containerName={history.containerName || history.containerId}
                  history={history}
                  prediction={prediction}
                  cpuPrediction={cpuPrediction}
                />
              )
            })}
        </section>
      </main>
    </div>
  )
}

export default App
