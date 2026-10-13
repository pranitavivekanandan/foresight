const PRICING_URL = 'https://instances.vantage.sh/instances.json';

const DEFAULT_REGION = process.env.COST_REGION || 'us-east-1';
const RESTART_TIER = process.env.COST_RESTART_TIER || 't3.medium';
const UPGRADE_FROM_TIER = process.env.COST_UPGRADE_FROM_TIER || 't3.medium';
const UPGRADE_TO_TIER = process.env.COST_UPGRADE_TO_TIER || 't3.large';
const WINDOW_HOURS = Number(process.env.COST_UPGRADE_WINDOW_HOURS) || 730;
const REFRESH_INTERVAL_MS = Number(process.env.COST_REFRESH_INTERVAL_MS) || 24 * 60 * 60 * 1000;

// The pricing payload is large (90MB+) and this host intermittently drops the
// connection mid-transfer, so a single fetch attempt is not reliable. Retry
// with backoff rather than giving up after one failure.
const FETCH_TIMEOUT_MS = Number(process.env.COST_FETCH_TIMEOUT_MS) || 120000;
const MAX_RETRIES = Number(process.env.COST_FETCH_MAX_RETRIES) || 5;
const RETRY_BASE_DELAY_MS = Number(process.env.COST_FETCH_RETRY_BASE_DELAY_MS) || 30000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

let pricingCache = { data: null, fetchedAt: null };

function extractHourlyPrice(instancesData, instanceType, region = DEFAULT_REGION, os = 'linux') {
  const entry = instancesData.find((item) => item.instance_type === instanceType);
  const osPricing = entry && entry.pricing && entry.pricing[region] && entry.pricing[region][os];
  const price = osPricing && osPricing.ondemand;
  const parsed = price != null ? Number(price) : null;
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * README originally flagged cost estimates as "simulated using public cloud
 * pricing benchmarks ... not real billing data". This function replaces the
 * hardcoded benchmark with a delta computed from real, fetched on-demand
 * prices. It takes already-resolved hourly prices rather than raw fetched
 * data, so it has no network/IO dependency and is trivially unit-testable
 * with fixture numbers.
 */
function computeCostDelta({ restartHourlyPrice, fromHourlyPrice, toHourlyPrice, windowHours = WINDOW_HOURS }) {
  const costRestartUsd =
    restartHourlyPrice != null ? Number((restartHourlyPrice * (1 / 60)).toFixed(4)) : null;

  const costUpgradeUsd =
    fromHourlyPrice != null && toHourlyPrice != null
      ? Number(((toHourlyPrice - fromHourlyPrice) * windowHours).toFixed(2))
      : null;

  return { costRestartUsd, costUpgradeUsd };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPricingOnce() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(PRICING_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`pricing fetch failed with status ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadPricing() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await fetchPricingOnce();
      pricingCache = { data, fetchedAt: new Date() };
      console.log(`costService: cached pricing for ${data.length} instance types (attempt ${attempt}/${MAX_RETRIES})`);
      return;
    } catch (err) {
      console.error(`costService: pricing fetch attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
        await sleep(delay);
      }
    }
  }
  console.error('costService: exhausted all pricing fetch retries, cost estimates remain unavailable until the next scheduled refresh');
}

function getCosts() {
  if (!pricingCache.data) {
    return { costRestartUsd: null, costUpgradeUsd: null };
  }

  const restartHourlyPrice = extractHourlyPrice(pricingCache.data, RESTART_TIER);
  const fromHourlyPrice = extractHourlyPrice(pricingCache.data, UPGRADE_FROM_TIER);
  const toHourlyPrice = extractHourlyPrice(pricingCache.data, UPGRADE_TO_TIER);

  return computeCostDelta({ restartHourlyPrice, fromHourlyPrice, toHourlyPrice });
}

function startPricingRefresh(intervalMs = REFRESH_INTERVAL_MS) {
  loadPricing();
  return setInterval(loadPricing, intervalMs);
}

module.exports = { computeCostDelta, extractHourlyPrice, getCosts, loadPricing, startPricingRefresh };
