#!/usr/bin/env node
/**
 * 200 Sample Case Runner with Filtering & Batch Evaluation.
 *
 * Usage:
 *   node scripts/run-200-samples.js [baseUrl] [--limit N] [--category good|bad|worst|edge|official]
 *
 * Example:
 *   node scripts/run-200-samples.js https://bup-preliminary-hackathon.vercel.app --limit 20
 *   node scripts/run-200-samples.js https://bup-preliminary-hackathon.vercel.app --category worst
 */

import fs from 'node:fs';
import { replayPlan } from '../server/replay.js';

const args = process.argv.slice(2);
let baseUrl = (process.env.BASE_URL || 'https://bup-preliminary-hackathon.vercel.app').replace(/\/$/, '');
let limit = null;
let targetCategory = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && args[i + 1]) {
    limit = parseInt(args[++i], 10);
  } else if (args[i] === '--category' && args[i + 1]) {
    targetCategory = args[++i].toLowerCase();
  } else if (!args[i].startsWith('--')) {
    baseUrl = args[i].replace(/\/$/, '');
  }
}

const FILE = new URL('../BUP_CSE_FEST_2026_Preli_200_Sample_Cases.json', import.meta.url);
const TOL = 0.01;
const near = (a, b) => Math.abs(a - b) <= TOL;

if (!fs.existsSync(FILE)) {
  console.error('200 sample case pack not found.');
  process.exit(1);
}

const pack = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let casesToRun = pack.cases;

if (targetCategory) {
  casesToRun = casesToRun.filter((c) => (c.category || '').toLowerCase() === targetCategory);
}
if (limit && limit > 0) {
  casesToRun = casesToRun.slice(0, limit);
}

console.log(`GridWise 200 Sample Case Runner -> ${baseUrl}`);
console.log(`Evaluating ${casesToRun.length} cases${targetCategory ? ` [category: ${targetCategory}]` : ''}...\n`);

function compareInterpretation(got, want) {
  const problems = [];
  if (!Array.isArray(got) || got.length !== want.length) return [`expected ${want.length} interpretation entries, got ${got?.length}`];
  for (let i = 0; i < want.length; i++) {
    const g = got[i];
    const w = want[i];
    if (g.note_index !== i) problems.push(`entry ${i}: note_index ${g.note_index} (entries must be ordered 0..N-1)`);
    if (g.applies !== w.applies) problems.push(`note ${i}: applies ${g.applies}, expected ${w.applies}`);
    if (g.directive_type !== w.directive_type) problems.push(`note ${i}: directive_type "${g.directive_type}", expected "${w.directive_type}"`);
    if (typeof g.explanation !== 'string') problems.push(`note ${i}: explanation must be a string`);
    const a = g.structured_adjustment;
    const e = w.structured_adjustment;
    if (e === null) {
      if (a !== null) problems.push(`note ${i}: structured_adjustment must be null for no_op`);
      continue;
    }
    if (!a) {
      problems.push(`note ${i}: structured_adjustment missing`);
      continue;
    }
    if (String(a.hours) !== String(e.hours)) problems.push(`note ${i}: hours [${a.hours}], expected [${e.hours}]`);
    for (const k of ['factor', 'minimum_energy_kwh', 'max_grid_kwh']) {
      if (k in e && !near(a[k], e[k])) problems.push(`note ${i}: ${k} ${a[k]}, expected ${e[k]}`);
    }
  }
  return problems;
}

let failed = 0;
let ratioSum = 0;
const latencies = [];

for (const c of casesToRun) {
  const started = Date.now();
  let res, body;
  try {
    res = await fetch(`${baseUrl}/optimize-energy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(c.input),
    });
    body = await res.json();
  } catch (err) {
    console.log(`FAIL ${c.id}  request failed: ${err.message}`);
    failed++;
    continue;
  }
  const ms = Date.now() - started;
  latencies.push(ms);

  const problems = [];
  if (res.status !== 200) problems.push(`HTTP ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  else {
    if (body.scenario_id !== c.input.scenario_id) problems.push('scenario_id was not echoed');
    if (typeof body.plan_summary !== 'string' || !body.plan_summary) problems.push('plan_summary missing');
    problems.push(...compareInterpretation(body.directive_interpretation, c.expected_output.directive_interpretation));

    const hours = [...c.input.hours].sort((a, b) => a.hour - b.hour);
    const replay = replayPlan({ hours, battery: c.input.battery, directives: c.expected_output.directive_interpretation, plan: body.hourly_plan });
    if (!replay.ok) problems.push(...replay.errors);
    else {
      for (const [k, v] of Object.entries(replay.totals)) {
        if (!near(body[k], v)) problems.push(`${k} reported ${body[k]}, recalculated ${v}`);
      }
      const ratio = Math.min(1, c.expected_output.total_cost_bdt / replay.totals.total_cost_bdt);
      ratioSum += ratio;
      console.log(
        `${problems.length ? 'FAIL' : ' OK '} [${c.id}] ${String(ms).padStart(5)}ms | cost ${replay.totals.total_cost_bdt.toFixed(2)} ` +
          `(ref ${c.expected_output.total_cost_bdt.toFixed(2)}) quality ${(ratio * 100).toFixed(1)}% | ${c.label}`,
      );
    }
  }
  if (problems.length) {
    failed++;
    if (res.status !== 200 || !body.hourly_plan) console.log(`FAIL [${c.id}] ${String(ms).padStart(5)}ms | ${c.label}`);
    for (const p of problems) console.log(`       - ${p}`);
  }
}

const sorted = [...latencies].sort((a, b) => a - b);
const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] : 0;
const passedCount = casesToRun.length - failed;
const avgCostQuality = casesToRun.length ? ((ratioSum / casesToRun.length) * 100).toFixed(1) : '0.0';

console.log(
  `\n==================================================================\n` +
  `RESULTS: ${passedCount}/${casesToRun.length} cases passed (${((passedCount / casesToRun.length) * 100).toFixed(1)}%) | ` +
  `Avg Cost Quality: ${avgCostQuality}% | p95 Latency: ${p95}ms\n` +
  `==================================================================\n`
);

process.exit(failed ? 1 : 0);
