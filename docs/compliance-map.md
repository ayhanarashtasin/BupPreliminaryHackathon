# Compliance map

Requirement → implementation → test → status.
Sources: `project.md` (canonical challenge behavior), `Evaluation.md` / `rules.md` (evaluation,
deployment, submission), the public sample pack (worked examples only).

Status legend: **done** = implemented and covered by an executed test or a verified manual run ·
**partial** = implemented and measured, but the measurement does not clear the target on the current
provider tier ·
**external** = correct in code but final proof needs a credential or a hosting account the repo
cannot contain.

## API contract

| Requirement | Source | Implementation | Test | Status |
|---|---|---|---|---|
| `GET /health` → `200 {"status":"ok"}` | project.md §3.1 | `server/index.js` | `test/api.test.js` · Docker run verified | done |
| Readiness inside 60 s | Evaluation.md §10.6 | `server/index.js` (WASM solver warmed before `listen`) | container reached `/health` ~4 s after start | done |
| `POST /optimize-energy` exact name | project.md §3.2 | `server/index.js` | `test/api.test.js` | done |
| Exact request schema | project.md §4 | `server/validateRequest.js` | `test/validateRequest.test.js` | done |
| Exact response top-level fields, no extras | project.md §12.1 | `server/pipeline.js` | `test/api.test.js` (key-set assertion) | done |
| `scenario_id` echoed exactly | project.md §12.1 | `server/pipeline.js` | `test/api.test.js`, `scripts/run-public-samples.js` | done |
| `400` malformed / structurally invalid | project.md §3.2, §21 | `server/index.js` error handler, `server/validateRequest.js` | `test/api.test.js`, `test/validateRequest.test.js` | done |
| `422` well-formed but semantically invalid | project.md §3.2 | `server/validateRequest.js` | `test/validateRequest.test.js` | done |
| `500` controlled, no stacks or secrets | project.md §3.2, §22 | `server/index.js` error handler | `test/api.test.js` (secret-leak assertion) | done |
| Model is never called for an invalid request | project.md §21 | `server/pipeline.js` (validate first) | `test/api.test.js` | done |

## LLM interpretation

| Requirement | Source | Implementation | Test | Status |
|---|---|---|---|---|
| Language model genuinely interprets every note | project.md §7, Evaluation.md §6.1, Gate B | `server/llm.js`, `server/prompt.js` | `test/llm.test.js`; no keyword interpreter exists in the repo | done |
| Model output drives the optimizer constraints | Evaluation.md §6.1 | `server/pipeline.js` → `server/directives.js` | `test/api.test.js` (directive visible in the plan) | done |
| One entry per note, ascending `note_index` | project.md §8.2 | `server/guardrails.js` | `test/guardrails.test.js` | done |
| Batched single call for 1–3 notes | goal.md §5.2 | `server/llm.js` | `test/llm.test.js` | done |
| Prompt states hour semantics, factor semantics, % of capacity, no invention | project.md §20 | `server/prompt.js` | `test/llm.test.js` (prompt assertions) | done |
| Paraphrase robustness, not phrase matching | project.md §7, Evaluation.md §10.4 | model-side; prompt gives semantics, never sample wording | 9/9 on unseen paraphrases via `openai/gpt-oss-120b` | done |
| Provider abstraction, nothing hard-coded | goal.md §5.1 | `server/llm.js` (`PROVIDERS`, env-driven) | `test/llm.test.js` (`llmConfig`) | done |
| Provider timeout | Evaluation.md §10.7 | `AbortSignal.timeout(LLM_TIMEOUT_MS)` in `server/llm.js` | code path exercised by the bogus-key container run | done |
| Bounded retry, no silent `no_op`, no guessed repair | project.md §22, goal.md §5.4 | `server/llm.js` | `test/llm.test.js` (retry count + rejection) | done |
| Malformed/fenced JSON tolerated, then validated | goal.md §5.4 | `parseModelJson` in `server/llm.js` | `test/llm.test.js` | done |

## Directives and guardrails

