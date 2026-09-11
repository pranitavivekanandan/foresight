const express = require('express');
const statsRoutes = require('./routes/statsRoutes');
const { startPoller } = require('./poller');

const app = express();
const PORT = 5000;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 10000;

const cors = require('cors');
app.use(cors());
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/stats', statsRoutes);

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  startPoller(POLL_INTERVAL_MS);
});
