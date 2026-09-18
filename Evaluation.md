# EVALUATION.md - BUP CSE Fest 2026 Hackathon Preliminary

## GridWise LLM-Assisted Smart Campus Energy Optimization

This file is the evaluation, deployment, submission, reliability, and reproducibility brief for Codex. It is derived from the official **Participant Guide & Evaluation Rubric** for the **Online Preliminary Round**.

> **Read with `project.md`.** `project.md` describes the challenge behavior, operator-note directives, request/response schemas, guardrails, battery behavior, energy accounting, and optimization validity rules. This `Evaluation.md` describes how the solution is expected to be packaged, deployed, tested, scored, penalized, reproduced, and tie-broken.
>
> **Canonical-source rule:** if this evaluation guide and the Problem Statement appear to disagree about operator-note directives, schemas, guardrails, battery behavior, or optimization validity, the **Problem Statement is the canonical source**. Do not change core challenge behavior to fit an interpretation of this file.
>
> **Codex rule:** never optimize only for score while violating correctness. The judging pipeline checks interpretation, directive application, normal GridWise validity, and only then cost quality.

---

# 1. Round Facts

- Institution: **Bangladesh University of Professionals (BUP)**, Mirpur Cantonment, Dhaka - 1216.
- Document: **Participant Guide & Evaluation Rubric**.
- Round: **Online Preliminary**.
- Round window: **7:00 PM - 11:00 PM (4 hours)**.
- Required service: **Deployed Public HTTP API**.
- Health endpoint: **`GET /health`**.
- Primary endpoint: **`POST /optimize-energy`**.
- LLM requirement: **Mandatory for `operator_notes` interpretation**.
- The guide is for participation, deployment, submission, and evaluation rules.
- The separate Problem Statement defines GridWise challenge behavior, operator-note directives, schemas, guardrails, battery rules, optimization rules, and required outputs.

---

# 2. Document Pack and Source Precedence

The participant document pack has three distinct purposes:

| Document | Purpose |
|---|---|
| Problem Statement | Defines the scenario, operator-note interpretation, supported directives, API schema, optimization rules, guardrails, and required outputs. |
| Participant Guide & Evaluation Rubric | Defines execution, deployment, repository policy, submission, scoring, penalties, and tie-break rules. |
| Public Sample Cases JSON | Provides worked input/output examples for local validation. Public cases are references, not the hidden judge set. |

The evaluation guide sections are:

1. Required Deliverables
2. Technical & Deployment Rules
3. LLM, Technology, Security & Repository Policy
4. Testing & Submission Checklist
5. Evaluation Model
6. Scoring Rubric
7. LLM & API Quality Metrics
8. Critical Violations & Penalties
9. Hidden Tests & Tie-Breakers
10. Final Quick Reference

---

# 3. Required Deliverables

Submit **one complete solution** that the judging harness can evaluate **without asking the team for setup help**.

## 3.1 API service

- Deploy **one HTTP API service** exposing both required endpoints.
- Submit **one service**, not separate deployments.
- `GET /health` is the readiness endpoint for the judging harness.
- `GET /health` must return the readiness response defined in the Problem Statement.
- `POST /optimize-energy` is the main **LLM interpretation + 24-hour optimization** endpoint.
- `POST /optimize-energy` must follow the exact request/response contract in the Problem Statement.

## 3.2 `directive_interpretation`

- Return **exactly one machine-checkable interpretation entry for every operator note**.
- Entries must be in **`note_index` order**.
- Applicable notes use `applies = true`.
- Irrelevant notes use all of the following:
  - `applies = false`
  - `directive_type = no_op`
  - `structured_adjustment = null`

## 3.3 `hourly_plan`

- Return the final **24-hour schedule** after applying all valid directives.
- The judge independently replays the schedule.

## 3.4 Source repository

- Provide all source code.
- Provide all dependency/configuration files.
- Repository creation timing and visibility must follow the official rulebook.

## 3.5 `README.md`

The README must be excellent and self-contained so organizers can run and test the solution locally **without team assistance**.

It must include:

- source setup,
- required environment-variable names,
- model/provider or local model identifier,
- the LLM's role,
- deterministic guardrails,
- optimizer/solver,
- exact run command,
- health endpoint example,
- API curl example(s),
- public-sample test command,
- dependencies,
- known limitations,
- Docker fallback pull/run instructions,
- secret-handling guidance.

Do **not** include secret values.

## 3.6 Docker fallback image

Submit a tested container image as a fallback execution path for organizers.

Requirements:

- provide a pullable registry reference,
- use an exact tag or digest,
- Docker Hub, GHCR, or equivalent is acceptable,
- expose the documented service port,
- bind the service to **`0.0.0.0`**,
- document required environment-variable names,
- provide one verified `docker run` command,
- the image must remain pullable during evaluation,
- the image must not contain baked-in secrets.

The source text labels this submission item as **"Docker fallback image ( Public API URL Recommended )"**. Preserve the actual required Docker fallback behavior above; do not infer additional requirements that are not stated.

## 3.7 3-minute solution video

Submit a maximum **3-minute** architecture/solution video.

The video should explain:

- the problem,
- architecture overview,
- solution approach,
- problem understanding,
- the **LLM -> guardrail -> optimizer** architecture,
- key implementation choices,
- how the solution is run,
- how the solution is tested,
- enough implementation detail for judges to understand how the LLM, guardrails, and optimizer work together.

Production-quality editing is **not required**. Technical clarity is the priority.

---

# 4. Submission Package

The package must contain all five items below.

| # | Required submission | What to provide |
|---|---|---|
| 1 | Working public endpoint | Base URL reachable by the judge for `GET /health` and `POST /optimize-energy`. |
| 2 | GitHub repository | Repository created after question reveal; keep private during the event; make public after the submission deadline for evaluation. |
| 3 | README & configuration | Setup/run instructions, model/provider or local model identifier, required environment-variable names, solver/library usage, and sample request/response. |
| 4 | Docker fallback image | Registry image reference with exact tag/digest, required environment-variable names, exposed port, and one verified Docker run command; image must remain pullable during evaluation. |
| 5 | 3-minute architecture / solution video | MP4 upload or organizer-accessible link; maximum 3 minutes; explain problem, architecture, solution flow, and how LLM, guardrails, and optimizer work together. |

---

# 5. Technical & Deployment Rules

The judging path must be **exact, reachable, reproducible, and practical for repeated LLM-assisted hidden tests**.

## 5.1 Required judge access

- The judge must be able to call `GET /health` and `POST /optimize-energy` from the submitted base URL.
- No login may be required.
- No dashboard access may be required.
- No manual approval may be required.
- No VPN may be required.
- No private-network access may be required.
- The service must accept JSON and return JSON using the exact endpoint names and fields defined in the Problem Statement.
- The submitted service must remain reachable throughout the evaluation window.
- It must remain reachable under repeated LLM-backed requests.
- Test both endpoints from **outside the development environment** before submitting.

## 5.2 Platform choice

- Teams may deploy on any reachable platform.
- Judging is based on behavior, accessibility, and reproducibility.
- Judging is **not** based on provider choice.

## 5.3 LLM availability

- The language model used for `operator_notes` must be available during judging.
- The team is responsible for:
  - API keys / credentials,
  - quota,
  - rate limits,
  - cost,
  - provider availability.
- Judges are not expected to repair an unavailable external dependency.
- A local or backup model is allowed if it still satisfies the Problem Statement.

## 5.4 Runtime training

- Do **not** require long training or fine-tuning jobs during evaluation.

## 5.5 Deterministic validation

LLM output must pass the exact deterministic guardrails in the Problem Statement **before it is applied to the optimizer**.

This includes at minimum:

- directive type,
- note mapping,
- hours,
- `applies` semantics,
- numeric ranges.

## 5.6 Local reproduction

The README must provide a **copy-paste local quickstart** from a clean environment. A judge should be able to:

