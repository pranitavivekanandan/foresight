import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AlertDetail from '../components/AlertDetail'
import { EmptyState } from '../components/ui'
import { useData, useRules, useToast } from '../context/contexts'
import { resolveAlert } from '../api'
import { rSquared } from '../regression'
import { thresholdFor } from '../rules'
import { readJson, writeJson, STORAGE_KEYS } from '../storage'
import { ALERT_HISTORY_POINTS } from '../constants'
import './AlertDetailPage.css'

export default function AlertDetailPage() {
  const { alertId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { alerts, histories, reloadAlerts, acknowledgedIds, toggleAcknowledged } = useData()
  const { rules } = useRules()
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState(null)
  const [assignees, setAssignees] = useState(() => readJson(STORAGE_KEYS.assignees, {}))

  const id = Number(alertId)
  const alert = alerts?.find((a) => a.id === id) ?? null

  if (alerts === null) return <p className="loading-state">Loading alert…</p>
  if (!alert) {
    return (
      <div className="card">
        <EmptyState icon="bell-off" title={`Alert ${alertId} not found`}>
          It may have been removed, or the alerts list could not be loaded.
        </EmptyState>
      </div>
    )
  }

  // Same window the backend evaluator uses for its regression.
  const history = (histories[alert.containerId]?.data ?? []).slice(-ALERT_HISTORY_POINTS)

  async function handleResolve() {
    setError(null)
    setResolving(true)
    try {
      await resolveAlert(alert.id)
      await reloadAlerts()
      toast.show(`Alert ALR-${alert.id} resolved`)
    } catch (err) {
      setError(`Failed to resolve alert: ${err.message}`)
    } finally {
      setResolving(false)
    }
  }

  function handleAssignee(value) {
    const next = { ...assignees, [alert.id]: value }
    setAssignees(next)
    writeJson(STORAGE_KEYS.assignees, next)
  }

  return (
    <>
      {error && <p className="load-error">{error}</p>}
      <AlertDetail
        alert={alert}
        onBack={() => navigate('/alerts')}
        onResolve={handleResolve}
        resolving={resolving}
        history={history}
        fitRSquared={rSquared(history, alert.metric)}
        fallbackThreshold={thresholdFor(rules, alert.metric, alert.containerId)}
        acknowledged={acknowledgedIds.includes(alert.id)}
        onAcknowledge={(value) => toggleAcknowledged(alert.id, value)}
        assignee={assignees[alert.id] ?? ''}
        onAssigneeChange={handleAssignee}
      />
    </>
  )
}
