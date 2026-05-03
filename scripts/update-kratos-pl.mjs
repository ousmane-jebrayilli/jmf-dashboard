/**
 * Updates Kratos Moving Inc. historical P&L and Ahmed's income data
 * from the Kratos_Financial_Intelligence_v3 Excel sheet.
 *
 * Logic:
 *   Dashboard Revenue  = Excel Revenue ($)
 *   Dashboard Expenses = Excel Expenses ($) + Ahmed Comp ($)  [owner comp included]
 *   Dashboard Profit   = Revenue − Expenses = Excel Adj. Profit ($)
 *
 *   Ahmed's kratosIncome = Ahmed Comp ($) per month
 *
 * Months NOT in screenshots (May–Oct 2022) are left untouched.
 * All writes are additive (merge), never destructive.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://bxxnjmottokudtjgigss.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4eG5qbW90dG9rdWR0amdpZ3NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzAyMzgsImV4cCI6MjA5MDU0NjIzOH0.NoIADiNmtaSJd67lAWLbQ49tPHa7KcAu4VBLcAY5kgk"
);

// ─── SOURCE DATA FROM EXCEL ────────────────────────────────────────────────────
// Each row: [month, excelRevenue, excelExpenses (excl. Ahmed), ahmedComp]
// Dashboard expenses = excelExpenses + ahmedComp
// Dashboard profit   = excelRevenue − dashboardExpenses = excelAdjProfit

const KRATOS_MONTHLY_DATA = [
  // 2022 — only Nov & Dec visible in screenshots; May–Oct left for manual entry
  ["2022-11", 16711.47,  9615.70, 1135.58],
  ["2022-12",  4463.91,  3261.79,  303.33],

  // 2023 — all 12 months
  ["2023-01",  8475.15,  5992.05, 2483.10],
  ["2023-02",  5551.10,  4069.86, 1481.24],
  ["2023-03", 15036.12, 11261.76, 2500.00],
  ["2023-04", 18389.32, 13011.29, 2500.00],
  ["2023-05", 40421.77, 26992.82, 2500.00],
  ["2023-06", 42162.31, 27301.45, 2500.00],
  ["2023-07", 39596.70, 26999.45, 2500.00],
  ["2023-08", 80783.82, 42366.25, 2500.00],
  ["2023-09", 49832.17, 32430.79, 2500.00],
  ["2023-10", 28951.00, 18712.12, 2500.00],
  ["2023-11", 23336.05, 15702.96, 2500.00],
  ["2023-12", 35497.33, 23363.11, 2500.00],

  // 2024 — all 12 months
  ["2024-01",  37652.12,  28692.84, 4000.00],
  ["2024-02",  47400.61,  34180.48, 4000.00],
  ["2024-03",  54193.92,  36510.68, 4268.32],
  ["2024-04",  62521.25,  49570.90, 4000.00],
  ["2024-05",  94716.40,  69680.32, 5003.61],
  ["2024-06", 141762.68,  96147.99, 7061.47],
  ["2024-07", 154733.57, 108883.35, 7085.02],
  ["2024-08", 151441.17, 109608.65, 6663.55],
  ["2024-09", 125753.91, 105986.71, 4476.72],
  ["2024-10",  98932.49,  87011.76, 4000.00],
  ["2024-11", 124044.01,  92707.09, 5633.69],
  ["2024-12",  89106.19,  71667.13, 4243.91],

  // 2025 — all 12 months (Mar 2025 is a loss month; ahmedComp = 0)
  ["2025-01",  99217.73,  80824.45, 5000.00],
  ["2025-02", 153663.90, 116059.06, 6760.48],
  ["2025-03", 123876.47, 131608.51,    0.00],  // loss month — no comp
  ["2025-04", 143426.13, 121424.38, 5200.18],
  ["2025-05", 160449.74, 136192.79, 5425.70],
  ["2025-06", 241436.20, 187918.68, 8351.75],
  ["2025-07", 195837.25, 163619.82, 6221.74],
  ["2025-08", 199383.62, 168791.89, 6059.17],
  ["2025-09", 111654.46, 103166.35, 5000.00],
  ["2025-10",  87234.56,  83705.44, 3529.12],
  ["2025-11", 120184.83, 105646.41, 5000.00],
  ["2025-12", 106411.13,  84343.55, 5206.76],

  // 2026 — Jan–Mar (YTD visible in screenshots)
  ["2026-01",  52933.46,  50914.72, 2018.74],
  ["2026-02",  41445.70,  39011.88, 2433.82],
  ["2026-03",  57402.77,  43953.89, 5000.00],
];

function round2(n) { return Math.round(n * 100) / 100; }

// Build derived records
const bizEntries = KRATOS_MONTHLY_DATA.map(([month, rev, exExp, comp]) => {
  const expenses = round2(exExp + comp);
  const profit   = round2(rev - expenses);
  return { month, revenue: rev, expenses, profit };
});

const ahmedIncome = KRATOS_MONTHLY_DATA.map(([month, , , comp]) => ({
  month,
  kratosIncome: comp,
  otherIncome:  0,
  income:       comp,
  notes:        "",
}));

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function mergeByMonth(existing, incoming) {
  const map = new Map((existing || []).map(e => [e.month, e]));
  for (const entry of incoming) {
    map.set(entry.month, { ...(map.get(entry.month) || {}), ...entry });
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

async function fetchKey(key) {
  const { data, error } = await supabase
    .from("dashboard_data")
    .select("value")
    .eq("key", key)
    .single();
  if (error) throw new Error(`fetchKey(${key}): ${error.message}`);
  return data.value;
}

async function saveKey(key, value) {
  const { error } = await supabase
    .from("dashboard_data")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(`saveKey(${key}): ${error.message}`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Fetching current dashboard_data …");

  // ── 1. Update businesses ──────────────────────────────────────────────────
  const businesses = await fetchKey("businesses");
  const kratosIdx  = businesses.findIndex(b => b.id === 1);
  if (kratosIdx === -1) throw new Error("Kratos Moving (id=1) not found in businesses array");

  const kratos = businesses[kratosIdx];
  const existingHistory = kratos.historicalData || [];
  const existingProfits = kratos.monthlyProfits  || [];

  console.log(`Kratos historicalData: ${existingHistory.length} existing rows`);
  console.log(`Applying ${bizEntries.length} monthly rows from Excel …`);

  const mergedHistory = mergeByMonth(existingHistory, bizEntries);
  const mergedProfits = mergeByMonth(existingProfits, bizEntries.map(e => ({
    month: e.month, revenue: e.revenue, expenses: e.expenses, profit: e.profit,
  })));

  businesses[kratosIdx] = {
    ...kratos,
    historicalData: mergedHistory,
    monthlyProfits:  mergedProfits,
  };

  await saveKey("businesses", businesses);
  console.log(`✓ businesses saved — historicalData now has ${mergedHistory.length} rows`);

  // ── 2. Update Ahmed's income (individual id=1) ─────────────────────────────
  const individuals = await fetchKey("individuals");
  const ahmedIdx    = individuals.findIndex(i => i.id === 1);
  if (ahmedIdx === -1) throw new Error("Ahmed (id=1) not found in individuals array");

  const ahmed = individuals[ahmedIdx];
  const existingIncome = ahmed.monthlyIncome || [];

  console.log(`Ahmed monthlyIncome: ${existingIncome.length} existing rows`);
  console.log(`Applying ${ahmedIncome.length} income rows …`);

  const mergedIncome = mergeByMonth(existingIncome, ahmedIncome);

  individuals[ahmedIdx] = { ...ahmed, monthlyIncome: mergedIncome };
  await saveKey("individuals", individuals);
  console.log(`✓ individuals saved — Ahmed monthlyIncome now has ${mergedIncome.length} rows`);

  // ── 3. Write monthly_business_logs & monthly_individual_logs ──────────────
  console.log("Writing relational logs …");
  const KRATOS_BIZ_ID = 1;
  const AHMED_IND_ID  = 1;

  for (const e of bizEntries) {
    // ensure period row exists
    await supabase.from("monthly_periods").upsert(
      { month_key: e.month, label: e.month, status: "open" },
      { onConflict: "month_key", ignoreDuplicates: true }
    );
    await supabase.from("monthly_business_logs").upsert(
      {
        month_key:   e.month,
        business_id: KRATOS_BIZ_ID,
        revenue:     e.revenue,
        expenses:    e.expenses,
        profit:      e.profit,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: "month_key,business_id" }
    );
  }
  console.log(`✓ monthly_business_logs: ${bizEntries.length} rows upserted`);

  for (const a of ahmedIncome) {
    await supabase.from("monthly_individual_logs").upsert(
      {
        month_key:      a.month,
        individual_id:  AHMED_IND_ID,
        kratos_income:  a.kratosIncome,
        other_income:   a.otherIncome,
        monthly_income: a.income,
        income_notes:   a.notes || null,
        updated_at:     new Date().toISOString(),
      },
      { onConflict: "month_key,individual_id" }
    );
  }
  console.log(`✓ monthly_individual_logs: ${ahmedIncome.length} rows upserted`);

  // ── 4. Preview of what was written ────────────────────────────────────────
  console.log("\n── Preview: Business P&L entries (first 5) ──");
  bizEntries.slice(0, 5).forEach(e =>
    console.log(`  ${e.month}  rev=${e.revenue.toFixed(2)}  exp=${e.expenses.toFixed(2)}  profit=${e.profit.toFixed(2)}`)
  );
  console.log(`  … and ${bizEntries.length - 5} more`);

  console.log("\n── Preview: Ahmed income (first 5) ──");
  ahmedIncome.slice(0, 5).forEach(a =>
    console.log(`  ${a.month}  kratosIncome=${a.kratosIncome.toFixed(2)}`)
  );

  console.log("\nDone. Reload the dashboard to see the updated data.");
}

main().catch(err => { console.error("Error:", err.message); process.exit(1); });
