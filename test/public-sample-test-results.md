# GridWise Public Sample Cases Test Evaluation Report

**Execution Timestamp:** `2026-09-18T15:32:02.661Z`  
**Target Host / Base URL:** `https://bup-preliminary-hackathon.vercel.app`  
**Test Suite:** `BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json` (10 Official Benchmark Scenarios)  
**Overall Result:** **10/10 PASSED (100%)**

---

## 1. Executive Summary & Quality Scorecard

| Metric | Measured Value | Standard / Threshold | Evaluation Rubric Status |
|---|---|---|---|
| **Health Check (`GET /health`)** | `HTTP 200` (743ms) | `HTTP 200 {"status":"ok"}` (< 60s) | **PASS (2/2 pts)** |
| **All Public Cases Pass Rate** | **10/10 (100%)** | 100% on valid benchmark cases | **PASS (25/25 pts Directive App)** |
| **Directive Interpretation Accuracy** | **10/10 cases (100%)** | 100% match with ground-truth schema/values | **PASS (25/25 pts Interpretation)** |
| **Optimization Cost Quality Ratio** | **100%** | >= 99% cost quality ratio | **PASS (10/10 pts Optimization)** |
| **P95 Request Latency** | **1761ms** | <= 5,000ms for full marks | **PASS (3/3 pts Latency)** |
| **Schema & Contract Compliance** | **10/10 cases (100%)** | Exact match with Section 4 & 5 schemas | **PASS (10/10 pts API Contract)** |
| **System Stability & Error Rate** | **0% failure rate** | Zero 5xx, Zero crashes, controlled validation | **PASS (5/5 pts Reliability)** |

---

## 2. API Health Check Verification

- **Endpoint:** `GET https://bup-preliminary-hackathon.vercel.app/health`
- **HTTP Status:** `200`
- **Response Payload:**
```json
{
  "status": "ok"
}
```
- **Latency:** `743ms`
- **Compliance:** Successfully returned `{"status": "ok"}` immediately upon probe.

---

## 3. Detailed Results Table: 10 Public Benchmark Scenarios

| Case ID | Scenario Name / Description | HTTP Status | Latency | Replay Status | Reported Cost (BDT) | Reference Cost (BDT) | Cost Quality | Result |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **SAMPLE-01** | Solar cleaning + distractor | `200` | 1138ms | VALID | 38365.00 | 38365.00 | 100% | ✅ PASS |
| **SAMPLE-02** | Battery charging maintenance | `200` | 779ms | VALID | 42885.00 | 42885.00 | 100% | ✅ PASS |
| **SAMPLE-03** | Emergency reserve as percentage | `200` | 1085ms | VALID | 35480.00 | 35480.00 | 100% | ✅ PASS |
| **SAMPLE-04** | No-discharge protection test | `200` | 1325ms | VALID | 40495.00 | 40495.00 | 100% | ✅ PASS |
| **SAMPLE-05** | Temporary feeder grid cap | `200` | 837ms | VALID | 33950.00 | 33950.00 | 100% | ✅ PASS |
| **SAMPLE-06** | Multiple notes with distractor | `200` | 1036ms | VALID | 34090.00 | 34090.00 | 100% | ✅ PASS |
| **SAMPLE-07** | Reserve plus transformer cap | `200` | 1205ms | VALID | 38550.00 | 38550.00 | 100% | ✅ PASS |
| **SAMPLE-08** | Separate charge/discharge outages | `200` | 856ms | VALID | 37665.00 | 37665.00 | 100% | ✅ PASS |
| **SAMPLE-09** | Reduction wording normalization | `200` | 1031ms | VALID | 34873.00 | 34873.00 | 100% | ✅ PASS |
| **SAMPLE-10** | Multi-constraint evening operation | `200` | 1761ms | VALID | 41620.00 | 41620.00 | 100% | ✅ PASS |

---

## 4. Per-Case Technical Breakdown

### 4.1. [SAMPLE-01] Solar cleaning + distractor
- **Operator Notes Input:**
  1. *"Facilities will wash the rooftop solar panels from noon until 2 PM. During cleaning, usable solar should be treated as roughly 25% of the forecast."*
  2. *"The sports office moved next month's registration deadline."*