1. clone/pull the repository,
2. configure environment-variable names,
3. install dependencies or pull the image,
4. start the service,
5. call `/health`,
6. run at least one Public Sample Cases request against `/optimize-energy`.

No undocumented step should be required.

---

# 6. LLM, Technology, Security & Repository Policy

## 6.1 Mandatory LLM use

LLM use for `operator_notes` is mandatory.

A **language-capable generative model** must interpret `operator_notes`, and its structured interpretation must be part of the actual path that produces optimization constraints.

Non-compliant patterns include:

- hard-coded phrase matching as the sole interpreter,
- using AI only for `plan_summary`,
- using AI only for documentation,
- keeping the LLM outside the path that produces `directive_interpretation` used by the optimizer.

Hidden notes may paraphrase the same directive, so public-string matching alone is not compliant.

## 6.2 Allowed deterministic code

Deterministic preprocessing and postprocessing are allowed for:

- normalization,
- JSON validation,
- guardrails,
- applying structured directives.

But deterministic code may **not replace** the required language-model interpretation step.

## 6.3 Allowed optimization methods

Optimization libraries/solvers are allowed, including:

- linear programming,
- dynamic programming,
- constraint solving,
- other practical optimization methods.

## 6.4 Model choice

- External model APIs are allowed.
- Local models are allowed.
- Teams may choose the provider/model.
- The chosen model must satisfy reliability and latency requirements.
- Document the provider/model or local model identifier used.

## 6.5 Security requirements

Do not commit or expose:

- API keys,
- tokens,
- `.env` files,
- passwords,
- other secrets,
- raw prompts containing secrets,
- sensitive stack traces,
- sensitive configuration values.

Secrets must not appear in:

- the repository,
- logs,
- API responses,
- public README fields,
- Docker image layers or baked-in configuration.

## 6.6 Data policy

- Use only synthetic challenge data supplied by the harness.
- Do not use live campus data.
- Do not use live utility data.
- Do not use live billing data.
- Do not use personal data.

## 6.7 Repository policy

- Create a **new GitHub repository after the question is revealed**.
- Develop the round solution there.
- Keep it **private during the event**.
- Make it **public after the submission deadline** for evaluation.

## 6.8 External tools and dependencies

- AI coding assistants are permitted under the official rulebook.
- Public libraries/frameworks/APIs/SDKs are permitted under the official rulebook.
- Core architecture and logic should be the team's own work.
- Credit all external tools and dependencies in `README.md`.

---

# 7. Pre-Submission Testing Checklist

Codex should make the repository capable of passing all checks below.

## 7.1 API

- `/health` responds.
- `/optimize-energy` accepts the exact request schema.
- `/optimize-energy` returns the exact response schema.

## 7.2 LLM interpretation

Every operator note produces exactly one `directive_interpretation` entry in `note_index` order with:

- `applies`,
- `directive_type`,
- `structured_adjustment`,
- `explanation`.

## 7.3 Guardrails and directives

Verify that:

- only supported directive types are emitted,
- `no_op` uses `applies = false`,
- `no_op` uses `structured_adjustment = null`,
- every non-`no_op` directive uses `applies = true`,
- hours are unique integers from 0 through 23,
- hours are in ascending order,
- numeric values are valid,
- relevant directives are applied before optimization.

## 7.4 Optimization

- The 24-hour plan must be **valid first**.
- Only then should it minimize **recalculated grid electricity cost**.
- Validity is checked after all organizer-ground-truth directives are applied.

## 7.5 Energy constraints

Verify all of the following:

- demand is satisfied,
- effective solar is respected,
- battery bounds are respected,
- battery rate limits are respected,
- battery state transitions are valid,
- directive-specific limits are respected,
- end-of-day battery neutrality is respected.

## 7.6 Robustness

The service must not crash on:

- malformed JSON,
- invalid structured input,
- LLM/provider errors,
- repeated requests,
- unexpected but valid numeric combinations.

## 7.7 Deployment

- Both endpoints work from outside the development environment.
- Both endpoints remain reachable during evaluation.

## 7.8 Submission artifacts

Include:

- endpoint,
- public-after-deadline repository,
- excellent README/local quickstart,
- model/provider information,
- environment-variable names,
- optimizer/solver information,
- credited libraries,
- sample request/response,
- fallback Docker image,
- 3-minute video.

## 7.9 Local reproduction

From a clean machine/environment, following only README instructions must be enough to verify:

- service starts,
- `/health` returns `{"status":"ok"}`,
- at least one Public Sample Cases request succeeds,
- no undocumented steps are required.

## 7.10 Video

- Accessible to judges.
- No longer than 3 minutes.
- Clearly explains:
  - problem,
  - architecture overview,
  - solution approach,
  - LLM/guardrail/optimizer flow,
  - how the system is executed,
  - how the system is tested.

## 7.11 Final repository and secret checks

- Repository follows the official timing/visibility rule.
- Do not submit secret values in public fields or README.

---

# 8. Evaluation Model - 100 Base Points

Automated testing is the primary evaluation mechanism.

The submitted video is **not part of the base 100-point score**. It is reviewed only when teams have the same total score and a tie must be resolved.

Automated judge tests score:

- core API behavior,
- LLM directive interpretation,
- directive application,
- optimization quality,
- schema correctness,
- performance,
- reliability.

Deployment/Docker and documentation are checked against fixed reproducibility criteria using submitted artifacts.

## 8.1 Seven scoring categories

| # | Category | Points |
|---|---|---:|
| 1 | LLM Directive Interpretation | 25 |
| 2 | Directive Application & Constraint Correctness | 25 |
| 3 | Optimization Quality | 10 |
| 4 | API Contract & Schema | 10 |
| 5 | Performance & Reliability | 10 |
| 6 | Deployment & Docker Fallback | 10 |
| 7 | Documentation & Local Reproducibility | 10 |
|  | **TOTAL** | **100** |

Important scoring behavior:

- LLM interpretation and downstream directive application are scored separately.
- Correct extraction is not enough if the returned schedule does not obey the directive.
- Optimization credit is considered only after the affected hidden case is valid under organizer-ground-truth directives and normal GridWise rules.
- The 3-minute video carries **no base marks**.
- The video is used only to resolve tied total scores.

---

# 9. Detailed Scoring Rubric

## 9.1 LLM Directive Interpretation - 25 points - Automated

Breakdown:

- 5 points: relevance / `no_op`
- 5 points: `directive_type`
- 5 points: affected hours
- 5 points: numeric values / required `structured_adjustment` shape
- 5 points: paraphrase robustness across related hidden notes

Free-text `explanation` wording is **not matched byte-for-byte**.

## 9.2 Directive Application & Constraint Correctness - 25 points - Automated

Breakdown:

- 10 points: organizer-ground-truth directive application
- 5 points: hourly energy balance / effective-solar validity
- 5 points: battery transitions / bounds / rate limits
- 5 points: action consistency / end-of-day neutrality / non-negative values

## 9.3 Optimization Quality - 10 points - Automated

- Cost quality is scored over optimization hidden cases.
- Invalid cases receive **zero optimization credit**.
- Valid cases are scored from organizer optimal cost versus **recalculated team cost**.
- See the scoring formula in Section 10.

## 9.4 API Contract & Schema - 10 points - Automated

Breakdown:

- 2 points: endpoints/status behavior
- 2 points: request validation
- 3 points: `directive_interpretation` schema/order/types
- 3 points: `hourly_plan` + top-level response schema + `scenario_id` echo

## 9.5 Performance & Reliability - 10 points - Automated

Breakdown:

- 2 points: health readiness
- 3 points: p95 latency
- 3 points: valid-request stability / failure rate
- 2 points: controlled malformed/model-provider failure handling and secret safety

## 9.6 Deployment & Docker Fallback - 10 points - Automated + Artifact Check

Breakdown:

