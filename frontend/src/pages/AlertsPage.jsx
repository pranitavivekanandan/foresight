import { useNavigate, useOutletContext } from 'react-router-dom'
import AlertsFeed from '../components/AlertsFeed'
import { useData, useRules } from '../context/contexts'
import './AlertsPage.css'

export default function AlertsPage() {
  const navigate = useNavigate()
  const { query } = useOutletContext() ?? { query: '' }
  const { alerts, alertsError, reloadAlerts, acknowledgedIds, toggleAcknowledged } = useData()
  const { rules } = useRules()

  return (
    <>
      {alertsError && <p className="load-error">Alerts could not be loaded: {alertsError}</p>}
      {alerts === null ? (
        <p className="loading-state">Loading alerts…</p>
      ) : (
        <AlertsFeed
          alerts={alerts}
          onSelectAlert={(alert) => navigate(`/alerts/${alert.id}`)}
          onAlertsChanged={reloadAlerts}
          acknowledgedIds={acknowledgedIds}
          onToggleAcknowledged={toggleAcknowledged}
          rules={rules}
          query={query}
        />
      )}
    </>
  )
}
