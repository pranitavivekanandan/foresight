import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAlerts, getContainers, getContainerHistory, getHealth, BackendUnreachableError } from '../api'
import { mergeContainerSources, parseEnvContainerIds, summarizeContainer } from '../containers'
import { readJson, writeJson, STORAGE_KEYS } from '../storage'
import { DASHBOARD_HISTORY_LIMIT, POLL_INTERVAL_MS } from '../constants'
import { DataContext, useRules } from './contexts'

const ENV_CONTAINER_IDS = parseEnvContainerIds(import.meta.env.VITE_CONTAINER_IDS)

// One poll loop for the whole app: health, container discovery, alerts and
// recent history for every known container. Screens read from here instead
// of each running their own timers.
export function DataProvider({ children }) {
  const { rules } = useRules()
  const [health, setHealth] = useState(null)
  const [containers, setContainers] = useState([])
  const [discoverySource, setDiscoverySource] = useState(null)
  const [histories, setHistories] = useState({})
  const [alerts, setAlerts] = useState(null)
  const [alertsError, setAlertsError] = useState(null)
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [acknowledgedIds, setAcknowledgedIds] = useState(() => readJson(STORAGE_KEYS.acknowledged, []))

  const loadAlerts = useCallback(async () => {
    try {
      const data = await getAlerts()
      setAlerts(data)
      setAlertsError(null)
      return data
    } catch (err) {
      setAlertsError(err instanceof BackendUnreachableError ? 'Backend unreachable' : err.message)
      setAlerts((prev) => prev ?? [])
      return null
    }
  }, [])

  const refresh = useCallback(async () => {
    const [healthResult, discovered, alertData] = await Promise.all([
      getHealth(),
      getContainers().catch(() => null),
      loadAlerts(),
    ])
    setHealth(healthResult)

    const list = mergeContainerSources({ discovered, envIds: ENV_CONTAINER_IDS, alerts: alertData ?? [] })
    setDiscoverySource(Array.isArray(discovered) ? 'api' : 'env')

    const settled = await Promise.allSettled(
      list.map((c) => getContainerHistory(c.containerId, DASHBOARD_HISTORY_LIMIT)),
    )
    const next = {}
    list.forEach((c, i) => {
      next[c.containerId] =
        settled[i].status === 'fulfilled' ? settled[i].value : { containerId: c.containerId, data: [], error: settled[i].reason }
    })
    setContainers(list)
    setHistories(next)
    setLastRefreshed(new Date())
    setLoaded(true)
  }, [loadAlerts])

  useEffect(() => {
    // Initial load plus polling; state is only set once each request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  const toggleAcknowledged = useCallback((id, value) => {
    setAcknowledgedIds((prev) => {
      const has = prev.includes(id)
      const shouldHave = value ?? !has
      const next = shouldHave ? (has ? prev : [...prev, id]) : prev.filter((x) => x !== id)
      writeJson(STORAGE_KEYS.acknowledged, next)
      return next
    })
  }, [])

  const summaries = useMemo(
    () =>
      containers.map((container) =>
        summarizeContainer({ container, history: histories[container.containerId], alerts: alerts ?? [], rules }),
      ),
    [containers, histories, alerts, rules],
  )

  const value = useMemo(
    () => ({
      loaded,
      health,
      containers,
      discoverySource,
      histories,
      summaries,
      alerts,
      alertsError,
      lastRefreshed,
      refresh,
      reloadAlerts: loadAlerts,
      acknowledgedIds,
      toggleAcknowledged,
    }),
    [loaded, health, containers, discoverySource, histories, summaries, alerts, alertsError, lastRefreshed, refresh, loadAlerts, acknowledgedIds, toggleAcknowledged],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

