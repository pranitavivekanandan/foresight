const { listContainers } = require('./dockerStatsService');
const metricsService = require('./metricsService');
const alertsService = require('./alertsService');
const costService = require('./costService');

const METRIC = process.env.ALERT_METRIC || 'memPercent';
const THRESHOLD = Number(process.env.ALERT_THRESHOLD) || 90;
const HISTORY_POINTS = Number(process.env.ALERT_HISTORY_POINTS) || 20;
const GROUP_WINDOW_MINUTES = Number(process.env.ALERT_GROUP_WINDOW_MINUTES) || 5;

// calculateBreachForecast deliberately mirrors predict.js exactly, including
// flagging willBreach for any positive slope no matter how far out the
// projected breach is. That's fine for a live UI display, but storing a
// permanent alert row for a breach projected in, say, 10^30 minutes (normal
// measurement noise, not a real trend) would spam the alerts table forever.
// This cap is a business-logic bound layered on top of the untouched math.
const MAX_LOOKAHEAD_MINUTES = Number(process.env.ALERT_MAX_LOOKAHEAD_MINUTES) || 1440;

/**
 * Deliberately duplicates the frontend's predict.js approach: least-squares
 * linear regression over {minutesSinceFirstReading, value} pairs. Alerts
 * must fire even if nobody has the dashboard open, so the backend cannot
 * depend on the frontend's prediction -- this is the backend's own copy of
 * that math, evaluated against the same stored history.
 */
function calculateBreachForecast(data, field = METRIC, threshold = THRESHOLD) {
  const validPoints = data
    .map((entry) => ({
      timestamp: new Date(entry.timestamp).getTime(),
      value: Number(entry[field]),
    }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value));

  if (validPoints.length < 2) {
    return { hasEnoughData: false };
  }

  const firstTimestamp = validPoints[0].timestamp;
  const points = validPoints.map((point) => ({
    x: (point.timestamp - firstTimestamp) / 60000,
    y: point.value,
  }));

  const xMean = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const numerator = points.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0);
  const denominator = points.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0);

  if (denominator === 0) {
    return { hasEnoughData: true, willBreach: false, currentValue: points[points.length - 1].y, slope: 0 };
  }

  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;
  const currentValue = points[points.length - 1].y;

  if (slope <= 0) {
    return { hasEnoughData: true, willBreach: false, currentValue, slope };
  }

  const lastX = points[points.length - 1].x;
  const minutesToBreach = (threshold - (slope * lastX + intercept)) / slope;
  const isAlreadyBreached = currentValue >= threshold;

  return {
    hasEnoughData: true,
    willBreach: minutesToBreach > 0 || isAlreadyBreached,
    currentValue,
    slope,
    minutesToBreach: Math.max(0, Math.round(minutesToBreach)),
  };
}

function buildExplanation({ containerName, metric, currentValue, threshold, minutesToBreach }) {
  const roundedValue = currentValue.toFixed(1);
  if (minutesToBreach <= 0) {
    return `${containerName}'s ${metric} has already crossed ${threshold}% (currently ${roundedValue}%) and continues to climb.`;
  }
  return `${containerName}'s ${metric} has been climbing steadily (currently ${roundedValue}%) and is projected to cross ${threshold}% in about ${minutesToBreach} minutes.`;
}

async function evaluateContainer(container) {
  const existing = await alertsService.findActiveAlert(container.containerId, METRIC);
  if (existing) return null;

  const history = await metricsService.getHistory(container.containerId, HISTORY_POINTS);
  const forecast = calculateBreachForecast(history.data, METRIC, THRESHOLD);
  if (!forecast.hasEnoughData || !forecast.willBreach) return null;
  if (forecast.minutesToBreach > MAX_LOOKAHEAD_MINUTES) return null;

  const explanation = buildExplanation({
    containerName: container.containerName,
    metric: METRIC,
    currentValue: forecast.currentValue,
    threshold: THRESHOLD,
    minutesToBreach: forecast.minutesToBreach,
  });

  const { costRestartUsd, costUpgradeUsd } = costService.getCosts();

  const now = new Date();
  const groupCandidate = await alertsService.findGroupCandidate(
    container.containerId,
    now,
    GROUP_WINDOW_MINUTES
  );

  const inserted = await alertsService.insertAlert({
    containerId: container.containerId,
    containerName: container.containerName,
    metric: METRIC,
    currentValue: forecast.currentValue,
    predictedBreachMinutes: forecast.minutesToBreach,
    explanation,
    costRestartUsd,
    costUpgradeUsd,
    groupedWith: groupCandidate ? groupCandidate.id : null,
  });

  return inserted;
}

async function evaluateAll() {
  const containers = await listContainers();
  const results = [];
  for (const container of containers) {
    try {
      const alert = await evaluateContainer(container);
      if (alert) results.push(alert);
    } catch (err) {
      console.error(`alertEvaluator: failed to evaluate ${container.containerName}:`, err.message);
    }
  }
  return results;
}

function startAlertPoller(intervalMs) {
  const tick = () => {
    evaluateAll().catch((err) => console.error('alertEvaluator: tick failed:', err.message));
  };
  tick();
  return setInterval(tick, intervalMs);
}

module.exports = { calculateBreachForecast, buildExplanation, evaluateContainer, evaluateAll, startAlertPoller };