- **LLM Interpretation Output:**
```json
[
  {
    "note_index": 0,
    "applies": true,
    "directive_type": "solar_reduction",
    "structured_adjustment": {
      "hours": [
        12,
        13
      ],
      "factor": 0.25
    },
    "explanation": "Solar output reduced to 25% while panels are cleaned"
  },
  {
    "note_index": 1,
    "applies": false,
    "directive_type": "no_op",
    "structured_adjustment": null,
    "explanation": "Note does not affect today's schedule"
  }
]
```
- **Independent Replay Validation:**
  - Energy balance checked across all 24 hours: **VERIFIED**
  - Battery capacity, minimum reserve, and rate limits: **VERIFIED**
  - Directive constraints enforced (`solar_reduction, no_op`): **VERIFIED**
  - End-of-day battery neutrality (`battery[23] == initial_energy`): **VERIFIED**
  - Reported Total Grid: `2692.5 kWh` | Peak: `187.5 kWh`
  - Total Cost: `38365.00 BDT` (Optimal Reference: `38365.00 BDT`)
  - Cost Quality: **100%**
- **Plan Summary:** "Applied usable solar cut to 25% at 12:00, 13:00. Ignored 1 note unrelated to today's schedule. Charged in 9 hours and discharged in 10 hours to shift load away from expensive hours, ending the day back at the initial battery level. Total grid import 2692.50 kWh, peak 187.50 kWh, cost 38365.00 BDT."

### 4.2. [SAMPLE-02] Battery charging maintenance
- **Operator Notes Input:**
  1. *"The battery charger will be isolated from 2 AM until 5 AM for electrical maintenance."*
- **LLM Interpretation Output:**
```json
[
  {
    "note_index": 0,
    "applies": true,
    "directive_type": "no_charge_window",
    "structured_adjustment": {
      "hours": [
        2,
        3,
        4
      ]
    },
    "explanation": "Battery cannot be charged from 2 AM to 5 AM due to maintenance"
  }
]
```
- **Independent Replay Validation:**
  - Energy balance checked across all 24 hours: **VERIFIED**
  - Battery capacity, minimum reserve, and rate limits: **VERIFIED**
  - Directive constraints enforced (`no_charge_window`): **VERIFIED**
  - End-of-day battery neutrality (`battery[23] == initial_energy`): **VERIFIED**
  - Reported Total Grid: `2915 kWh` | Peak: `180 kWh`
  - Total Cost: `42885.00 BDT` (Optimal Reference: `42885.00 BDT`)
  - Cost Quality: **100%**
- **Plan Summary:** "Applied no charging at 02:00, 03:00, 04:00. Charged in 7 hours and discharged in 7 hours to shift load away from expensive hours, ending the day back at the initial battery level. Total grid import 2915.00 kWh, peak 180.00 kWh, cost 42885.00 BDT."

### 4.3. [SAMPLE-03] Emergency reserve as percentage
- **Operator Notes Input:**
  1. *"Keep at least 50% of the battery capacity stored in the battery from 6 PM until 9 PM for emergency operations."*
- **LLM Interpretation Output:**
```json
[
  {
    "note_index": 0,
    "applies": true,
    "directive_type": "minimum_battery_reserve",
    "structured_adjustment": {
      "hours": [
        18,
        19,
        20
      ],
      "minimum_energy_kwh": 100
    },
    "explanation": "Maintain at least 100 kWh (50% of 200 kWh) in the battery from 6 PM to 9 PM."
  }
]
```
- **Independent Replay Validation:**
  - Energy balance checked across all 24 hours: **VERIFIED**
  - Battery capacity, minimum reserve, and rate limits: **VERIFIED**
  - Directive constraints enforced (`minimum_battery_reserve`): **VERIFIED**
  - End-of-day battery neutrality (`battery[23] == initial_energy`): **VERIFIED**
  - Reported Total Grid: `2430 kWh` | Peak: `205 kWh`
  - Total Cost: `35480.00 BDT` (Optimal Reference: `35480.00 BDT`)
  - Cost Quality: **100%**
- **Plan Summary:** "Applied battery held at or above 100 kWh at 18:00, 19:00, 20:00. Charged in 9 hours and discharged in 9 hours to shift load away from expensive hours, ending the day back at the initial battery level. Total grid import 2430.00 kWh, peak 205.00 kWh, cost 35480.00 BDT."

### 4.4. [SAMPLE-04] No-discharge protection test
- **Operator Notes Input:**
  1. *"For protection testing, the battery must not discharge from 6 PM until 8 PM."*
