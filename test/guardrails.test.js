import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInterpretation, DIRECTIVE_TYPES } from '../server/guardrails.js';

const CTX = { noteCount: 1, capacityKwh: 200 };
const wrap = (entry) => ({ directive_interpretation: [entry] });
const entry = (over = {}) => ({
  note_index: 0,
  applies: true,
  directive_type: 'solar_reduction',
  structured_adjustment: { hours: [13, 14], factor: 0.2 },
  explanation: 'solar reduced',
  ...over,
});
const reject = (raw, ctx = CTX) => {
  const r = validateInterpretation(raw, ctx);
  assert.equal(r.ok, false, `expected rejection, got ${JSON.stringify(r)}`);
  return r.error;
};
const accept = (raw, ctx = CTX) => {
  const r = validateInterpretation(raw, ctx);
  assert.equal(r.ok, true, `expected acceptance, got ${JSON.stringify(r)}`);
  return r.directives;
};

test('exactly six directive types are supported', () => {
  assert.equal(DIRECTIVE_TYPES.length, 6);
});

test('accepts each supported directive shape', () => {
  accept(wrap(entry()));
  accept(wrap(entry({ directive_type: 'minimum_battery_reserve', structured_adjustment: { hours: [18, 19, 20], minimum_energy_kwh: 120 } })));
  accept(wrap(entry({ directive_type: 'no_charge_window', structured_adjustment: { hours: [14, 15] } })));
  accept(wrap(entry({ directive_type: 'no_discharge_window', structured_adjustment: { hours: [14, 15] } })));
  accept(wrap(entry({ directive_type: 'max_grid_window', structured_adjustment: { hours: [17, 18, 19], max_grid_kwh: 250 } })));
  accept(wrap(entry({ applies: false, directive_type: 'no_op', structured_adjustment: null })));
});

test('strips model-invented extra keys instead of forwarding them', () => {
  const [d] = accept(wrap(entry({ structured_adjustment: { hours: [13], factor: 0.2, demand_kwh: 999 }, tariff_override: 3 })));
  assert.deepEqual(Object.keys(d).sort(), ['applies', 'directive_type', 'explanation', 'note_index', 'structured_adjustment']);
  assert.deepEqual(Object.keys(d.structured_adjustment).sort(), ['factor', 'hours']);
});

test('rejects unsupported directive types', () => {
  reject(wrap(entry({ directive_type: 'shed_load', structured_adjustment: { hours: [1] } })));
  reject(wrap(entry({ directive_type: null })));
});

test('rejects missing, duplicate and out-of-order note mappings', () => {
  reject({ directive_interpretation: [entry()] }, { ...CTX, noteCount: 2 });
  reject({ directive_interpretation: [entry(), entry()] }, { ...CTX, noteCount: 2 });
  reject({ directive_interpretation: [entry({ note_index: 1 }), entry({ note_index: 0 })] }, { ...CTX, noteCount: 2 });
  reject(wrap(entry({ note_index: 5 })));
});

test('rejects a no_op whose structured_adjustment key is absent rather than null', () => {
  const { note_index, applies, directive_type, explanation } = entry({ applies: false, directive_type: 'no_op' });
  reject(wrap({ note_index, applies, directive_type, explanation })); // key missing entirely
  accept(wrap({ note_index, applies, directive_type, explanation, structured_adjustment: null }));
});

test('rejects wrong applies semantics', () => {
  reject(wrap(entry({ applies: false })));
  reject(wrap(entry({ applies: true, directive_type: 'no_op', structured_adjustment: null })));
  reject(wrap(entry({ applies: false, directive_type: 'no_op', structured_adjustment: { hours: [1] } })));
  reject(wrap(entry({ applies: 'yes' })));
});

test('rejects invalid hour lists', () => {
  reject(wrap(entry({ structured_adjustment: { hours: [], factor: 0.2 } })));
  reject(wrap(entry({ structured_adjustment: { hours: [13, 13], factor: 0.2 } })));
  reject(wrap(entry({ structured_adjustment: { hours: [14, 13], factor: 0.2 } })));
  reject(wrap(entry({ structured_adjustment: { hours: [24], factor: 0.2 } })));
  reject(wrap(entry({ structured_adjustment: { hours: [-1], factor: 0.2 } })));
  reject(wrap(entry({ structured_adjustment: { hours: [13.5], factor: 0.2 } })));
  reject(wrap(entry({ structured_adjustment: { hours: '13-14', factor: 0.2 } })));
});

test('rejects out-of-range numeric values', () => {
  reject(wrap(entry({ structured_adjustment: { hours: [13], factor: -0.1 } })));
  reject(wrap(entry({ structured_adjustment: { hours: [13], factor: 1.5 } })));
  reject(wrap(entry({ structured_adjustment: { hours: [13], factor: 'low' } })));
  const reserve = (v) => wrap(entry({ directive_type: 'minimum_battery_reserve', structured_adjustment: { hours: [18], minimum_energy_kwh: v } }));
  reject(reserve(-1));
  reject(reserve(201)); // above capacity
  accept(reserve(200));
  const cap = (v) => wrap(entry({ directive_type: 'max_grid_window', structured_adjustment: { hours: [18], max_grid_kwh: v } }));
  reject(cap(-5));
  reject(cap(Infinity));
  accept(cap(0));
});

test('rejects malformed envelopes', () => {
  reject(null);
  reject([]);
  reject({});
  reject({ directive_interpretation: {} });
  reject(wrap('not-an-object'));
  reject(wrap(entry({ structured_adjustment: null })));
});

test('supplies a deterministic explanation when the model omits it', () => {
  const [d] = accept(wrap(entry({ explanation: '   ' })));
  assert.ok(d.explanation.length > 0);
});
