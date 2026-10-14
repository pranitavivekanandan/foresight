// No live API calls here -- all tests use stubbed fixture pricing data.
const { computeCostDelta, extractHourlyPrice } = require('../../services/costService');

describe('extractHourlyPrice', () => {
  const fixture = [
    { instance_type: 't3.medium', pricing: { 'us-east-1': { linux: { ondemand: '0.0416' } } } },
    { instance_type: 't3.large', pricing: { 'us-east-1': { linux: { ondemand: '0.0832' } } } },
  ];

  it('extracts a known price', () => {
    expect(extractHourlyPrice(fixture, 't3.medium', 'us-east-1', 'linux')).toBeCloseTo(0.0416);
  });

  it('returns null for an unknown instance type', () => {
    expect(extractHourlyPrice(fixture, 'm5.huge', 'us-east-1', 'linux')).toBeNull();
  });

  it('returns null when region pricing is missing', () => {
    expect(extractHourlyPrice(fixture, 't3.medium', 'eu-west-9', 'linux')).toBeNull();
  });
});

describe('computeCostDelta', () => {
  it('computes a plausible near-zero restart cost from a known hourly price', () => {
    const { costRestartUsd } = computeCostDelta({
      restartHourlyPrice: 0.0416,
      fromHourlyPrice: null,
      toHourlyPrice: null,
    });
    // computeCostDelta rounds to 4 decimals, so compare against that rounded value
    expect(costRestartUsd).toBeCloseTo(Number((0.0416 / 60).toFixed(4)), 4);
    expect(costRestartUsd).toBeLessThan(0.01);
  });

  it('computes a positive upgrade delta over the window when upgrading to a pricier tier', () => {
    const { costUpgradeUsd } = computeCostDelta({
      restartHourlyPrice: null,
      fromHourlyPrice: 0.0416,
      toHourlyPrice: 0.0832,
      windowHours: 730,
    });
    expect(costUpgradeUsd).toBeCloseTo((0.0832 - 0.0416) * 730, 2);
    expect(costUpgradeUsd).toBeGreaterThan(0);
  });

  it('returns null fields when prices are unavailable', () => {
    expect(
      computeCostDelta({ restartHourlyPrice: null, fromHourlyPrice: null, toHourlyPrice: null })
    ).toEqual({ costRestartUsd: null, costUpgradeUsd: null });
  });
});
