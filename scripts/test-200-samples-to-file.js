#!/usr/bin/env node
/**
 * 200 Comprehensive Sample Cases Evaluator against Live API.
 * Evaluates GET /health and POST /optimize-energy for all 200 benchmark scenarios.
 * Saves results incrementally to test/200-sample-test-results.json and test/200-sample-test-results.md.
 * Features:
 * - Polite pacing (2.1s sleep) to respect LLM rate limits (Groq 30 RPM)
 * - Automatic retry on 429 and transient 500 errors
 * - Resume mode: re-tests failed or missing cases while preserving verified successes
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayPlan } from '../server/replay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isFresh = process.argv.includes('--fresh');
const nonFlagArgs = process.argv.slice(2).filter(a => !a.startsWith('--'));
const BASE_URL = (nonFlagArgs[0] || process.env.BASE_URL || 'https://bup-preliminary-hackathon.vercel.app').replace(/\/$/, '');
const SAMPLE_FILE = path.join(rootDir, 'BUP_CSE_FEST_2026_Preli_200_Sample_Cases.json');
const RESULTS_JSON = path.join(rootDir, 'test', '200-sample-test-results.json');
const RESULTS_MD = path.join(rootDir, 'test', '200-sample-test-results.md');

const TOL = 0.01;
const near = (a, b) => Math.abs(a - b) <= TOL;

if (!fs.existsSync(SAMPLE_FILE)) {
  console.error(`Sample file not found at ${SAMPLE_FILE}`);
  process.exit(1);
}

const pack = JSON.parse(fs.readFileSync(SAMPLE_FILE, 'utf8'));
const totalCases = pack.cases.length;

// Check for existing valid results if not running --fresh
const existingMap = new Map();
if (!isFresh && fs.existsSync(RESULTS_JSON)) {
  try {
    const prev = JSON.parse(fs.readFileSync(RESULTS_JSON, 'utf8'));
    if (Array.isArray(prev.cases)) {
      for (const cr of prev.cases) {
        if (cr.passed && cr.status_code === 200 && cr.replay?.ok) {
          existingMap.set(cr.case_id, cr);
        }
      }
    }
    console.log(`Loaded ${existingMap.size} previously passed cases from cache.`);
  } catch (e) {
    console.log('No valid previous results cache found; starting clean.');
  }
}

function compareInterpretation(got, want) {
  const problems = [];
  if (!Array.isArray(got) || got.length !== want.length) {
    return [`expected ${want.length} interpretation entries, got ${got?.length}`];
  }
  for (let i = 0; i < want.length; i++) {
    const g = got[i];
    const w = want[i];
    if (g.note_index !== i) problems.push(`entry ${i}: note_index ${g.note_index} (expected ${i})`);
    if (g.applies !== w.applies) problems.push(`note ${i}: applies ${g.applies}, expected ${w.applies}`);
    if (g.directive_type !== w.directive_type) problems.push(`note ${i}: directive_type "${g.directive_type}", expected "${w.directive_type}"`);
    if (typeof g.explanation !== 'string' || !g.explanation.trim()) problems.push(`note ${i}: explanation must be a non-empty string`);
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, options, maxRetries = 3) {
  let attempt = 0;
  let lastRes = null;
  let lastLatency = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    attempt++;
    const start = Date.now();
    try {
      const res = await fetch(url, options);
      const latency = Date.now() - start;
      lastRes = res;
      lastLatency = latency;

      if (res.status === 429) {
        const waitTime = Math.min(30000, 3000 * Math.pow(1.5, attempt));
        console.log(`   [Rate Limit 429] Backing off for ${waitTime}ms before retry ${attempt}/${maxRetries}...`);
        await sleep(waitTime);
        continue;
      }

      if (res.status === 500) {
        let text = '';
        try {
          const clone = res.clone();
          text = await clone.text();
        } catch {}
        if (text.includes('operator note interpretation could not be validated')) {
          const waitTime = Math.min(30000, 3500 * Math.pow(1.5, attempt));
          console.log(`   [Transient LLM 500] Backing off for ${waitTime}ms before retry ${attempt}/${maxRetries}...`);
          await sleep(waitTime);
          continue;
        }
      }

      return { res, latency, error: null };
    } catch (err) {
      const latency = Date.now() - start;
      lastLatency = latency;
      lastError = err.message;
      if (attempt <= maxRetries) {
        console.log(`   [Network Error: ${err.message}] Retrying ${attempt}/${maxRetries}...`);
        await sleep(2000 * attempt);
        continue;
      }
      return { res: null, latency, error: err.message };
    }
  }

  return { res: lastRes, latency: lastLatency, error: lastError };
}

console.log(`=== Starting 200 Sample Cases Test Run ===`);
console.log(`Target: ${BASE_URL}`);
console.log(`Total Cases: ${totalCases}\n`);

const testStartTime = new Date().toISOString();

// 1. Health Check
console.log('--- Checking GET /health ---');
let healthResult = {
  endpoint: `${BASE_URL}/health`,
  method: 'GET',
  success: false,
  status: null,
  latency_ms: null,
  body: null,
  error: null,
};

const hStart = Date.now();
try {
  const hRes = await fetch(`${BASE_URL}/health`);
  healthResult.status = hRes.status;
  healthResult.latency_ms = Date.now() - hStart;
  healthResult.body = await hRes.json();
  healthResult.success = hRes.status === 200 && healthResult.body?.status === 'ok';
  console.log(`GET /health -> HTTP ${hRes.status} in ${healthResult.latency_ms}ms: ${JSON.stringify(healthResult.body)}\n`);
} catch (err) {
  healthResult.latency_ms = Date.now() - hStart;
  healthResult.error = err.message;
  console.error(`GET /health failed: ${err.message}\n`);
}

// 2. Run all 200 sample cases
const caseResults = [];
const latencies = [];
let passedCount = 0;
let qualityRatioSum = 0;

function saveProgress() {
  const sortedLat = [...latencies].sort((a, b) => a - b);
  const p95Idx = sortedLat.length ? Math.min(sortedLat.length - 1, Math.ceil(sortedLat.length * 0.95) - 1) : 0;
  const p95 = sortedLat[p95Idx] || 0;
  const avgLat = sortedLat.length ? Math.round(sortedLat.reduce((a, b) => a + b, 0) / sortedLat.length) : 0;
  const avgQual = caseResults.length ? Number(((qualityRatioSum / caseResults.length) * 100).toFixed(2)) : 0;

  const currentSummary = {
    test_executed_at: testStartTime,
    last_updated_at: new Date().toISOString(),
    base_url: BASE_URL,
    health_check: healthResult,
    total_cases: totalCases,
    completed_cases: caseResults.length,
    passed_cases: passedCount,
    failed_cases: caseResults.length - passedCount,
    pass_rate_percent: caseResults.length ? Number(((passedCount / caseResults.length) * 100).toFixed(1)) : 0,
    average_cost_quality_percent: avgQual,
    latency_metrics_ms: {
      min: sortedLat[0] || 0,
      median: sortedLat[Math.floor(sortedLat.length / 2)] || 0,
      average: avgLat,
      p95: p95,
      max: sortedLat[sortedLat.length - 1] || 0,
    },
    category_summary: {},
    cases: caseResults,
  };

  for (const cr of caseResults) {
    const cat = cr.category || 'unknown';
    if (!currentSummary.category_summary[cat]) {
      currentSummary.category_summary[cat] = { total: 0, passed: 0, failed: 0, avg_quality: 0, sum_ratio: 0 };
    }
    const csum = currentSummary.category_summary[cat];
    csum.total++;
    if (cr.passed) csum.passed++;
    else csum.failed++;
    csum.sum_ratio += (cr.replay?.cost_quality_ratio || 0);
    csum.avg_quality = Number(((csum.sum_ratio / csum.total) * 100).toFixed(1));
  }

  fs.writeFileSync(RESULTS_JSON, JSON.stringify(currentSummary, null, 2), 'utf8');

  let md = `# GridWise 200 Sample Cases Test Evaluation Report

**Execution Timestamp:** \`${testStartTime}\`  
**Target Host / Base URL:** \`${BASE_URL}\`  
**Test Suite:** \`BUP_CSE_FEST_2026_Preli_200_Sample_Cases.json\` (200 Scenarios)  
**Progress:** **${caseResults.length} / ${totalCases} Completed**  
**Current Pass Rate:** **${passedCount} / ${caseResults.length} (${currentSummary.pass_rate_percent}%)**  
**Average Cost Quality:** **${avgQual}%**  
**P95 Latency:** **${p95}ms**

---

## 1. Executive Summary & Category Breakdown

| Category | Total Tested | Passed | Failed | Pass Rate | Avg Cost Quality |
|---|:---:|:---:|:---:|:---:|:---:|
`;

  for (const [cat, s] of Object.entries(currentSummary.category_summary)) {
    const rate = s.total ? ((s.passed / s.total) * 100).toFixed(1) : 0;
    md += `| **${cat.toUpperCase()}** | ${s.total} | ${s.passed} | ${s.failed} | ${rate}% | ${s.avg_quality}% |\n`;
  }

  md += `| **OVERALL** | **${caseResults.length}** | **${passedCount}** | **${caseResults.length - passedCount}** | **${currentSummary.pass_rate_percent}%** | **${avgQual}%** |

---

## 2. Latency & Performance Profile

- **Min Latency:** \`${currentSummary.latency_metrics_ms.min}ms\`
- **Median Latency:** \`${currentSummary.latency_metrics_ms.median}ms\`
- **Average Latency:** \`${currentSummary.latency_metrics_ms.average}ms\`
- **P95 Latency:** \`${currentSummary.latency_metrics_ms.p95}ms\`
- **Max Latency:** \`${currentSummary.latency_metrics_ms.max}ms\`

---

## 3. Results Summary Table

| # | Case ID | Category | Status | Latency | Replay | Reported Cost | Reference Cost | Quality | Result |
|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
`;

  for (let idx = 0; idx < caseResults.length; idx++) {
    const cr = caseResults[idx];
    const repCost = (cr.replay.reported_totals && cr.replay.reported_totals.total_cost_bdt != null) ? cr.replay.reported_totals.total_cost_bdt.toFixed(2) : 'N/A';
    const refCost = cr.replay.reference_cost_bdt != null ? cr.replay.reference_cost_bdt.toFixed(2) : 'N/A';
    const qual = cr.replay.cost_quality_percent != null ? `${cr.replay.cost_quality_percent}%` : 'N/A';
    const mark = cr.passed ? '✅ PASS' : '❌ FAIL';
    md += `| ${idx + 1} | **${cr.case_id}** | ${cr.category} | \`${cr.status_code}\` | ${cr.latency_ms}ms | ${cr.replay.ok ? 'VALID' : 'INVALID'} | ${repCost} | ${refCost} | ${qual} | ${mark} |\n`;
  }

  fs.writeFileSync(RESULTS_MD, md, 'utf8');
}

for (let idx = 0; idx < totalCases; idx++) {
  const c = pack.cases[idx];
  const caseNum = idx + 1;

  // Check cache if not fresh
  if (existingMap.has(c.id)) {
    const cached = existingMap.get(c.id);
    latencies.push(cached.latency_ms || 1000);
    passedCount++;
    qualityRatioSum += (cached.replay?.cost_quality_ratio || 1.0);
    caseResults.push(cached);
    const costStr = cached.replay?.reported_totals?.total_cost_bdt != null ? cached.replay.reported_totals.total_cost_bdt.toFixed(2) : 'OK';
    console.log(`[${String(caseNum).padStart(3, ' ')}/200] CACHED-OK [${c.id}] | cost ${costStr} | ${c.label}`);
    continue;
  }

  const { res, latency: latencyMs, error: fetchError } = await fetchWithRetry(
    `${BASE_URL}/optimize-energy`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(c.input),
    },
    3
  );

  latencies.push(latencyMs);

  const problems = [];
  let status = res ? res.status : 0;
  let body = null;

  if (fetchError) {
    problems.push(`Fetch error: ${fetchError}`);
  } else {
    try {
      body = await res.json();
    } catch (e) {
      problems.push(`JSON parse error: ${e.message}`);
    }
  }

  if (status !== 200 && !problems.length) {
    problems.push(`HTTP ${status}: ${JSON.stringify(body).slice(0, 250)}`);
  }

  let costQuality = 0;
  let replay = { ok: false, errors: ['No response'] };

  if (status === 200 && body) {
    const expectedKeys = ['scenario_id', 'plan_summary', 'directive_interpretation', 'hourly_plan', 'total_cost_bdt', 'total_grid_kwh', 'peak_grid_kwh'];
    for (const k of expectedKeys) {
      if (!(k in body)) problems.push(`Missing key: ${k}`);
    }

    if (body.scenario_id !== c.input.scenario_id) {
      problems.push(`scenario_id "${body.scenario_id}" !== "${c.input.scenario_id}"`);
    }

    const interpProblems = compareInterpretation(body.directive_interpretation, c.expected_output.directive_interpretation);
    problems.push(...interpProblems);

    const sortedHours = [...c.input.hours].sort((a, b) => a.hour - b.hour);
    replay = replayPlan({
      hours: sortedHours,
      battery: c.input.battery,
      directives: c.expected_output.directive_interpretation,
      plan: body.hourly_plan,
    });

    if (!replay.ok) {
      problems.push(...replay.errors);
    } else {
      for (const [k, v] of Object.entries(replay.totals)) {
        if (!near(body[k], v)) problems.push(`${k} reported ${body[k]}, replayed ${v}`);
      }
      costQuality = Math.min(1, c.expected_output.total_cost_bdt / replay.totals.total_cost_bdt);
      qualityRatioSum += costQuality;
    }
  }

  const passed = problems.length === 0;
  if (passed) passedCount++;

  const caseResult = {
    case_id: c.id,
    label: c.label,
    category: c.category || 'unknown',
    passed,
    status_code: status,
    latency_ms: latencyMs,
    problems,
    interpretation: {
      matches_ground_truth: (body?.directive_interpretation && compareInterpretation(body.directive_interpretation, c.expected_output.directive_interpretation).length === 0) || false,
      actual: body?.directive_interpretation || null,
      expected: c.expected_output.directive_interpretation,
    },
    replay: {
      ok: replay.ok,
      errors: replay.errors || [],
      recalculated_totals: replay.totals || null,
      reported_totals: body ? {
        total_cost_bdt: body.total_cost_bdt,
        total_grid_kwh: body.total_grid_kwh,
        peak_grid_kwh: body.peak_grid_kwh,
      } : null,
      reference_cost_bdt: c.expected_output.total_cost_bdt,
      cost_quality_ratio: costQuality,
      cost_quality_percent: Number((costQuality * 100).toFixed(2)),
    },
    response: body,
  };

  caseResults.push(caseResult);

  const mark = passed ? 'OK ' : 'FAIL';
  const costMsg = replay.ok ? `cost ${replay.totals.total_cost_bdt.toFixed(2)} (ref ${c.expected_output.total_cost_bdt.toFixed(2)})` : 'replay failed';
  console.log(`[${String(caseNum).padStart(3, ' ')}/200] ${mark} [${c.id}] ${String(latencyMs).padStart(5)}ms | ${costMsg} | ${c.label}`);
  if (problems.length > 0) {
    for (const p of problems) console.log(`         -> ${p}`);
  }

  // Save progress periodically every 5 cases or at the end
  if (caseNum % 5 === 0 || caseNum === totalCases) {
    saveProgress();
  }

  // Polite pacing: 2.1s delay between live requests to strictly stay below Groq's 30 RPM limit
  await sleep(2100);
}

saveProgress();

console.log(`\n=============================================================`);
console.log(`COMPLETED 200 CASES: ${passedCount}/${totalCases} passed (${((passedCount / totalCases) * 100).toFixed(1)}%)`);
console.log(`Saved results JSON to: ${RESULTS_JSON}`);
console.log(`Saved results Markdown to: ${RESULTS_MD}`);
console.log(`=============================================================\n`);
