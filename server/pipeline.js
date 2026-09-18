// Orchestration: validate -> LLM interpret -> guardrails -> apply -> optimize -> replay -> respond.

import { validateRequest } from './validateRequest.js';
import { interpretNotes, InterpretationError } from './llm.js';
import { buildConstraints } from './directives.js';
import { optimize, InfeasibleError } from './optimizer.js';
import { replayPlan } from './replay.js';

const HOUR_LABEL = (hours) => hours.map((h) => `${String(h).padStart(2, '0')}:00`).join(', ');

/** Short, human-readable, derived only from validated directives and the replayed plan. */
export function buildSummary(directives, plan, totals) {
  const parts = [];
  for (const d of directives) {
    const a = d.structured_adjustment;
    switch (d.directive_type) {
      case 'solar_reduction':
        parts.push(`usable solar cut to ${Math.round(a.factor * 100)}% at ${HOUR_LABEL(a.hours)}`);
        break;
      case 'minimum_battery_reserve':
        parts.push(`battery held at or above ${a.minimum_energy_kwh} kWh at ${HOUR_LABEL(a.hours)}`);
        break;
      case 'no_charge_window':
        parts.push(`no charging at ${HOUR_LABEL(a.hours)}`);
        break;
      case 'no_discharge_window':
        parts.push(`no discharging at ${HOUR_LABEL(a.hours)}`);
        break;
      case 'max_grid_window':
        parts.push(`grid import capped at ${a.max_grid_kwh} kWh at ${HOUR_LABEL(a.hours)}`);
        break;
    }
  }
  const noOps = directives.filter((d) => !d.applies).length;
  const charge = plan.filter((p) => p.battery_action === 'charge').length;
  const discharge = plan.filter((p) => p.battery_action === 'discharge').length;

  const applied = parts.length ? `Applied ${parts.join('; ')}.` : 'No operator note changed the schedule.';
  const ignored = noOps ? ` Ignored ${noOps} note${noOps > 1 ? 's' : ''} unrelated to today's schedule.` : '';
  return (
    `${applied}${ignored} Charged in ${charge} hour${charge === 1 ? '' : 's'} and discharged in ${discharge} hour${discharge === 1 ? '' : 's'} ` +
    `to shift load away from expensive hours, ending the day back at the initial battery level. ` +
    `Total grid import ${totals.total_grid_kwh.toFixed(2)} kWh, peak ${totals.peak_grid_kwh.toFixed(2)} kWh, cost ${totals.total_cost_bdt.toFixed(2)} BDT.`
  );
}

export class PipelineError extends Error {
  constructor(status, publicMessage, detail) {
    super(publicMessage);
    this.status = status;
    this.detail = detail; // server-side only, never returned
  }
}

/**
 * @param {object} body raw parsed request body
 * @param {object} deps { config, complete }
 * @returns {Promise<object>} the exact /optimize-energy success response
 */
export async function runPipeline(body, deps = {}) {
  const check = validateRequest(body);
  if (!check.ok) throw new PipelineError(check.status, check.error);
  const { scenario_id, operator_notes, hours, battery } = check.request;

  let directives;
  try {
    directives = await interpretNotes({ notes: operator_notes, battery, config: deps.config, complete: deps.complete });
  } catch (err) {
    if (err instanceof InterpretationError) {
      throw new PipelineError(500, 'operator note interpretation could not be validated', err.message);
    }
    throw err;
  }

  const constraints = buildConstraints(directives, hours, battery);

  let plan;
  try {
    plan = await optimize({ hours, battery, constraints });
  } catch (err) {
    if (err instanceof InfeasibleError) throw new PipelineError(500, 'no valid 24-hour schedule could be produced', err.message);
    throw err;
  }

  const replay = replayPlan({ hours, battery, directives, plan });
  if (!replay.ok) throw new PipelineError(500, 'internal plan validation failed', replay.errors.join(' | '));

  return {
    scenario_id,
    directive_interpretation: directives,
    hourly_plan: plan,
    total_grid_kwh: replay.totals.total_grid_kwh,
    total_cost_bdt: replay.totals.total_cost_bdt,
    peak_grid_kwh: replay.totals.peak_grid_kwh,
    plan_summary: buildSummary(directives, plan, replay.totals),
  };
}
