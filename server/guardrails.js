// Deterministic guardrail validator for untrusted LLM interpretation output.
// project.md §8, Evaluation.md Gate C. Nothing reaches the optimizer without passing here.

export const DIRECTIVE_TYPES = [
  'solar_reduction',
  'minimum_battery_reserve',
  'no_charge_window',
  'no_discharge_window',
  'max_grid_window',
  'no_op',
];

const isFiniteNum = (v) => typeof v === 'number' && Number.isFinite(v);

function validateHours(hours) {
  if (!Array.isArray(hours) || hours.length === 0) return 'hours must be a non-empty array';
  for (let i = 0; i < hours.length; i++) {
    const h = hours[i];
    if (!Number.isInteger(h) || h < 0 || h > 23) return `hours[${i}] must be an integer in 0..23`;
    if (i > 0 && h <= hours[i - 1]) return 'hours must be unique and in ascending order';
  }
  return null;
}

// Returns the canonical structured_adjustment for the type, or throws a message string.
function canonicalAdjustment(type, adj, capacityKwh) {
  if (adj === null || typeof adj !== 'object' || Array.isArray(adj)) {
    throw `structured_adjustment must be an object for directive_type "${type}"`;
  }
  const hoursError = validateHours(adj.hours);
  if (hoursError) throw hoursError;
  const hours = [...adj.hours];

  switch (type) {
    case 'solar_reduction': {
      const factor = adj.factor;
      if (!isFiniteNum(factor)) throw 'solar_reduction.factor must be a finite number';
      if (factor < 0 || factor > 1) throw 'solar_reduction.factor must be within [0, 1]';
      return { hours, factor };
    }
    case 'minimum_battery_reserve': {
      const min = adj.minimum_energy_kwh;
      if (!isFiniteNum(min)) throw 'minimum_battery_reserve.minimum_energy_kwh must be a finite number';
      if (min < 0) throw 'minimum_battery_reserve.minimum_energy_kwh must be non-negative';
      if (min > capacityKwh) throw 'minimum_battery_reserve.minimum_energy_kwh must not exceed battery capacity';
      return { hours, minimum_energy_kwh: min };
    }
    case 'max_grid_window': {
      const cap = adj.max_grid_kwh;
      if (!isFiniteNum(cap)) throw 'max_grid_window.max_grid_kwh must be a finite number';
      if (cap < 0) throw 'max_grid_window.max_grid_kwh must be non-negative';
      return { hours, max_grid_kwh: cap };
    }
    case 'no_charge_window':
    case 'no_discharge_window':
      return { hours };
    default:
      throw `unsupported directive_type "${type}"`;
  }
}

const FALLBACK_EXPLANATION = {
  solar_reduction: 'Usable solar is reduced during the stated hours.',
  minimum_battery_reserve: 'A higher battery reserve is required during the stated hours.',
  no_charge_window: 'Battery charging is unavailable during the stated hours.',
  no_discharge_window: 'Battery discharging is unavailable during the stated hours.',
  max_grid_window: 'Grid import is capped during the stated hours.',
  no_op: "This note does not affect today's 24-hour energy schedule.",
};

/**
 * Validate raw (untrusted) LLM output.
 * @returns {{ok: true, directives: Array}|{ok: false, error: string}}
 */
export function validateInterpretation(raw, { noteCount, capacityKwh }) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'model output must be a JSON object' };
  }
  const list = raw.directive_interpretation;
  if (!Array.isArray(list)) return { ok: false, error: 'directive_interpretation must be an array' };
  if (list.length !== noteCount) {
    return { ok: false, error: `directive_interpretation must contain exactly ${noteCount} entries, one per operator note` };
  }

  const directives = [];
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e === null || typeof e !== 'object' || Array.isArray(e)) {
      return { ok: false, error: `entry ${i} must be an object` };
    }
    // Enforces existence, uniqueness, completeness and note_index ordering in one check.
    if (e.note_index !== i) {
      return { ok: false, error: `entry ${i} must have note_index ${i}; entries must be unique, complete and in ascending note_index order` };
    }
    const type = e.directive_type;
    if (!DIRECTIVE_TYPES.includes(type)) {
      return { ok: false, error: `entry ${i} has unsupported directive_type ${JSON.stringify(type)}` };
    }
    if (typeof e.applies !== 'boolean') {
      return { ok: false, error: `entry ${i} applies must be a boolean` };
    }

    let adjustment;
    if (type === 'no_op') {
      if (e.applies !== false) return { ok: false, error: `entry ${i} no_op must use applies = false` };
      // Exact shape: the key must be present and explicitly null. An omitted key is not null.
      if (!('structured_adjustment' in e) || e.structured_adjustment !== null) {
        return { ok: false, error: `entry ${i} no_op must use structured_adjustment = null` };
      }
      adjustment = null;
    } else {
      if (e.applies !== true) return { ok: false, error: `entry ${i} non-no_op directive must use applies = true` };
      try {
        adjustment = canonicalAdjustment(type, e.structured_adjustment, capacityKwh);
      } catch (message) {
        return { ok: false, error: `entry ${i}: ${message}` };
      }
    }

    const explanation =
      typeof e.explanation === 'string' && e.explanation.trim() ? e.explanation.trim().slice(0, 300) : FALLBACK_EXPLANATION[type];

    // Rebuilt from validated parts. Unknown model-supplied keys are dropped rather than rejected:
    // project.md §8.8 requires that no invented value reach the optimizer or the response, and
    // Evaluation.md §6.2 permits deterministic normalization. Dropping guarantees that outcome,
    // where rejecting would spend a retry and can still end in a controlled failure.
    directives.push({ note_index: i, applies: type !== 'no_op', directive_type: type, structured_adjustment: adjustment, explanation });
  }
  return { ok: true, directives };
}
