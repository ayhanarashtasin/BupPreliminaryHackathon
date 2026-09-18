# PROJECT.md — BUP CSE Fest 2026 Hackathon Preliminary

## Project: Smart Campus Energy Optimization Challenge

This file is the implementation brief for Codex. It is derived from the canonical **BUP CSE Fest 2026 Hackathon Preliminary Problem Statement** and the provided end-to-end processing-flow figure.

> **Canonical rule:** when this file and an implementation choice conflict, preserve the behavior defined in the official Problem Statement. Deployment, repository, submission, performance, scoring, tie-break, penalties, and general participation rules belong to the separate **Participant Guide & Evaluation Rubric** and are not redefined here.

---

# 1. Challenge Summary

Build one deployed public HTTP API service for a **24-hour smart-campus energy scheduling problem**.

The service receives:

- a synthetic scenario identifier,
- **1–3 natural-language operator notes**,
- exactly **24 hourly entries** containing:
  - demand,
  - solar availability,
  - grid tariff,
- battery parameters.

The service must:

1. use an **LLM or other language-capable generative model** to interpret **every operator note**,
2. convert each note into exactly one supported structured directive or `no_op`,
3. treat LLM output as **untrusted structured data**,
4. run deterministic guardrail validation,
5. apply every valid directive to the optimization model,
6. mathematically optimize the 24-hour schedule,
7. run a final deterministic replay/validation over the returned schedule,
8. return structured JSON containing both:
   - the machine-checkable note interpretation,
   - the final 24-hour energy plan.

The primary optimization objective is to **minimize total grid electricity cost**, but correctness comes first. A cheaper plan is invalid if it violates any energy, battery, or operator-directive rule.

All scenarios and operator notes are synthetic. No live campus, utility, billing, or personal data is required.

---

# 2. Required End-to-End Processing Flow

The supplied figure defines this exact conceptual pipeline:

```text
Energy Data + Operator Notes
          ↓
    LLM Interpreter
          ↓
   Guardrail Validator
          ↓
     Math Optimizer
          ↓
     Final Validator
          ↓
      API Response
```

The meaning of the figure is important:

- **The LLM understands human language.**
- **Deterministic code validates the interpretation.**
- **The optimizer performs the mathematical scheduling.**
- Human notes must **not** be trusted directly as mathematical constraints.
- Notes must first become a fixed structured format.
- That structured output must pass deterministic guardrails.
- Only then may the directives affect the optimization model.
- The optimized result must be replayed/validated before it is returned.

Do **not** collapse these responsibilities into one opaque LLM call.

---

# 3. Mandatory Public API

The judge harness exercises only these endpoint names. They must match exactly.

## 3.1 `GET /health`

When ready, return HTTP `200` with:

```json
{
  "status": "ok"
}
```

## 3.2 `POST /optimize-energy`

Accept one scenario JSON object and return one interpretation + optimization-plan JSON object.

### HTTP response codes

- `200` — successful health response or successful optimization response.
- `400` — malformed JSON or structurally invalid request.
- `422` — optional; semantically invalid but well-formed request.
- `500` — controlled internal error. Never expose secrets or raw stack traces.

---

# 4. Request Schema

`POST /optimize-energy` accepts one JSON object.

## 4.1 Top-level fields

| Field | Type | Requirement |
|---|---|---|
| `scenario_id` | string | Unique synthetic scenario identifier. |
| `operator_notes` | array of 1–3 strings | Non-empty natural-language campus operator notes referring to the same 24-hour scenario. |
| `hours` | array of exactly 24 objects | Must contain one entry for every hour `0..23`. |
| `battery` | object | Battery capacity, starting energy, reserve, and hourly limits. |

## 4.2 Hour entry

Each hourly object contains:

| Field | Type | Meaning |
|---|---|---|
| `hour` | integer | Unique integer from `0` through `23`. |
| `demand_kwh` | number | Campus demand that must be supplied in this hour. |
| `solar_kwh` | number | Base solar energy available before operator-note adjustments. |
| `tariff_bdt_per_kwh` | number | Grid electricity price for this hour. |

## 4.3 Battery object

| Field | Meaning |
|---|---|
| `capacity_kwh` | Maximum energy the battery can store. |
| `initial_energy_kwh` | Battery energy at the start of hour `0`. |
| `minimum_energy_kwh` | Base reserve level the battery must never go below. |
| `max_charge_kwh_per_hour` | Maximum energy that may be added in one hour. |
| `max_discharge_kwh_per_hour` | Maximum energy that may be removed in one hour. |

