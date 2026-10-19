const fs = require('fs');
const path = require('path');

const PRICING_URL = 'https://instances.vantage.sh/instances.json';
const SEED_FILE = path.join(__dirname, '..', 'data', 'ec2-pricing-seed.json');

const DEFAULT_REGION = process.env.COST_REGION || 'us-east-1';
const RESTART_TIER = process.env.COST_RESTART_TIER || 't3.medium';
const UPGRADE_FROM_TIER = process.env.COST_UPGRADE_FROM_TIER || 't3.medium';
const UPGRADE_TO_TIER = process.env.COST_UPGRADE_TO_TIER || 't3.large';
const WINDOW_HOURS = Number(process.env.COST_UPGRADE_WINDOW_HOURS) || 730;
const REFRESH_INTERVAL_MS = Number(process.env.COST_REFRESH_INTERVAL_MS) || 24 * 60 * 60 * 1000;

// The full pricing payload is 90MB+ and this host intermittently drops the
// connection mid-transfer, so a single fetch attempt is not reliable. Retry
// with backoff rather than giving up after one failure.
const FETCH_TIMEOUT_MS = Number(process.env.COST_FETCH_TIMEOUT_MS) || 120000;
const MAX_RETRIES = Number(process.env.COST_FETCH_MAX_RETRIES) || 5;
const RETRY_BASE_DELAY_MS = Number(process.env.COST_FETCH_RETRY_BASE_DELAY_MS) || 30000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

// In-memory cache holds only the three resolved hourly prices we actually
// use, never the full 90MB dataset -- extracted once right after a
// successful fetch, then discarded.
let pricingCache = { prices: null, source: null, fetchedAt: null };

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

function resolvePrices(instancesData) {
  return {
    restartHourlyPrice: extractHourlyPrice(instancesData, RESTART_TIER),
    fromHourlyPrice: extractHourlyPrice(instancesData, UPGRADE_FROM_TIER),
    toHourlyPrice: extractHourlyPrice(instancesData, UPGRADE_TO_TIER),
  };
}

/**
 * Loads whatever was cached to disk from the last successful live fetch (if
 * any) so getCosts() has real numbers immediately on startup, without
 * waiting on -- or being blocked by -- the live fetch below. This is a
 * seeded fallback, not fabricated data: it was itself written by a real
 * fetch from PRICING_URL at some point, just not necessarily this run.
 */
function loadSeedFromDisk() {
  try {
    const raw = fs.readFileSync(SEED_FILE, 'utf8');
    const seed = JSON.parse(raw);
    pricingCache = { prices: seed.prices, source: 'disk-seed', fetchedAt: seed.fetchedAt };
    console.log(`costService: loaded fallback pricing from disk seed (captured ${seed.fetchedAt})`);
  } catch (err) {
    console.log('costService: no usable disk seed found, cost estimates unavailable until a live fetch succeeds');
  }
}

function saveSeedToDisk(prices) {
  try {
    fs.mkdirSync(path.dirname(SEED_FILE), { recursive: true });
    fs.writeFileSync(
      SEED_FILE,
      JSON.stringify({ region: DEFAULT_REGION, prices, fetchedAt: new Date().toISOString() }, null, 2)
    );
  } catch (err) {
    console.error('costService: failed to persist pricing seed to disk:', err.message);
  }
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
      const instancesData = await fetchPricingOnce();
      const prices = resolvePrices(instancesData);
      pricingCache = { prices, source: 'live', fetchedAt: new Date().toISOString() };
      saveSeedToDisk(prices);
      console.log(`costService: live pricing fetch succeeded (attempt ${attempt}/${MAX_RETRIES}), cached and seeded to disk`);
      return;
    } catch (err) {
      console.error(`costService: pricing fetch attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
        await sleep(delay);
      }
    }
  }
  console.error(
    pricingCache.prices
      ? 'costService: exhausted all live fetch retries, continuing with cached/seeded pricing'
      : 'costService: exhausted all live fetch retries and no seed is available, cost estimates remain unavailable'
  );
}

function getCosts() {
  if (!pricingCache.prices) {
    return { costRestartUsd: null, costUpgradeUsd: null };
  }
  return computeCostDelta(pricingCache.prices);
}

function startPricingRefresh(intervalMs = REFRESH_INTERVAL_MS) {
  loadSeedFromDisk();
  loadPricing();
  return setInterval(loadPricing, intervalMs);
}

module.exports = {
  computeCostDelta,
  extractHourlyPrice,
  getCosts,
  loadPricing,
  loadSeedFromDisk,
  startPricingRefresh,
};
