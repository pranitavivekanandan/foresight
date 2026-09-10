const express = require('express');
const statsController = require('../controllers/statsController');

const router = express.Router();

router.get('/:containerId/history', statsController.getHistory);
router.post('/collect', statsController.triggerCollection);

module.exports = router;
