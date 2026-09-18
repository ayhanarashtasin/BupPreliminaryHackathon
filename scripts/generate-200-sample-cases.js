#!/usr/bin/env node
/**
 * 200 Comprehensive Smart Campus Energy Optimization Sample Case Generator.
 * Generates 200 diverse, realistic scenarios categorized into:
 * - Official Benchmark (10 cases)
 * - Good / Favorable / Generous (50 cases)
 * - Bad / Challenging / Stressed (70 cases)
 * - Worst / Extreme / Boundary (50 cases)
 * - Edge Cases & Paraphrase Traps (20 cases)
 *
 * Every scenario is mathematically solved using GLPK (optimizer.js) and verified
 * by deterministic replay (replay.js) to guarantee 100% feasibility and optimality.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConstraints } from '../server/directives.js';
import { optimize } from '../server/optimizer.js';
import { replayPlan } from '../server/replay.js';
import { buildSummary } from '../server/pipeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const ORIGINAL_FILE = path.join(rootDir, 'BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json');
const BACKUP_FILE = path.join(rootDir, 'BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.original.json');
const OUTPUT_200_ROOT = path.join(rootDir, 'BUP_CSE_FEST_2026_Preli_200_Sample_Cases.json');
const OUTPUT_200_TEST = path.join(rootDir, 'test', '200_sample_cases.json');

// Distractor pool
const DISTRACTORS = [
  "The sports office moved next month's registration deadline.",
  "The campus cafeteria will serve a special dinner menu tomorrow.",
  "Library heating ventilation filters were inspected last Tuesday.",
  "Faculty council meeting rescheduled to 3 PM in the administration hall.",
  "Water supply pump in dormitory 4 was serviced yesterday afternoon.",
  "Final examination timetable has been published on the student portal.",
  "Guest lecture on quantum computing will take place in Auditorium 2 on Friday.",
  "Campus Wi-Fi routers in building B will undergo a scheduled firmware update tonight.",
  "Parking lot 3 will be reserved for VIP vehicles during tomorrow's academic seminar.",
  "Blood donation camp organized by the student youth club this coming Sunday.",
  "The university chancellor will visit the newly constructed STEM complex next Thursday.",
  "Annual inter-department debate tournament registrations close this evening.",
  "Tree trimming along North Campus boulevard is scheduled for next weekend.",
  "The gymnasium fitness center will receive new elliptical machines on Monday.",
  "Academic calendar update: fall semester break dates have been approved."
];

function getRandomDistractor(seed) {
  return DISTRACTORS[seed % DISTRACTORS.length];
}

// Generate demand profiles
function createDemand(type, scale = 1.0) {
  const baseAcademic = [
    75, 70, 65, 65, 70, 80, 105, 130, 160, 185, 195, 205,
    210, 200, 195, 185, 175, 160, 145, 130, 115, 100, 90, 80
  ];
  const baseDormEvening = [
    60, 55, 50, 50, 55, 65, 80, 95, 110, 115, 110, 105,
    100, 95, 95, 105, 135, 180, 240, 260, 245, 200, 140, 85
  ];
  const baseLabHeavy = [
    140, 135, 130, 130, 135, 145, 170, 210, 260, 290, 310, 325,
    330, 320, 315, 305, 285, 260, 235, 205, 180, 165, 155, 145
  ];
  const baseWeekend = [
    50, 45, 45, 45, 45, 50, 55, 60, 70, 80, 85, 90,
    90, 85, 80, 75, 70, 70, 75, 80, 75, 65, 55, 50
  ];
  const baseFlat = [
    120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120,
    120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120
  ];

  let raw = baseAcademic;
  if (type === 'dorm') raw = baseDormEvening;
  else if (type === 'lab') raw = baseLabHeavy;
  else if (type === 'weekend') raw = baseWeekend;
  else if (type === 'flat') raw = baseFlat;

  return raw.map(v => Math.round(v * scale));
}

// Generate solar profiles
function createSolar(type, peak = 200) {
  const solarNormalized = [
    0, 0, 0, 0, 0, 0, 0.05, 0.15, 0.35, 0.60, 0.85, 0.98,
    1.0, 0.95, 0.82, 0.60, 0.35, 0.12, 0.02, 0, 0, 0, 0, 0
  ];

  if (type === 'zero') {
    return new Array(24).fill(0);
  }
  if (type === 'overcast') {
    return solarNormalized.map(n => Math.round(n * peak * 0.25));
  }
  if (type === 'erratic') {
    return solarNormalized.map((n, h) => {
      const drop = (h >= 11 && h <= 14) ? 0.3 : 1.0;
      return Math.round(n * peak * drop);
    });
  }
  // sunny
  return solarNormalized.map(n => Math.round(n * peak));
}

// Generate tariff profiles
function createTariff(type) {
  if (type === 'flat') {
    return new Array(24).fill(10);
  }
  if (type === 'high_peak') {
    return [
      4, 4, 4, 4, 4, 5, 7, 9, 11, 11, 12, 12,
      11, 10, 10, 11, 14, 22, 25, 26, 24, 16, 8, 5
    ];
  }
  if (type === 'mild_tou') {
    return [
      6, 6, 6, 6, 6, 7, 8, 9, 10, 10, 11, 11,
      11, 10, 10, 10, 11, 14, 15, 15, 14, 11, 8, 6
    ];
  }
  // standard TOU
  return [
    5, 5, 5, 5, 5, 6, 8, 10, 12, 13, 14, 14,
    13, 12, 12, 12, 14, 18, 20, 20, 18, 13, 8, 6
  ];
}

function assembleHours(demand, solar, tariff) {
  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    demand_kwh: demand[h],
    solar_kwh: solar[h],
    tariff_bdt_per_kwh: tariff[h]
  }));
}

async function solveAndVerify(caseDef) {
  const { input, expected_output } = caseDef;
  const hours = [...input.hours].sort((a, b) => a.hour - b.hour);
  const battery = input.battery;
  const directives = expected_output.directive_interpretation;

  const constraints = buildConstraints(directives, hours, battery);
  const plan = await optimize({ hours, battery, constraints });

  const replay = replayPlan({ hours, battery, directives, plan });
  if (!replay.ok) {
    throw new Error(`Case ${caseDef.id} replay failed: ${replay.errors.join(' | ')}`);
  }

  expected_output.hourly_plan = plan;
  expected_output.total_grid_kwh = replay.totals.total_grid_kwh;
  expected_output.total_cost_bdt = replay.totals.total_cost_bdt;
  expected_output.peak_grid_kwh = replay.totals.peak_grid_kwh;
  expected_output.plan_summary = buildSummary(directives, plan, replay.totals);

  return caseDef;
}

console.log('Generating 200 Comprehensive Smart Campus Energy Optimization Scenarios...');

// 1. Load original 10 public sample cases from backup
const originalData = JSON.parse(fs.readFileSync(fs.existsSync(BACKUP_FILE) ? BACKUP_FILE : ORIGINAL_FILE, 'utf8'));
const allCases = [];

for (const c of originalData.cases.slice(0, 10)) {
  c.category = 'official';
  allCases.push(c);
}
console.log(`Loaded and preserved ${allCases.length} official benchmark cases.`);

// -------------------------------------------------------------
// 2. GOOD CASES (50 Scenarios: GOOD-001 to GOOD-050)
// High solar, generous battery, favorable TOU, low/moderate demand
// -------------------------------------------------------------
console.log('Generating 50 Good / Generous scenarios...');
for (let i = 1; i <= 50; i++) {
  const cid = `GOOD-${String(i).padStart(3, '0')}`;
  const dType = i % 2 === 0 ? 'weekend' : 'academic';
  const demand = createDemand(dType, 0.7 + (i % 5) * 0.05);
  const solarPeak = 220 + (i % 6) * 20;
  const solar = createSolar('sunny', solarPeak);
  const tariff = createTariff('high_peak');

  const cap = 600 + (i % 5) * 100;
  const initial = 200 + (i % 4) * 50;
  const minRes = 50;
  const maxChg = 120 + (i % 4) * 20;
  const maxDis = 120 + (i % 4) * 20;

  const battery = {
    capacity_kwh: cap,
    initial_energy_kwh: initial,
    minimum_energy_kwh: minRes,
    max_charge_kwh_per_hour: maxChg,
    max_discharge_kwh_per_hour: maxDis
  };

  let notes = [];
  let interpretations = [];

  const subType = i % 5;
  if (subType === 0) {
    notes = [getRandomDistractor(i), getRandomDistractor(i + 3)];
    interpretations = [
      { note_index: 0, applies: false, directive_type: 'no_op', structured_adjustment: null, explanation: 'Campus announcement does not alter energy schedule' },
      { note_index: 1, applies: false, directive_type: 'no_op', structured_adjustment: null, explanation: 'Unrelated student activity notice' }
    ];
  } else if (subType === 1) {
    notes = [
      `Technicians will wash panel array B between 12:00 and 14:00. Solar generation will drop to roughly 70% of forecast.`,
      getRandomDistractor(i + 1)
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'solar_reduction', structured_adjustment: { hours: [12, 13], factor: 0.7 }, explanation: 'Solar reduced to 70% during panel wash' },
      { note_index: 1, applies: false, directive_type: 'no_op', structured_adjustment: null, explanation: 'Distractor note ignored' }
    ];
  } else if (subType === 2) {
    notes = [
      `Routine electrical breaker check will pause battery charging between 03:00 and 05:00.`,
      `The library reading rooms will remain quiet as usual.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'no_charge_window', structured_adjustment: { hours: [3, 4] }, explanation: 'No charging allowed during breaker check' },
      { note_index: 1, applies: false, directive_type: 'no_op', structured_adjustment: null, explanation: 'No effect on electrical operations' }
    ];
  } else if (subType === 3) {
    const res = minRes + 60;
    notes = [
      `Keep at least ${res} kWh in reserve between 18:00 and 21:00 during the guest lecture in main hall.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'minimum_battery_reserve', structured_adjustment: { hours: [18, 19, 20], minimum_energy_kwh: res }, explanation: 'Reserve buffer maintained during guest lecture' }
    ];
  } else {
    notes = [
      `Feeder line maintenance limits campus grid draw to 240 kWh between 11:00 and 13:00.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'max_grid_window', structured_adjustment: { hours: [11, 12], max_grid_kwh: 240 }, explanation: 'Grid import capped at 240 kWh' }
    ];
  }

  const caseObj = {
    id: cid,
    label: `Good Case #${i}: Favorable Solar & High Battery Flexibility`,
    category: 'good',
    input: {
      scenario_id: cid,
      operator_notes: notes,
      hours: assembleHours(demand, solar, tariff),
      battery
    },
    expected_output: {
      scenario_id: cid,
      directive_interpretation: interpretations
    }
  };

  const solved = await solveAndVerify(caseObj);
  allCases.push(solved);
}

// -------------------------------------------------------------
// 3. BAD CASES (70 Scenarios: BAD-001 to BAD-070)
// High demand, low/erratic solar, tight battery, restrictive directives
// -------------------------------------------------------------
console.log('Generating 70 Bad / Challenging scenarios...');
for (let i = 1; i <= 70; i++) {
  const cid = `BAD-${String(i).padStart(3, '0')}`;
  const dType = i % 3 === 0 ? 'lab' : (i % 3 === 1 ? 'dorm' : 'academic');
  const demand = createDemand(dType, 1.15 + (i % 4) * 0.05);
  const solarPeak = 70 + (i % 5) * 15;
  const solar = createSolar('overcast', solarPeak);
  const tariff = createTariff('high_peak');

  const cap = 400;
  const initial = 150;
  const minRes = 70;
  const maxChg = 80;
  const maxDis = 80;

  const battery = {
    capacity_kwh: cap,
    initial_energy_kwh: initial,
    minimum_energy_kwh: minRes,
    max_charge_kwh_per_hour: maxChg,
    max_discharge_kwh_per_hour: maxDis
  };

  let notes = [];
  let interpretations = [];

  const subType = i % 7;
  if (subType === 0) {
    notes = [
      `Heavy monsoon cloud cover expected: solar generation will drop to 20% between 11:00 and 14:00.`,
      getRandomDistractor(i)
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'solar_reduction', structured_adjustment: { hours: [11, 12, 13], factor: 0.2 }, explanation: 'Solar reduced to 20% due to monsoon clouds' },
      { note_index: 1, applies: false, directive_type: 'no_op', structured_adjustment: null, explanation: 'Administrative notice ignored' }
    ];
  } else if (subType === 1) {
    notes = [
      `Emergency inverter diagnostic: do not discharge the battery between 18:00 and 21:00.`,
      getRandomDistractor(i + 2)
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'no_discharge_window', structured_adjustment: { hours: [18, 19, 20] }, explanation: 'Discharge locked during diagnostic' },
      { note_index: 1, applies: false, directive_type: 'no_op', structured_adjustment: null, explanation: 'Unrelated note' }
    ];
  } else if (subType === 2) {
    const reqRes = minRes + 70; // 140 kWh
    notes = [
      `Hospital wing backup requirement: hold at least ${reqRes} kWh in the battery between 18:00 and 21:00.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'minimum_battery_reserve', structured_adjustment: { hours: [18, 19, 20], minimum_energy_kwh: reqRes }, explanation: 'High reserve required for medical facility' }
    ];
  } else if (subType === 3) {
    notes = [
      `Cooling fan malfunction on battery rack: no charging between 13:00 and 16:00.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'no_charge_window', structured_adjustment: { hours: [13, 14, 15] }, explanation: 'Charging paused for fan repair' }
    ];
  } else if (subType === 4) {
    const gridCap = 380;
    notes = [
      `Substation transformer rating: grid import must not exceed ${gridCap} kWh between 12:00 and 16:00.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'max_grid_window', structured_adjustment: { hours: [12, 13, 14, 15], max_grid_kwh: gridCap }, explanation: `Grid cap at ${gridCap} kWh` }
    ];
  } else if (subType === 5) {
    notes = [
      `Soot from nearby construction will reduce PV efficiency to 35% between 10:00 and 13:00.`,
      `Maintain minimum reserve of 140 kWh between 19:00 and 22:00 for campus security lighting.`,
      getRandomDistractor(i + 4)
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'solar_reduction', structured_adjustment: { hours: [10, 11, 12], factor: 0.35 }, explanation: 'Solar cut to 35% from soot' },
      { note_index: 1, applies: true, directive_type: 'minimum_battery_reserve', structured_adjustment: { hours: [19, 20, 21], minimum_energy_kwh: 140 }, explanation: 'Reserve buffer for security lights' },
      { note_index: 2, applies: false, directive_type: 'no_op', structured_adjustment: null, explanation: 'Distractor note' }
    ];
  } else {
    notes = [
      `Do not charge battery between 08:00 and 11:00 due to busbar inspection.`,
      `Do not discharge battery between 19:00 and 21:00 during electrical synchronization.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'no_charge_window', structured_adjustment: { hours: [8, 9, 10] }, explanation: 'Charging locked for busbar check' },
      { note_index: 1, applies: true, directive_type: 'no_discharge_window', structured_adjustment: { hours: [19, 20] }, explanation: 'Discharge locked for synchronization' }
    ];
  }

  const caseObj = {
    id: cid,
    label: `Bad Case #${i}: High Demand & Restrictive Operational Constraints`,
    category: 'bad',
    input: {
      scenario_id: cid,
      operator_notes: notes,
      hours: assembleHours(demand, solar, tariff),
      battery
    },
    expected_output: {
      scenario_id: cid,
      directive_interpretation: interpretations
    }
  };

  const solved = await solveAndVerify(caseObj);
  allCases.push(solved);
}

// -------------------------------------------------------------
// 4. WORST CASES (50 Scenarios: WORST-001 to WORST-050)
// Zero solar, flat tariff (zero arbitrage), emergency hospital reserve,
// tightly bounded battery headroom, severe combined multi-window limits
// -------------------------------------------------------------
console.log('Generating 50 Worst / Extreme Stress scenarios...');
for (let i = 1; i <= 50; i++) {
  const cid = `WORST-${String(i).padStart(3, '0')}`;
  const dType = i % 2 === 0 ? 'lab' : 'dorm';
  const demand = createDemand(dType, 1.25 + (i % 3) * 0.05);
  const solar = createSolar('zero', 0); // Complete blackout of solar
  const tariffType = i % 3 === 0 ? 'flat' : 'high_peak';
  const tariff = createTariff(tariffType);

  const cap = 350;
  const minRes = 80;
  const initial = 120;
  const maxChg = 60;
  const maxDis = 60;

  const battery = {
    capacity_kwh: cap,
    initial_energy_kwh: initial,
    minimum_energy_kwh: minRes,
    max_charge_kwh_per_hour: maxChg,
    max_discharge_kwh_per_hour: maxDis
  };

  let notes = [];
  let interpretations = [];

  const subType = i % 5;
  if (subType === 0) {
    const resLevel = 160;
    notes = [
      `Cyclone warning level 8: maintain at least ${resLevel} kWh battery reserve continuously between 16:00 and 21:00.`,
      `Academic buildings will remain closed tomorrow.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'minimum_battery_reserve', structured_adjustment: { hours: [16, 17, 18, 19, 20], minimum_energy_kwh: resLevel }, explanation: 'Cyclone emergency reserve requirement' },
      { note_index: 1, applies: false, directive_type: 'no_op', structured_adjustment: null, explanation: 'Building closure does not change electrical model' }
    ];
  } else if (subType === 1) {
    const gridCap = 400;
    notes = [
      `Emergency grid protection: do not discharge the battery between 17:00 and 20:00.`,
      `Utility feeder constraint: grid electricity draw capped at ${gridCap} kWh between 18:00 and 21:00.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'no_discharge_window', structured_adjustment: { hours: [17, 18, 19] }, explanation: 'Discharge locked for grid protection' },
      { note_index: 1, applies: true, directive_type: 'max_grid_window', structured_adjustment: { hours: [18, 19, 20], max_grid_kwh: gridCap }, explanation: `Grid import capped at ${gridCap} kWh` }
    ];
  } else if (subType === 2) {
    notes = [
      `Grid frequency regulation test: maintain at least 150 kWh in battery storage between 08:00 and 13:00.`,
      getRandomDistractor(i)
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'minimum_battery_reserve', structured_adjustment: { hours: [8, 9, 10, 11, 12], minimum_energy_kwh: 150 }, explanation: 'Frequency regulation test buffer' },
      { note_index: 1, applies: false, directive_type: 'no_op', structured_adjustment: null, explanation: 'Distractor' }
    ];
  } else if (subType === 3) {
    notes = [
      `Do not charge the battery between 10:00 and 13:00.`,
      `Do not discharge the battery between 18:00 and 21:00.`,
      getRandomDistractor(i + 1)
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'no_charge_window', structured_adjustment: { hours: [10, 11, 12] }, explanation: 'Charging paused' },
      { note_index: 1, applies: true, directive_type: 'no_discharge_window', structured_adjustment: { hours: [18, 19, 20] }, explanation: 'Discharge paused' },
      { note_index: 2, applies: false, directive_type: 'no_op', structured_adjustment: null, explanation: 'Unrelated note' }
    ];
  } else {
    const gridCap = 420;
    notes = [
      `Feeder line thermal limitation: grid import must not exceed ${gridCap} kWh between 19:00 and 22:00.`,
      `Keep at least 100 kWh in reserve during the same period.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'max_grid_window', structured_adjustment: { hours: [19, 20, 21], max_grid_kwh: gridCap }, explanation: 'Feeder thermal limitation' },
      { note_index: 1, applies: true, directive_type: 'minimum_battery_reserve', structured_adjustment: { hours: [19, 20, 21], minimum_energy_kwh: 100 }, explanation: 'Reserve maintained' }
    ];
  }

  const caseObj = {
    id: cid,
    label: `Worst Case #${i}: Zero Solar & Strict Multi-Constraint Stress`,
    category: 'worst',
    input: {
      scenario_id: cid,
      operator_notes: notes,
      hours: assembleHours(demand, solar, tariff),
      battery
    },
    expected_output: {
      scenario_id: cid,
      directive_interpretation: interpretations
    }
  };

  const solved = await solveAndVerify(caseObj);
  allCases.push(solved);
}

// -------------------------------------------------------------
// 5. EDGE CASES & NATURAL LANGUAGE TRAPS (20 Scenarios: EDGE-001 to EDGE-020)
// Boundary hours (0, 23), complex phrases, unusual wording, word numbers
// -------------------------------------------------------------
console.log('Generating 20 Edge Cases & Natural Language Traps...');
for (let i = 1; i <= 20; i++) {
  const cid = `EDGE-${String(i).padStart(3, '0')}`;
  const demand = createDemand('academic', 1.0);
  const solar = createSolar('sunny', 180);
  const tariff = createTariff('standard');

  const cap = 500;
  const initial = 200;
  const minRes = 50;
  const maxChg = 100;
  const maxDis = 100;

  const battery = {
    capacity_kwh: cap,
    initial_energy_kwh: initial,
    minimum_energy_kwh: minRes,
    max_charge_kwh_per_hour: maxChg,
    max_discharge_kwh_per_hour: maxDis
  };

  let notes = [];
  let interpretations = [];

  const sub = i % 10;
  if (sub === 0) {
    notes = [
      `System synchronization: do not charge the battery during hour 0 (between 00:00 and 01:00).`,
      getRandomDistractor(i)
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'no_charge_window', structured_adjustment: { hours: [0] }, explanation: 'Hour 0 charge freeze' },
      { note_index: 1, applies: false, directive_type: 'no_op', structured_adjustment: null, explanation: 'Distractor' }
    ];
  } else if (sub === 1) {
    notes = [
      `End-of-day telemetry inspection: battery discharging is unavailable between 23:00 and 24:00.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'no_discharge_window', structured_adjustment: { hours: [23] }, explanation: 'Hour 23 discharge lock' }
    ];
  } else if (sub === 2) {
    notes = [
      `PV generation will drop to 10% between 13:00 and 16:00 due to severe sandstorm.`,
      `Chancellor speech scheduled at 15:00.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'solar_reduction', structured_adjustment: { hours: [13, 14, 15], factor: 0.1 }, explanation: 'Solar curtailed to 10% from sandstorm' },
      { note_index: 1, applies: false, directive_type: 'no_op', structured_adjustment: null, explanation: 'Distractor speech note' }
    ];
  } else if (sub === 3) {
    notes = [
      `Rooftop shading from construction crane will drop solar to 25% between 10:00 and 14:00.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'solar_reduction', structured_adjustment: { hours: [10, 11, 12, 13], factor: 0.25 }, explanation: 'Solar reduced to 25% (one-fourth)' }
    ];
  } else if (sub === 4) {
    notes = [
      `Inverter overheating: usable solar is reduced to 25% between 13:00 and 15:00.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'solar_reduction', structured_adjustment: { hours: [13, 14], factor: 0.25 }, explanation: '75% reduction leaves 25% factor' }
    ];
  } else if (sub === 5) {
    notes = [
      `Deep night maintenance: do not discharge the battery between 00:00 and 05:00.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'no_discharge_window', structured_adjustment: { hours: [0, 1, 2, 3, 4] }, explanation: 'Early morning discharge freeze' }
    ];
  } else if (sub === 6) {
    notes = [
      `Campus grid feeder limit: cap grid import at 260 kWh between 20:00 and 24:00.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'max_grid_window', structured_adjustment: { hours: [20, 21, 22, 23], max_grid_kwh: 260 }, explanation: 'Evening grid cap' }
    ];
  } else if (sub === 7) {
    notes = [
      `Panel maintenance drops solar to 40% between 11:00 and 13:00.`,
      `Maintain at least 150 kWh battery reserve between 18:00 and 21:00 for campus security.`,
      `University bus routes schedule updated for winter semester.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'solar_reduction', structured_adjustment: { hours: [11, 12], factor: 0.4 }, explanation: 'Solar cut to 40%' },
      { note_index: 1, applies: true, directive_type: 'minimum_battery_reserve', structured_adjustment: { hours: [18, 19, 20], minimum_energy_kwh: 150 }, explanation: 'Reserve requirement' },
      { note_index: 2, applies: false, directive_type: 'no_op', structured_adjustment: null, explanation: 'Bus timetable distractor' }
    ];
  } else if (sub === 8) {
    notes = [
      `Do not charge the battery between 14:00 and 17:00.`,
      `Grid import is capped at 280 kWh between 15:00 and 18:00.`
    ];
    interpretations = [
      { note_index: 0, applies: true, directive_type: 'no_charge_window', structured_adjustment: { hours: [14, 15, 16] }, explanation: 'No charging 2 PM to 5 PM' },
      { note_index: 1, applies: true, directive_type: 'max_grid_window', structured_adjustment: { hours: [15, 16, 17], max_grid_kwh: 280 }, explanation: 'Grid cap 3 PM to 6 PM' }
    ];
  } else {
    notes = [
      `Sports day rehearsal in main field at 4 PM.`,
      `Cafeteria coffee machine serviced this morning.`
    ];
    interpretations = [
      { note_index: 0, applies: false, directive_type: 'no_op', structured_adjustment: null, explanation: 'Rehearsal distractor' },
      { note_index: 1, applies: false, directive_type: 'no_op', structured_adjustment: null, explanation: 'Coffee machine distractor' }
    ];
  }

  const caseObj = {
    id: cid,
    label: `Edge Case #${i}: Boundary Window & Natural Language Trap`,
    category: 'edge',
    input: {
      scenario_id: cid,
      operator_notes: notes,
      hours: assembleHours(demand, solar, tariff),
      battery
    },
    expected_output: {
      scenario_id: cid,
      directive_interpretation: interpretations
    }
  };

  const solved = await solveAndVerify(caseObj);
  allCases.push(solved);
}

console.log(`\nSuccessfully generated and verified all ${allCases.length} scenarios!`);

// Prepare full JSON pack
const pack200 = {
  _meta: {
    ...originalData._meta,
    case_count: allCases.length,
    description: `Comprehensive 200-sample benchmark dataset for Smart Campus 24-Hour Energy Scheduling. Spans Good (favorable solar, generous battery), Bad (high demand, suppressed solar, restrictive directives), Worst (zero solar, flat tariffs, emergency hospital reserves, multi-constraint locks), and Edge Cases (boundary hours, complex paraphrasing, distractors). Every case is mathematically solved with GLPK and verified by deterministic replay.`,
    distribution: {
      official_benchmark: 10,
      good: 50,
      bad: 70,
      worst: 50,
      edge: 20,
      total: 200
    }
  },
  cases: allCases
};

// 1. Write 200 cases to root 200 file
fs.writeFileSync(OUTPUT_200_ROOT, JSON.stringify(pack200, null, 2), 'utf8');
console.log(`Saved 200 sample cases to: ${OUTPUT_200_ROOT}`);

// 2. Write 200 cases to test/ folder
fs.writeFileSync(OUTPUT_200_TEST, JSON.stringify(pack200, null, 2), 'utf8');
console.log(`Saved 200 sample cases to: ${OUTPUT_200_TEST}`);

// 3. Update BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json as requested
fs.writeFileSync(ORIGINAL_FILE, JSON.stringify(pack200, null, 2), 'utf8');
console.log(`Updated ${ORIGINAL_FILE} with 200 sample cases.`);

console.log('\n--- 200 Sample Dataset Statistics ---');
console.log(`Total Scenarios: ${allCases.length}`);
const categories = {};
for (const c of allCases) {
  categories[c.category] = (categories[c.category] || 0) + 1;
}
console.log('Category breakdown:', categories);

const totalCost = allCases.reduce((sum, c) => sum + c.expected_output.total_cost_bdt, 0);
const avgCost = totalCost / allCases.length;
console.log(`Average Optimal Cost: ${avgCost.toFixed(2)} BDT`);
console.log('Done!');
