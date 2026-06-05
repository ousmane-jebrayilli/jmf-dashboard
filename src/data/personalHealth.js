// TODO: wire to Supabase / Export JSON once backend schema is ready.
// All values are hardcoded seed data for the standalone personal health view.

export const PERSONAL_PROFILE = {
  name:      "Ousmane Jebrayilli",
  dob:       "2001-07-24",
  heightIn:  69,          // 5'9"
  heightCm:  175,
  email:     "ous@jmfteam.org",
};

// [date, weight_lb, body_fat_pct, skeletal_muscle_lb, source]
export const BODY_COMP = [
  { date: "2019-08", weight: 142,   bf: 15.0, smm: 68,   source: "photo-est" },
  { date: "2020-05", weight: 152,   bf: 13.0, smm: 72,   source: "photo-est" },
  { date: "2021-03", weight: 152,   bf: 13.0, smm: 73,   source: "photo-est" },
  { date: "2021-10", weight: 152,   bf: 12.0, smm: 74,   source: "photo-est" },
  { date: "2022-08", weight: 145,   bf: 11.0, smm: 71,   source: "photo-est" },
  { date: "2023-07", weight: 156.4, bf: 15.4, smm: 75.8, source: "InBody"    },
  { date: "2025-01", weight: 168.9, bf: 20.1, smm: 76.9, source: "InBody"    },
  { date: "2026-05-03", weight: 153.4, bf: 16.6, smm: 71.4, source: "Evolt360" },
  { date: "2026-05-17", weight: 154.3, bf: 16.0, smm: 72.3, source: "Evolt360" },
  // TARGET — not a real measurement
  { date: "2026-08-16", weight: 147,   bf: 12.0, smm: 72,   source: "TARGET"   },
];

// Bloodwork series keyed by metric
export const BLOODWORK = {
  ldl: {
    label:    "LDL Cholesterol",
    unit:     "mmol/L",
    refRange: "< 2.0 optimal · 3.5 = treatment threshold",
    optimal:  2.0,
    warning:  3.5,
    series: [
      { date: "2021-03", val: 3.08 },
      { date: "2021-10", val: 2.53 },
      { date: "2025-01", val: 3.50 },
      { date: "2026-05", val: 4.76 },
    ],
  },
  totalCholesterol: {
    label:    "Total Cholesterol",
    unit:     "mmol/L",
    refRange: "< 5.2 desirable",
    optimal:  5.2,
    warning:  6.2,
    series: [
      { date: "2021-10", val: 4.66 },
      { date: "2025-01", val: 5.88 },
      { date: "2026-05", val: 6.58 },
    ],
  },
  hdl: {
    label:    "HDL Cholesterol",
    unit:     "mmol/L",
    refRange: "> 1.0 desirable",
    optimal:  1.0,
    warning:  null,
    series: [
      { date: "2026-05", val: 1.70 },
    ],
  },
  triglycerides: {
    label:    "Triglycerides",
    unit:     "mmol/L",
    refRange: "< 1.7 normal",
    optimal:  1.7,
    warning:  null,
    series: [
      { date: "2026-05", val: 0.45 },
    ],
  },
  hba1c: {
    label:    "HbA1c",
    unit:     "%",
    refRange: "< 5.5 normal · 5.7–6.4 pre-diabetic",
    optimal:  5.5,
    warning:  5.7,
    series: [
      { date: "2025-01", val: 5.6 },
      { date: "2026-05", val: 5.3 },
    ],
  },
  testosterone: {
    label:    "Testosterone",
    unit:     "ng/dL",
    refRange: "500–800 optimal",
    optimal:  500,
    warning:  300,
    series: [
      { date: "2025-01", val: 360 },
      { date: "2026-05", val: 595 },
    ],
  },
  egfr: {
    label:    "eGFR (Kidney)",
    unit:     "mL/min",
    refRange: "≥ 90 normal",
    optimal:  90,
    warning:  60,
    series: [
      { date: "2021-03", val: 102 },
      { date: "2023-07", val: 101 },
      { date: "2025-01", val:  53 },
      { date: "2026-05", val:  97 },
    ],
  },
};

// Metric cards shown on Health tab (ordered)
export const HEALTH_METRICS = [
  {
    key:       "ldl",
    label:     "LDL Cholesterol",
    latest:    4.76,
    unit:      "mmol/L",
    status:    "HIGH",
    note:      "Past 3.5 tx threshold — familial pattern",
    color:     "red",
  },
  {
    key:       "totalCholesterol",
    label:     "Total Cholesterol",
    latest:    6.58,
    unit:      "mmol/L",
    status:    "HIGH",
    note:      "HDL 1.7 ✓ · Triglycerides 0.45 ✓",
    color:     "red",
  },
  {
    key:       "hba1c",
    label:     "HbA1c",
    latest:    5.3,
    unit:      "%",
    status:    "NORMAL",
    note:      "Down from 5.6% — trending well",
    color:     "green",
  },
  {
    key:       "testosterone",
    label:     "Testosterone",
    latest:    595,
    unit:      "ng/dL",
    status:    "OPTIMAL",
    note:      "Up from 360 — in optimal range",
    color:     "green",
  },
  {
    key:       "egfr",
    label:     "eGFR (Kidney)",
    latest:    97,
    unit:      "mL/min",
    status:    "NORMAL",
    note:      "Recovered from 53 dip during 2025 cut",
    color:     "green",
  },
  {
    key:       "bodyFat",
    label:     "Body Fat",
    latest:    16.0,
    unit:      "%",
    status:    "CUTTING",
    note:      "Target 12% by Aug 16, 2026",
    color:     "amber",
  },
];
