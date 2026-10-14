import { useEffect, useState } from 'react'
import { getContainerHistory, getAlerts, resolveAlert, BackendUnreachableError } from './api'
import DashboardCard from './components/DashboardCard'
import Sidebar from './components/Sidebar'
import AlertsFeed from './components/AlertsFeed'
import AlertDetail from './components/AlertDetail'
import { predictBreach } from './predict'
import { MEM_THRESHOLD_PERCENT, CPU_THRESHOLD_PERCENT, POLL_INTERVAL_MS } from './constants'
import './App.css'

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
        prediction: predictBreach(history.data, 'memPercent', MEM_THRESHOLD_PERCENT),
        cpuPrediction: predictBreach(history.data, 'cpuPercent', CPU_THRESHOLD_PERCENT),
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

  // 'dashboard' | 'alerts' — which page the sidebar is showing. No router: this
  // app has exactly two pages and plain state is simpler than pulling one in.
  const [view, setView] = useState('dashboard')

  // null = first load not yet complete; array = alert rows from the backend.
  const [alerts, setAlerts] = useState(null)
  const [alertsUnreachable, setAlertsUnreachable] = useState(false)
  // Set when a row in AlertsFeed is clicked; drives the AlertsFeed <-> AlertDetail switch.
  const [selectedAlertId, setSelectedAlertId] = useState(null)
  const [detailResolving, setDetailResolving] = useState(false)
  const [alertActionError, setAlertActionError] = useState(null)

  async function loadAlerts() {
    try {
      const data = await getAlerts()
      setAlerts(data)
      setAlertsUnreachable(false)
    } catch (err) {
      setAlertsUnreachable(err instanceof BackendUnreachableError)
      setAlerts((prev) => prev ?? [])
    }
  }

  useEffect(() => {
    loadAlerts()
    // Keep the alerts list (and the dashboard badges derived from it) fresh
    // on the same cadence as the container history poll below.
    const interval = setInterval(loadAlerts, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  async function handleResolveFromDetail(id) {
    setAlertActionError(null)
    setDetailResolving(true)
    try {
      await resolveAlert(id)
      await loadAlerts()
    } catch (err) {
      setAlertActionError(`Failed to resolve alert: ${err.message}`)
    } finally {
      setDetailResolving(false)
    }
  }

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

  const selectedAlert = alerts?.find((a) => a.id === selectedAlertId) ?? null

  function handleNavigate(nextView) {
    setView(nextView)
    setSelectedAlertId(null)
  }

  return (
    <div className="app-shell">
      <Sidebar view={view} onNavigate={handleNavigate} />
      <main className="main-content">
        {view === 'dashboard' && (
          <>
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

                  const hasActiveAlert = Boolean(
                    alerts?.some((a) => a.containerId === history.containerId && !a.resolved),
                  )

                  return (
                    <DashboardCard
                      key={id}
                      containerName={history.containerName || history.containerId}
                      history={history}
                      prediction={prediction}
                      cpuPrediction={cpuPrediction}
                      hasActiveAlert={hasActiveAlert}
                    />
                  )
                })}
            </section>
          </>
        )}

        {view === 'alerts' && (
          <>
            <header className="page-header">
              <div>
                <h1>Alerts</h1>
                <p>Predicted breaches and ongoing incidents</p>
              </div>
            </header>

            {alertsUnreachable && (
              <p className="load-error">
                Backend is unreachable — make sure the server is running on port 5000
                and that the Vite proxy is configured correctly.
              </p>
            )}

            {alerts === null && <p className="loading-state">Loading alerts…</p>}

            {alerts !== null && selectedAlert && (
              <>
                {alertActionError && <p className="load-error">{alertActionError}</p>}
                <AlertDetail
                  alert={selectedAlert}
                  onBack={() => setSelectedAlertId(null)}
                  onResolve={handleResolveFromDetail}
                  resolving={detailResolving}
                />
              </>
            )}

            {alerts !== null && !selectedAlert && (
              <AlertsFeed
                alerts={alerts}
                onSelectAlert={(alert) => setSelectedAlertId(alert.id)}
                onAlertsChanged={loadAlerts}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
