const pool = require('../db/pool');

async function insertAlert(alert) {
  const result = await pool.query(
    `INSERT INTO alerts
      (container_id, container_name, metric, current_value, predicted_breach_minutes,
       explanation, cost_restart_usd, cost_upgrade_usd, grouped_with)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      alert.containerId,
      alert.containerName,
      alert.metric,
      alert.currentValue,
      alert.predictedBreachMinutes,
      alert.explanation,
      alert.costRestartUsd,
      alert.costUpgradeUsd,
      alert.groupedWith ?? null,
    ]
  );
  return mapRow(result.rows[0]);
}

function mapRow(row) {
  return {
    id: row.id,
    time: row.time,
    containerId: row.container_id,
    containerName: row.container_name,
    metric: row.metric,
    currentValue: Number(row.current_value),
    predictedBreachMinutes: Number(row.predicted_breach_minutes),
    explanation: row.explanation,
    costRestartUsd: row.cost_restart_usd != null ? Number(row.cost_restart_usd) : null,
    costUpgradeUsd: row.cost_upgrade_usd != null ? Number(row.cost_upgrade_usd) : null,
    groupedWith: row.grouped_with,
    resolved: row.resolved,
  };
}

async function listAlerts() {
  const result = await pool.query(`SELECT * FROM alerts ORDER BY time DESC`);
  return result.rows.map(mapRow);
}

async function getAlertById(id) {
  const result = await pool.query(`SELECT * FROM alerts WHERE id = $1`, [id]);
  return result.rows.length ? mapRow(result.rows[0]) : null;
}

async function resolveAlert(id) {
  const result = await pool.query(
    `UPDATE alerts SET resolved = true WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows.length ? mapRow(result.rows[0]) : null;
}

/**
 * Finds unresolved alerts for OTHER containers fired within `windowMinutes`
 * of `time`, oldest first. Used by the evaluator to decide root-cause
 * grouping: if a match exists, the new alert is grouped under the earliest one.
 */
async function findGroupCandidate(containerId, time, windowMinutes) {
  const result = await pool.query(
    `SELECT * FROM alerts
     WHERE container_id != $1
       AND resolved = false
       AND time BETWEEN $2::timestamptz - ($3 || ' minutes')::interval
                     AND $2::timestamptz + ($3 || ' minutes')::interval
     ORDER BY time ASC
     LIMIT 1`,
    [containerId, time, windowMinutes]
  );
  return result.rows.length ? mapRow(result.rows[0]) : null;
}

/**
 * Prevents duplicate alerts firing every poll tick for the same ongoing
 * issue: if an unresolved alert already exists for this container+metric,
 * the evaluator skips inserting another one.
 */
async function findActiveAlert(containerId, metric) {
  const result = await pool.query(
    `SELECT * FROM alerts WHERE container_id = $1 AND metric = $2 AND resolved = false LIMIT 1`,
    [containerId, metric]
  );
  return result.rows.length ? mapRow(result.rows[0]) : null;
}

module.exports = {
  insertAlert,
  listAlerts,
  getAlertById,
  resolveAlert,
  findGroupCandidate,
  findActiveAlert,
};
