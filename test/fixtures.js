// Deterministic scenarios with known properties (no public-sample wording is used here).

export const scenario = (over = {}) => {
  const hours = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    demand_kwh: 100,
    solar_kwh: h >= 8 && h <= 16 ? 60 : 0,
    tariff_bdt_per_kwh: h >= 17 && h <= 21 ? 12 : 5, // cheap night, expensive evening
  }));
  return {
    scenario_id: 'TEST-1',
    operator_notes: ['A note.'],
    hours,
    battery: {
      capacity_kwh: 200,
      initial_energy_kwh: 100,
      minimum_energy_kwh: 20,
      max_charge_kwh_per_hour: 50,
      max_discharge_kwh_per_hour: 50,
    },
    ...over,
  };
};

export const noOp = (i = 0) => ({
  note_index: i,
  applies: false,
  directive_type: 'no_op',
  structured_adjustment: null,
  explanation: 'unrelated',
});

export const directive = (directive_type, structured_adjustment, note_index = 0) => ({
  note_index,
  applies: true,
  directive_type,
  structured_adjustment,
  explanation: 'test directive',
});

/** A model completion stub that always answers with the given interpretation entries. */
export const stubModel = (entries) => async () => JSON.stringify({ directive_interpretation: entries });
