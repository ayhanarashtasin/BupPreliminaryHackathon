import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConstraints } from '../server/directives.js';
import { optimize } from '../server/optimizer.js';
import { replayPlan } from '../server/replay.js';
import { scenario, directive } from './fixtures.js';

const s = scenario();
const base = await optimize({ hours: s.hours, battery: s.battery, constraints: buildConstraints([], s.hours, s.battery) });
const clone = () => base.map((p) => ({ ...p }));
const check = (plan, directives = []) => replayPlan({ hours: s.hours, battery: s.battery, directives, plan });

const rejects = (mutate, directives = [], label = '') => {
  const plan = clone();
  mutate(plan);
  const r = check(plan, directives);
  assert.equal(r.ok, false, `replay accepted an invalid plan ${label}`);
};

test('accepts the optimizer output it was built from', () => {
  const r = check(clone());
  assert.equal(r.ok, true, r.errors?.join(' | '));
});

test('rejects energy imbalance', () => rejects((p) => (p[5].grid_kwh += 10)));
test('rejects solar overuse', () => {
  rejects((p) => {
    p[12].solar_used_kwh += 25;
    p[12].grid_kwh -= 25;
  });
});
test('rejects solar_reduction that was not applied', () => {
  rejects(() => {}, [directive('solar_reduction', { hours: [12], factor: 0.1 })], 'with unapplied solar reduction');
});
test('rejects a broken battery transition', () => rejects((p) => (p[7].battery_energy_after_kwh += 5)));
test('rejects a charge above the rate limit', () => {
  rejects((p) => {
    p[0].battery_action = 'charge';
    p[0].battery_kwh = 999;
    p[0].grid_kwh += 999;
    p[0].battery_energy_after_kwh += 999;
  });
});
test('rejects battery above capacity', () => {
  rejects((p) => {
    for (let h = 0; h < 24; h++) p[h].battery_energy_after_kwh = 5000;
  });
});
test('rejects a reserve violation', () => {
  rejects(() => {}, [directive('minimum_battery_reserve', { hours: [18, 19], minimum_energy_kwh: 199 })], 'below reserve');
});
test('rejects a forbidden charge', () => {
  const charging = base.find((p) => p.battery_action === 'charge').hour;
  rejects(() => {}, [directive('no_charge_window', { hours: [charging] })], 'in a no-charge window');
});
test('rejects a forbidden discharge', () => {
  const discharging = base.find((p) => p.battery_action === 'discharge').hour;
  rejects(() => {}, [directive('no_discharge_window', { hours: [discharging] })], 'in a no-discharge window');
});
test('rejects a grid cap violation', () => {
  rejects(() => {}, [directive('max_grid_window', { hours: [0], max_grid_kwh: 0 })], 'above the grid cap');
});
test('rejects a wrong end-of-day battery level', () => {
  rejects((p) => {
    p[23].battery_action = 'discharge';
    p[23].battery_kwh = 40;
    p[23].grid_kwh -= 40;
    p[23].battery_energy_after_kwh -= 40;
  });
});
test('rejects idle hours that still move energy', () => {
  rejects((p) => {
    p[6].battery_action = 'idle';
    p[6].battery_kwh = 30;
  });
});
test('rejects negative and non-finite values', () => {
  rejects((p) => (p[4].grid_kwh = -50));
  rejects((p) => (p[4].grid_kwh = NaN));
  rejects((p) => (p[4].battery_action = 'float'));
});
test('rejects wrong hour coverage', () => {
  rejects((p) => p.pop());
  rejects((p) => (p[3].hour = 4));
});
