// Integration test: runs against the real TimescaleDB instance, not mocked.
// Exercises the full pipeline: seeded history -> alertEvaluator -> alerts
// table -> HTTP layer. Fixture rows are isolated under unique test
// container ids and cleaned up after the run.
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');
const metricsService = require('../../services/metricsService');
const { evaluateContainer } = require('../../services/alertEvaluator');

const SUFFIX = Date.now();
const CONTAINER_A = `test-alert-a-${SUFFIX}`;
const CONTAINER_B = `test-alert-b-${SUFFIX}`;

async function seedRisingHistory(containerId, containerName, pointsWithMinuteOffsets) {
  const base = Date.now();
  const records = pointsWithMinuteOffsets.map(([minutesOffset, memPercent]) => ({
    timestamp: new Date(base + minutesOffset * 60000),
    containerId,
    containerName,
    cpuPercent: 0,
    memUsedMB: memPercent * 10,
    memLimitMB: 1000,
    memPercent,
  }));
  await metricsService.insertStats(records);
}

afterAll(async () => {
  await pool.query(`DELETE FROM alerts WHERE container_id = ANY($1)`, [[CONTAINER_A, CONTAINER_B]]);
  await pool.query(`DELETE FROM container_stats WHERE container_id = ANY($1)`, [[CONTAINER_A, CONTAINER_B]]);
});

describe('alert evaluation end-to-end', () => {
  it('fires an alert for a container with a rising memory trend', async () => {
    await seedRisingHistory(CONTAINER_A, 'alert-test-a', [[-2, 60], [-1, 75], [0, 88]]);

    const alert = await evaluateContainer({ containerId: CONTAINER_A, containerName: 'alert-test-a' });

    expect(alert).not.toBeNull();
    expect(alert.containerId).toBe(CONTAINER_A);
    expect(alert.metric).toBe('memPercent');
    expect(alert.explanation).toContain('alert-test-a');
    expect(alert.resolved).toBe(false);
  });

  it('does not fire a duplicate alert while the first one is still unresolved', async () => {
    const again = await evaluateContainer({ containerId: CONTAINER_A, containerName: 'alert-test-a' });
    expect(again).toBeNull();
  });

  it('groups a second container alert fired within the grouping window', async () => {
    await seedRisingHistory(CONTAINER_B, 'alert-test-b', [[-2, 55], [-1, 70], [0, 89]]);

    const alertB = await evaluateContainer({ containerId: CONTAINER_B, containerName: 'alert-test-b' });

    expect(alertB).not.toBeNull();
    expect(alertB.groupedWith).not.toBeNull();
  });
});

describe('lookahead cap', () => {
  it('does not fire an alert when the projected breach is absurdly far in the future', async () => {
    const CONTAINER_C = `test-alert-c-${SUFFIX}`;
    // Tiny positive slope over widely spaced points -> technically "will
    // breach" per the raw regression, but thousands of years out.
    await seedRisingHistory(CONTAINER_C, 'alert-test-c', [[-2, 10], [-1, 10.0000001], [0, 10.0000002]]);

    const alert = await evaluateContainer({ containerId: CONTAINER_C, containerName: 'alert-test-c' });
    expect(alert).toBeNull();

    await pool.query('DELETE FROM container_stats WHERE container_id = $1', [CONTAINER_C]);
  });
});

describe('GET/PATCH /api/alerts', () => {
  it('lists alerts most recent first, including the ones just fired', async () => {
    const res = await request(app).get('/api/alerts');
    expect(res.status).toBe(200);
    const ids = res.body.map((a) => a.containerId);
    expect(ids).toEqual(expect.arrayContaining([CONTAINER_A, CONTAINER_B]));
  });

  it('fetches a single alert by id', async () => {
    const list = await request(app).get('/api/alerts');
    const target = list.body.find((a) => a.containerId === CONTAINER_A);

    const res = await request(app).get(`/api/alerts/${target.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(target.id);
  });

  it('returns 404 for an unknown alert id', async () => {
    const res = await request(app).get('/api/alerts/999999999');
    expect(res.status).toBe(404);
  });

  it('resolves an alert', async () => {
    const list = await request(app).get('/api/alerts');
    const target = list.body.find((a) => a.containerId === CONTAINER_A);

    const res = await request(app).patch(`/api/alerts/${target.id}/resolve`);
    expect(res.status).toBe(200);
    expect(res.body.resolved).toBe(true);
  });
});
