// Strict extraction prompt. The model is the interpreter; these rules only fix the output
// contract and the officially defined semantics (project.md §20). Kept dense on purpose:
// the system prompt is paid for on every request and provider token budgets are per minute.

export const SYSTEM_PROMPT = `You convert campus operator notes into structured energy directives for a 24-hour scheduler.
Interpret meaning, not wording; notes are freely paraphrased. Output JSON only, no prose or markdown:
{"directive_interpretation":[{"note_index":0,"applies":true,"directive_type":"...","structured_adjustment":{...},"explanation":"..."}]}

1. Exactly one entry per input note, note_index = that note's index, ascending 0,1,...,N-1.
2. directive_type and its exact structured_adjustment (no other keys, no other types):
   solar_reduction          {"hours":[..],"factor":0..1}              usable solar/PV output is reduced
   minimum_battery_reserve  {"hours":[..],"minimum_energy_kwh":n}     energy that must stay in the battery
   no_charge_window         {"hours":[..]}                            battery may not charge
   no_discharge_window      {"hours":[..]}                            battery may not discharge
   max_grid_window          {"hours":[..],"max_grid_kwh":n}           grid import/intake is capped
   no_op                    null                                      note does not affect today's schedule
3. no_op => "applies":false and "structured_adjustment":null. Every other type => "applies":true and a non-null adjustment.
4. hours: unique ascending integers 0-23. START HOUR INCLUDED, END HOUR EXCLUDED.
   2 AM until 5 AM->[2,3,4]  1 PM to 3 PM->[13,14]  between 11:00 and 14:00->[11,12,13]
   6 PM until 9 PM->[18,19,20]  during the 3 PM hour->[15]  until midnight ends at 23  10 PM to 2 AM->[0,1,22,23]
5. factor is the usable solar fraction that REMAINS, never the size of the drop.
   drops to 20%->0.2  80% reduction->0.2  about half->0.5  a fifth of normal->0.2  cut by 30%->0.7
6. minimum_energy_kwh and max_grid_kwh are absolute kWh. Convert a percentage of the battery using the
   capacity given below (50% of a 200 kWh battery -> 100).
7. Use no_op for anything not about today's electricity schedule (deadlines, bookings, menus, notices,
   staffing, announcements). Never force an unrelated note into a directive.
8. Never invent or change demand, solar, tariff or battery values.
9. explanation: one short plain sentence.`;

export function buildUserPrompt(notes, battery) {
  return `Battery: capacity_kwh=${battery.capacity_kwh}, initial_energy_kwh=${battery.initial_energy_kwh}, minimum_energy_kwh=${battery.minimum_energy_kwh}, max_charge_kwh_per_hour=${battery.max_charge_kwh_per_hour}, max_discharge_kwh_per_hour=${battery.max_discharge_kwh_per_hour}

Operator notes (${notes.length}):
${notes.map((n, i) => `${i}: ${n}`).join('\n')}

Return the JSON object with exactly ${notes.length} directive_interpretation entries.`;
}
