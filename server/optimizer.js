// Linear-programming optimizer (GLPK via glpk.js WASM) behind a narrow interface.
// Minimise Σ grid[h] * tariff[h] subject to every hard GridWise constraint.

import GLPKFactory from 'glpk.js';

export const EPS = 1e-6;
export const SOLVER_NAME = 'GLPK (glpk.js WASM build of the GNU Linear Programming Kit), simplex LP';

let glpkPromise = null;
const glpk = () => (glpkPromise ??= GLPKFactory());

/** Ready the WASM solver before the first request so /health means "can actually serve". */
export const warmUpSolver = () => glpk();

const round6 = (v) => Math.round(v * 1e6) / 1e6;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class InfeasibleError extends Error {}

/**
 * @returns {Promise<Array>} hourly_plan, exactly 24 entries in hour order.
 */
export async function optimize({ hours, battery, constraints }) {
  const g = await glpk();
  const { effectiveSolar, effectiveMinimum, chargeAllowed, dischargeAllowed, gridCap } = constraints;
  const N = 24;

  const objectiveVars = [];
  const subjectTo = [];
  const bounds = [];
  const v = (p, h) => `${p}${h}`;

  for (let h = 0; h < N; h++) {
    objectiveVars.push({ name: v('g', h), coef: hours[h].tariff_bdt_per_kwh });

    // grid[h] >= 0, capped by any active max_grid_window
    if (Number.isFinite(gridCap[h])) bounds.push({ name: v('g', h), type: g.GLP_DB, lb: 0, ub: gridCap[h] });
    // 0 <= solar_used[h] <= effective_solar[h]
    bounds.push({ name: v('s', h), type: g.GLP_DB, lb: 0, ub: Math.max(0, effectiveSolar[h]) });
    // charge / discharge rate limits, zeroed inside no_charge / no_discharge windows
    bounds.push({ name: v('c', h), type: g.GLP_DB, lb: 0, ub: chargeAllowed[h] ? battery.max_charge_kwh_per_hour : 0 });
    bounds.push({ name: v('d', h), type: g.GLP_DB, lb: 0, ub: dischargeAllowed[h] ? battery.max_discharge_kwh_per_hour : 0 });
    // effective_minimum[h] <= energy_after[h] <= capacity; hour 23 is pinned to the initial level.
    bounds.push(
      h === N - 1
        ? { name: v('e', h), type: g.GLP_FX, lb: battery.initial_energy_kwh, ub: battery.initial_energy_kwh }
        : { name: v('e', h), type: g.GLP_DB, lb: effectiveMinimum[h], ub: battery.capacity_kwh },
    );

    // Energy balance: grid + solar_used + discharge - charge = demand
    subjectTo.push({
      name: `bal${h}`,
      vars: [
        { name: v('g', h), coef: 1 },
        { name: v('s', h), coef: 1 },
        { name: v('d', h), coef: 1 },
        { name: v('c', h), coef: -1 },
      ],
      bnds: { type: g.GLP_FX, lb: hours[h].demand_kwh, ub: hours[h].demand_kwh },
    });

    // State transition: energy_after[h] - energy_after[h-1] - charge + discharge = 0
    const stateVars = [
      { name: v('e', h), coef: 1 },
      { name: v('c', h), coef: -1 },
      { name: v('d', h), coef: 1 },
    ];
    if (h > 0) stateVars.push({ name: v('e', h - 1), coef: -1 });
    const rhs = h === 0 ? battery.initial_energy_kwh : 0;
    subjectTo.push({ name: `state${h}`, vars: stateVars, bnds: { type: g.GLP_FX, lb: rhs, ub: rhs } });
  }

  // Hour 23 is bounded to initial_energy_kwh above, but it must still honour any active reserve.
  if (effectiveMinimum[N - 1] > battery.initial_energy_kwh + EPS) {
    throw new InfeasibleError('end-of-day neutrality conflicts with the hour-23 minimum battery reserve');
  }

  const res = await g.solve(
    { name: 'gridwise', objective: { direction: g.GLP_MIN, name: 'cost', vars: objectiveVars }, subjectTo, bounds },
    { msglev: g.GLP_MSG_OFF, presol: true },
  );
  if (!res?.result || res.result.status !== g.GLP_OPT) {
    throw new InfeasibleError(`solver returned status ${res?.result?.status}`);
  }
  const x = res.result.vars;

  // Rebuild the plan deterministically from the net battery flow instead of trusting each
  // solver variable: this removes charge/discharge degeneracy and float noise in one step,
  // and keeps the energy balance exact by construction.
  const plan = [];
  let energy = battery.initial_energy_kwh;
  for (let h = 0; h < N; h++) {
    let net = (x[v('c', h)] ?? 0) - (x[v('d', h)] ?? 0);
    if (Math.abs(net) < EPS) net = 0;
    net = clamp(
      net,
      dischargeAllowed[h] ? -battery.max_discharge_kwh_per_hour : 0,
      chargeAllowed[h] ? battery.max_charge_kwh_per_hour : 0,
    );
    net = round6(net);

    const after = round6(clamp(energy + net, 0, battery.capacity_kwh));
    net = round6(after - energy);

    const need = hours[h].demand_kwh + net;
    const solarUsed = round6(clamp(need, 0, Math.max(0, effectiveSolar[h])));
    const grid = round6(Math.max(0, need - solarUsed));

    plan.push({
      hour: hours[h].hour,
      grid_kwh: grid,
      solar_used_kwh: solarUsed,
      battery_action: net > 0 ? 'charge' : net < 0 ? 'discharge' : 'idle',
      battery_kwh: Math.abs(net),
      battery_energy_after_kwh: after,
    });
    energy = after;
  }
  return plan;
}
