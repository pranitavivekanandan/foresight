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
