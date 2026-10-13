const app = require('./app');
const { startPoller } = require('./poller');
const { startAlertPoller } = require('./services/alertEvaluator');
const costService = require('./services/costService');

const PORT = 5000;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 10000;
const ALERT_POLL_INTERVAL_MS = Number(process.env.ALERT_POLL_INTERVAL_MS) || POLL_INTERVAL_MS;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  startPoller(POLL_INTERVAL_MS);
  costService.startPricingRefresh();
  startAlertPoller(ALERT_POLL_INTERVAL_MS);
});