- 3 points: live endpoint reachability
- 4 points: working pullable Docker fallback image that reaches `/health` using the documented command
- 2 points: clean startup/reproducibility from submitted instructions
- 1 point: no judge debugging/manual code changes required

## 9.7 Documentation & Local Reproducibility - 10 points - Structured Reproducibility Check

Breakdown:

- 3 points: clean local quickstart from a fresh environment
- 2 points: environment/configuration/model-provider documentation
- 2 points: public-sample test procedure and expected result
- 1 point: LLM/guardrail/optimizer architecture explanation
- 1 point: Docker pull/run fallback instructions
- 1 point: dependencies, limitations, and secret-handling guidance

## 9.8 Scoring principle

The system is judged as a pipeline:

```text
understand note
    -> validate structured directive
    -> apply directive to optimization
    -> return a valid schedule
    -> optimize cost
```

A cheap schedule built on a wrong or ignored directive does **not** score as a correct solution.

---

# 10. LLM & API Quality Metrics

These thresholds are machine-checkable and are used by the judge harness and reproducibility checks.

## 10.1 Interpretation coverage

Expected standard:

- exactly one `directive_interpretation` entry for every `operator_notes` item,
- returned in `note_index` order `0..N-1`.

Failure conditions include:

- missing mappings,
- duplicate mappings,
- out-of-order mappings.

These are schema/interpretation failures.

## 10.2 Directive accuracy

The following must match organizer ground truth within tolerance:

- `applies`,
- `directive_type`,
- required `structured_adjustment` shape,
- hours,
- directive numeric values.

Semantics:

- `no_op` -> `applies = false` and null adjustment,
- every other directive -> `applies = true`.

## 10.3 Optimization scoring formula

The guide states:

```text
quality_ratio = min(1, organizer_optimal_cost / recalculated_team_cost)
Optimization Quality = 10 * average(quality_ratio across all optimization hidden cases)
```

Special case explicitly stated:

```text
if organizer_optimal_cost and recalculated_team_cost are both within numeric tolerance of 0:
    quality_ratio = 1
```

### Important source ambiguity - do not invent a rule

The provided source then says:

> "If organizer_optimal_cost is within tolerance of 0 but team cost is above tolerance, quality_ratio"

and immediately starts the next metric. The right-hand side/value is **not present in the supplied text**. Therefore:

- do **not** invent the missing value in code or documentation,
- do **not** claim the guide defines it,
- defer to the official judge package or organizer clarification if this branch needs to be replicated locally,
- the production service does not need to calculate the judge's score; it must return a valid optimized schedule.

## 10.4 Paraphrase robustness

Expected standard:

- equivalent hidden phrasings of the same rule should resolve to the same underlying directive,
- time ranges use the Problem Statement whole-hour convention.

This robustness is measured across related hidden cases. It is **not** a separate response field.

## 10.5 Downstream application

The final `hourly_plan` must satisfy every applicable organizer-ground-truth directive, including:

- `solar_reduction`,
- `minimum_battery_reserve`,
- `no_charge_window`,
- `no_discharge_window`,
- `max_grid_window`.

Correct extraction without correct scheduling is insufficient.

## 10.6 Health readiness

- `GET /health` must return `{"status":"ok"}` within **60 seconds of service start**.
- This shows the service is ready before hidden tests begin.

## 10.7 Per-request timeout

- `POST /optimize-energy` must complete within **30 seconds**.
- Responses beyond the timeout are treated as failures.

## 10.8 p95 latency points

| p95 latency | Latency points |
|---|---:|
| `<= 5s` | 3/3 |
| `> 5s` to `15s` | 2/3 |
| `> 15s` to `30s` | 1/3 |
| `> 30s` | 0/3; timed-out requests are failures |

Repeated LLM/API slowness reduces the Performance & Reliability score.

## 10.9 Failure rate

For valid requests:

- do not return 5xx,
- do not return invalid JSON,
- do not return no response,
- remain stable across repeated hidden cases.

## 10.10 Malformed input and bad model output

- Return a controlled error or safe failure.
- Do not crash.
- Do not invent an unsupported directive.
- Bad input must not take down the service.
- Bad model output must not take down the service.

## 10.11 Secret handling

No API keys, tokens, raw secret values, or sensitive stack traces may appear in:

- repository,
- logs,
- responses.

Never leak credentials or sensitive configuration.

## 10.12 Time and factor normalization

- `hours` must be unique integers `0-23`.
- `hours` must be in ascending order.
- A window from **1 PM to 3 PM** maps to `[13,14]`.
- For `solar_reduction`, `factor` is the usable fraction remaining.
- An **80% reduction** means `factor = 0.2`.

These rules make hidden semantic extraction machine-checkable.

## 10.13 Numeric tolerance

- Use absolute tolerance of **0.01 kWh or 0.01 BDT** unless the official judge package specifies a stricter value.
- This matches the canonical Problem Statement tolerance for floating-point comparisons.

## 10.14 Documentation and local reproducibility

Expected standard:

- README is self-contained,
- judges can reproduce the service locally from a clean environment,
- use only the submitted repository and documented environment-variable names,
- verify `/health`,
- run at least one public-sample request.

Undocumented setup steps, missing commands, or team intervention reduce credit.

## 10.15 Docker fallback image quality

Expected standard:

- image can be pulled,
- image can be started with the documented command,
- service reaches `/health`,
- image contains no baked-in credentials.

The Docker image is used as a fallback path if the hosted endpoint is unavailable or for reproducibility verification.

## 10.16 3-minute video quality

Expected standard:

- accessible,
- length `<= 3:00`,
- clearly explains:
  - problem,
  - architecture overview,
  - solution approach,
  - `LLM -> deterministic guardrails -> optimizer` flow,
  - how submission is run/tested.

The video is **tie-break only**, not part of the base 100-point score.

## 10.17 Machine-checked interpretation ground truth

Hidden operator notes have organizer ground truth for:

- relevance,
- directive type,
- affected hours,
- required numeric values.

Free-text explanation wording is not judged byte-for-byte.

---

# 11. Critical Violations & Penalties

A low-cost schedule is not acceptable if it misunderstands or violates an applicable operator directive or breaks underlying GridWise energy rules.

## 11.1 Required LLM absent from interpretation path

Violation:

- required LLM is absent from operator-note interpretation path, or
- AI is used only for `plan_summary` / documentation.

Penalty:

- fails the mandatory challenge requirement,
- not eligible for the final preliminary shortlist.

Verification:

- automated and artifact verification may inspect repository/architecture,
- judges may verify that a language-capable generative model directly produces the structured operator-note interpretation used by the optimizer.

## 11.2 Relevant note interpreted incorrectly or marked `no_op`

Penalty:

- interpretation credit is lost for the affected note/case.

Judge behavior:

- structured interpretation is compared with organizer ground truth,
- schedule is separately checked against the true directive.

## 11.3 Applicable ground-truth directive missing from `hourly_plan`

Penalty:

- affected hidden case is invalid for directive-application scoring,
- no optimization credit for that case.

Judge behavior:

- the plan is replayed using the **true hidden directive**, not only the team's reported interpretation.

## 11.4 Energy-balance failure or unmet hourly demand

Penalty:

- affected hidden case is treated as invalid,
- no optimization credit.

Requirement:

- every hour must satisfy the Problem Statement energy-balance equation within tolerance.

## 11.5 Battery bound, transition, charge-rate, or discharge-rate violation

Penalty:

- affected hidden case is treated as invalid,
- no optimization credit.

Judge behavior:

- battery state is independently replayed hour by hour.

## 11.6 Effective-solar overuse or impossible/negative energy values

Penalty:

- affected hidden case is treated as invalid,
- no optimization credit.

Important behavior:

- `solar_reduction` changes available solar **before** the schedule is checked.

## 11.7 Hard directive violation

A violation of any of the following makes the affected hidden case invalid for optimization credit:

- `no_charge_window`,
- `no_discharge_window`,
- minimum reserve,
- `max_grid_window`.

These are hard operational rules.

## 11.8 End-of-day battery energy does not return to initial level

Penalty:

- affected hidden case is treated as invalid,
- no optimization credit.

Reason:

- battery neutrality prevents using starting energy as a free one-time source.

## 11.9 Reported totals disagree with `hourly_plan` or repeated critical invalidity

Penalty:

- recalculation / scoring deduction,
- repeated failures may block qualification eligibility.

Source of truth:

- `hourly_plan` is the source of truth for totals and validity.

## 11.10 Ground truth before cost

The judge first checks:

1. organizer ground-truth directive,
2. downstream application,
3. normal GridWise constraints.

Only then is optimization quality scored for that hidden case.

---

# 12. Hidden Tests

Public examples teach the contract. Hidden tests determine whether the full LLM-to-optimizer pipeline generalizes across unseen language and energy conditions.

Rules:

- The exact hidden case list will not be published.
- Hidden wording will not be published.
- Hidden distribution will not be published.
- Hidden expected answers will not be published.
- Each valid hidden scenario follows the Problem Statement.
- Each valid hidden scenario contains **1-3 synthetic operator notes**.
- Each note maps to exactly one supported directive type or `no_op`.
- Hidden scoring notes do not require unpublished directive types.
- The same underlying directive may be paraphrased using:
  - different wording,
  - whole-hour time expressions,
  - percentages,
  - equivalent numeric descriptions.
- Do not hard-code public phrases.
- Hidden cases also vary:
  - demand,
  - solar,
  - tariff,
  - battery state,
  - reserve limits,
  - charge/discharge rate limits,
  - directive combinations.
- Organizer-valid scoring scenarios are feasible.
- Organizer-valid scoring scenarios do not require mutually contradictory hard directives.
- Equivalent valid optimal schedules are accepted.
- Judging is based on:
  - interpretation ground truth,
  - directive application,
  - validity,
  - recalculated cost.

---

# 13. Tie-Break Order

The video is reviewed first only after teams have the same total score.

| Priority | Tie-breaker | Why it matters |
|---:|---|---|
| 1 | 3-minute Architecture & Solution Video | Used only after same total score. Reviewers compare problem understanding, architecture clarity, solution flow, and run/testing explanation. |
| 2 | Directive Application & Constraint Correctness | If video does not separate the tie, stronger correctness against ground-truth directives and GridWise constraints ranks higher. |
| 3 | LLM Directive Interpretation | Better semantic extraction across paraphrases separates systems that genuinely understand unseen notes. |
| 4 | Optimization Quality | Among otherwise tied valid solutions, stronger cost quality separates teams. |
| 5 | API/schema validity | Exact machine-checkable contracts improve reliable and reproducible evaluation. |
| 6 | Reliability and deployment stability | Pipeline must remain reachable and respond within judging limits. |
| 7 | Documentation & local reproducibility | Copy-paste setup, public-sample validation, model/solver disclosure, and Docker fallback instructions matter at the cutoff. |
| 8 | Exceptional engineering / verification | Robust guardrails, fallbacks, caching, testing, and implementation quality may be considered if a tie still remains. |

---

# 14. Official Recommended Priority Order

The guide's recommended priority order is:

1. **Exact API & JSON Contract**
2. **LLM Operator-Note Interpretation**
3. **Deterministic Guardrails**
4. **Directive Application & Energy Correctness**
5. **Optimization Quality**
6. **Reliability, Deployment & Docker Fallback**
7. **Documentation & Local Reproducibility**
8. **3-minute Video (Tie-break Readiness Only)**

Codex should follow this order when implementation time is constrained.

---

# 15. Final Pre-Submit Checklist

Use this as a hard release gate.

- [ ] `GET /health` is reachable and returns the expected readiness response.
- [ ] `POST /optimize-energy` is reachable externally.
- [ ] `POST /optimize-energy` accepts **1-3 `operator_notes`** with the exact Problem Statement schema.
- [ ] Every operator note produces exactly one `directive_interpretation` entry.
- [ ] `directive_interpretation` entries are in `note_index` order.
- [ ] `no_op` uses `applies = false`.
- [ ] `no_op` uses `structured_adjustment = null`.
- [ ] Every non-`no_op` directive uses `applies = true`.
- [ ] Every non-`no_op` directive uses the exact required `structured_adjustment` shape.
- [ ] LLM output is deterministically guardrailed before optimization.
- [ ] Directive hours are unique integers `0-23`.
- [ ] Directive hours are ascending.
- [ ] Numeric values are valid.
- [ ] Invalid model output cannot silently invent constraints.
- [ ] `hourly_plan` obeys organizer-ground-truth directives.
- [ ] `hourly_plan` obeys energy balance.
- [ ] `hourly_plan` obeys effective-solar limits.
- [ ] `hourly_plan` obeys battery rules.
- [ ] `hourly_plan` obeys battery rate limits.
- [ ] `hourly_plan` obeys grid caps.
- [ ] `hourly_plan` obeys end-of-day neutrality.
- [ ] `total_grid_kwh` matches a recalculation from `hourly_plan`.
- [ ] `total_cost_bdt` matches a recalculation from `hourly_plan`.
- [ ] `peak_grid_kwh` matches a recalculation from `hourly_plan`.
- [ ] README is self-contained.
- [ ] README has a clean local quickstart.
- [ ] README documents setup.
- [ ] README documents required environment-variable names.
- [ ] README documents model/provider or local model.
- [ ] README documents the LLM role.
- [ ] README documents guardrails.
- [ ] README documents optimizer/solver.
- [ ] README documents dependencies.
- [ ] README contains the exact run command.
- [ ] README contains `/health` test instructions.
- [ ] README contains `/optimize-energy` curl/sample test instructions.
- [ ] README documents known limitations.
- [ ] README contains no committed secrets.
- [ ] Repository was created after question reveal.
- [ ] Repository remains private during the event.
- [ ] Repository is made public after the deadline.
- [ ] Submitted endpoint remains reachable for evaluation.
- [ ] Required fallback/video links remain accessible through the judging window.
- [ ] Docker fallback image uses an exact pullable tag/digest.
- [ ] Documented Docker pull command works.
- [ ] Documented Docker run command works.
- [ ] Docker-started service reaches `/health`.
- [ ] Documented service port is exposed.
- [ ] Container binds to `0.0.0.0`.
- [ ] No secrets are baked into the image.
- [ ] Required video is accessible.
- [ ] Video is no more than 3 minutes.
- [ ] Video explains the problem.
- [ ] Video explains the architecture overview.
- [ ] Video explains the solution approach.
- [ ] Video explains the `LLM -> deterministic guardrails -> optimizer` pipeline.
- [ ] Video explains how organizers can run/test the submission.
- [ ] Team understands that the video is used only as a tie-break when total scores are equal.

---

# 16. Codex Engineering Acceptance Gates

The following gates translate the rubric into implementation requirements. They do not replace any official rule above.

## Gate A - Contract correctness

Do not consider the service ready unless:

- exact endpoint names are implemented,
- request validation is deterministic,
- response schema is exact,
- `scenario_id` is echoed correctly,
- `directive_interpretation` and `hourly_plan` are structurally valid.

## Gate B - Real LLM path

Do not ship a solution where:

- phrase matching alone determines directives,
- LLM output is cosmetic,
- `plan_summary` is the only LLM use.

The LLM interpretation must actually feed the validated directive path used to build optimizer constraints.

## Gate C - Guardrail before optimizer

Never pass raw LLM output directly into optimization.

Validate:

- schema,
- directive type,
- note index mapping,
- one interpretation per note,
- ordering,
- `applies` semantics,
- adjustment shape,
- hour ranges/order/uniqueness,
- numeric ranges.

