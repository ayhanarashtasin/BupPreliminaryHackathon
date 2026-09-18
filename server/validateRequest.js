// Deterministic structural + semantic request validation (project.md §21).
// Runs before the LLM and before the optimizer. 400 = structural, 422 = well-formed but contradictory.

const HOUR_FIELDS = ['demand_kwh', 'solar_kwh', 'tariff_bdt_per_kwh'];
const BATTERY_FIELDS = [
  'capacity_kwh',
  'initial_energy_kwh',
  'minimum_energy_kwh',
  'max_charge_kwh_per_hour',
  'max_discharge_kwh_per_hour',
];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const bad = (status, error) => ({ ok: false, status, error });

/**
 * @returns {{ok: true, request: object}|{ok: false, status: number, error: string}}
 */
export function validateRequest(body) {
  if (!isObject(body)) return bad(400, 'request body must be a JSON object');
  if (typeof body.scenario_id !== 'string' || body.scenario_id.length === 0) {
    return bad(400, 'scenario_id must be a non-empty string');
  }

  const notes = body.operator_notes;
  if (!Array.isArray(notes) || notes.length < 1 || notes.length > 3) {
    return bad(400, 'operator_notes must be an array of 1 to 3 entries');
  }
  for (let i = 0; i < notes.length; i++) {
    if (typeof notes[i] !== 'string' || notes[i].trim().length === 0) {
      return bad(400, `operator_notes[${i}] must be a non-empty string`);
    }
  }

  if (!Array.isArray(body.hours) || body.hours.length !== 24) {
    return bad(400, 'hours must be an array of exactly 24 entries');
  }
  const hours = new Array(24);
  for (const entry of body.hours) {
    if (!isObject(entry)) return bad(400, 'each hours entry must be an object');
    const h = entry.hour;
    if (!Number.isInteger(h) || h < 0 || h > 23) return bad(400, 'each hours entry needs an integer hour in 0..23');
    if (hours[h]) return bad(400, `duplicate hour ${h}; hours must cover 0..23 exactly once`);
    for (const f of HOUR_FIELDS) {
      if (!Number.isFinite(entry[f])) return bad(400, `hour ${h}: ${f} must be a finite number`);
      if (entry[f] < 0) return bad(422, `hour ${h}: ${f} must not be negative`);
    }
    hours[h] = { hour: h, demand_kwh: entry.demand_kwh, solar_kwh: entry.solar_kwh, tariff_bdt_per_kwh: entry.tariff_bdt_per_kwh };
  }
  for (let h = 0; h < 24; h++) if (!hours[h]) return bad(400, `missing hour ${h}; hours must cover 0..23 exactly once`);

  const b = body.battery;
  if (!isObject(b)) return bad(400, 'battery must be an object');
  const battery = {};
  for (const f of BATTERY_FIELDS) {
    if (!Number.isFinite(b[f])) return bad(400, `battery.${f} must be a finite number`);
    if (b[f] < 0) return bad(422, `battery.${f} must not be negative`);
    battery[f] = b[f];
  }
  if (battery.capacity_kwh <= 0) return bad(422, 'battery.capacity_kwh must be greater than zero');
  if (battery.minimum_energy_kwh > battery.capacity_kwh) return bad(422, 'battery.minimum_energy_kwh must not exceed battery.capacity_kwh');
  if (battery.initial_energy_kwh > battery.capacity_kwh) return bad(422, 'battery.initial_energy_kwh must not exceed battery.capacity_kwh');
  // End-of-day neutrality pins hour 23 to initial_energy_kwh, so a start below the base reserve is unschedulable.
  if (battery.initial_energy_kwh < battery.minimum_energy_kwh) {
    return bad(422, 'battery.initial_energy_kwh must not be below battery.minimum_energy_kwh');
  }

  return { ok: true, request: { scenario_id: body.scenario_id, operator_notes: notes.map((n) => n.trim()), hours, battery } };
}
