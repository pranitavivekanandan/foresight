const { listContainers, collectAllContainerStats } = require('../services/dockerStatsService');
const metricsService = require('../services/metricsService');
const alertsService = require('../services/alertsService');

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

async function getAlerts(req, res) {
  try {
    const alerts = await alertsService.listAlerts();
    res.json(alerts);
  } catch (err) {
    console.error('Failed to list alerts:', err);
    res.status(500).json({ error: 'Failed to list alerts' });
  }
}

async function getAlertById(req, res) {
  try {
    const id = Number(req.params.id);
    const alert = await alertsService.getAlertById(id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json(alert);
  } catch (err) {
    console.error('Failed to fetch alert:', err);
    res.status(500).json({ error: 'Failed to fetch alert' });
  }
}

async function resolveAlert(req, res) {
  try {
    const id = Number(req.params.id);
    const alert = await alertsService.resolveAlert(id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json(alert);
  } catch (err) {
    console.error('Failed to resolve alert:', err);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
}

module.exports = {
  getContainers,
  getHistory,
  triggerCollection,
  getAlerts,
  getAlertById,
  resolveAlert,
};