## 4.4 Example request shape

```json
{
  "scenario_id": "GRID-101",
  "operator_notes": [
    "Solar output will drop to about 20% from 1 PM to 3 PM.",
    "Do not charge the battery between 2 PM and 4 PM.",
    "The cafeteria menu changes tomorrow."
  ],
  "hours": [
    {"hour": 0, "demand_kwh": 180, "solar_kwh": 0, "tariff_bdt_per_kwh": 7},
    "... 22 more hourly entries ...",
    {"hour": 23, "demand_kwh": 200, "solar_kwh": 0, "tariff_bdt_per_kwh": 9}
  ],
  "battery": {
    "capacity_kwh": 500,
    "initial_energy_kwh": 200,
    "minimum_energy_kwh": 50,
    "max_charge_kwh_per_hour": 100,
    "max_discharge_kwh_per_hour": 100
  }
}
```

---

# 5. Operator Notes and Supported Directive Types

Every scenario contains **1–3 operator notes**.

Some notes affect the current energy schedule; others are realistic distractors. Hidden cases may express the same rule using different wording.

Every operator note must produce **exactly one** `directive_interpretation` entry.

Only the directive types below are accepted.

## 5.1 `solar_reduction`

Meaning: reduce usable solar during specific hours.

Required `structured_adjustment`:

```json
{
  "hours": [13, 14],
  "factor": 0.2
}
```

Rules:

- `factor` is the **usable fraction that remains**.
- Example: an **80% reduction** means `factor = 0.2`.
- `factor` must be in `[0, 1]` inclusive.

Deterministic optimizer effect:

```text
effective_solar[h] = original_solar[h] * factor
```

for every listed hour.

---

## 5.2 `minimum_battery_reserve`

Meaning: keep battery energy at or above a required level during specific hours.

Required `structured_adjustment`:

```json
{
  "hours": [18, 19, 20],
  "minimum_energy_kwh": 120
}
```

Deterministic optimizer effect:

```text
battery_energy_after_kwh[h] >= max(
    base minimum_energy_kwh,
    directive minimum_energy_kwh
)
```

for every listed hour.

Guardrail:

- reserve must be finite,
- non-negative,
- must not exceed battery capacity.

---

## 5.3 `no_charge_window`

Meaning: battery charging is unavailable during specific hours.

Required `structured_adjustment`:

```json
{
  "hours": [14, 15]
}
```

Deterministic optimizer effect:

```text
battery charge amount = 0
```

for the listed hours.

---

## 5.4 `no_discharge_window`

Meaning: battery discharging is unavailable during specific hours.

Required `structured_adjustment`:

```json
{
  "hours": [14, 15]
}
```

Deterministic optimizer effect:

```text
battery discharge amount = 0
```

for the listed hours.

---

## 5.5 `max_grid_window`

Meaning: grid import may not exceed a stated amount during specific hours.

Required `structured_adjustment`:

```json
{
  "hours": [17, 18, 19],
  "max_grid_kwh": 250
}
```

Deterministic optimizer effect:

```text
grid_kwh[h] <= max_grid_kwh
```

for every listed hour.

Guardrail:

- `max_grid_kwh` must be finite,
- `max_grid_kwh >= 0`.

---

## 5.6 `no_op`

Meaning: the note does not affect the current 24-hour energy schedule.

Required behavior:

```json
{
  "applies": false,
  "directive_type": "no_op",
  "structured_adjustment": null
}
```

Deterministic optimizer effect:

```text
No change to the optimization model.
```

`no_op` is the **only** directive allowed to use `applies = false`.

---

# 6. Time-Window Semantics

Time windows use whole-hour intervals.

The **start hour is included** and the **end hour is excluded**.

Examples:

- `1 PM to 3 PM` → hours `[13, 14]`
- `2 PM to 4 PM` → hours `[14, 15]`
- `6 PM until 9 PM` → hours `[18, 19, 20]`

Every `hours` array in `structured_adjustment` must:

- contain only integers,
- contain values from `0` through `23`,
- contain no duplicates,
- be sorted in ascending order.

---

# 7. LLM Interpretation Requirements

The LLM must be part of the **operator-note interpretation path**.

Using an LLM only for:

