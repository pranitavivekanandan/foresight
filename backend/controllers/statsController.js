const { listContainers, collectAllContainerStats } = require('../services/dockerStatsService');
const metricsService = require('../services/metricsService');

async function getContainers(req, res) {
  try {
    const containers = await listContainers();
    res.json(containers);
  } catch (err) {
    console.error('Failed to list containers:', err);
    res.status(500).json({ error: 'Failed to list containers' });
  }
}

async function getHistory(req, res) {
  try {
    const { containerId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 100, 1000);

    const history = await metricsService.getHistory(containerId, limit);
    res.json(history);
  } catch (err) {
    console.error('Failed to fetch history:', err);
    res.status(500).json({ error: 'Failed to fetch container history' });
  }
}

async function triggerCollection(req, res) {
  try {
    const stats = await collectAllContainerStats();
    await metricsService.insertStats(stats);
    res.json({ collected: stats.length, containers: stats.map((s) => s.containerName) });
  } catch (err) {
    console.error('Failed to collect stats:', err);
    res.status(500).json({ error: 'Failed to collect container stats' });
  }
}

module.exports = { getContainers, getHistory, triggerCollection };