| Requirement | Source | Implementation | Test | Status |
|---|---|---|---|---|
| Exactly six directive types | project.md §5 | `DIRECTIVE_TYPES` in `server/guardrails.js` | `test/guardrails.test.js` | done |
| Unsupported type rejected | project.md §8.1 | `server/guardrails.js` | `test/guardrails.test.js`, `test/api.test.js` | done |
| Missing / duplicate / out-of-order note mapping rejected | project.md §8.2 | `server/guardrails.js` | `test/guardrails.test.js` | done |
| `no_op` ⇒ `applies:false` + `null` adjustment | project.md §5.6, §8.3 | `server/guardrails.js` | `test/guardrails.test.js` | done |
| Non-`no_op` ⇒ `applies:true` + exact shape | project.md §8.3 | `server/guardrails.js` | `test/guardrails.test.js` | done |
| Hours unique, ascending, `0..23` | project.md §6, §8.4 | `validateHours` in `server/guardrails.js` | `test/guardrails.test.js` | done |
| Start-inclusive / end-exclusive windows | project.md §6 | `server/prompt.js` rules 5 | `test/llm.test.js`, public-sample run | done |
| Solar `factor` = remaining fraction, `[0,1]` | project.md §5.1, §8.5 | `server/prompt.js` rule 6, `server/guardrails.js` | `test/guardrails.test.js`, `test/llm.test.js` | done |
| Reserve finite, ≥ 0, ≤ capacity | project.md §8.6 | `server/guardrails.js` | `test/guardrails.test.js` | done |
| Grid cap finite, ≥ 0 | project.md §8.7 | `server/guardrails.js` | `test/guardrails.test.js` | done |
| No mutation of base demand/tariff/battery | project.md §8.8 | `server/guardrails.js` rebuilds entries from validated parts only | `test/guardrails.test.js` (extra keys stripped) | done |
| Controlled safe failure on bad model output | project.md §8.9 | `server/llm.js` → `server/pipeline.js` | `test/api.test.js` | done |

## Directive application and optimization

| Requirement | Source | Implementation | Test | Status |
|---|---|---|---|---|
| Directives applied **before** optimization | project.md §9 | `server/pipeline.js` order | `test/optimizer.test.js` | done |
| Effective solar per hour | project.md §5.1, §9 | `buildConstraints` | `test/optimizer.test.js` | done |
| Effective minimum reserve = `max(base, directives)` | project.md §11.2, §19 | `buildConstraints` | `test/optimizer.test.js` | done |
| No-charge / no-discharge windows | project.md §5.3, §5.4 | `buildConstraints` → LP bounds | `test/optimizer.test.js` | done |
| Grid cap = `min(active caps)` | project.md §19 | `buildConstraints` → LP bound | `test/optimizer.test.js` | done |
| Overlapping solar reductions combine conservatively | project.md §19 | `buildConstraints` (`min`) | `test/optimizer.test.js` | done |
| Real mathematical optimizer (LP) | Evaluation.md §6.3 | `server/optimizer.js` (GLPK simplex) | `test/optimizer.test.js`, `test/samples.test.js` | done |
| Objective `min Σ grid·tariff` | project.md §10 | `server/optimizer.js` | `test/samples.test.js` (matches reference optimum) | done |
| Hourly energy balance | project.md §11.5 | LP equality + deterministic rebuild | `test/optimizer.test.js`, `test/replay.test.js` | done |
| Battery transitions and bounds | project.md §11.1, §11.2 | LP state rows + bounds | `test/optimizer.test.js`, `test/replay.test.js` | done |
| Hourly charge/discharge rate limits | project.md §11.3 | LP variable bounds | `test/optimizer.test.js` | done |
| `0 ≤ solar_used ≤ effective solar`, curtailment allowed | project.md §11.4 | LP bound + rebuild clamp | `test/optimizer.test.js` | done |
| No grid export | project.md §11.4 | `grid ≥ 0`, no export variable exists | `test/replay.test.js` (negative grid rejected) | done |
| End-of-day neutrality | project.md §11.6 | `energy_after[23]` fixed to initial | `test/optimizer.test.js`, `test/replay.test.js` | done |
| No simultaneous charge and discharge | project.md §18 | net-flow rebuild in `server/optimizer.js` | `test/optimizer.test.js` (idle ⇒ 0) | done |
| Validity before cost | Evaluation.md Gate E | replay gates the response | `test/optimizer.test.js` (capped case is not cheaper) | done |
| Controlled failure when infeasible | project.md §22 | `InfeasibleError` → `PipelineError` | `server/optimizer.js` reserve/neutrality guard | done |

## Final replay and totals