- `plan_summary`,
- documentation,
- cosmetic text,

**does not satisfy the challenge requirement**.

For every note, the LLM should extract one structured interpretation containing at least:

- `note_index`,
- `applies`,
- `directive_type`,
- `structured_adjustment`,
- `explanation`.

The LLM must not invent:

- demand,
- solar,
- tariff,
- battery limits,
- battery parameters,
- unsupported directive types.

The same underlying rule may be phrased differently. The implementation must be robust to paraphrases rather than relying on byte-for-byte matching.

Example equivalent solar-reduction statements:

- `PV production will drop to about 20% between 13:00 and 15:00.`
- `Panel washing from one until three will leave roughly one-fifth of normal solar output.`
- `Expect an 80% reduction in rooftop solar during the 1-3 PM maintenance window.`

All three mean the same underlying directive:

```json
{
  "directive_type": "solar_reduction",
  "structured_adjustment": {
    "hours": [13, 14],
    "factor": 0.2
  }
}
```

---

# 8. Guardrail Validator

Treat LLM output as **untrusted structured data** until deterministic validation passes.

The validator must enforce all of the following.

## 8.1 Allowed directive type

`directive_type` must be exactly one of:

```text
solar_reduction
minimum_battery_reserve
no_charge_window
no_discharge_window
max_grid_window
no_op
```

## 8.2 Note mapping

- `note_index` must identify an existing operator note.
- Every input note must appear exactly once.
- No note may be missing.
- No note may appear twice.
- Returned interpretation entries must be in `note_index` order: `0, 1, ..., N-1`.

## 8.3 `applies` semantics

For `no_op`:

```text
applies = false
structured_adjustment = null
```

For every non-`no_op` directive:

```text
applies = true
structured_adjustment must match the exact shape required by that directive type
```

## 8.4 Hours validation

Every hours list must contain:

- unique integers,
- values only in `0..23`,
- ascending order.

## 8.5 Solar factor validation

For `solar_reduction`:

```text
0 <= factor <= 1
```

## 8.6 Reserve validation

For `minimum_battery_reserve`:

```text
minimum_energy_kwh is finite
minimum_energy_kwh >= 0
minimum_energy_kwh <= battery.capacity_kwh
```

## 8.7 Grid-cap validation

For `max_grid_window`:

```text
max_grid_kwh is finite
max_grid_kwh >= 0
```

## 8.8 No invention

The interpretation must not modify base:

- demand,
- tariff,
- battery parameters,

unless the modification is explicitly represented by a supported directive. In the supplied directive set, none permit arbitrary mutation of those base values.

## 8.9 Safe failure

If the LLM returns:

- malformed JSON,
- unsupported directive type,
- wrong structure,
- invalid numbers,
- invalid note mapping,

then the service must fail in a **controlled** manner.

It must not:

- silently invent a new directive,
- reinterpret an invalid type into a different type without deterministic justification,
- crash,
- leak raw stack traces or secrets.

---

# 9. Applying Directives Before Optimization

Relevant notes must be applied to the optimization model **before** scheduling.

A note that is interpreted correctly but not actually applied to the mathematical model still fails the challenge.

Recommended deterministic preprocessing model:

```text
base scenario
   ↓
validated directives
   ↓
create effective per-hour constraints
   ↓
run optimizer
```

At minimum, derive per hour:

- `effective_solar_kwh[h]`,
- effective minimum battery reserve,
- whether charging is allowed,
- whether discharging is allowed,
- effective maximum grid import, if any.

If multiple directives of the same type affect the same hour, combine them conservatively so all applicable hard constraints remain satisfied.

The official statement guarantees organizer-valid scoring scenarios will be feasible and will not require mutually contradictory hard directives at the same time.

---

# 10. Mathematical Optimization Objective

After applying all valid directive adjustments, minimize:

```text
total_cost_bdt = Σ(grid_kwh[h] * tariff_bdt_per_kwh[h])
```

for `h = 0..23`.

Lower cost is better **only after** all constraints are satisfied.

Do not sacrifice validity for a lower objective value.

---

# 11. Battery and Energy Rules

The existing GridWise energy-accounting rules remain unchanged.

The judge independently replays the returned schedule hour by hour using effective solar and the operator directives.

## 11.1 Battery state transition

For each hour:

### Charge

```text
E_after = E_before + battery_kwh
```

### Discharge

```text
E_after = E_before - battery_kwh
```

