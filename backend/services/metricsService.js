const pool = require('../db/pool');

async function insertStats(records) {
  if (!records.length) return;

  const values = [];
  const placeholders = records.map((r, i) => {
    const base = i * 7;
    values.push(
      r.timestamp,
      r.containerId,
      r.containerName,
      r.cpuPercent,
      r.memUsedMB,
      r.memLimitMB,
      r.memPercent
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
  });

  const query = `
    INSERT INTO container_stats
      (time, container_id, container_name, cpu_percent, mem_used_mb, mem_limit_mb, mem_percent)
    VALUES ${placeholders.join(', ')}
  `;

  await pool.query(query, values);
}

async function getHistory(containerId, limit = 100) {
  const result = await pool.query(
    `SELECT time, container_name, cpu_percent, mem_used_mb, mem_limit_mb, mem_percent
     FROM container_stats
     WHERE container_id = $1
     ORDER BY time DESC
     LIMIT $2`,
    [containerId, limit]
  );

  const rows = result.rows.reverse();

  return {
    containerId,
    containerName: rows.length ? rows[0].container_name : null,
    count: rows.length,
    data: rows.map((row) => ({
      timestamp: row.time,
      cpuPercent: Number(row.cpu_percent),
      memPercent: Number(row.mem_percent),
      memUsedMB: Number(row.mem_used_mb),
      memLimitMB: Number(row.mem_limit_mb),
    })),
  };
}

module.exports = { insertStats, getHistory };