- **LLM Interpretation Output:**
```json
[
  {
    "note_index": 0,
    "applies": true,
    "directive_type": "no_discharge_window",
    "structured_adjustment": {
      "hours": [
        18,
        19
      ]
    },
    "explanation": "Battery discharge is prohibited from 6 PM to 8 PM."
  }
]
```
- **Independent Replay Validation:**
  - Energy balance checked across all 24 hours: **VERIFIED**
  - Battery capacity, minimum reserve, and rate limits: **VERIFIED**
  - Directive constraints enforced (`no_discharge_window`): **VERIFIED**
  - End-of-day battery neutrality (`battery[23] == initial_energy`): **VERIFIED**
  - Reported Total Grid: `2645 kWh` | Peak: `225 kWh`
  - Total Cost: `40495.00 BDT` (Optimal Reference: `40495.00 BDT`)
  - Cost Quality: **100%**
- **Plan Summary:** "Applied no discharging at 18:00, 19:00. Charged in 8 hours and discharged in 10 hours to shift load away from expensive hours, ending the day back at the initial battery level. Total grid import 2645.00 kWh, peak 225.00 kWh, cost 40495.00 BDT."

### 4.5. [SAMPLE-05] Temporary feeder grid cap
- **Operator Notes Input:**
  1. *"From 6 PM until 9 PM, campus grid import must not exceed 155 kWh in any hour because the feeder is operating under a temporary limit."*
- **LLM Interpretation Output:**
```json
[
  {
    "note_index": 0,
    "applies": true,
    "directive_type": "max_grid_window",
    "structured_adjustment": {
      "hours": [
        18,
        19,
        20
      ],
      "max_grid_kwh": 155
    },
    "explanation": "Limits grid import to 155 kWh per hour from 6 PM to 9 PM."
  }
]
```
- **Independent Replay Validation:**
  - Energy balance checked across all 24 hours: **VERIFIED**
  - Battery capacity, minimum reserve, and rate limits: **VERIFIED**
  - Directive constraints enforced (`max_grid_window`): **VERIFIED**
  - End-of-day battery neutrality (`battery[23] == initial_energy`): **VERIFIED**
  - Reported Total Grid: `2430 kWh` | Peak: `175 kWh`
  - Total Cost: `33950.00 BDT` (Optimal Reference: `33950.00 BDT`)
  - Cost Quality: **100%**
- **Plan Summary:** "Applied grid import capped at 155 kWh at 18:00, 19:00, 20:00. Charged in 9 hours and discharged in 10 hours to shift load away from expensive hours, ending the day back at the initial battery level. Total grid import 2430.00 kWh, peak 175.00 kWh, cost 33950.00 BDT."

### 4.6. [SAMPLE-06] Multiple notes with distractor
- **Operator Notes Input:**
  1. *"Cloud cover during panel inspection will leave about half of the forecast solar output from 10 AM until noon."*
  2. *"The charging circuit will be unavailable from 2 PM until 4 PM."*
  3. *"The library is extending book-return hours next week."*
- **LLM Interpretation Output:**
```json
[
  {
    "note_index": 0,
    "applies": true,
    "directive_type": "solar_reduction",
    "structured_adjustment": {
      "hours": [
        10,
        11
      ],
      "factor": 0.5
    },
    "explanation": "Solar output is about half from 10 AM to noon."
  },
  {
    "note_index": 1,
    "applies": true,
    "directive_type": "no_charge_window",
    "structured_adjustment": {
      "hours": [
        14,
        15
      ]
    },
    "explanation": "Charging circuit is unavailable from 2 PM to 4 PM."
  },
  {
    "note_index": 2,
    "applies": false,
    "directive_type": "no_op",
    "structured_adjustment": null,
    "explanation": "Note does not affect today's schedule."
  }
]
```
- **Independent Replay Validation:**
  - Energy balance checked across all 24 hours: **VERIFIED**
  - Battery capacity, minimum reserve, and rate limits: **VERIFIED**
  - Directive constraints enforced (`solar_reduction, no_charge_window, no_op`): **VERIFIED**
  - End-of-day battery neutrality (`battery[23] == initial_energy`): **VERIFIED**
  - Reported Total Grid: `2395 kWh` | Peak: `175 kWh`
  - Total Cost: `34090.00 BDT` (Optimal Reference: `34090.00 BDT`)
  - Cost Quality: **100%**
- **Plan Summary:** "Applied usable solar cut to 50% at 10:00, 11:00; no charging at 14:00, 15:00. Ignored 1 note unrelated to today's schedule. Charged in 8 hours and discharged in 7 hours to shift load away from expensive hours, ending the day back at the initial battery level. Total grid import 2395.00 kWh, peak 175.00 kWh, cost 34090.00 BDT."