### Idle

```text
E_after = E_before
battery_kwh = 0
```

`battery_kwh` in the response is a **non-negative magnitude**. Direction comes from `battery_action`.

## 11.2 Battery bounds

Always enforce:

```text
minimum_energy_kwh <= E_after <= capacity_kwh
```

If a `minimum_battery_reserve` directive is active for an hour, use the higher required reserve:

```text
E_after >= max(base minimum, active directive minimum)
```

## 11.3 Hourly charge/discharge limits

If charging:

```text
battery_kwh <= max_charge_kwh_per_hour
```

If discharging:

```text
battery_kwh <= max_discharge_kwh_per_hour
```

Also enforce directive windows:

- `no_charge_window` → charge amount must be `0` in listed hours.
- `no_discharge_window` → discharge amount must be `0` in listed hours.

## 11.4 Solar usage

For every hour:

```text
0 <= solar_used_kwh <= effective_solar_kwh
```

Unused solar is curtailed.

Grid export is **not part of this challenge**.

## 11.5 Energy balance

For every hour:

```text
grid_kwh
+ solar_used_kwh
+ battery_discharge_kwh
=
demand_kwh
+ battery_charge_kwh
```

This equality must hold within the judge's numeric tolerance.

## 11.6 End-of-day battery neutrality

The final battery energy must equal the initial battery energy:

```text
final battery_energy_after_kwh = initial_energy_kwh
```

Reason: the starting battery may shift energy across hours, but it may not be treated as free one-time energy by ending the day at a lower state of charge.

---

# 12. Response Schema

A successful `POST /optimize-energy` response must include both the operator-note interpretation and the final 24-hour schedule.

## 12.1 Top-level fields

| Field | Type | Requirement |
|---|---|---|
| `scenario_id` | string | Must exactly match request `scenario_id`. |
| `directive_interpretation` | array | Exactly one machine-checkable entry for every operator note. |
| `hourly_plan` | array of exactly 24 objects | One entry for every hour `0..23`. |
| `total_grid_kwh` | number | Sum of `grid_kwh` over all 24 hours. |
| `total_cost_bdt` | number | Sum of hourly grid cost. |
| `peak_grid_kwh` | number | Maximum hourly `grid_kwh`. |
| `plan_summary` | string | Short human-readable explanation of the final strategy. |

## 12.2 Directive interpretation entry

Each entry must contain:

| Field | Requirement |
|---|---|
| `note_index` | Zero-based index of the corresponding `operator_notes` entry. |
| `applies` | `true` for every applicable non-`no_op` directive; `false` only for `no_op`. |
| `directive_type` | One supported type. `no_op` is required when `applies = false`. |
| `structured_adjustment` | Exact machine-checkable object for the selected directive, or `null` only for `no_op`. |
| `explanation` | Short explanation of the interpretation. |

Example fragment:

```json
{
  "directive_interpretation": [
    {
      "note_index": 0,
      "applies": true,
      "directive_type": "solar_reduction",
      "structured_adjustment": {
        "hours": [13, 14],
        "factor": 0.2
      },
      "explanation": "Solar availability is reduced during panel cleaning."
    },
    {
      "note_index": 2,
      "applies": false,
      "directive_type": "no_op",
      "structured_adjustment": null,
      "explanation": "This note does not affect today's energy schedule."
    }
  ]
}
```

## 12.3 Hourly plan entry

Each of the 24 entries must contain:

| Field | Allowed value / meaning |
|---|---|
| `hour` | Integer `0..23`. |
| `grid_kwh` | Non-negative grid energy purchased in this hour. |
| `solar_used_kwh` | Solar energy actually used; cannot exceed effective solar. |
| `battery_action` | Exactly one of `charge`, `discharge`, `idle`. |
| `battery_kwh` | Non-negative magnitude of battery action; must be `0` when idle. |
| `battery_energy_after_kwh` | Battery energy immediately after completing this hour. |

---

# 13. Derived Totals

After optimization, compute these from `hourly_plan`, not from independent approximations.

## `total_grid_kwh`

```text
Σ grid_kwh[h]
```

## `total_cost_bdt`

```text
Σ grid_kwh[h] * tariff_bdt_per_kwh[h]
```

## `peak_grid_kwh`

```text
max(grid_kwh[h])
```

The judge will recalculate all three and compare them with the returned values.

---

# 14. Final Validator / Replay