## Gate D - Ground-truth-style replay

Implement a deterministic final replay/validator that can independently recompute:

- energy balance,
- effective solar use,
- battery transitions,
- battery bounds,
- rate limits,
- directive constraints,
- final battery neutrality,
- totals.

Treat the returned `hourly_plan` as the source of truth.

## Gate E - Cost only after validity

The optimization objective must never justify violating a hard rule.

Order of priority:

1. interpretation validity,
2. directive application,
3. GridWise validity,
4. cost minimization.

## Gate F - Performance

Target significantly below the hard timeout:

- readiness within 60 seconds,
- every `/optimize-energy` request under 30 seconds,
- p95 target `<= 5s` for full latency points.

## Gate G - Failure containment

Provider/model/input failures must be contained.

- no crash loops,
- no uncaught raw stack traces to clients,
- no unsupported invented directive,
- no secrets in errors,
- valid requests should not produce 5xx.

## Gate H - Reproducibility

A fresh judge should be able to reproduce without team intervention.

- README commands must be copy-pasteable,
- environment variables must be named,
- Docker image must be pullable,
- Docker command must work,
- public sample must be runnable.

## Gate I - Deployment reachability

Before submission, test from an external network/client rather than only localhost.

## Gate J - Security

Repository, logs, responses, prompts, and image must be secret-safe.

---

# 17. Recommended Automated Test Matrix for Codex

This section is implementation guidance derived from the official evaluation points; it does not add new challenge rules.

## 17.1 Endpoint tests

- health returns HTTP 200 and the expected JSON body,
- valid optimize request returns JSON,
- malformed JSON returns controlled failure,
- structurally invalid request returns controlled failure,
- repeated valid calls remain stable.

## 17.2 Interpretation tests

For every note:

- exactly one entry,
- no duplicates,
- no missing entries,
- correct `note_index`,
- array sorted by `note_index`,
- exact `applies` semantics,
- supported directive only,
- correct structured shape,
- valid numeric values,
- time normalization,
- paraphrase sets map consistently.

## 17.3 Application tests

Create one or more tests for every supported hard directive and verify that the final plan actually obeys it.

## 17.4 Energy replay tests

For every returned hour verify:

- finite values,
- non-negative values where required,
- demand balance,
- effective solar cap,
- battery action consistency,
- battery state transition,
- battery capacity/minimum,
- hourly charge/discharge limit,
- active reserve rule,
- active grid cap,
- no-charge/no-discharge constraints,
- final state equals initial state.

## 17.5 Totals tests

Recompute from `hourly_plan` and compare:

- `total_grid_kwh`,
- `total_cost_bdt`,
- `peak_grid_kwh`.

Use the official tolerance rules.

## 17.6 Reliability tests

Exercise:

- provider timeout,
- malformed LLM JSON,
- unsupported LLM directive,
- duplicate/missing note mapping,
- invalid hour array,
- NaN/Infinity-like invalid numeric output if a parser can receive it,
- network errors,
- repeated requests,
- unexpected valid numeric scenarios.

The service must fail safely and must not leak secrets.

## 17.7 Deployment tests

- clean process start,
- readiness within 60 seconds,
- Docker pull,
- Docker run,
- Docker `/health`,
- external public endpoint access,
- clean-machine README reproduction.

## 17.8 Latency tests

Collect enough repeated calls to estimate p95 and target `<= 5s`.

---

# 18. Do-Not-Do List

Codex must not introduce any of the following:

- separate deployments for the two required endpoints,
- authentication/login requirement on judging endpoints,
- dashboard gate,
- manual approval step,
- VPN-only access,
- private-network-only access,
- hard-coded phrase matching as the sole interpreter,
- LLM used only for `plan_summary` or documentation,
- raw unvalidated LLM constraints entering optimizer,
- undocumented setup step,
- long runtime fine-tuning/training requirement,
- committed credentials,
- `.env` committed with secrets,
- secrets baked into Docker image,
- raw secret prompts in logs,
- raw stack traces/sensitive values in API responses,
- live campus/utility/billing/personal data,
- invented hidden directives,
- optimization that ignores ground-truth-style constraints,
- relying on public examples as the hidden distribution,
- assuming byte-for-byte expected schedule equality,
- treating the video as base-score work ahead of correctness,
- inventing the missing `quality_ratio` zero-optimal-cost branch from the supplied evaluation text.

---

# 19. One-Screen Codex Summary

```text
ROUND
- Online preliminary, 7 PM-11 PM, 4 hours.

SERVICE
- One public HTTP API.
- GET /health.
- POST /optimize-energy.
- JSON in/out.
- No login/VPN/manual approval/private network.

MANDATORY PIPELINE
- LLM interprets operator_notes.
- Deterministic guardrails validate output.
- Valid directives become optimizer constraints.
- Optimizer builds valid 24-hour plan.
- Final deterministic replay validates plan.

BASE SCORE = 100
- 25 LLM Directive Interpretation
- 25 Directive Application & Constraint Correctness
- 10 Optimization Quality
- 10 API Contract & Schema
- 10 Performance & Reliability
- 10 Deployment & Docker Fallback
- 10 Documentation & Local Reproducibility

TIMING
- /health ready within 60s.
- /optimize-energy timeout 30s.
- p95 <=5s gives full 3 latency points.

VALIDITY BEFORE COST
- Wrong/missing true directive -> case invalid for application scoring and no optimization credit.
- Energy/battery/solar/hard-directive/end-neutrality violation -> no optimization credit.

TOLERANCE
- 0.01 kWh or 0.01 BDT unless official judge package is stricter.

SECURITY
- No secrets in repo/logs/responses/image.

REPRODUCTION
- Excellent README.
- Clean local quickstart.
- Pullable Docker fallback.

REPOSITORY
- Create after question reveal.
- Private during event.
- Public after submission deadline.

VIDEO
- <=3 minutes.
- No base points.
- First tie-break after equal total score.

HIDDEN TESTS
- 1-3 synthetic notes.
- Paraphrases, time expressions, percentages, equivalent numbers.
- Do not hard-code sample phrases.
- Hidden energy/battery conditions vary.
- Equivalent valid optimal schedules accepted.
```

---

# 20. Final Instruction to Codex

When implementing or modifying this project:

1. Read **all of `project.md`** for canonical challenge behavior.
2. Read **all of `Evaluation.md`** for deployment, submission, scoring, reliability, reproducibility, penalties, and tie-break expectations.
3. Preserve the exact public API contract.
4. Keep the LLM in the real operator-note interpretation path.
5. Treat LLM output as untrusted until deterministic validation passes.
6. Apply validated directives to the mathematical optimizer.
7. Replay and validate the final schedule independently.
8. Optimize cost only after the plan is valid.
9. Engineer for hidden paraphrases, repeated requests, provider failures, and latency limits.
10. Keep the repository, Docker image, logs, and API responses free of secrets.
11. Keep README and Docker reproduction fully copy-pasteable for judges.
12. Do not invent missing official rules. Where the supplied evaluation source is incomplete, preserve that uncertainty and defer to the official judge package/organizer clarification.

**Release only when the final pre-submit checklist in this file is satisfied.**

---

# Appendix A - Complete Source Text (Verbatim Preservation)

This appendix preserves the complete supplied Participant Guide & Evaluation Rubric text verbatim so that Codex has access to every word from the provided source, including any source formatting artifacts or incomplete lines. Where the structured guidance above and this verbatim appendix differ in wording, treat the appendix as the literal supplied text and follow the canonical-source rules already stated.

