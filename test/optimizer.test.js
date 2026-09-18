import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConstraints } from '../server/directives.js';
import { optimize } from '../server/optimizer.js';
import { replayPlan } from '../server/replay.js';
import { scenario, directive } from './fixtures.js';

const TOL = 0.01;

async function run(directives, over = {}) {
  const s = scenario(over);
  const constraints = buildConstraints(directives, s.hours, s.battery);
  const plan = await optimize({ hours: s.hours, battery: s.battery, constraints });
  const replay = replayPlan({ hours: s.hours, battery: s.battery, directives, plan });
  assert.equal(replay.ok, true, `replay failed: ${replay.errors?.join(' | ')}`);
  return { s, constraints, plan, replay };
}
const at = (plan, h) => plan.find((p) => p.hour === h);

test('directive application changes the effective constraints', () => {
  const s = scenario();
  const c = buildConstraints(
    [
      directive('solar_reduction', { hours: [10, 11], factor: 0.25 }, 0),
      directive('no_charge_window', { hours: [2, 3] }, 1),
      directive('no_discharge_window', { hours: [18] }, 2),
    ],
    s.hours,
    s.battery,
  );
  assert.equal(c.effectiveSolar[10], 15); // 60 * 0.25
  assert.equal(c.effectiveSolar[12], 60); // untouched
  assert.deepEqual([c.chargeAllowed[2], c.chargeAllowed[3], c.chargeAllowed[4]], [false, false, true]);
  assert.equal(c.dischargeAllowed[18], false);
  assert.equal(c.gridCap[18], Infinity);
});

test('overlapping directives combine conservatively', () => {
  const s = scenario();
  const c = buildConstraints(
    [
      directive('solar_reduction', { hours: [10], factor: 0.5 }, 0),
      directive('solar_reduction', { hours: [10], factor: 0.2 }, 1),
      directive('minimum_battery_reserve', { hours: [18], minimum_energy_kwh: 80 }, 2),
    ],
    s.hours,
    s.battery,
  );
  assert.equal(c.effectiveSolar[10], 12); // strictest remaining availability, 60 * 0.2
  assert.equal(c.effectiveMinimum[18], 80); // max(base 20, directive 80)

  const c2 = buildConstraints(
    [directive('max_grid_window', { hours: [19], max_grid_kwh: 200 }, 0), directive('max_grid_window', { hours: [19], max_grid_kwh: 150 }, 1)],
    s.hours,
    s.battery,
  );
  assert.equal(c2.gridCap[19], 150); // tightest cap
});

test('baseline plan is valid, balanced, battery-neutral and uses free solar', async () => {
  const { s, plan, replay } = await run([]);
  assert.equal(plan.length, 24);
  assert.deepEqual(plan.map((p) => p.hour), Array.from({ length: 24 }, (_, i) => i));
  assert.equal(at(plan, 23).battery_energy_after_kwh, s.battery.initial_energy_kwh);
  assert.equal(at(plan, 12).solar_used_kwh, 60); // solar is free, always worth using
  for (const p of plan) {
    assert.ok(p.grid_kwh >= 0 && p.solar_used_kwh >= 0 && p.battery_kwh >= 0);
    assert.ok(['charge', 'discharge', 'idle'].includes(p.battery_action));
    if (p.battery_action === 'idle') assert.equal(p.battery_kwh, 0);
    assert.ok(!Object.is(p.grid_kwh, -0) && !Object.is(p.battery_kwh, -0));
  }
  // Load shifting: discharge during the expensive evening block.
  assert.ok(plan.filter((p) => p.hour >= 17 && p.hour <= 21 && p.battery_action === 'discharge').length > 0);
  assert.ok(replay.totals.total_cost_bdt > 0);
});

test('solar_reduction actually lowers the solar used in the listed hours', async () => {
  const { plan } = await run([directive('solar_reduction', { hours: [10, 11], factor: 0.25 })]);
  assert.ok(at(plan, 10).solar_used_kwh <= 15 + TOL);
  assert.ok(at(plan, 11).solar_used_kwh <= 15 + TOL);
  assert.equal(at(plan, 12).solar_used_kwh, 60);
});

test('no_charge_window forces charging to zero', async () => {
  const { plan } = await run([directive('no_charge_window', { hours: [2, 3, 4] })]);
  for (const h of [2, 3, 4]) assert.notEqual(at(plan, h).battery_action, 'charge');
});

test('no_discharge_window forces discharging to zero even in expensive hours', async () => {
  const { plan } = await run([directive('no_discharge_window', { hours: [18, 19] })]);
  for (const h of [18, 19]) assert.notEqual(at(plan, h).battery_action, 'discharge');
});

test('minimum_battery_reserve raises the floor in the listed hours', async () => {
  const { plan } = await run([directive('minimum_battery_reserve', { hours: [18, 19, 20], minimum_energy_kwh: 150 })]);
  for (const h of [18, 19, 20]) assert.ok(at(plan, h).battery_energy_after_kwh >= 150 - TOL);
});

test('max_grid_window caps hourly grid import', async () => {
  const { plan } = await run([directive('max_grid_window', { hours: [17, 18, 19], max_grid_kwh: 60 })]);
  for (const h of [17, 18, 19]) assert.ok(at(plan, h).grid_kwh <= 60 + TOL, `hour ${h} grid ${at(plan, h).grid_kwh}`);
});

test('respects hourly charge and discharge rate limits', async () => {
  const { plan } = await run([], { battery: { ...scenario().battery, max_charge_kwh_per_hour: 10, max_discharge_kwh_per_hour: 7 } });
  for (const p of plan) {
    if (p.battery_action === 'charge') assert.ok(p.battery_kwh <= 10 + TOL);
    if (p.battery_action === 'discharge') assert.ok(p.battery_kwh <= 7 + TOL);
  }
});

test('handles zero solar, zero battery headroom, flat tariffs and combined directives', async () => {
  const noSolar = scenario();
  noSolar.hours.forEach((h) => (h.solar_kwh = 0));
  await run([], noSolar);

  const locked = scenario().battery;
  await run([], { battery: { ...locked, initial_energy_kwh: 20, minimum_energy_kwh: 20 } });

  const flat = scenario();
  flat.hours.forEach((h) => (h.tariff_bdt_per_kwh = 7));
  await run([], flat);

  await run([
    directive('solar_reduction', { hours: [10, 11, 12], factor: 0 }, 0),
    directive('no_charge_window', { hours: [13, 14] }, 1),
    directive('minimum_battery_reserve', { hours: [18, 19], minimum_energy_kwh: 120 }, 2),
  ]);
});

test('lower cost is never bought by breaking a directive', async () => {
  const free = await run([]);
  const capped = await run([directive('max_grid_window', { hours: [17, 18, 19, 20, 21], max_grid_kwh: 70 })]);
  assert.ok(capped.replay.totals.total_cost_bdt >= free.replay.totals.total_cost_bdt - TOL);
});

test('totals are derived from the plan', async () => {
  const { s, plan, replay } = await run([]);
  const grid = plan.reduce((a, p) => a + p.grid_kwh, 0);
  const cost = plan.reduce((a, p) => a + p.grid_kwh * s.hours[p.hour].tariff_bdt_per_kwh, 0);
  assert.ok(Math.abs(replay.totals.total_grid_kwh - grid) < TOL);
  assert.ok(Math.abs(replay.totals.total_cost_bdt - cost) < TOL);
  assert.ok(Math.abs(replay.totals.peak_grid_kwh - Math.max(...plan.map((p) => p.grid_kwh))) < TOL);
});