After the optimizer produces a candidate plan, deterministically replay it hour by hour.

Do not trust the optimizer output without validation.

The final validator must verify:

1. `scenario_id` matches the request.
2. `directive_interpretation` contains exactly one entry per note.
3. Entries are in `note_index` order.
4. `hourly_plan` contains exactly 24 unique hours `0..23`.
5. All required numeric values are finite and non-negative where required.
6. Battery transitions are correct.
7. Battery never exceeds capacity.
8. Battery never drops below the effective minimum reserve.
9. Charge/discharge hourly limits are respected.
10. `no_charge_window` is respected.
11. `no_discharge_window` is respected.
12. `max_grid_window` is respected.
13. `solar_reduction` has been applied to effective solar.
14. `solar_used_kwh` never exceeds effective solar.
15. The hourly energy-balance equality holds.
16. Final battery energy equals initial battery energy.
17. `total_grid_kwh` matches the replayed sum.
18. `total_cost_bdt` matches the replayed cost.
19. `peak_grid_kwh` matches the replayed maximum.
20. Every extracted directive was actually applied downstream.

If final validation fails, do **not** return the candidate as a successful plan.

---

# 15. Hidden Evaluation Expectations

Hidden evaluation checks both:

- **language understanding**, and
- **energy optimization / downstream application**.

Do not assume only `total_cost_bdt` or free-text output is checked.

## 15.1 Interpretation checks

The judge may verify:

- whether each note is applicable or `no_op`,
- correct directive type,
- correct hours,
- correct numeric values within tolerance,
- robustness to paraphrasing,
- one interpretation entry per note,
- no duplicate or missing note mappings,
- exact `structured_adjustment` shape,
- correct `applies` semantics.

## 15.2 Downstream checks

The judge may:

- recompute effective solar after `solar_reduction`,
- verify reserve directives,
- verify no-charge windows,
- verify no-discharge windows,
- verify grid caps directly against `hourly_plan`.

Correct extraction without correct downstream application does **not** pass.

## 15.3 No byte-for-byte plan matching

Equivalent valid optimal schedules may differ.

The judge evaluates:

- structured interpretation,
- directive application,
- schedule validity,
- recalculated cost,

rather than requiring exact JSON equality with one reference plan.

---

# 16. Numeric Tolerance

For normal floating-point arithmetic, values within an absolute tolerance of:

```text
0.01 kWh
0.01 BDT
```

should be treated as equivalent unless the official judge package specifies a stricter tolerance.

Implementation recommendation:

```python
EPS = 1e-6         # internal feasibility checks
JUDGE_TOL = 0.01   # output/replay equivalence expectation
```

Use numerically stable calculations and normalize tiny negative floating-point artifacts to zero only when they are within a small internal epsilon.

---

# 17. Recommended Internal Architecture

This section is an implementation recommendation, not an additional competition rule.

```text
app/
├── main.py                    # HTTP API routes
├── schemas.py                 # Request/response validation models
├── llm/
│   ├── interpreter.py         # LLM call + structured output
│   ├── prompts.py             # strict extraction prompt
│   └── types.py               # directive schemas / enums
├── validation/
│   ├── request_validator.py   # structural/semantic request checks
│   ├── directive_validator.py # deterministic LLM guardrails
│   └── plan_validator.py      # final replay validator
├── optimization/
│   ├── preprocess.py          # apply directives to effective constraints
│   ├── model.py               # LP/MILP optimizer
│   └── solver.py              # solve and convert solution to hourly plan
├── services/
│   └── optimize_energy.py     # orchestration pipeline
└── tests/
    ├── test_directives.py
    ├── test_time_windows.py
    ├── test_energy_balance.py
    ├── test_optimizer.py
    ├── test_final_replay.py
    └── test_api.py
```

Recommended orchestration:

```text
validate request
→ interpret notes with LLM
→ validate LLM output deterministically
→ apply directives to effective constraints
→ solve mathematical optimization
→ build hourly_plan
→ replay final plan deterministically
→ recompute totals
→ generate short plan_summary
→ return JSON
```

---

# 18. Recommended Optimizer Formulation

A linear-programming formulation is sufficient if implemented carefully.

For each hour `h`, useful non-negative variables are:

```text
grid[h]
solar_used[h]
charge[h]
discharge[h]
energy_after[h]
```

Possible battery-action output mapping can be derived from charge/discharge results:

- if `charge[h] > tolerance` → `battery_action = "charge"`, `battery_kwh = charge[h]`
- else if `discharge[h] > tolerance` → `battery_action = "discharge"`, `battery_kwh = discharge[h]`
- else → `battery_action = "idle"`, `battery_kwh = 0`

Do not allow simultaneous meaningful charge and discharge in the final output. If the chosen mathematical formulation could produce both due to degeneracy, eliminate that behavior through formulation, tie-breaking, or safe deterministic post-processing that preserves objective value and all constraints.

Per-hour energy balance can be modeled as:

```text
grid[h] + solar_used[h] + discharge[h]
=
demand[h] + charge[h]
```

Battery state:

```text
energy_after[h] = energy_before[h] + charge[h] - discharge[h]
```

where:

```text
energy_before[0] = initial_energy_kwh
energy_before[h] = energy_after[h-1]   for h > 0
```

Bounds:

```text
0 <= solar_used[h] <= effective_solar[h]
0 <= charge[h] <= max_charge_kwh_per_hour
0 <= discharge[h] <= max_discharge_kwh_per_hour
effective_minimum[h] <= energy_after[h] <= capacity_kwh
grid[h] >= 0
```

Directive-specific constraints:

```text
no_charge_window      → charge[h] = 0
no_discharge_window   → discharge[h] = 0
max_grid_window       → grid[h] <= directive cap
solar_reduction       → modify effective_solar[h]
minimum reserve       → increase effective_minimum[h]
```

End condition:

```text
energy_after[23] = initial_energy_kwh
```

Objective:

```text
minimize Σ grid[h] * tariff[h]
```

---

# 19. Combining Multiple Directives

The official scoring scenarios will be feasible and will not require contradictory hard directives. Still, the implementation should combine valid constraints deterministically.

Recommended combination behavior:

## Solar reductions

If more than one validated reduction affects the same hour, all applicable reductions must be satisfied. Represent the resulting effective solar conservatively so no directive is violated.

## Minimum battery reserve

Use the strictest reserve:

```text
effective_minimum[h] = max(base minimum, all active directive minima)
```

## No-charge / no-discharge

If any applicable directive forbids that action in an hour, that action must be zero.

## Grid caps

If more than one cap applies in the same hour, use the tightest cap:

```text
effective_grid_cap[h] = min(all active max_grid_kwh values)
```

Do not create behavior beyond the published directive types.

---

# 20. LLM Prompting Contract for Codex Implementation

The LLM extraction prompt should make the following points explicit:

1. Return one interpretation object for each input note.
2. Preserve `note_index` exactly.
3. Choose only from the six supported directive types.
4. Use `no_op` for irrelevant notes.
5. Do not invent unsupported constraints.
6. Convert time windows to whole-hour indices using inclusive-start/exclusive-end semantics.
7. For percentage solar reductions, output the **remaining usable fraction**, not the reduction percentage.
8. Use exact schema shapes.
9. Return machine-parseable structured output only.
10. Do not alter the scenario's demand, tariffs, or battery parameters.

Recommended LLM output shape before deterministic validation:

```json
{
  "directive_interpretation": [
    {
      "note_index": 0,
      "applies": true,
      "directive_type": "solar_reduction",
      "structured_adjustment": {
        "hours": [13, 14],
        "factor": 0.2
      },
      "explanation": "Solar availability is reduced to 20% during the stated interval."
    }
  ]
}
```

Never use the LLM's explanatory prose as the authoritative constraint representation. The structured fields are authoritative only after deterministic validation.

---

# 21. Structural Request Validation

Before invoking the LLM or optimizer, reject structurally invalid input.

At minimum check:

- body is valid JSON,
- top-level object exists,
- `scenario_id` is a string,
- `operator_notes` contains between 1 and 3 non-empty strings,
- `hours` contains exactly 24 entries,
- each `hour` is unique,
- the set of hour values is exactly `{0,1,...,23}`,
- required hourly numeric fields exist and are finite,
- `battery` object exists,
- required battery fields exist and are finite,
- obvious invalid negative constraints are rejected where semantically inappropriate.

Return controlled `400` for malformed/structural failure. `422` may be used for well-formed but semantically invalid input.

---

# 22. Failure Handling

The API must fail safely and predictably.

## LLM failure

Examples:

- timeout,
- malformed structured response,
- unsupported directive,
- missing note,
- duplicate note,
- invalid numeric parameter.

