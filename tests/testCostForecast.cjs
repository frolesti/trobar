const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tieredCost, paymentCosts, easUpdateCost, estimate, csv } = require('../scripts/forecastCosts.cjs');
const assumptions = require('../docs/planning/cost-assumptions.json');

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('tiered pricing uses cumulative volume boundaries, not successive block widths', () => {
  const bands = [[100000, 32], [500000, 25.6], [1000000, 19.2], [5000000, 9.6], [1e12, 2.4]];
  near(tieredCost(5000, 5000, bands), 0);
  near(tieredCost(5001, 5000, bands), 0.032);
  near(tieredCost(100000, 5000, bands), 3040);
  near(tieredCost(100001, 5000, bands), 3040.0256);
  near(tieredCost(500000, 5000, bands), 3040 + 400000 / 1000 * 25.6);
  near(tieredCost(1000000, 5000, bands), 3040 + 10240 + 9600);
  near(tieredCost(5000001, 5000, bands), 3040 + 10240 + 9600 + 38400 + 0.0024);
  assert.throws(() => tieredCost(-1, 0, bands));
  assert.throws(() => tieredCost(100, 0, [[50, 1]]));
  assert.throws(() => tieredCost(100, 0, [[100, 1], [50, 1]]));
});

test('Stripe mixes actual charge frequency with monthly amortized revenue', () => {
  const config = { ...assumptions.payment, mix: { monthly: 0, quarterly: 0, annual: 1 } };
  const result = paymentCosts(12, config);
  near(result.gross, 348);
  near(result.transactions, 1);
  near(result.processing, 348 * 0.015 + 0.25);
  near(result.billing, 348 * 0.007);
  near(result.total, result.processing + result.billing);
  near(paymentCosts(1).gross, 35.2);
  assert.throws(() => paymentCosts(1, { ...config, mix: { monthly: 1, quarterly: 1, annual: 0 } }));
});

test('all 15 forecast cases reconcile line items, fees, contingency and annual run rate', () => {
  for (const scenario of Object.keys(assumptions.scenarios)) {
    let previous = 0;
    for (const mau of assumptions.mauLevels) {
      const result = estimate(mau, scenario);
      assert.ok(result.lines.length >= 25);
      near(result.infrastructure, result.lines.reduce((sum, line) => sum + line.costEur, 0));
      near(result.total, result.infrastructure + result.stripe);
      near(result.total, [...result.lines, ...result.paymentLines].reduce((sum, line) => sum + line.costEur, 0));
      near(result.recommendedBudget, result.total * 1.2);
      near(result.annualRunRate, result.total * 12);
      assert.ok(result.total >= previous);
      assert.ok(result.lines.every(line => Number.isFinite(line.costEur) && line.costEur >= 0));
      assert.equal(result.accounts, mau * 3);
      previous = result.total;
    }
  }
  assert.throws(() => estimate(0, 'central'));
  assert.throws(() => estimate(100, 'missing'));
});

test('Firestore daily grants are shared by client and scheduled workloads', () => {
  const prices = require('../docs/planning/cost-rates.json');
  const result = estimate(1000, 'central');
  const readLine = result.lines.find(line => line.item === 'firestoreReads');
  const expectedReads = 6000 * (500 + 160) + 2880 * 1500 + 8640 * 30 +
    3000 * 12 * 3 + 3000 * 12 * 0.5 * 12;
  assert.equal(readLine.quantity, expectedReads);
  near(readLine.costEur, (expectedReads - 30 * 50000) / 100000 * prices.firestore.readsPer100k * assumptions.usdToEur);
});

test('Maps free thresholds and all reported tier boundaries match the calculator', () => {
  const prices = require('../docs/planning/cost-rates.json');
  for (const rate of Object.values(prices.maps)) {
    near(tieredCost(rate.free, rate.free, rate.bands), 0);
    near(tieredCost(rate.free + 1, rate.free, rate.bands), rate.bands[0][1] / 1000);
    for (let index = 0; index < rate.bands.length - 1; index++) {
      const boundary = rate.bands[index][0];
      near(tieredCost(boundary + 1, rate.free, rate.bands) - tieredCost(boundary, rate.free, rate.bands),
        rate.bands[index + 1][1] / 1000);
    }
  }
});

test('FX changes USD-denominated services, never EUR budgets or Stripe', () => {
  const original = estimate(10000, 'central');
  const alternate = estimate(10000, 'central', { ...assumptions, usdToEur: assumptions.usdToEur * 2 });
  near(alternate.maps, original.maps * 2);
  near(alternate.stripe, original.stripe);
  near(alternate.lines.find(line => line.item === 'sportsDataMonthly').costEur, 30);
});

test('Expo bills extra users with 40 MiB each, matching the official worked example', () => {
  const { expo } = require('../docs/planning/cost-rates.json');
  near(easUpdateCost(3000, 100, expo), 0);
  near(easUpdateCost(3001, 100 + 40 / 1024, expo), 0.005);
  near(easUpdateCost(10000, 20 * 5 * 10000 / 1024, expo), 95.3125);
  near(easUpdateCost(10000, 21 * 5 * 10000 / 1024, expo), 100.1953125);
  assert.throws(() => estimate(25000, 'central'), /explicit OSM budget/);
});

test('CSV escapes strings and persisted outputs exactly match current inputs', () => {
  assert.equal(csv([{ item: 'a,"b', cost: 1.2 }], ['item', 'cost']), '"item","cost"\n"a,""b","1.200000"\n');
  const results = Object.keys(assumptions.scenarios).flatMap(name => assumptions.mauLevels.map(mau => estimate(mau, name)));
  const directory = path.resolve(__dirname, '../docs/planning');
  for (const [filename, rows] of [
    ['cost-forecast-summary.csv', results],
    ['cost-forecast-breakdown.csv', results.flatMap(result => [...result.lines, ...result.paymentLines]
      .map(line => ({ scenario: result.scenario, mau: result.mau, ...line })))],
  ]) {
    const actual = fs.readFileSync(path.join(directory, filename), 'utf8');
    const columns = actual.split('\n')[0].split(',').map(value => value.slice(1, -1));
    assert.equal(actual, csv(rows, columns), `${filename} must be regenerated`);
  }
});

test('published monthly, central breakdown and annual tables match the calculator', () => {
  const report = fs.readFileSync(path.resolve(__dirname, '../docs/planning/COST_FORECAST.md'), 'utf8');
  const money = value => value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const count = value => value.toLocaleString('de-DE');
  const row = values => `| ${values.join(' | ')} |`;
  for (const mau of assumptions.mauLevels) {
    const central = estimate(mau, 'central');
    const monthly = ['baix', 'central', 'intensiu'].map(name => money(estimate(mau, name).total));
    assert.ok(report.includes(row([count(mau), ...monthly])), `Monthly table mismatch at ${mau} MAU`);
    assert.ok(report.includes(row([count(mau), ...[
      central.maps, central.firebase, central.distribution, central.stripe, central.total,
    ].map(money)])), `Service table mismatch at ${mau} MAU`);
    assert.ok(report.includes(row([count(mau), ...[
      central.total, central.recommendedBudget, central.annualRunRate,
    ].map(money)])), `Annual/budget table mismatch at ${mau} MAU`);
  }
});
