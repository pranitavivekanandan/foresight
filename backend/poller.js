const { collectAllContainerStats } = require('./services/dockerStatsService');
const metricsService = require('./services/metricsService');

function startPoller(intervalMs = 10000) {
  const tick = async () => {
    try {
      const stats = await collectAllContainerStats();
      await metricsService.insertStats(stats);
    } catch (err) {
      console.error('Poller collection failed:', err);
    }
  };

  tick();
  return setInterval(tick, intervalMs);
}

module.exports = { startPoller };
