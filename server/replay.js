// Final deterministic replay validator (project.md §14, Evaluation.md Gate D).
// Independently re-derives every constraint straight from the validated directives and
// replays the returned hourly_plan hour by hour. The plan is the source of truth.

const TOL = 0.01; // official absolute tolerance: 0.01 kWh / 0.01 BDT
const round6 = (v) => Math.round(v * 1e6) / 1e6;

const finiteNonNegative = (v) => Number.isFinite(v) && v >= -TOL;

/**
 * @returns {{ok: true, totals: object}|{ok: false, errors: string[]}}
 */
export function replayPlan({ hours, battery, directives, plan }) {
  const errors = [];
  const fail = (m) => errors.push(m);

  if (!Array.isArray(plan) || plan.length !== 24) {
    return { ok: false, errors: ['hourly_plan must contain exactly 24 entries'] };
  }
  const seen = new Set();
  for (const p of plan) {
    if (!Number.isInteger(p.hour) || p.hour < 0 || p.hour > 23 || seen.has(p.hour)) {
      return { ok: false, errors: ['hourly_plan must contain each hour 0..23 exactly once'] };
    }
    seen.add(p.hour);
  }
  const byHour = new Map(plan.map((p) => [p.hour, p]));

  // Effective solar recomputed here from the directives themselves, not from the optimizer's inputs.
  const effectiveSolar = hours.map((h) => h.solar_kwh);
  for (const d of directives) {
    if (d.applies && d.directive_type === 'solar_reduction') {
      for (const h of d.structured_adjustment.hours) {
        effectiveSolar[h] = Math.min(effectiveSolar[h], hours[h].solar_kwh * d.structured_adjustment.factor);
      }
    }
  }

  let energy = battery.initial_energy_kwh;
  let totalGrid = 0;
  let totalCost = 0;
  let peakGrid = 0;

  for (let h = 0; h < 24; h++) {
    const p = byHour.get(h);
    const hour = hours[h];
    const { grid_kwh: grid, solar_used_kwh: solar, battery_kwh: mag, battery_energy_after_kwh: after, battery_action: action } = p;

    if (!finiteNonNegative(grid)) fail(`hour ${h}: grid_kwh must be finite and non-negative`);
    if (!finiteNonNegative(solar)) fail(`hour ${h}: solar_used_kwh must be finite and non-negative`);
    if (!finiteNonNegative(mag)) fail(`hour ${h}: battery_kwh must be finite and non-negative`);
    if (!Number.isFinite(after)) fail(`hour ${h}: battery_energy_after_kwh must be finite`);
    if (!['charge', 'discharge', 'idle'].includes(action)) fail(`hour ${h}: invalid battery_action`);
    if (action === 'idle' && Math.abs(mag) > TOL) fail(`hour ${h}: idle hour must have battery_kwh = 0`);

    if (solar > effectiveSolar[h] + TOL) fail(`hour ${h}: solar_used_kwh exceeds effective solar`);

    const flow = action === 'charge' ? mag : action === 'discharge' ? -mag : 0;
    if (action === 'charge' && mag > battery.max_charge_kwh_per_hour + TOL) fail(`hour ${h}: charge rate limit exceeded`);
    if (action === 'discharge' && mag > battery.max_discharge_kwh_per_hour + TOL) fail(`hour ${h}: discharge rate limit exceeded`);
    if (Math.abs(energy + flow - after) > TOL) fail(`hour ${h}: battery state transition is inconsistent`);
    if (after > battery.capacity_kwh + TOL) fail(`hour ${h}: battery energy exceeds capacity`);
    if (after < battery.minimum_energy_kwh - TOL) fail(`hour ${h}: battery energy below base minimum reserve`);

    // grid + solar_used + discharge = demand + charge
    const balance = grid + solar + (action === 'discharge' ? mag : 0) - (hour.demand_kwh + (action === 'charge' ? mag : 0));
    if (Math.abs(balance) > TOL) fail(`hour ${h}: hourly energy balance violated by ${balance.toFixed(4)}`);

    energy = after;
    totalGrid += grid;
    totalCost += grid * hour.tariff_bdt_per_kwh;
    peakGrid = Math.max(peakGrid, grid);
  }

  // Every validated directive must actually be reflected in the returned plan.
  for (const d of directives) {
    if (!d.applies) continue;
    const a = d.structured_adjustment;
    for (const h of a.hours) {
      const p = byHour.get(h);
      switch (d.directive_type) {
        case 'no_charge_window':
          if (p.battery_action === 'charge' && p.battery_kwh > TOL) fail(`hour ${h}: no_charge_window violated`);
          break;
        case 'no_discharge_window':
          if (p.battery_action === 'discharge' && p.battery_kwh > TOL) fail(`hour ${h}: no_discharge_window violated`);
          break;
        case 'minimum_battery_reserve':
          if (p.battery_energy_after_kwh < a.minimum_energy_kwh - TOL) fail(`hour ${h}: minimum_battery_reserve violated`);
          break;
        case 'max_grid_window':
          if (p.grid_kwh > a.max_grid_kwh + TOL) fail(`hour ${h}: max_grid_window violated`);
          break;
        case 'solar_reduction':
          if (p.solar_used_kwh > hours[h].solar_kwh * a.factor + TOL) fail(`hour ${h}: solar_reduction not applied`);
          break;
      }
    }
  }

  if (Math.abs(energy - battery.initial_energy_kwh) > TOL) {
    fail('end-of-day battery energy does not equal initial_energy_kwh');
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    totals: { total_grid_kwh: round6(totalGrid), total_cost_bdt: round6(totalCost), peak_grid_kwh: round6(peakGrid) },
  };
}
