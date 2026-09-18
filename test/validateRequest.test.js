import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest } from '../server/validateRequest.js';
import { scenario } from './fixtures.js';

const status = (body) => {
  const r = validateRequest(body);
  return r.ok ? 200 : r.status;
};

test('accepts a well-formed scenario and normalises hour order', () => {
  const body = scenario();
  body.hours = [...body.hours].reverse();
  const r = validateRequest(body);
  assert.equal(r.ok, true);
  assert.deepEqual(r.request.hours.map((h) => h.hour), Array.from({ length: 24 }, (_, i) => i));
  assert.equal(r.request.scenario_id, 'TEST-1');
});

test('rejects structurally invalid bodies with 400', () => {
  assert.equal(status(null), 400);
  assert.equal(status('{}'), 400);
  assert.equal(status(scenario({ scenario_id: 42 })), 400);
  assert.equal(status(scenario({ scenario_id: '' })), 400);
  assert.equal(status(scenario({ operator_notes: [] })), 400);
  assert.equal(status(scenario({ operator_notes: ['a', 'b', 'c', 'd'] })), 400);
  assert.equal(status(scenario({ operator_notes: ['  '] })), 400);
  assert.equal(status(scenario({ operator_notes: [123] })), 400);
  assert.equal(status(scenario({ operator_notes: 'a note' })), 400);
  assert.equal(status(scenario({ battery: undefined })), 400);
});

test('rejects broken hour arrays with 400', () => {
  const short = scenario();
  short.hours = short.hours.slice(0, 23);
  assert.equal(status(short), 400);

  const dup = scenario();
  dup.hours[5] = { ...dup.hours[4] };
  assert.equal(status(dup), 400);

  const missing = scenario();
  missing.hours[23] = { ...missing.hours[22], hour: 22 };
  assert.equal(status(missing), 400);

  const nan = scenario();
  nan.hours[3].demand_kwh = 'lots';
  assert.equal(status(nan), 400);

  const infinite = scenario();
  infinite.hours[3].tariff_bdt_per_kwh = Infinity;
  assert.equal(status(infinite), 400);

  const outOfRange = scenario();
  outOfRange.hours[3].hour = 24;
  assert.equal(status(outOfRange), 400);
});

test('rejects missing or non-finite battery fields with 400', () => {
  for (const f of ['capacity_kwh', 'initial_energy_kwh', 'minimum_energy_kwh', 'max_charge_kwh_per_hour', 'max_discharge_kwh_per_hour']) {
    const b = scenario();
    delete b.battery[f];
    assert.equal(status(b), 400, `missing battery.${f}`);
  }
});

test('rejects semantically contradictory scenarios with 422', () => {
  const negative = scenario();
  negative.hours[2].demand_kwh = -5;
  assert.equal(status(negative), 422);
  assert.equal(status(scenario({ battery: { ...scenario().battery, capacity_kwh: 0 } })), 422);
  assert.equal(status(scenario({ battery: { ...scenario().battery, minimum_energy_kwh: 500 } })), 422);
  assert.equal(status(scenario({ battery: { ...scenario().battery, initial_energy_kwh: 500 } })), 422);
  assert.equal(status(scenario({ battery: { ...scenario().battery, initial_energy_kwh: 10, minimum_energy_kwh: 20 } })), 422);
  assert.equal(status(scenario({ battery: { ...scenario().battery, max_charge_kwh_per_hour: -1 } })), 422);
});
