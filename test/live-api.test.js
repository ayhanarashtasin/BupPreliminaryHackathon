// Live endpoint test suite against the deployed service or local base URL.
// Tests GET /health and POST /optimize-energy using public sample cases.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayPlan } from '../server/replay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Opt-in: this suite needs a reachable deployment and a live provider key, so it must never
// fail `npm test` in an offline or key-less environment. Run it with:
//   BASE_URL=https://your-deployment npm test        (or: npm run test:live)
const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
const skip = BASE_URL ? false : 'set BASE_URL to run the live endpoint suite';
const SAMPLE_FILE = path.join(rootDir, 'BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json');
const TOL = 0.01;

test('Live API: GET /health returns 200 {"status":"ok"}', { skip }, async () => {
  const res = await fetch(`${BASE_URL}/health`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const data = await res.json();
  assert.deepEqual(data, { status: 'ok' });
});

test('Live API: POST /optimize-energy solves public sample cases accurately', { skip, timeout: 60000 }, async () => {
  assert.ok(fs.existsSync(SAMPLE_FILE), 'Public sample file must exist');
  const pack = JSON.parse(fs.readFileSync(SAMPLE_FILE, 'utf8'));

  // Test the first sample case end-to-end to ensure live pipeline integrity
  const sample = pack.cases[0];
  const res = await fetch(`${BASE_URL}/optimize-energy`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(sample.input),
  });

  assert.equal(res.status, 200, `Expected HTTP 200, got ${res.status}`);
  const body = await res.json();

  assert.equal(body.scenario_id, sample.input.scenario_id);
  assert.equal(typeof body.plan_summary, 'string');
  assert.equal(body.hourly_plan.length, 24);
  assert.equal(body.directive_interpretation.length, sample.expected_output.directive_interpretation.length);

  const hours = [...sample.input.hours].sort((a, b) => a.hour - b.hour);
  const replay = replayPlan({
    hours,
    battery: sample.input.battery,
    directives: sample.expected_output.directive_interpretation,
    plan: body.hourly_plan,
  });

  assert.equal(replay.ok, true, `Replay errors: ${replay.errors?.join(', ')}`);
  assert.ok(
    body.total_cost_bdt <= sample.expected_output.total_cost_bdt + TOL,
    `Reported cost ${body.total_cost_bdt} exceeds reference ${sample.expected_output.total_cost_bdt}`,
  );
});
