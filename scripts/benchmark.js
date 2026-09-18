#!/usr/bin/env node
// Latency smoke test against a live service. Measurements taken with a mocked or stubbed
// model are NOT judge-representative: run this against the deployment with the real provider.
//
//   node scripts/benchmark.js [baseUrl] [requests]

import fs from 'node:fs';

const BASE = (process.argv[2] || process.env.BASE_URL || `http://localhost:${process.env.PORT || 8080}`).replace(/\/$/, '');
const COUNT = Number(process.argv[3] || 20);
const FILE = new URL('../BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json', import.meta.url);

const cases = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')).cases.map((c) => c.input) : [];
if (!cases.length) {
  console.error('No scenarios available to benchmark (public sample pack missing).');
  process.exit(1);
}

const health = Date.now();
const h = await fetch(`${BASE}/health`);
console.log(`/health -> ${h.status} ${JSON.stringify(await h.json())} in ${Date.now() - health}ms\n`);

const times = [];
let failures = 0;
for (let i = 0; i < COUNT; i++) {
  const input = { ...cases[i % cases.length], scenario_id: `BENCH-${i}` };
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}/optimize-energy`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    await res.json();
    if (res.status !== 200) failures++;
  } catch {
    failures++;
  }
  times.push(Date.now() - t0);
  process.stdout.write('.');
}

const sorted = [...times].sort((a, b) => a - b);
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
console.log(`\n\nrequests ${COUNT}  failures ${failures}`);
console.log(`min ${sorted[0]}ms  median ${pct(0.5)}ms  p95 ${pct(0.95)}ms  max ${sorted.at(-1)}ms`);
console.log(`avg ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(0)}ms`);
console.log(pct(0.95) <= 5000 ? 'p95 within the 5s full-points target.' : 'p95 above the 5s target.');
