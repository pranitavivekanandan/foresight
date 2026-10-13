const express = require('express');
const statsController = require('../controllers/statsController');

const statsRouter = express.Router();

statsRouter.get('/containers', statsController.getContainers);
statsRouter.get('/:containerId/history', statsController.getHistory);
statsRouter.post('/collect', statsController.triggerCollection);

const alertsRouter = express.Router();

alertsRouter.get('/', statsController.getAlerts);
alertsRouter.get('/:id', statsController.getAlertById);
alertsRouter.patch('/:id/resolve', statsController.resolveAlert);

module.exports = { statsRouter, alertsRouter };
