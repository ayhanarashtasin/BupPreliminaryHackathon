// Turn validated directives into deterministic per-hour optimizer constraints.
// project.md §9 and §19 (combination rules). Runs BEFORE optimization, never after.

/**
 * @param {Array} directives validated directive_interpretation entries
 * @param {Array} hours request hour objects sorted 0..23
 * @param {object} battery request battery object
 */
export function buildConstraints(directives, hours, battery) {
  const effectiveSolar = hours.map((h) => h.solar_kwh);
  const effectiveMinimum = hours.map(() => battery.minimum_energy_kwh);
  const chargeAllowed = hours.map(() => true);
  const dischargeAllowed = hours.map(() => true);
  const gridCap = hours.map(() => Infinity);

  for (const d of directives) {
    if (!d.applies) continue;
    const a = d.structured_adjustment;
    for (const h of a.hours) {
      switch (d.directive_type) {
        case 'solar_reduction':
          // Overlapping reductions: keep the most restrictive remaining availability.
          effectiveSolar[h] = Math.min(effectiveSolar[h], hours[h].solar_kwh * a.factor);
          break;
        case 'minimum_battery_reserve':
          effectiveMinimum[h] = Math.max(effectiveMinimum[h], a.minimum_energy_kwh);
          break;
        case 'no_charge_window':
          chargeAllowed[h] = false;
          break;
        case 'no_discharge_window':
          dischargeAllowed[h] = false;
          break;
        case 'max_grid_window':
          gridCap[h] = Math.min(gridCap[h], a.max_grid_kwh);
          break;
      }
    }
  }
  return { effectiveSolar, effectiveMinimum, chargeAllowed, dischargeAllowed, gridCap };
}
