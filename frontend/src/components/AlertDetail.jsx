function formatCurrency(value) {
  if (value == null) return 'Estimate unavailable'
  return `$${value.toFixed(2)}`
}

export default function AlertDetail({ alert, onBack, onResolve, resolving }) {
  if (!alert) return null

  const breachText =
    alert.predictedBreachMinutes > 0
      ? `Breach in about ${alert.predictedBreachMinutes} minutes`
      : 'Threshold already breached'

  return (
    <div className="alert-detail">
      <button type="button" className="breadcrumb-back" onClick={onBack}>
        &larr; Alerts / Alert #{alert.id}
      </button>

      <div className="alert-detail-header">
        <div>
          <h2>{alert.containerName}</h2>
          <p className="muted">{alert.metric}</p>
        </div>
        <span className={`badge ${alert.resolved ? 'healthy' : 'critical'}`}>
          {alert.resolved ? 'Resolved' : 'Active'}
        </span>
      </div>

      <div className="alert-explanation-card">
        <p>{alert.explanation}</p>
        <p className="breach-estimate">{breachText}</p>
      </div>

      <div className="cost-cards">
        <div className="cost-card">
          <div className="cost-card-heading">
            <h3>Restart service</h3>
            <span className="cost-value">{formatCurrency(alert.costRestartUsd)}</span>
          </div>
          <p className="muted">Estimated cost (not real billing data).</p>
        </div>

        <div className="cost-card">
          <div className="cost-card-heading">
            <h3>Upgrade instance</h3>
            <span className="cost-value">{formatCurrency(alert.costUpgradeUsd)}</span>
          </div>
          <p className="muted">Estimated cost (not real billing data).</p>
        </div>
      </div>

      {!alert.resolved && (
        <button
          type="button"
          className="resolve-button"
          onClick={() => onResolve(alert.id)}
          disabled={resolving}
        >
          {resolving ? 'Resolving…' : 'Resolve alert'}
        </button>
      )}
    </div>
  )
}