### 4.7. [SAMPLE-07] Reserve plus transformer cap
- **Operator Notes Input:**
  1. *"Keep at least 90 kWh in the battery from 6 PM until 10 PM for emergency services."*
  2. *"The evening transformer limit is 180 kWh of grid import from 7 PM until 9 PM."*
- **LLM Interpretation Output:**
```json
[
  {
    "note_index": 0,
    "applies": true,
    "directive_type": "minimum_battery_reserve",
    "structured_adjustment": {
      "hours": [
        18,
        19,
        20,
        21
      ],
      "minimum_energy_kwh": 90
    },
    "explanation": "Ensures at least 90 kWh remains in the battery during the specified evening hours."
  },
  {
    "note_index": 1,
    "applies": true,
    "directive_type": "max_grid_window",
    "structured_adjustment": {
      "hours": [
        19,
        20
      ],
      "max_grid_kwh": 180
    },
    "explanation": "Limits grid import to 180 kWh during the 7‑9 PM window."
  }
]
```
- **Independent Replay Validation:**
  - Energy balance checked across all 24 hours: **VERIFIED**
  - Battery capacity, minimum reserve, and rate limits: **VERIFIED**
  - Directive constraints enforced (`minimum_battery_reserve, max_grid_window`): **VERIFIED**
  - End-of-day battery neutrality (`battery[23] == initial_energy`): **VERIFIED**
  - Reported Total Grid: `2560 kWh` | Peak: `185 kWh`
  - Total Cost: `38550.00 BDT` (Optimal Reference: `38550.00 BDT`)
  - Cost Quality: **100%**
- **Plan Summary:** "Applied battery held at or above 90 kWh at 18:00, 19:00, 20:00, 21:00; grid import capped at 180 kWh at 19:00, 20:00. Charged in 6 hours and discharged in 8 hours to shift load away from expensive hours, ending the day back at the initial battery level. Total grid import 2560.00 kWh, peak 185.00 kWh, cost 38550.00 BDT."

### 4.8. [SAMPLE-08] Separate charge/discharge outages
- **Operator Notes Input:**
  1. *"Battery charging is disabled from 11 AM until 1 PM while technicians inspect the charger."*
  2. *"Do not discharge the battery from 5 PM until 7 PM during relay testing."*
- **LLM Interpretation Output:**
```json
[
  {
    "note_index": 0,
    "applies": true,
    "directive_type": "no_charge_window",
    "structured_adjustment": {
      "hours": [
        11,
        12
      ]
    },
    "explanation": "Charging is prohibited during the inspection period."
  },
  {
    "note_index": 1,
    "applies": true,
    "directive_type": "no_discharge_window",
    "structured_adjustment": {
      "hours": [
        17,
        18
      ]
    },
    "explanation": "Discharging is prohibited during the relay testing period."
  }
]
```
- **Independent Replay Validation:**
  - Energy balance checked across all 24 hours: **VERIFIED**
  - Battery capacity, minimum reserve, and rate limits: **VERIFIED**
  - Directive constraints enforced (`no_charge_window, no_discharge_window`): **VERIFIED**
  - End-of-day battery neutrality (`battery[23] == initial_energy`): **VERIFIED**
  - Reported Total Grid: `2490 kWh` | Peak: `210 kWh`
  - Total Cost: `37665.00 BDT` (Optimal Reference: `37665.00 BDT`)
  - Cost Quality: **100%**
- **Plan Summary:** "Applied no charging at 11:00, 12:00; no discharging at 17:00, 18:00. Charged in 9 hours and discharged in 10 hours to shift load away from expensive hours, ending the day back at the initial battery level. Total grid import 2490.00 kWh, peak 210.00 kWh, cost 37665.00 BDT."

### 4.9. [SAMPLE-09] Reduction wording normalization
- **Operator Notes Input:**
  1. *"Expect an 80% reduction in rooftop solar between 11 AM and 2 PM because of inverter work."*
  2. *"The student affairs office will publish club notices tomorrow."*
- **LLM Interpretation Output:**
```json
[
  {
    "note_index": 0,
    "applies": true,
    "directive_type": "solar_reduction",
    "structured_adjustment": {
      "hours": [
        11,
        12,
        13
      ],
      "factor": 0.2
    },
    "explanation": "Solar output is reduced to 20% from 11 AM to 2 PM due to inverter work."
  },
  {
    "note_index": 1,
    "applies": false,
    "directive_type": "no_op",
    "structured_adjustment": null,
    "explanation": "The note concerns club notices and does not affect today's electricity schedule."
  }
]
```
- **Independent Replay Validation:**
  - Energy balance checked across all 24 hours: **VERIFIED**
  - Battery capacity, minimum reserve, and rate limits: **VERIFIED**
  - Directive constraints enforced (`solar_reduction, no_op`): **VERIFIED**
  - End-of-day battery neutrality (`battery[23] == initial_energy`): **VERIFIED**
  - Reported Total Grid: `2504 kWh` | Peak: `170 kWh`
  - Total Cost: `34873.00 BDT` (Optimal Reference: `34873.00 BDT`)
  - Cost Quality: **100%**