```text
BANGLADESH UNIVERSITY OF PROFESSIONALS
Mirpur Cantonment, Dhaka - 1216
Participant Guide & Evaluation Rubric
Online Preliminary Round
Round Online Preliminary
Round Window 7:00 PM - 11:00 PM (4 hours)
Required Service Deployed Public HTTP API
Health Endpoint GET /health
Primary Endpoint POST /optimize-energy
LLM Requirement Mandatory for operator_notes interpretation
PURPOSE: Use this guide for participation, deployment, submission, and evaluation rules. The separate Problem
Statement defines the GridWise challenge behavior, operator-note directives, schemas, and optimization rules.
01. About This Guide & Document Pack
This document explains how to participate, deploy, submit, and understand the evaluation for the LLM-assisted GridWise
preliminary. It does not redefine the challenge itself.
The online preliminary round runs from 7:00 PM to 11:00 PM (4 hours).
IMPORTANT: For operator_notes, supported directive types, structured adjustments, guardrails, request/response fields,
battery rules, and exact challenge behavior, read the separate Problem Statement.
Participant document pack
Document Purpose
Problem Statement Defines the scenario, operator-note interpretation,
supported directives, API schema, optimization rules,
guardrails, and required outputs.
Participant Guide & Evaluation Rubric Defines execution, deployment, repository policy,
submission, scoring, penalties, and tie-break rules.
Public Sample Cases JSON Provides worked input/output examples for local
validation. Public cases are references, not the hidden
judge set.
Inside this guide
Section Contents
02 Required Deliverables
03 Technical & Deployment Rules
04 LLM, Technology, Security & Repository Policy
05 Testing & Submission Checklist
06 Evaluation Model
07 Scoring Rubric
08 LLM & API Quality Metrics
09 Critical Violations & Penalties
10 Hidden Tests & Tie-Breakers
11 Final Quick Reference
02. Required Deliverables
Submit one complete solution that the judging harness can evaluate without asking your team for setup help.
Required item Requirement Notes
API service Deploy one HTTP API service
exposing both required endpoints.
Submit one service, not separate
deployments.
GET /health Readiness endpoint for the judging
harness.
Must return the readiness response
defined in the Problem Statement.
POST /optimize-energy Main LLM interpretation + 24-hour
optimization endpoint.
Must follow the exact
request/response contract in the
Problem Statement.
directive_interpretation Return exactly one
machine-checkable interpretation
entry for every operator note, in
note_index order.
Applicable notes use applies = true.
Irrelevant notes use applies = false,
directive_type = no_op, and
structured_adjustment = null.
Required item Requirement Notes
hourly_plan Return the final 24-hour schedule
after applying all valid directives.
The judge independently replays the
schedule.
Source repository Provide all source code and
dependency/configuration files.
Repository timing and visibility must
follow the official rulebook.
README.md Provide an excellent, self-contained
README that lets organizers run and test
the solution locally without team
assistance.
Include source setup,
environment-variable names,
model/provider, LLM role, guardrails,
optimizer/solver, exact run command,
health/API curl examples, public-sample
test command, dependencies, and known
limitations. Do not include secret values.
Docker fallback image Submit a tested container image as a
fallback execution path for organizers.
Provide a pullable registry reference with
an exact tag or digest. The image must
expose the documented service port, bind
to 0.0.0.0, and must not contain baked-in
secrets.
3-minute solution video Submit a maximum 3-minute video
explaining the problem, architecture
overview, and your solution approach.
Focus on technical clarity: problem
understanding,
LLM-to-guardrail-to-optimizer architecture,
key implementation choices, and how the
solution is run/tested. Production-quality
editing is not required.
Submission package
Item Required submission What to provide
1 Working public endpoint Base URL reachable by the judge for
GET /health and POST
/optimize-energy.
2 GitHub repository Repository created after question
reveal; keep private during the event
and make public after the submission
deadline for evaluation.
3 README & configuration Setup/run instructions, model/provider
or local model identifier, required
environment-variable names,
solver/library usage, and sample
request/response.
4 Docker fallback image ( Public API
URL Recommended )
Registry image reference (Docker
Hub, GHCR, or equivalent) with exact
tag/digest, required
environment-variable names,
exposed port, and one verified docker
run command. Image must remain
pullable during evaluation.
5 3-minute architecture / solution video MP4 upload or organizer-accessible
link. Maximum 3 minutes. Explain the
problem, architecture overview, and
solution flow; show enough
implementation detail for judges to
understand how the LLM, guardrails,
and optimizer work together.
03. Technical & Deployment Rules
Keep the judging path exact, reachable, reproducible, and practical for repeated LLM-assisted hidden tests.
Required judge access
• The judge must be able to call GET /health and POST /optimize-energy from the submitted base URL.
• No login, dashboard access, manual approval, VPN, or private-network access may be required for the judging endpoint.
• The service must accept JSON and return JSON using the exact endpoint names and fields defined in the Problem
Statement.
• The submitted service must remain reachable throughout the evaluation window, including repeated LLM-backed requests.
• Test both endpoints from outside your development environment before submitting.Deployment & reproducibility
rules
Rule Requirement
Platform choice Teams may deploy on any reachable platform. Judging is
based on behavior, accessibility, and reproducibility, not
provider choice.
LLM availability The language model used for operator_notes must be
available during judging. Teams are responsible for keys,
quota, rate limits, and provider availability.
Runtime training Do not require long training or fine-tuning jobs during
evaluation.
Deterministic validation LLM output must pass the exact deterministic guardrails in
the Problem Statement before it is applied to the optimizer,
including directive type, note mapping, hours, applies
semantics, and numeric ranges.
Local reproduction The README must provide a copy-paste local quickstart
from a clean environment: clone/pull, configure
environment-variable names, install or pull image, start
service, call /health, and run at least one public sample
against /optimize-energy.
04. LLM, Technology, Security & Repository Policy
LLM use for operator_notes is mandatory. Other implementation choices are open as long as the submitted system is valid,
secure, reproducible, and compliant with the Problem Statement.
Implementation policy
Approach Policy
Language-capable generative model Required for interpreting operator_notes. Its structured
interpretation must be part of the path that produces the
optimization constraints.
Deterministic preprocessing / postprocessing Allowed for normalization, JSON validation, guardrails,
and applying structured directives. It may not replace
the required language-model interpretation step.
CANONICAL CONTRACT: If this guide and the Problem Statement appear to disagree about operator-note directives,
schemas, guardrails, battery behavior, or optimization validity, the Problem Statement is the canonical source.
Approach Policy
Optimization libraries / solvers Allowed, including linear programming, dynamic
programming, constraint solving, or other practical
optimization methods.
External model API or local model Allowed. Teams may choose the provider/model, but
must meet reliability and latency requirements and
document the model/provider or local identifier used.
Hard-coded phrase matching as the sole interpreter Not compliant. Hidden notes may paraphrase the same
directive, and the language model must be part of the
interpretation path.
AI used only for plan_summary or documentation Does not satisfy the LLM requirement. The model must
interpret operator_notes into directive_interpretation
used by the optimizer.
Security & repository requirements
• Do not commit API keys, tokens, .env files, passwords, or other secrets to the repository.
• Do not expose secrets, tokens, raw prompts containing secrets, stack traces, or sensitive values in logs or API responses.
• Use only the synthetic challenge data supplied by the harness; do not use live campus, utility, billing, or personal data.
• Create a new GitHub repository after the question is revealed and develop the round solution there. Keep it private during
the event and make it public after the submission deadline for evaluation.
• AI coding assistants and public libraries/frameworks/APIs/SDKs are permitted under the official rulebook, but core
architecture and logic should be the team's own work. Credit all external tools and dependencies in README.md.
EXTERNAL MODEL RESPONSIBILITY: If your solution depends on a hosted model/API, your team is responsible for
valid credentials, quota, cost, rate limits, and availability. Judges are not expected to repair an unavailable
dependency. A local or backup model is allowed if it still satisfies the Problem Statement.
05. Testing & Submission Checklist
Run these checks before submitting. They combine operator-note interpretation, guardrails, directive application, optimization,
deployment, and repository requirements.
Check What to verify
API /health responds; /optimize-energy accepts the exact request schema and
returns the exact response schema.
LLM interpretation Every operator note produces exactly one directive_interpretation entry in
note_index order with applies, directive_type, structured_adjustment, and
explanation.
Guardrails & directives Only supported directive types are emitted; no_op uses applies = false and
null adjustment; all other directives use applies = true; hours are unique
integers 0-23 in ascending order; numeric values are valid; relevant directives
are applied before optimization.
Optimization The 24-hour plan is valid first, then minimizes recalculated grid electricity cost
after all organizer-ground-truth directives are applied.
Energy constraints Demand, effective solar, battery bounds, rate limits, state transitions,
directive-specific limits, and end-of-day neutrality are all respected.
Robustness Malformed JSON, invalid structured input, LLM/provider errors, repeated
requests, and unexpected valid numeric combinations do not crash the
service.
Deployment Both endpoints work from outside the development environment and remain
reachable during evaluation.
Submission Endpoint, public-after-deadline repository, excellent README/local quickstart,
model/provider, environment-variable names, optimizer/solver, credited
libraries, sample request/response, fallback Docker image, and 3-minute video
are included.
Check What to verify
Local reproduction From a clean machine/environment, follow the README exactly and verify
that the service starts, /health returns {"status":"ok"}, and at least one Public
Sample Cases request succeeds without undocumented steps.
3-minute video Video is accessible to judges, is no longer than 3 minutes, and clearly explains
the problem, architecture overview, solution approach, LLM/guardrail/optimizer
flow, and how the system is executed/tested.
REPOSITORY ACCESS: Follow the official rulebook: create a new repository after question reveal, keep it private
during the event, and make it public after the submission deadline for evaluation.
FINAL SUBMISSION CHECK: Do not submit secret values in public fields or README.
06. Evaluation Model
The preliminary uses automated testing as the primary evaluation mechanism. The submitted video is not part of the base
100-point score and is reviewed only when teams finish with the same total score and a tie must be resolved.
PRIMARY EVALUATION - 100 POINTS: Automated judge tests are used to score the core API behavior, LLM directive
interpretation, directive application, optimization quality, schema correctness, performance, and reliability.
Deployment/Docker and documentation are checked against fixed reproducibility criteria using the submitted artifacts.
The 3-minute video does not contribute base points.
VIDEO TIE-BREAK REVIEW - NO BASE POINTS: The 3-minute architecture/solution video is reviewed only when two
or more teams finish with the same total score and a tie must be resolved, especially at a qualification or ranking
boundary. Reviewers compare problem understanding, architecture clarity, the LLM -> deterministic guardrails ->
optimizer flow, and run/testing explanation. If the tie still remains, the technical sub-score tie-break order in Section 10
is applied.
Seven scoring categories
# Category Points
1 LLM Directive Interpretation 25
2 Directive Application & Constraint
Correctness
25
3 Optimization Quality 10
4 API Contract & Schema 10
5 Performance & Reliability 10
6 Deployment & Docker Fallback 10
7 Documentation & Local
Reproducibility
10
TOTAL 100
IMPORTANT: LLM interpretation and downstream application are scored separately. Correct extraction is not enough if
the returned schedule does not obey the directive. Optimization credit is considered only after the affected hidden
case is valid under organizer ground-truth directives and normal GridWise rules. The 3-minute video carries no base
marks and is used only to resolve tied total scores.
07. Scoring Rubric
Detailed criteria for the seven-category, 100-point GridWise preliminary evaluation model.
Category / Score / Stage What it measures
LLM Directive Interpretation
25 pts · Automated
25 = 5 relevance/no_op + 5 directive_type + 5 affected hours + 5 numeric
values/required structured_adjustment shape + 5 paraphrase robustness across
related hidden notes. Free-text explanation wording is not matched byte-for-byte.
Directive Application & Constraint
Correctness
25 pts · Automated
25 = 10 organizer-ground-truth directive application + 5 hourly energy
balance/effective-solar validity + 5 battery transitions/bounds/rate limits + 5
action consistency/end-of-day neutrality/non-negative values.
Optimization Quality
10 pts · Automated
10 = cost-quality score over optimization hidden cases. Invalid cases receive
zero optimization credit. Valid cases are scored from organizer optimal cost
versus recalculated team cost; see formula below.
API Contract & Schema
10 pts · Automated
10 = 2 endpoints/status behavior + 2 request validation + 3
directive_interpretation schema/order/types + 3 hourly_plan/top-level response
schema and scenario_id echo.
Performance & Reliability
10 pts · Automated
10 = 2 health readiness + 3 p95 latency + 3 valid-request stability/failure rate + 2
controlled malformed/model-provider failure handling and secret safety.
Deployment & Docker Fallback
10 pts · Automated + Artifact Check
10 = 3 live endpoint reachability + 4 working pullable Docker fallback image that
reaches /health using the documented command + 2 clean
startup/reproducibility from submitted instructions + 1 no judge
debugging/manual code changes required.
Documentation & Local
Reproducibility
10 pts · Structured Reproducibility
Check
10 = 3 clean local quickstart from a fresh environment + 2
environment/configuration/model-provider documentation + 2 public-sample test
procedure and expected result + 1 LLM/guardrail/optimizer architecture
explanation + 1 Docker pull/run fallback instructions + 1 dependencies,
limitations, and secret-handling guidance.
SCORING PRINCIPLE: The system is judged as a pipeline: understand the note, validate the structured directive, apply
it to the optimization, return a valid schedule, and then optimize cost. A cheap schedule built on a wrong or ignored
directive does not score as a correct solution.
08. LLM & API Quality Metrics
These machine-checkable interpretation, operational, and API thresholds are used by the judge harness and reproducibility
checks.
Metric Expected standard Meaning
Interpretation coverage Exactly one directive_interpretation entry for every
operator_notes item, returned in note_index order
0..N-1.
Missing, duplicate, or out-of-order
mappings are schema/interpretation
failures.
Directive accuracy applies, directive_type, required
structured_adjustment shape, hours, and directive
numeric values must match organizer ground truth
within tolerance.
no_op must use applies = false and
null adjustment; every other directive
must use applies = true.
OPTIMIZATION SCORE: min(1, organizer_optimal_cost / recalculated_team_cost). Optimization Quality = 10 x the
average quality_ratio across all optimization hidden cases. If organizer_optimal_cost and recalculated_team_cost are
both within numeric tolerance of 0, quality_ratio = 1. If organizer_optimal_cost is within tolerance of 0 but team cost
is above tolerance, quality_ratio
Metric Expected standard Meaning
Paraphrase robustness Equivalent hidden phrasings of the same rule
should resolve to the same underlying directive.
Time ranges use the Problem Statement
whole-hour convention.
Paraphrase robustness is measured
across related hidden cases; it is not
a separate response field.
Downstream application The final hourly_plan must satisfy every applicable
organizer-ground-truth directive, including
solar_reduction, minimum_battery_reserve,
no_charge_window, no_discharge_window, and
max_grid_window.
Correct extraction without correct
scheduling is insufficient.
Health readiness GET /health returns {"status":"ok"} within 60
seconds of service start.
Shows the service is ready before
hidden tests begin.
Per-request timeout POST /optimize-energy must complete within 30
seconds.
Responses beyond the timeout are
treated as failures.
p95 latency p95 <= 5s: 3/3 latency points; >5s to 15s: 2/3;
>15s to 30s: 1/3; >30s: 0/3 and timed-out requests
are failures.
Repeated LLM/API slowness reduces
the Performance & Reliability score.
Failure rate Valid requests should not return 5xx, invalid
JSON, or no response.
The service must remain stable
across repeated hidden cases.
Malformed input Return a controlled error or safe failure; do not
crash or invent an unsupported directive.
Bad input or bad model output should
not take down the service.
Secret handling No API keys, tokens, raw secret values, or
sensitive stack traces in repo, logs, or responses.
Never leak credentials or sensitive
configuration.
Time & factor
normalization
hours must be unique integers 0-23 in ascending
order. A window from 1 PM to 3 PM maps to
[13,14]. For solar_reduction, factor is the usable
fraction remaining: an 80% reduction means factor
= 0.2.
These rules make hidden semantic
extraction machine-checkable.
Numeric tolerance Use absolute tolerance of 0.01 kWh or 0.01 BDT
unless the official judge package specifies a
stricter value.
Matches the canonical Problem
Statement tolerance for floating-point
comparisons.
Documentation & local
reproducibility
README is self-contained and judges can
reproduce the service locally from a clean
environment using only the submitted repository
and documented environment-variable names,
including /health and at least one public-sample
request.
Scored through fixed reproducibility
criteria; undocumented setup steps,
missing commands, or team
intervention reduce credit.
Docker fallback image Submitted image can be pulled and started with
the documented command and reaches /health.
Image contains no baked-in credentials.
Used as a fallback path if the hosted
endpoint is unavailable or for
reproducibility verification.
3-minute video Accessible, <= 3:00, and clearly explains the
problem, architecture overview, solution approach,
LLM -> deterministic guardrails -> optimizer flow,
and how the submission is run/tested.
Tie-break only. The video is not part
of the base 100-point score and is
reviewed only when teams have the
same total score.
MACHINE-CHECKED INTERPRETATION: Hidden operator notes have organizer ground truth for relevance, directive
type, affected hours, and required numeric values. Free-text explanation wording is not judged byte-for-byte.
09. Critical Violations & Penalties
A low-cost schedule is not acceptable if it misunderstands or violates an applicable operator directive, or if it breaks the
underlying GridWise energy rules.
Violation Penalty Explanation
Required LLM absent from
operator-note interpretation path, or
AI used only for
plan_summary/documentation
Fails the mandatory challenge
requirement; not eligible for the final
preliminary shortlist
Automated and artifact verification
may inspect the
repository/architecture to confirm that
a language-capable generative model
directly produces the structured
operator-note interpretation used by
the optimizer.
Relevant note interpreted incorrectly
or marked no_op
Interpretation credit lost for the
affected note/case
The judge compares the structured
interpretation against organizer
ground truth. The schedule is still
checked separately against the true
directive.
Applicable ground-truth directive not
reflected in hourly_plan
Affected hidden case invalid for
directive-application scoring; no
optimization credit for that case
The judge replays the plan using the
true hidden directive, not only the
team-reported interpretation.
Energy-balance failure or unmet
hourly demand
Affected hidden case treated as
invalid; no optimization credit
Every hour must satisfy the Problem
Statement energy-balance equation
within tolerance.
Battery bound, transition, charge-rate,
or discharge-rate violation
Affected hidden case treated as
invalid; no optimization credit
The judge independently replays
battery state hour by hour.
Effective-solar overuse or
impossible/negative energy values
Affected hidden case treated as
invalid; no optimization credit
solar_reduction changes available
solar before the schedule is checked.
no_charge_window,
no_discharge_window, minimum
reserve, or max_grid_window
violation
Affected hidden case treated as
invalid; no optimization credit
Applicable directive constraints are
hard operational rules.
End-of-day battery energy does not
return to initial level
Affected hidden case treated as
invalid; no optimization credit
Battery neutrality prevents using
starting energy as a free one-time
source.
Reported totals disagree with
hourly_plan or repeated critical
invalidity
Recalculation / scoring deduction;
repeated failures may block
qualification eligibility
hourly_plan is the source of truth for
totals and validity.
GROUND TRUTH BEFORE COST: The judge first checks the organizer ground-truth directive, its downstream
application, and the normal GridWise constraints. Only then is optimization quality scored for that hidden case.
10. Hidden Tests & Tie-Breakers
Public examples teach the contract. Hidden tests determine whether the full LLM-to-optimizer pipeline generalizes across
unseen language and energy conditions.
Hidden tests
• The exact hidden case list, wording, distribution, and expected answers will not be published.
• Each valid hidden scenario follows the Problem Statement and contains 1-3 synthetic operator notes. Each note maps to
exactly one supported directive type or no_op; hidden scoring notes do not require unpublished directive types.
• The same underlying directive may be paraphrased with different wording, whole-hour time expressions, percentages, or
equivalent numeric descriptions. Teams should not hard-code public phrases.
• Hidden cases also vary demand, solar, tariff, battery state, reserve/rate limits, and directive combinations. Organizer valid
scoring scenarios are feasible and do not require mutually contradictory hard directives. Equivalent valid optimal schedules
are accepted; judging is based on interpretation ground truth, directive application, validity, and recalculated cost.
Tie-break order
Priority Tie-breaker Why it matters
1 3-minute Architecture & Solution
Video
Used only after teams have the same
total score. Reviewers compare
problem understanding, architecture
clarity, solution flow, and run/testing
explanation.
2 Directive Application & Constraint
Correctness
If the video does not separate the tie,
stronger correctness against
ground-truth directives and GridWise
constraints ranks higher.
3 LLM Directive Interpretation Better semantic extraction across
paraphrases separates systems that
genuinely understand unseen notes.
4 Optimization Quality Among otherwise tied valid solutions,
stronger cost quality separates teams.
5 API/schema validity Exact machine-checkable contracts
make evaluation reliable and
reproducible.
6 Reliability and deployment stability A strong pipeline must remain
reachable and respond within judging
limits.
7 Documentation & local reproducibility Clear copy-paste setup,
public-sample validation, model/solver
disclosure, and Docker fallback
instructions matter at the cutoff.
8 Exceptional engineering / verification Robust guardrails, fallbacks, caching,
testing, and implementation quality
may be considered if a tie still
remains.
11. Final Quick Reference
Recommended priority order and final pre-submit checklist for the LLM-assisted GridWise preliminary.
Recommended priority
Priority Focus
1 Exact API & JSON Contract
2 LLM Operator-Note Interpretation
3 Deterministic Guardrails
4 Directive Application & Energy Correctness
5 Optimization Quality
6 Reliability, Deployment & Docker Fallback
7 Documentation & Local Reproducibility
8 3-minute Video (Tie-break Readiness Only)
Final pre-submit checklist
[ ] GET /health is reachable and returns the expected readiness response.
[ ] POST /optimize-energy is reachable externally and accepts 1-3 operator_notes with the exact Problem Statement
schema.
[ ] Every operator note produces exactly one directive_interpretation entry in note_index order; no_op uses applies =
false + null adjustment, and all other directives use applies = true with the exact required structured_adjustment shape.
[ ] LLM output is deterministically guardrailed before optimization; directive hours are unique integers 0-23 in ascending
order, numeric values are valid, and invalid model output cannot silently invent constraints.
[ ] hourly_plan obeys the organizer-ground-truth directives plus energy balance, effective-solar, battery, rate-limit,
grid-cap, and end-of-day rules.
[ ] total_grid_kwh, total_cost_bdt, and peak_grid_kwh match values recalculated from hourly_plan.
[ ] README is self-contained and has a clean local quickstart: setup, required environment-variable names,
model/provider or local model, LLM role, guardrails, optimizer/solver, dependencies, exact run command, /health test,
/optimize-energy curl/sample test, known limitations, and no committed secrets.
[ ] Repository was created after question reveal, remains private during the event, is made public after the deadline, the
submitted endpoint remains reachable for evaluation, and all required fallback/video links remain accessible through the
judging window.
[ ] Fallback Docker image is submitted with an exact pullable tag/digest; documented docker pull/run commands work,
/health becomes ready, the documented port is exposed, and no secrets are baked into the image.
[ ] Required 3-minute video is accessible and explains the problem, architecture overview, solution approach, LLM ->
deterministic guardrails -> optimizer pipeline, and how organizers can run/test the submission. The video is used only as
a tie-break when teams have the same total score.```
