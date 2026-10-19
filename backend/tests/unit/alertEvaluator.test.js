const { calculateBreachForecast, buildExplanation } = require('../../services/alertEvaluator');

function makeHistory(pointsWithMinuteOffsets, baseTime = Date.now()) {
  return pointsWithMinuteOffsets.map(([minutesOffset, value]) => ({
    timestamp: new Date(baseTime + minutesOffset * 60000).toISOString(),
    memPercent: value,
  }));
}

describe('calculateBreachForecast', () => {
  it('reports insufficient data with fewer than 2 valid points', () => {
    expect(calculateBreachForecast([], 'memPercent', 90)).toEqual({ hasEnoughData: false });
    expect(
      calculateBreachForecast([{ timestamp: new Date().toISOString(), memPercent: 10 }], 'memPercent', 90)
        .hasEnoughData
    ).toBe(false);
  });

  it('predicts a future breach for a rising trend', () => {
    const data = makeHistory([[0, 50], [1, 60], [2, 70]]);
    const result = calculateBreachForecast(data, 'memPercent', 90);
    expect(result.hasEnoughData).toBe(true);
    expect(result.willBreach).toBe(true);
    expect(result.slope).toBeGreaterThan(0);
    expect(result.minutesToBreach).toBeGreaterThanOrEqual(0);
  });

  it('does not predict a breach for a flat trend', () => {
    const data = makeHistory([[0, 50], [1, 50], [2, 50]]);
    expect(calculateBreachForecast(data, 'memPercent', 90).willBreach).toBe(false);
  });

  it('does not predict a breach for a declining trend', () => {
    const data = makeHistory([[0, 80], [1, 70], [2, 60]]);
    expect(calculateBreachForecast(data, 'memPercent', 90).willBreach).toBe(false);
  });

  it('flags an already-breached current value with willBreach true', () => {
    const data = makeHistory([[0, 85], [1, 92], [2, 95]]);
    const result = calculateBreachForecast(data, 'memPercent', 90);
    expect(result.willBreach).toBe(true);
    expect(result.currentValue).toBeGreaterThanOrEqual(90);
  });

  it('filters out points with invalid timestamps or values', () => {
    const data = [
      { timestamp: 'not-a-date', memPercent: 50 },
      { timestamp: new Date().toISOString(), memPercent: 'NaN' },
    ];
    expect(calculateBreachForecast(data, 'memPercent', 90).hasEnoughData).toBe(false);
  });
});

describe('buildExplanation', () => {
  it('describes a projected future breach', () => {
    const text = buildExplanation({
      containerName: 'api',
      metric: 'memPercent',
      currentValue: 72.345,
      threshold: 90,
      minutesToBreach: 12,
    });
    expect(text).toContain('api');
    expect(text).toContain('72.3');
    expect(text).toContain('90');
    expect(text).toContain('12 minutes');
  });

  it('describes an already-crossed threshold', () => {
    const text = buildExplanation({
      containerName: 'api',
      metric: 'memPercent',
      currentValue: 95,
      threshold: 90,
      minutesToBreach: 0,
    });
    expect(text).toMatch(/already crossed/);
  });
});