- **Plan Summary:** "Applied usable solar cut to 20% at 11:00, 12:00, 13:00. Ignored 1 note unrelated to today's schedule. Charged in 9 hours and discharged in 9 hours to shift load away from expensive hours, ending the day back at the initial battery level. Total grid import 2504.00 kWh, peak 170.00 kWh, cost 34873.00 BDT."

### 4.10. [SAMPLE-10] Multi-constraint evening operation
- **Operator Notes Input:**
  1. *"The data center requires at least 80 kWh to remain in the battery from 6 PM until 10 PM."*
  2. *"Grid intake must stay at or below 190 kWh from 7 PM until 10 PM while the substation is constrained."*
  3. *"A seminar room booking was moved to next week."*
- **LLM Interpretation Output:**
```json
[
  {
    "note_index": 0,
    "applies": true,
    "directive_type": "minimum_battery_reserve",
    "structured_adjustment": {
      "hours": [
        18,
        19,
        20,
        21
      ],
      "minimum_energy_kwh": 80
    },
    "explanation": "Reserve at least 80 kWh in battery from 6 PM to 10 PM"
  },
  {
    "note_index": 1,
    "applies": true,
    "directive_type": "max_grid_window",
    "structured_adjustment": {
      "hours": [
        19,
        20,
        21
      ],
      "max_grid_kwh": 190
    },
    "explanation": "Cap grid import to 190 kWh from 7 PM to 10 PM"
  },
  {
    "note_index": 2,
    "applies": false,
    "directive_type": "no_op",
    "structured_adjustment": null,
    "explanation": "Note is unrelated to today's schedule"
  }
]
```
- **Independent Replay Validation:**
  - Energy balance checked across all 24 hours: **VERIFIED**
  - Battery capacity, minimum reserve, and rate limits: **VERIFIED**
  - Directive constraints enforced (`minimum_battery_reserve, max_grid_window, no_op`): **VERIFIED**
  - End-of-day battery neutrality (`battery[23] == initial_energy`): **VERIFIED**
  - Reported Total Grid: `2715 kWh` | Peak: `190 kWh`
  - Total Cost: `41620.00 BDT` (Optimal Reference: `41620.00 BDT`)
  - Cost Quality: **100%**
- **Plan Summary:** "Applied battery held at or above 80 kWh at 18:00, 19:00, 20:00, 21:00; grid import capped at 190 kWh at 19:00, 20:00, 21:00. Ignored 1 note unrelated to today's schedule. Charged in 6 hours and discharged in 10 hours to shift load away from expensive hours, ending the day back at the initial battery level. Total grid import 2715.00 kWh, peak 190.00 kWh, cost 41620.00 BDT."

---

## 5. Rubric & Constraint Adherence Analysis

According to **`project.md`** and **`Evaluation.md`**:

1. **Pipeline Architecture Separation:**
   - The LLM acts as the interpreter for natural-language operator notes, outputting strictly structured JSON.
   - Deterministic guardrails validate and sanitize the interpretation before feeding constraints into the solver.
   - GLPK (GNU Linear Programming Kit) solves the exact 24-hour cost-minimization Mixed Integer / Linear Program.
   - Deterministic replay checks all invariants before the HTTP 200 response is generated.

2. **Energy Invariants:**
   - $\text{demand}_h + \text{charge}_h = \text{grid}_h + \text{solar\_used}_h + \text{discharge}_h$ for every hour $h \in [0, 23]$.
   - $0 \le \text{solar\_used}_h \le \text{effective\_solar}_h$.
   - $\text{min\_reserve}_h \le \text{battery\_energy}_h \le \text{capacity}$.
   - End-of-day battery energy neutrality strictly holds: $\text{battery\_energy}_{23} = \text{battery\_energy}_{\text{initial}}$.

3. **Latency & Performance:**
   - Mean Latency: `1105ms`
   - P95 Latency: `1761ms` (Well below the 5.0s maximum threshold for full points).
   - Max Latency: `1761ms`

---
*Report generated automatically by GridWise Public Sample Evaluation Harness.*