| Requirement | Source | Implementation | Test | Status |
|---|---|---|---|---|
| Independent hour-by-hour replay | project.md §14, Gate D | `server/replay.js` | `test/replay.test.js` (15 mutation tests) | done |
| Every directive replay-checked | project.md §14.20 | `server/replay.js` per-directive loop | `test/replay.test.js` | done |
| Invalid plan never returned as success | project.md §14, §22 | `server/pipeline.js` | `test/replay.test.js` | done |
| Totals recomputed from `hourly_plan` | project.md §13 | `server/replay.js` returns the totals used in the response | `test/optimizer.test.js`, `scripts/run-public-samples.js` | done |
| Tolerance 0.01 kWh / 0.01 BDT | project.md §16 | `TOL` in `server/replay.js` | `test/replay.test.js` | done |
| `battery_kwh` non-negative, `0` when idle, no `-0` | project.md §12.3 | `server/optimizer.js` | `test/optimizer.test.js` | done |
| `plan_summary` deterministic, from validated plan | project.md §23 | `buildSummary` in `server/pipeline.js` | `test/api.test.js` | done |

## Reliability, performance, deployment, documentation

| Requirement | Source | Implementation | Test | Status |
|---|---|---|---|---|
| Repeated requests stay stable | Evaluation.md §10.9 | stateless pipeline | `test/api.test.js` (12 sequential requests) | done |
| No unhandled rejection kills the process | Evaluation.md Gate G | `process.on('unhandledRejection')`, async route try/catch | `server/index.js` | done |
| No secret leakage in responses or logs | Evaluation.md §10.11, Gate J | `server/index.js`, `server/llm.js` | `test/api.test.js`; container log inspection | done |
| p95 ≤ 5 s target | Evaluation.md §10.8 | one batched call, clamped timeout, in-process LP, no DB on the path | p95 varies with free-tier throttling: 2.5 s / 4.7 s / 8.4 s across three real runs. Not reliably ≤5 s on the free key | partial |
| Provider rate limits absorbed | Evaluation.md §5.3, §10.9 | `429` + `Retry-After` back-off inside `LLM_BUDGET_MS` (`server/llm.js`) | observed recovering from free-tier `429`s (SAMPLE-10, 4.7 s) | done |
| Interpretation can never outlive the budget | Evaluation.md §10.7, Gate F | every attempt clamped to the remaining budget (`attemptTimeout`, `server/llm.js`) | `test/llm.test.js` (clamp + early-stop) | done |
| DB never on the judge path | goal.md §4.3 | `server/db.js` fire-and-forget, post-response | `npm test` runs with no `MONGODB_URI`; Atlas write/read verified separately | done |
| Binds `0.0.0.0`, documented port | Evaluation.md §3.6 | `server/index.js`, `Dockerfile` | container run on `-p 8080:8080` | done |
| Docker image builds, runs, reaches `/health` | Evaluation.md §10.15 | `Dockerfile`, `.dockerignore` | `gridwise:1.0.0`: `/health` → 200 in 16 ms, real `/optimize-energy` → 200 in 745 ms | done |
| No secrets in the image | Evaluation.md §3.6 | no `COPY .env`, `.dockerignore` excludes `.env*` | image inspected | done |
| Public registry tag/digest | Evaluation.md §4 | README §5 placeholder | — | external (push required) |
| Public base URL, no login/VPN | Evaluation.md §5.1 | no auth middleware anywhere | live at `https://bup-preliminary-hackathon.vercel.app`; 10/10 public cases from an external client, p95 2.3 s | done |
| Self-contained README with quickstart, curl, env names, model, solver, Docker, limits, credits | Evaluation.md §3.5, §9.7 | `README.md` | — | done |
| Public-sample runner, one copy-paste command | goal.md §18 | `scripts/run-public-samples.js`, `npm run samples` | 10/10, 100% cost quality, real `openai/gpt-oss-120b` | done |
| 3-minute architecture video | Evaluation.md §3.7 | — | — | external (team deliverable) |

## Deliberate non-implementations

* The judge's scoring formula is not reimplemented. The participant guide's `quality_ratio` branch for
  "organizer optimal cost within tolerance of 0 but team cost above tolerance" is truncated in the
  supplied source; it is not guessed here (Evaluation.md §10.3, §18).
* No offline/keyword interpreter exists as an LLM fallback — that would violate the mandatory-LLM rule.
* No authentication, dashboard gate, or database dependency stands between the judge and either endpoint.
