const { calculateCpuPercent } = require('../../services/dockerStatsService');

describe('calculateCpuPercent', () => {
  it('computes cpu percent correctly for normal deltas', () => {
    const stats = {
      cpu_stats: { cpu_usage: { total_usage: 200 }, system_cpu_usage: 1000, online_cpus: 2 },
      precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 800 },
    };
    // cpuDelta=100, systemDelta=200, numCpus=2 -> (100/200)*2*100 = 100
    expect(calculateCpuPercent(stats)).toBeCloseTo(100);
  });

  it('returns 0 when systemDelta is zero or negative', () => {
    const stats = {
      cpu_stats: { cpu_usage: { total_usage: 200 }, system_cpu_usage: 800, online_cpus: 2 },
      precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 800 },
    };
    expect(calculateCpuPercent(stats)).toBe(0);
  });

  it('returns 0 when cpuDelta is zero or negative', () => {
    const stats = {
      cpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 1000, online_cpus: 2 },
      precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 800 },
    };
    expect(calculateCpuPercent(stats)).toBe(0);
  });

  it('falls back to percpu_usage length when online_cpus is absent', () => {
    const stats = {
      cpu_stats: { cpu_usage: { total_usage: 200, percpu_usage: [1, 2, 3, 4] }, system_cpu_usage: 1000 },
      precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 800 },
    };
    // numCpus=4, cpuDelta=100, systemDelta=200 -> (100/200)*4*100 = 200
    expect(calculateCpuPercent(stats)).toBeCloseTo(200);
  });

  it('falls back to 1 cpu when neither online_cpus nor percpu_usage is present', () => {
    const stats = {
      cpu_stats: { cpu_usage: { total_usage: 200 }, system_cpu_usage: 1000 },
      precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 800 },
    };
    expect(calculateCpuPercent(stats)).toBeCloseTo(50);
  });
});