Required behavior:

- do not invent a substitute directive,
- do not silently ignore the error if it changes correctness,
- produce a controlled service error,
- log enough information for debugging without exposing secrets in the public response.

## Optimizer failure

If no valid solution is returned:

- do not construct a fake schedule,
- return a controlled error.

Organizer-valid scoring cases are expected to have feasible ground-truth interpretations and no contradictory hard directives, so infeasibility may indicate an implementation or interpretation error.

## Final-validation failure

If replay detects a violated rule:

- reject the generated plan internally,
- do not return it as a successful response.

---

# 23. Plan Summary

`plan_summary` is a short human-readable explanation of the final strategy.

It is not a substitute for:

- the LLM interpretation,
- the structured directives,
- the optimizer,
- the final validator.

The LLM requirement is **not** satisfied by using an LLM only to write `plan_summary`.

Keep the summary concise and based only on the validated interpretation and final plan.

---

# 24. Testing Requirements

Codex should build automated tests covering the official behaviors.

## 24.1 Directive parsing tests

At minimum:

- straightforward `solar_reduction`,
- percentage reduction → remaining fraction conversion,
- paraphrased solar reduction,
- `minimum_battery_reserve`,
- `no_charge_window`,
- `no_discharge_window`,
- `max_grid_window`,
- irrelevant `no_op`,
- multiple notes in one scenario,
- note order preservation.

## 24.2 Time-window tests

Verify:

```text
1 PM to 3 PM → [13,14]
2 PM to 4 PM → [14,15]
6 PM until 9 PM → [18,19,20]
```

Also test:

- duplicate hours rejected,
- out-of-range hours rejected,
- unsorted hours rejected or normalized before validation only if normalization is explicitly implemented and still yields a deterministic valid structure.

## 24.3 Guardrail tests

Reject:

- unsupported directive types,
- factor below 0,
- factor above 1,
- negative grid cap,
- reserve above capacity,
- reserve below 0,
- missing note mappings,
- duplicate note mappings,
- `applies = false` for a non-`no_op` directive,
- `applies = true` for `no_op`,
- non-null adjustment for `no_op`.

## 24.4 Energy tests

Test:

- energy balance every hour,
- charge/discharge transition math,
- battery capacity bound,
- base reserve bound,
- directive reserve bound,
- hourly charge limit,
- hourly discharge limit,
- solar availability limit,
- no grid export behavior,
- end-of-day battery neutrality.

## 24.5 Directive-application tests

Ensure extraction alone is insufficient:

- solar reduction actually lowers effective solar,
- no-charge really forces charge to zero,
- no-discharge really forces discharge to zero,
- reserve really raises the minimum battery level,
- grid cap really limits hourly grid import.

## 24.6 Aggregate tests

Verify from `hourly_plan`:

- `total_grid_kwh`,
- `total_cost_bdt`,
- `peak_grid_kwh`.

## 24.7 API tests

Verify:

- `GET /health` returns `200` and `{"status":"ok"}`,
- malformed JSON returns `400`,
- structurally invalid request returns `400`,
- controlled internal failure does not expose stack trace/secrets,
- valid scenario returns all required response fields.

---

# 25. Acceptance Checklist

The implementation is not complete until every item below is satisfied.

## API

- [ ] Public HTTP service exists.
- [ ] `GET /health` endpoint name is exact.
- [ ] `GET /health` returns HTTP 200 with `status = "ok"` when ready.
- [ ] `POST /optimize-energy` endpoint name is exact.
- [ ] Successful optimization returns HTTP 200.
- [ ] Malformed/structurally invalid JSON is handled with 400.
- [ ] Optional 422 is used only for well-formed semantic invalidity if implemented.
- [ ] Internal failures are controlled and do not leak secrets or raw stack traces.

## Input

- [ ] Exactly 24 hourly entries are required.
- [ ] Hour IDs cover 0 through 23 exactly once.
- [ ] `operator_notes` contains 1–3 non-empty strings.
- [ ] Battery fields are present and validated.

## LLM interpretation

- [ ] LLM is genuinely used in the operator-note interpretation path.
- [ ] Every note gets exactly one interpretation entry.
- [ ] Entries remain in `note_index` order.
- [ ] Only supported directive types are emitted.
- [ ] Irrelevant note → `no_op`.
- [ ] No invented demand/solar/tariff/battery values.
- [ ] Hidden paraphrases are supported.

