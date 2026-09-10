const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'foresight',
  password: process.env.PGPASSWORD || 'foresight',
  database: process.env.PGDATABASE || 'foresight',
});

module.exports = pool;
