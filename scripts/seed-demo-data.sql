-- Demo seed data for Foresight. Column names match database/init.sql.
--
-- Uses the real container IDs/names from `docker ps` on 2026-10-14. Container
-- IDs change whenever a container is recreated (e.g. `docker-compose up
-- --build`), so re-check `docker ps --no-trunc` before loading this again.
--
-- What it inserts (all timestamps relative to now(), so the data "ends now"):
--   container_stats: 61 rows per container, one per minute for the last 60 min
--     foresight-backend-1   memPercent rises steadily 60 -> 88
--     foresight-frontend-1  memPercent rises slowly   30 -> 40
--     foresight-db          memPercent flat around 45
--   alerts: 1 root alert (backend) + 2 grouped under it via grouped_with
--     (frontend unresolved, db resolved)
--
-- These rows are DEMO DATA, not real measurements. The backend poller keeps
-- inserting real readings for the same containers every 10 s, so the two will
-- be interleaved in container_stats.
--
-- Load once. It aborts (and inserts nothing) if the alerts table already has rows.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM alerts) THEN
    RAISE EXCEPTION 'alerts table is not empty - seed already loaded? Nothing was inserted.';
  END IF;
END $$;

-- memory limit 7784.180 MB = the real mem_limit_mb these containers report.
WITH containers (container_id, container_name, mem_start, mem_end, cpu_base) AS (
  VALUES
    ('88e4628fc047be1c105dee9bfd1264073bd6a5de3ae82bdd1a4850c017b9e4ec', 'foresight-backend-1',  60.0, 88.0, 6.0),
    ('36fb671bd9ee87bb5de9c911d3bef36f98a31f1fb5fa982db4c09fc98810e207', 'foresight-frontend-1', 30.0, 40.0, 2.0),
    ('935f87a1dd68899377b27b131a97372e38301bf030f94c920246e42519873b5b', 'foresight-db',         45.0, 45.0, 4.0)
),
readings AS (
  SELECT
    c.container_id,
    c.container_name,
    now() - make_interval(mins => 60 - i) AS time,
    -- Linear rise plus a small wobble that is zero at i = 0 and i = 60, so
    -- the series starts and ends exactly at mem_start / mem_end.
    c.mem_start + (c.mem_end - c.mem_start) * i / 60.0 + 0.4 * sin(pi() * i / 6.0) AS mem_percent,
    c.cpu_base + 1.5 * sin(i / 5.0) + 1.5 AS cpu_percent
  FROM containers c
  CROSS JOIN generate_series(0, 60) AS i
)
INSERT INTO container_stats
  (time, container_id, container_name, cpu_percent, mem_used_mb, mem_limit_mb, mem_percent)
SELECT
  time,
  container_id,
  container_name,
  round(cpu_percent::numeric, 2),
  round((mem_percent / 100.0 * 7784.180)::numeric, 1),
  7784.180,
  round(mem_percent::numeric, 2)
FROM readings;

-- Explanations use the backend's own template (alertEvaluator.buildExplanation)
-- so the UI can parse the 90% threshold from them. Costs are what
-- costService.computeCostDelta returns for its seeded prices
-- (t3.medium 0.0416/h, t3.large 0.0832/h): restart 0.0007, upgrade 30.37.
-- Root id comes from RETURNING, so grouped_with is correct whatever the
-- sequence value is.
WITH root AS (
  INSERT INTO alerts
    (time, container_id, container_name, metric, current_value, predicted_breach_minutes,
     explanation, cost_restart_usd, cost_upgrade_usd, grouped_with, resolved)
  VALUES
    (now() - interval '5 minutes',
     '88e4628fc047be1c105dee9bfd1264073bd6a5de3ae82bdd1a4850c017b9e4ec', 'foresight-backend-1',
     'memPercent', 85.7, 9,
     'foresight-backend-1''s memPercent has been climbing steadily (currently 85.7%) and is projected to cross 90% in about 9 minutes.',
     0.0007, 30.37, NULL, false)
  RETURNING id
)
INSERT INTO alerts
  (time, container_id, container_name, metric, current_value, predicted_breach_minutes,
   explanation, cost_restart_usd, cost_upgrade_usd, grouped_with, resolved)
SELECT v.time, v.container_id, v.container_name, 'memPercent', v.current_value, v.minutes,
       v.explanation, 0.0007, 30.37, root.id, v.resolved
FROM root
CROSS JOIN (
  VALUES
    (now() - interval '4 minutes',
     '36fb671bd9ee87bb5de9c911d3bef36f98a31f1fb5fa982db4c09fc98810e207', 'foresight-frontend-1',
     39.3, 304,
     'foresight-frontend-1''s memPercent has been climbing steadily (currently 39.3%) and is projected to cross 90% in about 304 minutes.',
     false),
    (now() - interval '3 minutes',
     '935f87a1dd68899377b27b131a97372e38301bf030f94c920246e42519873b5b', 'foresight-db',
     45.2, 900,
     'foresight-db''s memPercent has been climbing steadily (currently 45.2%) and is projected to cross 90% in about 900 minutes.',
     true)
) AS v (time, container_id, container_name, current_value, minutes, explanation, resolved);

COMMIT;
