CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS container_stats (
  time          TIMESTAMPTZ      NOT NULL,
  container_id  TEXT             NOT NULL,
  container_name TEXT            NOT NULL,
  cpu_percent   DOUBLE PRECISION NOT NULL,
  mem_used_mb   DOUBLE PRECISION NOT NULL,
  mem_limit_mb  DOUBLE PRECISION NOT NULL,
  mem_percent   DOUBLE PRECISION NOT NULL
);

SELECT create_hypertable('container_stats', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_container_stats_container_time
  ON container_stats (container_id, time DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id                      SERIAL PRIMARY KEY,
  time                    TIMESTAMPTZ      NOT NULL DEFAULT now(),
  container_id            TEXT             NOT NULL,
  container_name          TEXT             NOT NULL,
  metric                  TEXT             NOT NULL,
  current_value           DOUBLE PRECISION NOT NULL,
  predicted_breach_minutes DOUBLE PRECISION NOT NULL,
  explanation             TEXT             NOT NULL,
  cost_restart_usd        DOUBLE PRECISION,
  cost_upgrade_usd        DOUBLE PRECISION,
  grouped_with            INTEGER          REFERENCES alerts(id),
  resolved                BOOLEAN          NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_alerts_time ON alerts (time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_container_resolved ON alerts (container_id, resolved);