## Guardrails

- [ ] LLM output is treated as untrusted.
- [ ] Directive schema is validated deterministically.
- [ ] Hours are unique, sorted, and within `0..23`.
- [ ] Solar factors are in `[0,1]`.
- [ ] Reserve is finite, non-negative, and ≤ capacity.
- [ ] Grid cap is finite and non-negative.
- [ ] `applies` semantics are exact.
- [ ] Malformed/unsupported LLM output fails safely.

## Optimization

- [ ] Directives are applied before optimization.
- [ ] Effective solar is correctly computed.
- [ ] Effective reserve is correctly computed.
- [ ] No-charge windows are enforced.
- [ ] No-discharge windows are enforced.
- [ ] Grid caps are enforced.
- [ ] Grid cost is minimized after correctness constraints.

## Battery / energy

- [ ] Battery transitions are correct.
- [ ] Battery remains within capacity and reserve limits.
- [ ] Hourly charge/discharge limits are respected.
- [ ] Solar usage is non-negative and ≤ effective solar.
- [ ] Grid export is not used.
- [ ] Hourly energy balance holds.
- [ ] Final battery energy equals initial battery energy.

## Output

- [ ] `scenario_id` matches request.
- [ ] `directive_interpretation` is complete.
- [ ] `hourly_plan` contains exactly 24 unique hours.
- [ ] `battery_action` is exactly `charge`, `discharge`, or `idle`.
- [ ] `battery_kwh` is non-negative and equals 0 when idle.
- [ ] `total_grid_kwh` is recalculated from the plan.
- [ ] `total_cost_bdt` is recalculated from the plan.
- [ ] `peak_grid_kwh` is recalculated from the plan.
- [ ] `plan_summary` is short and consistent with the validated plan.

## Final replay

- [ ] Every extracted directive is replay-verified.
- [ ] Every battery rule is replay-verified.
- [ ] Every hourly energy balance is replay-verified.
- [ ] Final battery neutrality is replay-verified.
- [ ] Aggregate values are replay-verified.
- [ ] Invalid candidate plans are never returned as success.

---

# 26. Critical "Do Not" List

Codex must not:

- rename the required endpoints,
- skip the LLM in the operator-note interpretation path,
- use only keyword matching as a substitute for the required language-model interpretation path,
- trust LLM output without deterministic validation,
- invent directive types,
- invent scenario data,
- ignore relevant notes,
- treat an irrelevant note as a made-up energy rule,
- output `applies = false` for a non-`no_op` directive,
- output a non-null `structured_adjustment` for `no_op`,
- misinterpret an 80% solar reduction as `factor = 0.8`; it means `factor = 0.2`,
- treat end hours as inclusive,
- allow out-of-range or duplicate hours in a directive,
- optimize first and apply directives afterward,
- return a plan that violates a correctly interpreted directive,
- consume the initial battery as free energy by ending below the starting state,
- exceed available effective solar,
- use grid export,
- trust optimizer output without final replay,
- return stale/precomputed totals that do not match `hourly_plan`,
- depend on byte-for-byte hidden-note wording,
- expose secrets or raw stack traces.

---

# 27. Codex Implementation Order

Use this order when building the project:

1. Define strict request/response schemas.
2. Implement `GET /health`.
3. Implement deterministic structural request validation.
4. Define directive enums and exact per-directive schemas.
5. Implement the LLM interpreter with structured output.
6. Implement the deterministic directive guardrail validator.
7. Implement time-window normalization rules.
8. Implement directive-to-effective-constraint preprocessing.
9. Implement the mathematical optimizer.
10. Convert optimizer variables into the exact `hourly_plan` schema.
11. Recompute aggregate metrics.
12. Implement deterministic final replay validation.
13. Implement concise `plan_summary` generation.
14. Wire the complete `POST /optimize-energy` orchestration path.
15. Add unit tests for every directive and energy rule.
16. Add hidden-language paraphrase tests.
17. Add API integration tests.
18. Verify numeric tolerance behavior.
19. Verify safe failure paths.
20. Deploy as a public HTTP API according to the separate participant deployment/submission guide.

---

# 28. One-Sentence System Principle

> **Understand the operator notes first, validate the extracted directives, apply them to the optimization, produce a valid 24-hour schedule, replay-validate it, and only then minimize/return the costed plan.**

