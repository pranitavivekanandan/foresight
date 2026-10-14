// Integration test: runs against the real TimescaleDB instance (same one the
// app uses in dev), not mocked. Fixture rows are isolated under a unique
// test container id and cleaned up after the run.
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

const TEST_CONTAINER_ID = `test-history-${Date.now()}`;

beforeAll(async () => {
  await pool.query(
    `INSERT INTO container_stats (time, container_id, container_name, cpu_percent, mem_used_mb, mem_limit_mb, mem_percent)
     VALUES
       (now() - interval '2 minutes', $1, 'test-container', 10, 100, 1000, 10),
       (now() - interval '1 minute',  $1, 'test-container', 12, 110, 1000, 11),
       (now(),                       $1, 'test-container', 15, 120, 1000, 12)`,
    [TEST_CONTAINER_ID]
  );
});

afterAll(async () => {
  await pool.query(`DELETE FROM container_stats WHERE container_id = $1`, [TEST_CONTAINER_ID]);
});

describe('GET /api/stats/:containerId/history', () => {
  it('returns stored history matching the locked contract shape', async () => {
    const res = await request(app).get(`/api/stats/${TEST_CONTAINER_ID}/history?limit=10`);

    expect(res.status).toBe(200);
    expect(res.body.containerId).toBe(TEST_CONTAINER_ID);
    expect(res.body.containerName).toBe('test-container');
    expect(res.body.count).toBe(3);
    expect(res.body.data).toHaveLength(3);

    const [first] = res.body.data;
    expect(first).toHaveProperty('timestamp');
    expect(first).toHaveProperty('cpuPercent');
    expect(first).toHaveProperty('memPercent');
    expect(first).toHaveProperty('memUsedMB');
    expect(first).toHaveProperty('memLimitMB');

    // chronological order (oldest first)
    expect(res.body.data[0].cpuPercent).toBeLessThan(res.body.data[2].cpuPercent);
  });

  it('returns an empty result for an unknown container id', async () => {
    const res = await request(app).get('/api/stats/does-not-exist/history');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.data).toEqual([]);
  });
});
