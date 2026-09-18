import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';
import { scenario, directive, noOp, stubModel } from './fixtures.js';

/** Boot the real Express app on an ephemeral port with an injected model completion. */
async function withServer(complete, fn) {
  const server = createApp({ complete }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(base);
  } finally {
    server.close();
  }
}
const post = (base, body, raw = false) =>
  fetch(`${base}/optimize-energy`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ? body : JSON.stringify(body) });

const okModel = stubModel([directive('solar_reduction', { hours: [13, 14], factor: 0.2 }, 0), noOp(1)]);
const twoNotes = scenario({ operator_notes: ['Solar drops to 20% from 1 PM to 3 PM.', 'The cafeteria menu changes tomorrow.'] });

test('GET /health returns 200 {"status":"ok"}', async () => {
  await withServer(okModel, async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });
});

test('POST /optimize-energy returns the exact response contract', async () => {
  await withServer(okModel, async (base) => {
    const res = await post(base, twoNotes);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(Object.keys(body).sort(), [
      'directive_interpretation', 'hourly_plan', 'peak_grid_kwh', 'plan_summary', 'scenario_id', 'total_cost_bdt', 'total_grid_kwh',
    ]);
    assert.equal(body.scenario_id, twoNotes.scenario_id);
    assert.equal(body.hourly_plan.length, 24);
    assert.equal(body.directive_interpretation.length, 2);
    assert.deepEqual(body.directive_interpretation.map((d) => d.note_index), [0, 1]);
    assert.equal(body.directive_interpretation[1].applies, false);
    assert.equal(body.directive_interpretation[1].structured_adjustment, null);
    for (const e of body.directive_interpretation) {
      assert.deepEqual(Object.keys(e).sort(), ['applies', 'directive_type', 'explanation', 'note_index', 'structured_adjustment']);
    }
    for (const p of body.hourly_plan) {
      assert.deepEqual(Object.keys(p).sort(), ['battery_action', 'battery_energy_after_kwh', 'battery_kwh', 'grid_kwh', 'hour', 'solar_used_kwh']);
    }
    // The interpreted directive is visible in the plan, not just in the interpretation.
    for (const h of [13, 14]) {
      assert.ok(body.hourly_plan[h].solar_used_kwh <= twoNotes.hours[h].solar_kwh * 0.2 + 0.01);
    }
    const grid = body.hourly_plan.reduce((a, p) => a + p.grid_kwh, 0);
    assert.ok(Math.abs(body.total_grid_kwh - grid) < 0.01);
    assert.equal(typeof body.plan_summary, 'string');
  });
});

test('malformed JSON returns a controlled 400', async () => {
  await withServer(okModel, async (base) => {
    const res = await post(base, '{"scenario_id":', true);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(typeof body.error, 'string');
    assert.ok(!JSON.stringify(body).includes('at '), 'no stack trace in the response');
  });
});

test('structurally invalid request returns 400 without touching the model', async () => {
  let called = false;
  await withServer(
    async (...a) => {
      called = true;
      return okModel(...a);
    },
    async (base) => {
      const res = await post(base, { ...twoNotes, hours: [] });
      assert.equal(res.status, 400);
      assert.equal(called, false);
    },
  );
});

test('model failure fails in a controlled way and leaks nothing', async () => {
  const boom = async () => {
    throw new Error('provider 401: key sk-test-SECRET-123 rejected');
  };
  await withServer(boom, async (base) => {
    const res = await post(base, twoNotes);
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.ok(!text.includes('sk-test-SECRET-123'));
    assert.ok(!text.includes('provider 401'));
    assert.equal(typeof JSON.parse(text).error, 'string');
  });
});

test('invalid model structure is rejected rather than guessed into a directive', async () => {
  const cases = [
    async () => 'not json at all',
    stubModel([directive('load_shedding', { hours: [1] }, 0), noOp(1)]),
    stubModel([directive('solar_reduction', { hours: [13, 14], factor: 5 }, 0), noOp(1)]),
    stubModel([noOp(0)]), // missing the second note
    stubModel([noOp(0), noOp(0)]), // duplicate note_index
  ];
  for (const complete of cases) {
    await withServer(complete, async (base) => {
      const res = await post(base, twoNotes);
      assert.equal(res.status, 500);
      assert.equal((await res.json()).hourly_plan, undefined);
    });
  }
});

test('repeated valid requests stay stable', async () => {
  await withServer(okModel, async (base) => {
    for (let i = 0; i < 12; i++) {
      const res = await post(base, { ...twoNotes, scenario_id: `LOOP-${i}` });
      assert.equal(res.status, 200);
      assert.equal((await res.json()).scenario_id, `LOOP-${i}`);
    }
  });
});

test('unknown routes return a controlled 404', async () => {
  await withServer(okModel, async (base) => {
    assert.equal((await fetch(`${base}/optimise-energy`)).status, 404);
  });
});
