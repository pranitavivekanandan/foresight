import TrendChart from './TrendChart'
import { analyzeTrend } from '../trend'

export default function DashboardCard({ containerName, history, prediction, cpuPrediction }) {
  const data = Array.isArray(history?.data) ? history.data : []
  const lastEntry = data[data.length - 1]
  const memoryTrend = analyzeTrend(data)
  const cpuTrend = analyzeTrend(data, 'cpuPercent')

  if (!lastEntry) {
    return (
      <div className="card">
        <div className="card-heading">
          <h2>{containerName}</h2>
        </div>
        <div className="empty-state">
          <strong>No historical data available yet.</strong>
          <p>Prediction will appear after sufficient metrics are collected.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-heading">
        <h2>{containerName}</h2>
      </div>
      <div className="metric-grid">
        <div><span>CPU usage</span><strong>{Number.isFinite(lastEntry.cpuPercent) ? `${lastEntry.cpuPercent}%` : 'Unavailable'}</strong></div>
        <div><span>Memory usage</span><strong>{Number.isFinite(lastEntry.memPercent) ? `${lastEntry.memPercent.toFixed(2)}%` : 'Unavailable'}</strong></div>
      </div>
      <p className="memory-detail">
        {Number.isFinite(lastEntry.memUsedMB) && Number.isFinite(lastEntry.memLimitMB)
          ? `${lastEntry.memUsedMB} / ${lastEntry.memLimitMB} MB`
          : 'Memory capacity unavailable'}
      </p>
      <TrendChart data={data} />
      <div className="prediction-panel">
        <span className="eyebrow">Prediction</span>
        {memoryTrend.hasEnoughData ? (
          <div className="prediction-content">
            <div><span>Memory</span><strong className={`trend-${memoryTrend.direction}`}>{memoryTrend.direction === 'increasing' ? '↑' : memoryTrend.direction === 'decreasing' ? '↓' : '→'} {memoryTrend.direction}</strong></div>
            <div><span>CPU</span><strong className={`${cpuPrediction?.willBreach ? 'alert ' : ''}trend-${cpuTrend.direction}`}>{cpuTrend.direction === 'increasing' ? '↑' : cpuTrend.direction === 'decreasing' ? '↓' : '→'} {cpuTrend.direction}</strong></div>
            <div><span>Current / threshold</span><strong>{Number.isFinite(lastEntry.memPercent) ? `${lastEntry.memPercent.toFixed(2)}% / 90%` : 'Unavailable'}</strong></div>
            <div><span>Estimated breach</span><strong className={prediction?.willBreach ? 'alert' : ''}>{prediction?.willBreach ? (prediction.minutesToBreach === 0 ? 'Threshold reached' : `~${prediction.minutesToBreach} minutes`) : 'Not projected'}</strong></div>
          </div>
        ) : (
          <p>Insufficient historical data for prediction.</p>
        )}
      </div>
    </div>
  )
}