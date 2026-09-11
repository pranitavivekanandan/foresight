const Docker = require('dockerode');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

function calculateCpuPercent(stats) {
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const numCpus =
    stats.cpu_stats.online_cpus ||
    (stats.cpu_stats.cpu_usage.percpu_usage
      ? stats.cpu_stats.cpu_usage.percpu_usage.length
      : 1);

  if (systemDelta <= 0 || cpuDelta <= 0) return 0;
  return (cpuDelta / systemDelta) * numCpus * 100;
}

function calculateMemory(stats) {
  const cache =
    (stats.memory_stats.stats && (stats.memory_stats.stats.cache || stats.memory_stats.stats.total_inactive_file)) || 0;
  const usedBytes = stats.memory_stats.usage - cache;
  const limitBytes = stats.memory_stats.limit;

  const memUsedMB = usedBytes / (1024 * 1024);
  const memLimitMB = limitBytes / (1024 * 1024);
  const memPercent = limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0;

  return { memUsedMB, memLimitMB, memPercent };
}

async function listContainers() {
  const containers = await docker.listContainers();
  return containers.map((containerInfo) => ({
    containerId: containerInfo.Id,
    containerName: containerInfo.Names[0].replace(/^\//, ''),
  }));
}

async function collectAllContainerStats() {
  const containers = await docker.listContainers();

  const results = await Promise.all(
    containers.map(async (containerInfo) => {
      const container = docker.getContainer(containerInfo.Id);
      const stats = await container.stats({ stream: false });
      const { memUsedMB, memLimitMB, memPercent } = calculateMemory(stats);

      return {
        containerId: containerInfo.Id,
        containerName: containerInfo.Names[0].replace(/^\//, ''),
        cpuPercent: calculateCpuPercent(stats),
        memUsedMB,
        memLimitMB,
        memPercent,
        timestamp: new Date(),
      };
    })
  );

  return results;
}

module.exports = { listContainers, collectAllContainerStats, calculateCpuPercent, calculateMemory };
