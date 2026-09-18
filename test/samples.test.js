// Offline half of the public-sample check: feeds each case's published ground-truth directives
// straight into the optimizer to prove the scheduling half is correct without spending LLM calls.
// The full end-to-end run (real model included) is `npm run samples` against a live service.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildConstraints } from '../server/directives.js';
import { optimize } from '../server/optimizer.js';
import { replayPlan } from '../server/replay.js';

const FILE = new URL('../BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json', import.meta.url);
const TOL = 0.01;

test('public sample cases: plans are valid and reach the reference optimal cost', { skip: !fs.existsSync(FILE) && 'public sample pack not present' }, async () => {
  const pack = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  for (const c of pack.cases) {
    const hours = [...c.input.hours].sort((a, b) => a.hour - b.hour);
    const battery = c.input.battery;
    const directives = c.expected_output.directive_interpretation;

    const plan = await optimize({ hours, battery, constraints: buildConstraints(directives, hours, battery) });
    const replay = replayPlan({ hours, battery, directives, plan });
    assert.equal(replay.ok, true, `${c.id} replay failed: ${replay.errors?.join(' | ')}`);
    // Equivalent optimal schedules are accepted; the recalculated cost must not be worse.
    assert.ok(
      replay.totals.total_cost_bdt <= c.expected_output.total_cost_bdt + TOL,
      `${c.id} cost ${replay.totals.total_cost_bdt} > reference ${c.expected_output.total_cost_bdt}`,
    );
  }
});
