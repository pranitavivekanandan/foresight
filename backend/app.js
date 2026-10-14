const express = require('express');
const cors = require('cors');
const { statsRouter, alertsRouter } = require('./routes/statsRoutes');

const app = express();
app.use(cors());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/stats', statsRouter);
app.use('/api/alerts', alertsRouter);

module.exports = app;
