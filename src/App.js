import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

/*
 SUPABASE SCHEMA EXPECTED:

 -- auth.users: managed by Supabase Auth (email + password)

 -- public.profiles
 create table public.profiles (
   id            uuid primary key references auth.users(id) on delete cascade,
   role          text not null default 'individual',  -- 'admin' or 'individual'
   individual_id int,                                  -- maps to individuals[].id; null for admin
   display_name  text,
   initials      text
 );
 -- RLS: each user can read their own row; admin can read all
 alter table public.profiles enable row level security;
 create policy "own profile" on public.profiles for select using (auth.uid() = id);
 create policy "admin read all" on public.profiles for select using (
   exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
 );

 -- public.reporting_periods
 create table public.reporting_periods (
   id          uuid primary key default gen_random_uuid(),
   period_date date unique not null,
   label       text,
   created_at  timestamptz default now()
 );
 alter table public.reporting_periods disable row level security;

 -- public.submissions
 create table public.submissions (
   id           uuid primary key default gen_random_uuid(),
   user_id      uuid not null references auth.users(id),
   period       date not null,
   submitted_at timestamptz default now(),
   status       text default 'pending',
   data         jsonb not null,
   admin_note   text,
   reviewed_at  timestamptz,
   reviewed_by  uuid references auth.users(id)
 );
 alter table public.submissions disable row level security;

 -- Seed initial reporting period:
 insert into public.reporting_periods (period_date, label)
 values ('2026-04-01', 'April 2026')
 on conflict do nothing;
*/

const supabase = createClient(
  "https://bxxnjmottokudtjgigss.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4eG5qbW90dG9rdWR0amdpZ3NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzAyMzgsImV4cCI6MjA5MDU0NjIzOH0.NoIADiNmtaSJd67lAWLbQ49tPHa7KcAu4VBLcAY5kgk"
);

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:          "#ECF0F6",
  surface:     "#FFFFFF",
  card:        "#FFFFFF",
  border:      "#DFE4ED",
  borderDark:  "#C4CCDA",
  nav:         "#0B1829",
  navBorder:   "rgba(255,255,255,0.06)",
  navText:     "rgba(255,255,255,0.45)",
  gold:        "#B8962E",
  goldLight:   "#F5F0E4",
  goldText:    "#8A6F1E",
  red:         "#C0392B",
  redLight:    "#FDECEA",
  redText:     "#922B21",
  green:       "#1E8449",
  greenLight:  "#EAF7EE",
  greenText:   "#1A6E3C",
  amber:       "#B7770D",
  amberLight:  "#FEF9EC",
  blue:        "#1A5276",
  blueLight:   "#EAF2F8",
  blueText:    "#154360",
  purple:      "#6C3483",
  purpleLight: "#F4ECF7",
  purpleText:  "#512E5F",
  text:        "#0F1923",
  textMid:     "#4A5568",
  textDim:     "#8A96A8",
  shadow:      "0 1px 3px rgba(11,24,41,0.06), 0 4px 16px rgba(11,24,41,0.04)",
  shadowMd:    "0 4px 12px rgba(11,24,41,0.10), 0 8px 32px rgba(11,24,41,0.06)",
  mono:        "'SF Mono', 'Courier New', monospace",
  sans:        "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

// ─── NUMBER HELPERS ───────────────────────────────────────────────────────────
const safe = (n) => (isNaN(n) || n == null ? 0 : Number(n));
const $K = (n) => {
  const v = safe(n), a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1000000) return `${s}$${(a / 1000000).toFixed(2)}M`;
  if (a >= 1000)    return `${s}$${(a / 1000).toFixed(0)}K`;
  return `${s}$${a.toLocaleString("en-CA")}`;
};
const $F = (n, d = 0) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: d }).format(safe(n));

// ─── TIME HELPERS ─────────────────────────────────────────────────────────────
const SYSTEM_START = "2026-04"; // April 2026 — first tracking month
function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthsBetween(startYM, endYM) {
  const months = [];
  let [sy, sm] = startYM.split("-").map(Number);
  const [ey, em] = endYM.split("-").map(Number);
  while (sy < ey || (sy === ey && sm <= em)) {
    months.push(`${sy}-${String(sm).padStart(2, "0")}`);
    sm++; if (sm > 12) { sm = 1; sy++; }
  }
  return months;
}
function monthLabel(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-CA", { month: "short", year: "numeric" });
}
function monthIndex(ym) {
  const [y, m] = (ym || SYSTEM_START).split("-").map(Number);
  return (y * 12) + (m - 1);
}
function monthDiff(fromYM, toYM) {
  return monthIndex(toYM) - monthIndex(fromYM);
}
function ymFromDate(value) {
  return value ? value.slice(0, 7) : "";
}
function parseDateParts(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}
function formatDate(value) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}
function addMonthsToDate(value, months) {
  const parts = parseDateParts(value);
  if (!parts) return "";
  const dt = new Date(parts.y, parts.m - 1 + months, parts.d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
function monthsInLeaseWindow(startDate, endDate) {
  const start = parseDateParts(startDate);
  const end = parseDateParts(endDate);
  if (!start || !end) return 0;
  let months = ((end.y - start.y) * 12) + (end.m - start.m);
  if (end.d >= start.d - 1) months += 1;
  return Math.max(months, 0);
}
function makeId(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
function makeLease(lease = {}) {
  const start = lease.lease_start_date || "";
  const end = lease.lease_end_date || "";
  const termMonths = safe(lease.lease_term_months) || monthsInLeaseWindow(start, end);
  return {
    id: lease.id || makeId("lease"),
    tenant_full_name: lease.tenant_full_name || "",
    phone_number: lease.phone_number || "",
    email: lease.email || "",
    unit_label: lease.unit_label || "",
    lease_start_date: start,
    lease_end_date: end,
    lease_term_months: termMonths,
    monthly_rent: safe(lease.monthly_rent),
    deposit_received: safe(lease.deposit_received),
    deposit_date: lease.deposit_date || "",
    payment_frequency: lease.payment_frequency || "monthly",
    lease_notes: lease.lease_notes || "",
    lease_status: lease.lease_status || "vacant",
    deposit_applies_to_rent: lease.deposit_applies_to_rent !== false,
  };
}
function makeUnit(unit = {}) {
  return {
    id: unit.id || makeId("unit"),
    label: unit.label || unit.unit_label || "Unit",
    status: unit.status || "vacant",
    market_rent: safe(unit.market_rent ?? unit.rent),
    notes: unit.notes || "",
    lease: unit.lease ? makeLease({ ...unit.lease, unit_label: unit.lease.unit_label || unit.label || unit.unit_label || "Unit" }) : null,
  };
}

// ─── DEFAULT DATA — April 1, 2026 ─────────────────────────────────────────────
const DEFAULT = {
  lastUpdated: "April 1, 2026",

  individuals: [
    { id:1, name:"Ahmed (AJ)",         initials:"AJ", cash:0,   accounts:1023,  debt:0, securities:46610, crypto:1466, physicalAssets:0, monthlyIncome:[], accountsLog:[] },
    { id:2, name:"Nazila Isgandarova", initials:"NI", cash:0,   accounts:15647, debt:0, securities:39939, crypto:0,    physicalAssets:0, monthlyIncome:[], accountsLog:[] },
    { id:3, name:"Yasin Majidov",      initials:"YM", cash:500, accounts:0,     debt:0, securities:0,     crypto:0,    physicalAssets:0, monthlyIncome:[], accountsLog:[] },
    { id:4, name:"Maryam Majidova",    initials:"MM", cash:0,   accounts:1305,  debt:0, securities:0,     crypto:0,    physicalAssets:0, monthlyIncome:[], accountsLog:[] },
    { id:5, name:"Akbar Majidov",      initials:"AM", cash:0,   accounts:-1089, debt:0, securities:0,     crypto:0,    physicalAssets:0, monthlyIncome:[], accountsLog:[] },
    { id:6, name:"Mustafa Majidov",    initials:"MU", cash:0,   accounts:0,     debt:0, securities:0,     crypto:0,    physicalAssets:0, monthlyIncome:[], accountsLog:[] },
  ],

  businesses: [
    { id:1, name:"Kratos Moving Inc.", abbr:"KMI", type:"operating",  cashAccounts:152207, liabilities:133056, taxPayable:120000, creditCards:13056, revenue:0, expenses:0, monthlyProfits:[], notes:"CEO: James Bond. BMO + RBC + Wise accounts. CRA $120K payable included in liabilities." },
    { id:2, name:"JMF Logistics Inc.", abbr:"JMF", type:"operating",  cashAccounts:2621,   liabilities:0,      taxPayable:0,     creditCards:0,     revenue:0, expenses:0, monthlyProfits:[], notes:"RBC Chequing. Clean balance sheet. No outstanding liabilities." },
    { id:3, name:"PRIMA",              abbr:"PRIMA",type:"operating",  cashAccounts:10007,  liabilities:2349,   taxPayable:0,     creditCards:2349,  revenue:0, expenses:0, monthlyProfits:[], notes:"Nazila's operating corporation. TD Chequing $10,007. TD Business Travel Visa $2,349." },
    { id:4, name:"ASWC",               abbr:"ASWC", type:"nonprofit", cashAccounts:20643,  liabilities:0,      taxPayable:0,     creditCards:0,     revenue:0, expenses:0, monthlyProfits:[], notes:"Non-profit collective fund. TD Chequing $20,643. NOT included in JMF consolidated net worth." },
  ],

  properties: [
    {
      id:1, name:"27 Roytec Rd.", status:"STRONG", property_type:"commercial",
      purchase:1020000, market:2000000, mortgage:728134.68, original_balance:0, ownership:1,
      mortgage_as_of_month:SYSTEM_START, payment_structure:"amortizing", mortgage_manual_override:0, mortgage_manual_override_month:"",
      interest_rate:6.25, rate:"P+1.80% (≈6.25%)", rateType:"Floating / Prime + 1.80",
      maturity:"TBC", remaining_amortization_months:300, taxes_paid_by:"owner",
      monthlyPayment:0, monthly_pi:0, monthly_payment_tax:0,
      tax_account_balance:0, monthlyTax:0, annual_property_tax_estimate:0, tax_account_note:"",
      tax_notice_outstanding:0, tax_notice_penalty:0, tax_notice_next_installment:0, tax_notice_next_due:"",
      monthly_insurance:0, annual_insurance:0,
      maintenance_reserve_monthly:0, management_fee_monthly:0, utilities_monthly:0, capex_reserve_monthly:0,
      rentalIncome:6000, rental_market_monthly:6000,
      occupancy_status:"partially_leased",
      tenant_summary:"8A: Nes Bakery Inc. ($6,000/mo) · 8B: 3 rooms vacant",
      vacancy_notes:"Section 8B fully vacant. 3 rooms available.",
      sections:[
        { id:"8A",   label:"Section 8A",  tenant:"Nes Bakery Inc.", rent:6000, status:"leased" },
        { id:"8B-1", label:"8B – Room 1", tenant:"",                rent:0,    status:"vacant" },
        { id:"8B-2", label:"8B – Room 2", tenant:"",                rent:0,    status:"vacant" },
        { id:"8B-3", label:"8B – Room 3", tenant:"",                rent:0,    status:"vacant" },
      ],
      units:[
        makeUnit({
          id:"8A", label:"Section 8A", status:"leased", market_rent:6000,
          lease: {
            id:"roytec-8a", tenant_full_name:"Nes Bakery Inc.", unit_label:"Section 8A",
            monthly_rent:6000, payment_frequency:"monthly", lease_status:"active",
            lease_notes:"Commercial tenant in place. Exact lease dates pending confirmation."
          }
        }),
        makeUnit({ id:"8B-1", label:"8B - Room 1", status:"vacant", market_rent:0 }),
        makeUnit({ id:"8B-2", label:"8B - Room 2", status:"vacant", market_rent:0 }),
        makeUnit({ id:"8B-3", label:"8B - Room 3", status:"vacant", market_rent:0 }),
      ],
      covenant_notes:"DSCR ≥ 1.25× inception · ≥ 1.20× renewal · Min. vacancy factor 5% · Min. mgmt fee 5% · Business interruption ins. ≥ 12 months rent · Fire ins. ≥ $750K · Liability ≥ $2M · Arrangement fee $3,000 · Annual renewal fee $1,000",
      lender:"TD Bank",
      notes:"Borrower: PRIMA Centre for Mental Health and Wellness Inc. Floating — 6.25% is a scenario (prime 4.45% + 1.80%). Balance $728,134 confirmed April 1, 2026.",
      valuations:[{ date:"2026-04-01", value:2000000, note:"Initial valuation" }],
    },
    {
      id:2, name:"3705 Farr Ave.", status:"STRONG", property_type:"vacant_land",
      purchase:250000, market:1200000, mortgage:0, original_balance:0,
      mortgage_as_of_month:SYSTEM_START, payment_structure:"amortizing", mortgage_manual_override:0, mortgage_manual_override_month:"",
      interest_rate:0, rate:"N/A", rateType:"Mortgage-free",
      maturity:"N/A", remaining_amortization_months:0, taxes_paid_by:"owner",
      monthlyPayment:0, monthly_pi:0, monthly_payment_tax:0,
      tax_account_balance:0, monthlyTax:0, annual_property_tax_estimate:0, tax_account_note:"",
      tax_notice_outstanding:810.86, tax_notice_penalty:18.91, tax_notice_next_installment:561.61, tax_notice_next_due:"2025-09-29",
      monthly_insurance:0, annual_insurance:0,
      maintenance_reserve_monthly:0, management_fee_monthly:0, utilities_monthly:0, capex_reserve_monthly:0,
      rentalIncome:0, rental_market_monthly:0,
      occupancy_status:"vacant_land",
      tenant_summary:"", vacancy_notes:"Vacant land. No current use.",
      sections:[], covenant_notes:"",
      ownership:0.5, co_owner:"Jamal (50%)",
      lender:"None",
      notes:"Fully mortgage-free. JMF 50% share — co-owned with Jamal. Annual property tax pending full bill.",
      valuations:[{ date:"2026-04-01", value:1200000, note:"Initial valuation" }],
    },
    {
      id:3, name:"121 Milky Way", status:"WATCH", property_type:"residential",
      purchase:3079729, market:2850000, mortgage:1824886.46, original_balance:2000000,
      mortgage_as_of_month:SYSTEM_START, payment_structure:"amortizing", mortgage_manual_override:0, mortgage_manual_override_month:"",
      interest_rate:5.79, rate:"5.79%", rateType:"12 Month Fixed Closed",
      maturity:"Apr 1, 2027", remaining_amortization_months:285, taxes_paid_by:"lender",
      monthlyPayment:12628.05, monthly_pi:11722.76, monthly_payment_tax:905.29,
      tax_account_balance:2361.89, monthlyTax:905.29, annual_property_tax_estimate:10864, tax_account_note:"",
      tax_notice_outstanding:0, tax_notice_penalty:0, tax_notice_next_installment:0, tax_notice_next_due:"",
      monthly_insurance:0, annual_insurance:0,
      maintenance_reserve_monthly:0, management_fee_monthly:0, utilities_monthly:0, capex_reserve_monthly:0,
      rentalIncome:0, rental_market_monthly:0,
      occupancy_status:"owner_occupied",
      tenant_summary:"Owner-resided by family", vacancy_notes:"",
      sections:[], covenant_notes:"",
      lender:"Equitable Bank",
      notes:"Renewed April 2026 at 5.79% Fixed Closed. Matures April 1, 2027. Borrower: Nazila Isgandarova. Tax escrowed by Equitable. Tax account $2,362.",
      valuations:[{ date:"2026-04-01", value:2850000, note:"Initial valuation" }],
    },
    {
      id:4, name:"51 Ahchie Crt.", status:"WATCH", property_type:"residential",
      purchase:2119105, market:1750000, mortgage:1523755.81, original_balance:1553670,
      mortgage_as_of_month:SYSTEM_START, payment_structure:"amortizing", mortgage_manual_override:0, mortgage_manual_override_month:"",
      interest_rate:5.79, rate:"5.79%", rateType:"12 Month Fixed Closed",
      maturity:"Apr 1, 2027", remaining_amortization_months:337, taxes_paid_by:"lender",
      monthlyPayment:10342.14, monthly_pi:9107, monthly_payment_tax:1235.14,
      tax_account_balance:21602.52, monthlyTax:1235.14, annual_property_tax_estimate:14821, tax_account_note:"",
      tax_notice_outstanding:0, tax_notice_penalty:0, tax_notice_next_installment:0, tax_notice_next_due:"",
      monthly_insurance:0, annual_insurance:0,
      maintenance_reserve_monthly:0, management_fee_monthly:0, utilities_monthly:0, capex_reserve_monthly:0,
      rentalIncome:4900, rental_market_monthly:4900,
      occupancy_status:"partially_leased",
      tenant_summary:"Unit A (Upper): $3,300/mo · Unit B (Lower): $1,600/mo · Both leased April 2026",
      vacancy_notes:"Both units leased. Lump sum payment (~6 mo) may arrive for Unit A.",
      sections:[
        { id:"A", label:"Unit A (Upper)", tenant:"", rent:3300, status:"leased" },
        { id:"B", label:"Unit B (Lower)", tenant:"", rent:1600, status:"leased" },
      ],
      units:[
        makeUnit({
          id:"level-a", label:"Level A", status:"leased", market_rent:3300,
          lease:{
            id:"ahchie-level-a-2026",
            tenant_full_name:"",
            unit_label:"Level A",
            lease_start_date:"2026-04-27",
            lease_end_date:"2027-04-26",
            lease_term_months:12,
            monthly_rent:3300,
            deposit_received:20000,
            deposit_date:"2026-04-27",
            payment_frequency:"monthly",
            lease_status:"active",
            lease_notes:"Deposit is currently treated as prepaid rent credit unless manually overridden later."
          }
        }),
        makeUnit({
          id:"level-b", label:"Level B", status:"leased", market_rent:1600,
          lease:{
            id:"ahchie-level-b-2026",
            tenant_full_name:"",
            unit_label:"Level B",
            lease_start_date:"2026-04-01",
            lease_end_date:"2027-03-31",
            lease_term_months:12,
            monthly_rent:1600,
            deposit_received:0,
            deposit_date:"",
            payment_frequency:"monthly",
            lease_status:"active",
            lease_notes:"Lower level lease placeholder. Tenant details can be added inline."
          }
        }),
        makeUnit({ id:"level-c", label:"Level C", status:"vacant", market_rent:0, notes:"Available for future tenancy." }),
      ], covenant_notes:"",
      lender:"Equitable Bank",
      notes:"Renewed April 2026 at 5.79% Fixed Closed. Matures April 1, 2027. Borrower: Akbar Majidov. Tax escrowed by Equitable. Tax account $21,603.",
      valuations:[{ date:"2026-04-01", value:1750000, note:"Initial valuation" }],
    },
    {
      id:5, name:"4 New Seabury Dr.", status:"WATCH", property_type:"residential",
      purchase:349000, market:958800, mortgage:894768.98, original_balance:960000,
      mortgage_as_of_month:SYSTEM_START, payment_structure:"amortizing", mortgage_manual_override:0, mortgage_manual_override_month:"",
      interest_rate:5.94, rate:"5.94%", rateType:"60 Month Fixed Closed",
      maturity:"Dec 2029", remaining_amortization_months:311, taxes_paid_by:"lender",
      monthlyPayment:5979, monthly_pi:5605, monthly_payment_tax:374,
      tax_account_balance:1458, monthlyTax:374, annual_property_tax_estimate:4484, tax_account_note:"",
      tax_notice_outstanding:0, tax_notice_penalty:0, tax_notice_next_installment:0, tax_notice_next_due:"",
      monthly_insurance:0, annual_insurance:0,
      maintenance_reserve_monthly:0, management_fee_monthly:0, utilities_monthly:0, capex_reserve_monthly:0,
      rentalIncome:3900, rental_market_monthly:3900,
      occupancy_status:"lease_signed_pending_possession",
      tenant_summary:"Lease signed. Possession: April 20, 2026.",
      vacancy_notes:"Currently vacant. Rent collection begins at possession.",
      sections:[],
      units:[
        makeUnit({
          id:"main", label:"Main", status:"lease_signed_pending_possession", market_rent:3900,
          lease:{
            id:"new-seabury-main", tenant_full_name:"", unit_label:"Main",
            monthly_rent:3900, payment_frequency:"monthly", lease_status:"signed_pending",
            lease_notes:"Lease signed. Possession begins April 20, 2026."
          }
        }),
      ], covenant_notes:"",
      ownership:0.6667, co_owner:"Abassli family (33.3%)",
      lender:"Equitable Bank",
      notes:"Fixed 5.94%. JMF 2/3 share — co-owned with Abassli family. Fee balance: $550. Tax escrowed by lender.",
      valuations:[{ date:"2026-04-01", value:958800, note:"Initial valuation" }],
    },
  ],

  cashflow: {
    income: [
      { label:"Other income", amount:0, note:"" },
    ],
    obligations: [
      { label:"121 Milky Way mortgage",  amount:12628, note:"5.79% · Equitable · Apr 2027" },
      { label:"51 Ahchie Crt. mortgage", amount:10342, note:"5.79% · Equitable · Apr 2027" },
      { label:"4 New Seabury mortgage",  amount:5979,  note:"5.94% · Equitable · Dec 2029" },
      { label:"27 Roytec Rd. mortgage",  amount:0,     note:"TD Bank · P+1.80% (≈6.25%) · pending" },
    ],
  },

  rentPayments: [], // { id, propertyId, unitId, leaseId, month:"YYYY-MM", amount, date, type:"payment", note }
};

// ─── DASHBOARD DB HELPERS ─────────────────────────────────────────────────────
async function loadFromDB() {
  try {
    const { data, error } = await supabase.from("dashboard_data").select("*");
    if (error || !data || data.length === 0) return null;
    const result = {};
    data.forEach(row => { result[row.key] = row.value; });
    return result.individuals?.length > 0 ? result : null;
  } catch { return null; }
}
async function saveToDB(key, value) {
  try { await supabase.from("dashboard_data").upsert({ key, value, updated_at: new Date().toISOString() }); }
  catch (e) { console.error("DB save failed", e); }
}
function mergeById(defaults, dbArr) {
  return defaults.map(def => {
    const db = (dbArr || []).find(x => x.id === def.id) || {};
    return { ...def, ...db };
  });
}

// ─── PROPERTY HELPERS ─────────────────────────────────────────────────────────
function deriveUnitsFromSections(prop) {
  const sections = prop.sections || [];
  if (!sections.length) return [];
  return sections.map(sec => makeUnit({
    id: sec.id,
    label: sec.label,
    status: sec.status,
    market_rent: safe(sec.rent),
    lease: sec.tenant || safe(sec.rent) > 0 ? {
      id: `${prop.id}-${sec.id}-lease`,
      tenant_full_name: sec.tenant || "",
      unit_label: sec.label,
      monthly_rent: safe(sec.rent),
      payment_frequency: "monthly",
      lease_status: sec.status === "leased" ? "active" : "vacant",
      lease_notes: "",
    } : null,
  }));
}
function normalizeProperty(prop) {
  const units = (prop.units && prop.units.length ? prop.units : deriveUnitsFromSections(prop)).map(makeUnit);
  const occupancy = prop.occupancy_status || (units.some(u => u.lease?.lease_status === "active") ? "partially_leased" : "vacant");
  return {
    ...prop,
    mortgage_as_of_month: prop.mortgage_as_of_month || SYSTEM_START,
    payment_structure: prop.payment_structure || "amortizing",
    mortgage_manual_override: safe(prop.mortgage_manual_override),
    mortgage_manual_override_month: prop.mortgage_manual_override_month || "",
    units,
    occupancy_status: occupancy,
  };
}
function normalizeRentPayment(payment) {
  return {
    id: payment.id || makeId("rent"),
    propertyId: payment.propertyId,
    unitId: payment.unitId || "",
    leaseId: payment.leaseId || "",
    month: payment.month || ymFromDate(payment.date) || currentYM(),
    amount: safe(payment.amount ?? payment.received),
    date: payment.date || `${payment.month || currentYM()}-01`,
    type: payment.type || "payment",
    note: payment.note || "",
  };
}
function getPropertyUnits(prop) {
  return (prop.units || []).map(makeUnit);
}
function getActiveLease(unit) {
  return unit?.lease?.lease_status && !["vacant", "expired"].includes(unit.lease.lease_status) ? makeLease(unit.lease) : null;
}
function getMortgagePI(prop) {
  const separatedTax = safe(prop.monthly_payment_tax) || ((prop.taxes_paid_by === "lender" || prop.taxes_paid_by === "escrow") ? safe(prop.monthlyTax) : 0);
  return safe(prop.monthly_pi) || Math.max(0, safe(prop.monthlyPayment) - separatedTax);
}
function hasSeparateMortgageTax(prop) {
  return safe(prop.monthly_pi) > 0 || safe(prop.monthly_payment_tax) > 0 ||
    (((prop.taxes_paid_by === "lender" || prop.taxes_paid_by === "escrow")) && safe(prop.monthlyTax) > 0);
}
function getMortgageOperatingPayment(prop) {
  return hasSeparateMortgageTax(prop) ? getMortgagePI(prop) : safe(prop.monthlyPayment);
}
function calculateMortgageSnapshot(prop, targetYM = currentYM()) {
  const anchorMonth = prop.mortgage_manual_override_month || prop.mortgage_as_of_month || SYSTEM_START;
  const openingBalance = safe(prop.mortgage_manual_override_month ? prop.mortgage_manual_override : prop.mortgage);
  const elapsedMonths = Math.max(0, monthDiff(anchorMonth, targetYM));
  const monthlyRate = safe(prop.interest_rate) / 100 / 12;
  const piPayment = getMortgagePI(prop);
  const paymentStructure = prop.payment_structure || "amortizing";
  let balance = openingBalance;
  let remainingAmortization = Math.max(0, safe(prop.remaining_amortization_months));

  for (let i = 0; i < elapsedMonths; i += 1) {
    const interest = monthlyRate > 0 ? balance * monthlyRate : 0;
    const rawPrincipal = paymentStructure === "interest_only" ? 0 : (piPayment - interest);
    const principal = Math.max(0, Math.min(balance, rawPrincipal));
    balance = Math.max(0, balance - principal);
    remainingAmortization = Math.max(0, remainingAmortization - 1);
  }

  const currentInterest = monthlyRate > 0 ? balance * monthlyRate : 0;
  const currentPrincipal = paymentStructure === "interest_only" ? 0 : Math.max(0, Math.min(balance, piPayment - currentInterest));
  const nextBalance = Math.max(0, balance - currentPrincipal);

  return {
    anchorMonth,
    openingBalance,
    displayedBalance: balance,
    currentInterest,
    currentPrincipal,
    nextBalance,
    paymentStructure,
    monthlyPI: piPayment,
    remainingAmortization,
    hasManualOverride: !!prop.mortgage_manual_override_month,
  };
}
function getLeaseTermMonths(lease) {
  return safe(lease.lease_term_months) || monthsInLeaseWindow(lease.lease_start_date, lease.lease_end_date);
}
function buildLeaseSchedule(lease) {
  if (!lease?.lease_start_date || safe(lease.monthly_rent) <= 0) return [];
  const termMonths = getLeaseTermMonths(lease);
  if (!termMonths) return [];
  return Array.from({ length: termMonths }, (_, idx) => {
    const dueDate = addMonthsToDate(lease.lease_start_date, idx);
    return {
      month: ymFromDate(dueDate),
      dueDate,
      amount: safe(lease.monthly_rent),
    };
  });
}
function getLeasePayments(rentPayments, propertyId, unitId, leaseId) {
  return (rentPayments || [])
    .map(normalizeRentPayment)
    .filter(entry =>
      entry.propertyId === propertyId &&
      entry.type === "payment" &&
      (!unitId || entry.unitId === unitId) &&
      (!leaseId || entry.leaseId === leaseId)
    );
}
function buildLeaseLedger(unit, prop, rentPayments) {
  const lease = getActiveLease(unit);
  if (!lease) return null;
  const schedule = buildLeaseSchedule(lease);
  const payments = getLeasePayments(rentPayments, prop.id, unit.id, lease.id);
  const paymentByMonth = payments.reduce((acc, entry) => {
    acc[entry.month] = (acc[entry.month] || 0) + safe(entry.amount);
    return acc;
  }, {});
  let remainingCredit = lease.deposit_applies_to_rent ? safe(lease.deposit_received) : 0;
  const rows = schedule.map(item => {
    const paid = safe(paymentByMonth[item.month]);
    const creditApplied = Math.min(Math.max(item.amount - paid, 0), remainingCredit);
    remainingCredit = Math.max(0, remainingCredit - creditApplied);
    const outstanding = Math.max(0, item.amount - paid - creditApplied);
    return { ...item, paid, creditApplied, outstanding };
  });
  const totalDue = rows.reduce((sum, row) => sum + row.amount, 0);
  const totalPaid = rows.reduce((sum, row) => sum + row.paid, 0);
  const totalCredited = rows.reduce((sum, row) => sum + row.creditApplied, 0);
  const totalOutstanding = rows.reduce((sum, row) => sum + row.outstanding, 0);
  const remainingLeaseValue = rows
    .filter(row => row.month >= currentYM())
    .reduce((sum, row) => sum + row.outstanding, 0);
  return {
    lease,
    rows,
    payments,
    totalDue,
    totalPaid,
    totalCredited,
    totalOutstanding,
    remainingLeaseValue,
    unusedCredit: remainingCredit,
  };
}
function propertyLeaseLedgers(prop, rentPayments) {
  return getPropertyUnits(prop)
    .map(unit => ({ unit, ledger: buildLeaseLedger(unit, prop, rentPayments) }))
    .filter(item => item.ledger);
}
function propertyExpectedRentForMonth(prop, month) {
  return propertyLeaseLedgers(prop, []).reduce((sum, item) => {
    const row = item.ledger.rows.find(r => r.month === month);
    return sum + safe(row?.amount);
  }, 0);
}
function propertyCollectedRentForMonth(prop, rentPayments, month) {
  return (rentPayments || [])
    .map(normalizeRentPayment)
    .filter(entry => entry.propertyId === prop.id && entry.type === "payment" && entry.month === month)
    .reduce((sum, entry) => sum + safe(entry.amount), 0);
}
function propertyCollectedRentTotal(prop, rentPayments) {
  return (rentPayments || [])
    .map(normalizeRentPayment)
    .filter(entry => entry.propertyId === prop.id && entry.type === "payment")
    .reduce((sum, entry) => sum + safe(entry.amount), 0);
}
function propertyOutstandingForMonth(prop, rentPayments, month) {
  return propertyLeaseLedgers(prop, rentPayments).reduce((sum, item) => {
    const row = item.ledger.rows.find(r => r.month === month);
    return sum + safe(row?.outstanding);
  }, 0);
}
function propertyOccupancyStatus(prop) {
  const units = getPropertyUnits(prop);
  if (!units.length) return prop.occupancy_status;
  const active = units.filter(unit => {
    const status = unit.lease?.lease_status || unit.status;
    return ["active", "signed_pending", "leased", "lease_signed_pending_possession"].includes(status);
  }).length;
  const hasPending = units.some(unit => (unit.lease?.lease_status || unit.status) === "signed_pending");
  if (!active) return prop.property_type === "vacant_land" ? "vacant_land" : "vacant";
  if (hasPending && active === units.length) return "lease_signed_pending_possession";
  if (active === units.length) return "leased";
  return "partially_leased";
}
function buildTenantSummary(units) {
  const active = (units || []).filter(unit => unit.lease && ["active", "signed_pending"].includes(unit.lease.lease_status));
  if (!active.length) return "";
  return active.map(unit => `${unit.label}: ${unit.lease.tenant_full_name || "Tenant TBD"} (${ $F(unit.lease.monthly_rent) }/mo)`).join(" · ");
}
// Returns the rent currently being collected based on active leases
function propEffectiveRent(prop) {
  const units = getPropertyUnits(prop);
  if (!units.length) return safe(prop.rentalIncome);
  return units.reduce((sum, unit) => {
    const lease = getActiveLease(unit);
    if (!lease || !["active", "signed_pending"].includes(lease.lease_status)) return sum;
    return sum + safe(lease.monthly_rent);
  }, 0);
}
// Returns total monthly cash outflows for a property
function propMonthlyOut(prop) {
  return getMortgageOperatingPayment(prop) + safe(prop.monthlyTax) + safe(prop.monthly_insurance) +
    safe(prop.maintenance_reserve_monthly);
}
// Returns JMF ownership fraction (0–1). Defaults to 1 (100%) if field absent.
function propOwnership(prop) { const o = safe(prop.ownership); return (o > 0 && o <= 1) ? o : 1; }
// Gross equity regardless of ownership split
function propCurrentMortgageBalance(prop, targetYM = currentYM()) { return calculateMortgageSnapshot(prop, targetYM).displayedBalance; }
function propGrossEquity(prop) { return safe(prop.market) - propCurrentMortgageBalance(prop); }
// JMF-attributable equity (gross × ownership share)
function propJMFEquity(prop) { return propGrossEquity(prop) * propOwnership(prop); }
// Expected monthly rent for ledger (shows agreed rent even pre-possession)
function propLedgerExpected(prop) {
  return propertyExpectedRentForMonth(prop, currentYM()) || propEffectiveRent(prop) || safe(prop.rentalIncome);
}

// ─── AUTH / PROFILE HELPERS ───────────────────────────────────────────────────
async function fetchProfile(userId) {
  try {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) throw error;
    return data;
  } catch { return null; }
}
async function fetchAllProfiles() {
  try {
    const { data } = await supabase.from("profiles").select("*");
    return data || [];
  } catch { return []; }
}

// ─── REPORTING PERIOD HELPERS ─────────────────────────────────────────────────
async function fetchReportingPeriods() {
  try {
    const { data } = await supabase.from("reporting_periods")
      .select("*").order("period_date", { ascending: false });
    return data || [];
  } catch { return []; }
}

// ─── SUBMISSION HELPERS ───────────────────────────────────────────────────────
// userId is auth.users UUID throughout
async function getSubmissionsForUser(userId) {
  try {
    const { data } = await supabase.from("submissions")
      .select("*").eq("user_id", userId).order("period", { ascending: false });
    return data || [];
  } catch { return []; }
}
async function getPendingSubmissions() {
  try {
    const { data } = await supabase.from("submissions")
      .select("*").eq("status", "pending").order("submitted_at", { ascending: true });
    return data || [];
  } catch { return []; }
}
async function createSubmission(userId, period, submittedData) {
  try {
    const { error } = await supabase.from("submissions")
      .insert({ user_id: userId, period, data: submittedData, status: "pending" });
    return !error;
  } catch { return false; }
}
async function approveSubmission(id, reviewerUserId) {
  try {
    const { error } = await supabase.from("submissions")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: reviewerUserId })
      .eq("id", id);
    return !error;
  } catch { return false; }
}
async function rejectSubmission(id, reviewerUserId, note) {
  try {
    const { error } = await supabase.from("submissions")
      .update({ status: "rejected", admin_note: note || null, reviewed_at: new Date().toISOString(), reviewed_by: reviewerUserId })
      .eq("id", id);
    return !error;
  } catch { return false; }
}

// ─── MAINTENANCE REMINDER HELPERS ─────────────────────────────────────────────
async function loadMaintenanceReminders(propertyId) {
  try {
    const q = propertyId
      ? supabase.from("maintenance_reminders").select("*").eq("property_id", propertyId)
      : supabase.from("maintenance_reminders").select("*");
    const { data } = await q.order("due_date", { ascending: true });
    return data || [];
  } catch { return []; }
}

// ─── PERSONAL EXPENSE HELPERS ──────────────────────────────────────────────────
const PERSONAL_CATEGORIES = [
  "Housing","Transport","Food","Health","Family",
  "Education","Entertainment","Shopping","Subscriptions","Business","Other",
];
const PAYMENT_METHODS = ["Cash","Debit","Credit","E-transfer","Other"];

async function loadPersonalExpenses(userId) {
  try {
    const { data } = await supabase.from("personal_expenses").select("*")
      .eq("user_id", userId).order("date", { ascending: false });
    return data || [];
  } catch { return []; }
}
async function loadAllPersonalExpenses() {
  try {
    const { data } = await supabase.from("personal_expenses").select("*").order("date", { ascending: false });
    return data || [];
  } catch { return []; }
}
async function savePersonalExpense(expense) {
  try {
    const { data, error } = await supabase.from("personal_expenses").insert(expense).select().single();
    if (error) throw error;
    return data;
  } catch (e) { console.error("savePersonalExpense", e); return null; }
}
async function loadBudgetTargets(userId) {
  try {
    const { data } = await supabase.from("budget_targets").select("*").eq("user_id", userId);
    return data || [];
  } catch { return []; }
}
async function saveBudgetTarget(userId, month, category, amount) {
  try {
    const { error } = await supabase.from("budget_targets")
      .upsert({ user_id: userId, month, category, amount }, { onConflict: "user_id,month,category" });
    return !error;
  } catch { return false; }
}

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────
function Label({ children, color }) {
  return <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: color || C.textDim, marginBottom: 6, fontFamily: C.sans }}>{children}</div>;
}
function Card({ children, style, accent }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, boxShadow: C.shadow, overflow: "hidden", position: "relative", ...style }}>
      {accent && <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background: accent, borderRadius:"14px 14px 0 0" }} />}
      {children}
    </div>
  );
}
function StatusPill({ status }) {
  const map = { STRONG: { bg: C.greenLight, color: C.greenText, label: "Strong" }, WATCH: { bg: C.amberLight, color: C.amber, label: "Watch" }, RISK: { bg: C.redLight, color: C.redText, label: "Risk" } };
  const s = map[status] || map.WATCH;
  return <span style={{ background: s.bg, color: s.color, borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "3px 10px", letterSpacing: "0.05em" }}>{s.label}</span>;
}
function OccupancyBadge({ status }) {
  const map = {
    owner_occupied:                  { label: "Owner Occupied",   color: C.blue,    bg: C.blueLight  },
    leased:                          { label: "Leased",           color: C.green,   bg: C.greenLight },
    vacant:                          { label: "Vacant",           color: C.red,     bg: C.redLight   },
    partially_leased:                { label: "Partial Lease",    color: C.amber,   bg: C.amberLight },
    vacant_land:                     { label: "Vacant Land",      color: C.textDim, bg: C.border     },
    lease_signed_pending_possession: { label: "Lease Signed",     color: C.amber,   bg: C.amberLight },
  };
  const s = map[status] || { label: status || "—", color: C.textDim, bg: C.bg };
  return <span style={{ background: s.bg, color: s.color, borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "3px 10px", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{s.label}</span>;
}
function EditNum({ value, onChange, locked }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(safe(value));
  const num = safe(value);
  const col = num < 0 ? C.red : C.text;
  if (locked) return <span style={{ fontFamily: C.mono, fontSize: 14, color: col }}>{$F(num)}</span>;
  if (editing) return (
    <input autoFocus type="number" value={v}
      onChange={e => setV(e.target.value)}
      onBlur={() => { onChange(safe(v)); setEditing(false); }}
      onKeyDown={e => { if (e.key === "Enter") { onChange(safe(v)); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
      style={{ background: C.goldLight, border: `1.5px solid ${C.gold}`, borderRadius: 6, color: C.goldText, padding: "4px 10px", width: 120, fontSize: 14, fontFamily: C.mono, outline: "none" }}
    />
  );
  return <span onClick={() => { setV(safe(value)); setEditing(true); }} title="Click to edit" style={{ cursor: "pointer", color: col, fontFamily: C.mono, fontSize: 14, borderBottom: `1.5px dashed ${C.borderDark}`, paddingBottom: 1 }}>{$F(num)}</span>;
}
function EditText({ value, onChange, locked, type = "text", placeholder = "", width = 140, align = "right" }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value || "");
  const display = value || "—";
  if (locked) return <span style={{ fontSize: 13, color: value ? C.text : C.textDim, fontFamily: type === "date" ? C.sans : C.sans }}>{display}</span>;
  if (editing) return (
    <input autoFocus type={type} value={v}
      placeholder={placeholder}
      onChange={e => setV(e.target.value)}
      onBlur={() => { onChange(v); setEditing(false); }}
      onKeyDown={e => { if (e.key === "Enter") { onChange(v); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
      style={{ background: C.goldLight, border: `1.5px solid ${C.gold}`, borderRadius: 6, color: C.goldText, padding: "4px 10px", width, fontSize: 13, fontFamily: C.sans, outline: "none", textAlign: align }}
    />
  );
  return <span onClick={() => { setV(value || ""); setEditing(true); }} title="Click to edit" style={{ cursor: "pointer", color: value ? C.text : C.textDim, fontSize: 13, borderBottom: `1.5px dashed ${C.borderDark}`, paddingBottom: 1 }}>{display}</span>;
}

function Row({ label, children, last, labelStyle }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: last ? "none" : `1px solid ${C.border}` }}>
      <span style={{ fontSize: 13, color: C.textMid, ...labelStyle }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}
function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: C.nav, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: C.sans }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: C.gold, letterSpacing: "0.1em", marginBottom: 10 }}>JMF</div>
      <div style={{ fontSize: 11, color: C.navText, letterSpacing: "0.06em" }}>Loading…</div>
    </div>
  );
}

// ─── CASH FLOW GRAPH ──────────────────────────────────────────────────────────
function CashFlowGraph({ data }) {
  const months  = monthsBetween(SYSTEM_START, currentYM());
  const values  = months.map(m => {
    const bizIn  = data.businesses.filter(b => b.type !== "nonprofit").reduce((s, b) => {
      const e = (b.monthlyProfits || []).find(p => p.month === m); return s + safe(e?.profit);
    }, 0);
    const rentIn = (data.rentPayments || []).map(normalizeRentPayment).filter(r => r.month === m).reduce((s, r) => s + safe(r.amount), 0);
    const indIn  = data.individuals.reduce((s, ind) => {
      const e = (ind.monthlyIncome || []).find(p => p.month === m); return s + safe(e?.income);
    }, 0);
    const other  = data.cashflow.income.reduce((s, i) => s + safe(i.amount), 0);
    const tIn    = bizIn + rentIn + indIn + other;
    const tOut   = data.cashflow.obligations.reduce((s, o) => s + safe(o.amount), 0);
    return { month: m, ncf: tIn - tOut, tIn, tOut };
  });
  const maxAbs   = Math.max(1, ...values.map(v => Math.abs(v.ncf)));
  const BAR_W    = Math.max(52, Math.min(90, Math.floor(560 / Math.max(1, months.length))));
  const MID_Y    = 72;
  const MAX_H    = 56;
  const SVG_H    = 150;
  const SVG_W    = Math.max(BAR_W * months.length, 260);
  return (
    <Card accent={C.gold} style={{ marginTop: 20, paddingTop: 24 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing:"0.1em", textTransform:"uppercase" }}>Cash Flow</div>
          <div style={{ fontSize: 13, color: C.textMid, marginTop: 2 }}>Monthly income vs. obligations · from April 2026</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize: 9, color: C.textDim, textTransform:"uppercase", letterSpacing:"0.08em" }}>Latest month</div>
          <div style={{ fontSize: 18, fontFamily: C.mono, fontWeight: 700, color: values[values.length-1]?.ncf >= 0 ? C.green : C.red }}>
            {values.length ? (values[values.length-1].ncf >= 0 ? "+" : "") + $K(values[values.length-1].ncf) : "—"}
          </div>
        </div>
      </div>
      <div style={{ overflowX: "auto", marginRight: -4 }}>
        <svg width={SVG_W} height={SVG_H} style={{ display:"block", overflow:"visible" }}>
          {/* zero line */}
          <line x1={0} y1={MID_Y} x2={SVG_W} y2={MID_Y} stroke={C.borderDark} strokeWidth={1} strokeDasharray="3 4" />
          {values.map((v, i) => {
            const hPx   = Math.max(3, (Math.abs(v.ncf) / maxAbs) * MAX_H);
            const isPos = v.ncf >= 0;
            const bY    = isPos ? MID_Y - hPx : MID_Y;
            const bX    = i * BAR_W + BAR_W * 0.12;
            const bW    = BAR_W * 0.76;
            return (
              <g key={v.month}>
                <rect x={bX} y={bY} width={bW} height={hPx} rx={4}
                  fill={isPos ? C.green : C.red} opacity={0.85} />
                <text x={i * BAR_W + BAR_W / 2} y={SVG_H - 4}
                  textAnchor="middle" fontSize={9} fill={C.textDim} fontFamily={C.sans}>
                  {monthLabel(v.month).split(" ")[0]}
                </text>
                {v.ncf !== 0 && (
                  <text x={i * BAR_W + BAR_W / 2} y={isPos ? bY - 5 : bY + hPx + 12}
                    textAnchor="middle" fontSize={9} fontWeight={700}
                    fill={isPos ? C.green : C.red} fontFamily={C.mono}>
                    {(v.ncf > 0 ? "+" : "") + $K(v.ncf)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {values.every(v => v.tIn === 0) && (
        <div style={{ textAlign:"center", fontSize: 12, color: C.textDim, marginTop: 8 }}>
          Log business profits, rent, and income to see your cash flow trend.
        </div>
      )}
    </Card>
  );
}

// ─── CASH MODAL ───────────────────────────────────────────────────────────────
function CashModal({ current, onSave, onClose }) {
  const [val, setVal] = useState(safe(current));
  const save = () => { onSave(safe(val)); onClose(); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 360, boxShadow: "0 8px 48px rgba(0,0,0,0.12)" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>Cash Vault</div>
        <div style={{ fontSize: 13, color: C.textDim, marginBottom: 20, lineHeight: 1.6 }}>
          Enter Ahmed's current physical cash. Updates net worth immediately.
        </div>
        <Label>Vault cash (CAD)</Label>
        <input type="number" value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") onClose(); }}
          autoFocus
          style={{ width: "100%", padding: "12px 14px", background: C.bg, border: `1.5px solid ${C.gold}`, borderRadius: 8, color: C.text, fontSize: 18, fontFamily: C.mono, outline: "none", boxSizing: "border-box", marginBottom: 20 }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={save} style={{ flex: 1, padding: "12px", background: C.gold, border: "none", borderRadius: 8, color: "#FFF", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Save</button>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.textMid, fontSize: 14, cursor: "pointer" }}>Cancel</button>
        </div>
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 14, textAlign: "center" }}>Last recorded: $34,770 (March 2026)</div>
      </div>
    </div>
  );
}

// ─── RENT LOG MODAL ───────────────────────────────────────────────────────────
function RentLogModal({ propertyName, unitLabel, lease, month, expected, creditApplied, current, onSave, onClose }) {
  const [received, setReceived] = useState(safe(current?.amount));
  const [note, setNote] = useState(current?.note || "");
  const [date, setDate] = useState(current?.date || `${month}-01`);
  const inp = { width:"100%", padding:"10px 12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:14, fontFamily:C.mono, outline:"none", boxSizing:"border-box", marginBottom:14 };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:28, width:"100%", maxWidth:360, boxShadow:"0 8px 48px rgba(0,0,0,0.14)" }}>
        <div style={{ fontSize:17, fontWeight:700, color:C.text, marginBottom:4 }}>Log Rent Payment</div>
        <div style={{ fontSize:13, color:C.textDim, marginBottom:8 }}>{propertyName} · {unitLabel} · {monthLabel(month)}</div>
        <div style={{ background:C.bg, borderRadius:10, padding:"10px 12px", marginBottom:18, fontSize:12, color:C.textMid, lineHeight:1.6 }}>
          <div>Tenant: <strong style={{ color:C.text }}>{lease?.tenant_full_name || "Tenant TBD"}</strong></div>
          <div>Rent due: <strong style={{ color:C.text }}>{$F(expected)}</strong></div>
          <div>Deposit credit applied: <strong style={{ color:creditApplied > 0 ? C.gold : C.textDim }}>{$F(creditApplied)}</strong></div>
        </div>
        <Label>Amount received (CAD)</Label>
        <input type="number" autoFocus value={received} onChange={e => setReceived(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { onSave(safe(received), note, date); onClose(); } if (e.key === "Escape") onClose(); }}
          style={inp} />
        <Label>Payment date</Label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, fontFamily:C.sans, fontSize:13 }} />
        <Label>Note (optional)</Label>
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. e-transfer received April 15"
          style={{ ...inp, fontFamily:C.sans, fontSize:13 }} />
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => { onSave(safe(received), note, date); onClose(); }}
            style={{ flex:1, padding:12, background:C.gold, border:"none", borderRadius:8, color:"#FFF", fontSize:14, fontWeight:700, cursor:"pointer" }}>Save</button>
          <button onClick={onClose}
            style={{ flex:1, padding:12, background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, color:C.textMid, fontSize:14, cursor:"pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── REMINDER MODAL ───────────────────────────────────────────────────────────
function ReminderModal({ missingRent, missingProfits, onSaveRent, onSaveProfit, onDismiss }) {
  const ym = currentYM();
  const [rentVals,   setRentVals]   = useState(() => Object.fromEntries(missingRent.map(p => [p.id, ""])));
  const [profitVals, setProfitVals] = useState(() => Object.fromEntries(missingProfits.map(b => [b.id, ""])));
  const [saving, setSaving]         = useState(false);

  if (missingRent.length === 0 && missingProfits.length === 0) return null;

  const handleSave = async () => {
    setSaving(true);
    missingRent.forEach(p => { if (rentVals[p.id] !== "") onSaveRent(p.id, safe(rentVals[p.id]), ""); });
    missingProfits.forEach(b => { if (profitVals[b.id] !== "") onSaveProfit(b.id, safe(profitVals[b.id])); });
    onDismiss();
  };

  const inp = {
    width: "100%", padding: "9px 12px", background: C.bg, border: `1.5px solid ${C.border}`,
    borderRadius: 8, color: C.text, fontSize: 14, fontFamily: C.mono, outline: "none",
    boxSizing: "border-box", transition: "border-color 0.15s",
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(7,15,30,0.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:20 }}>
      <div style={{ background:C.surface, borderRadius:20, width:"100%", maxWidth:460, boxShadow:"0 24px 80px rgba(0,0,0,0.28)", overflow:"hidden" }}>
        {/* Gold accent header */}
        <div style={{ background:`linear-gradient(135deg, ${C.nav} 0%, #1A2E52 100%)`, padding:"22px 28px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:C.gold, boxShadow:`0 0 8px ${C.gold}` }} />
            <div style={{ fontSize:11, fontWeight:700, color:C.gold, letterSpacing:"0.12em", textTransform:"uppercase" }}>Monthly Update Required</div>
          </div>
          <div style={{ fontSize:22, fontWeight:800, color:"#FFFFFF", letterSpacing:-0.5 }}>Please Update</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", marginTop:4 }}>
            {monthLabel(ym)} — {missingRent.length + missingProfits.length} item{missingRent.length + missingProfits.length > 1 ? "s" : ""} pending
          </div>
        </div>

        <div style={{ padding:"24px 28px 28px", maxHeight:"60vh", overflowY:"auto" }}>
          {/* Rent section */}
          {missingRent.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                <div style={{ width:3, height:14, background:C.gold, borderRadius:2 }} />
                <div style={{ fontSize:11, fontWeight:700, color:C.textMid, letterSpacing:"0.08em", textTransform:"uppercase" }}>Rent Collected</div>
              </div>
              {missingRent.map(p => (
                <div key={p.id} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{p.name}</span>
                    <span style={{ fontSize:11, color:C.textDim }}>Expected: {$F(propLedgerExpected(p))}/mo</span>
                  </div>
                  <input type="number" placeholder="Amount received (CAD)"
                    value={rentVals[p.id]} onChange={e => setRentVals(v => ({ ...v, [p.id]: e.target.value }))}
                    style={inp} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
              ))}
            </div>
          )}

          {/* Profit section */}
          {missingProfits.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                <div style={{ width:3, height:14, background:C.blue, borderRadius:2 }} />
                <div style={{ fontSize:11, fontWeight:700, color:C.textMid, letterSpacing:"0.08em", textTransform:"uppercase" }}>Net Profit — {monthLabel(ym)}</div>
              </div>
              {missingProfits.map(b => (
                <div key={b.id} style={{ marginBottom:12 }}>
                  <div style={{ marginBottom:5 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{b.name}</span>
                  </div>
                  <input type="number" placeholder="Net profit this month (CAD)"
                    value={profitVals[b.id]} onChange={e => setProfitVals(v => ({ ...v, [b.id]: e.target.value }))}
                    style={inp} onFocus={e => e.target.style.borderColor = C.blue} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
              ))}
            </div>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ flex:2, padding:"13px", background:`linear-gradient(135deg, #C8A235 0%, ${C.gold} 100%)`, border:"none", borderRadius:10, color:"#FFF", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:`0 4px 16px rgba(184,150,46,0.35)`, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Save & Close"}
            </button>
            <button onClick={onDismiss}
              style={{ flex:1, padding:"13px", background:"transparent", border:`1.5px solid ${C.border}`, borderRadius:10, color:C.textMid, fontSize:14, cursor:"pointer" }}>
              Dismiss
            </button>
          </div>
          <div style={{ fontSize:11, color:C.textDim, marginTop:12, textAlign:"center" }}>
            This prompt will reappear each session until all fields are filled.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ADD PERSONAL EXPENSE MODAL ───────────────────────────────────────────────
function AddPersonalExpenseModal({ userId, onSave, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate]                 = useState(today);
  const [amount, setAmount]             = useState("");
  const [category, setCategory]         = useState(PERSONAL_CATEGORIES[0]);
  const [subcategory, setSubcategory]   = useState("");
  const [description, setDescription]   = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Debit");
  const [saving, setSaving]             = useState(false);

  const inp = {
    width:"100%", padding:"9px 12px", background:C.bg, border:`1px solid ${C.border}`,
    borderRadius:8, color:C.text, fontSize:14, fontFamily:C.sans, outline:"none",
    boxSizing:"border-box", marginBottom:12,
  };

  const handleSave = async (andClose) => {
    if (!amount || safe(amount) === 0) return;
    setSaving(true);
    const result = await savePersonalExpense({
      user_id: userId, date, amount: safe(amount), category,
      subcategory: subcategory || null, description: description || null,
      payment_method: paymentMethod,
    });
    setSaving(false);
    if (result) onSave(result);
    if (andClose) { onClose(); return; }
    setAmount(""); setDescription(""); setSubcategory("");
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1200, padding:20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:18, padding:28, width:"100%", maxWidth:440, boxShadow:"0 12px 60px rgba(0,0,0,0.18)", maxHeight:"92vh", overflowY:"auto" }}>
        <div style={{ fontSize:17, fontWeight:700, color:C.text, marginBottom:20 }}>Add Expense</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:4 }}>
          <div>
            <Label>Date</Label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
          </div>
          <div>
            <Label>Amount (CAD)</Label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
              style={{ ...inp, fontFamily:C.mono }} autoFocus />
          </div>
        </div>
        <Label>Category</Label>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inp, cursor:"pointer" }}>
          {PERSONAL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <Label>Subcategory (optional)</Label>
        <input type="text" value={subcategory} onChange={e => setSubcategory(e.target.value)} placeholder="e.g. Groceries, Gas…" style={inp} />
        <Label>Description (optional)</Label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="What was this for?" style={inp} />
        <Label>Payment Method</Label>
        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ ...inp, cursor:"pointer" }}>
          {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
        </select>
        <div style={{ display:"flex", gap:8, marginTop:4, flexWrap:"wrap" }}>
          <button onClick={() => handleSave(true)} disabled={saving || !amount}
            style={{ flex:2, padding:12, background:C.gold, border:"none", borderRadius:8, color:"#FFF", fontSize:13, fontWeight:700, cursor:"pointer", opacity:(saving || !amount) ? 0.6 : 1, minWidth:110 }}>
            {saving ? "Saving…" : "Save & Close"}
          </button>
          <button onClick={() => handleSave(false)} disabled={saving || !amount}
            style={{ flex:2, padding:12, background:C.goldLight, border:`1px solid ${C.gold}`, borderRadius:8, color:C.goldText, fontSize:13, fontWeight:600, cursor:"pointer", opacity:(saving || !amount) ? 0.6 : 1, minWidth:130 }}>
            Save & Add Another
          </button>
          <button onClick={onClose}
            style={{ flex:1, padding:12, background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, color:C.textMid, fontSize:13, cursor:"pointer", minWidth:70 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SUBMISSION MODAL ─────────────────────────────────────────────────────────
function SubmissionModal({ currentData, periodLabel, onSubmit, onClose }) {
  const [fields, setFields] = useState({
    accounts:       safe(currentData?.accounts),
    cash:           safe(currentData?.cash),
    securities:     safe(currentData?.securities),
    crypto:         safe(currentData?.crypto),
    physicalAssets: safe(currentData?.physicalAssets),
  });
  const [submitting, setSubmitting] = useState(false);
  const set = (k, v) => setFields(f => ({ ...f, [k]: safe(v) }));

  const rows = [
    { key: "accounts",       label: "Bank Accounts",  desc: "Net account balance" },
    { key: "cash",           label: "Cash (Vault)",   desc: "Physical cash" },
    { key: "securities",     label: "Securities",     desc: "TFSA, investments, mutual funds" },
    { key: "crypto",         label: "Crypto",         desc: "Market value" },
    { key: "physicalAssets", label: "Physical Assets",desc: "Gold, silver, etc." },
  ];

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit(fields);
    setSubmitting(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 8px 48px rgba(0,0,0,0.14)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>Monthly Update Required</div>
        <div style={{ fontSize: 13, color: C.textDim, marginBottom: 24, lineHeight: 1.6 }}>
          Submit your financial snapshot for <strong style={{ color: C.text }}>{periodLabel}</strong>. Ahmed will review and approve.
        </div>
        {rows.map(r => (
          <div key={r.key} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <Label>{r.label}</Label>
              <span style={{ fontSize: 10, color: C.textDim }}>{r.desc}</span>
            </div>
            <input type="number" value={fields[r.key]} onChange={e => set(r.key, e.target.value)}
              style={{ width: "100%", padding: "9px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 14, fontFamily: C.mono, color: C.text, outline: "none", boxSizing: "border-box" }}
            />
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ flex: 2, padding: "12px", background: C.gold, border: "none", borderRadius: 8, color: "#FFF", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Submitting…" : "Submit"}
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.textMid, fontSize: 13, cursor: "pointer" }}>
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── APPROVAL QUEUE ───────────────────────────────────────────────────────────
// profiles: array of public.profiles rows for mapping user_id → display info
// individuals: current dashboard individuals array for showing "previous" values
function ApprovalQueue({ pendingSubs, profiles, individuals, onApprove, onReject }) {
  const [notes, setNotes] = useState({});
  if (!pendingSubs.length) return null;

  return (
    <Card style={{ marginBottom: 16, border: `1.5px solid ${C.amber}` }}>
      <Label color={C.amber}>Pending Submissions — {pendingSubs.length} awaiting review</Label>
      {pendingSubs.map((sub, si) => {
        const profile = profiles.find(p => p.id === sub.user_id);
        const current = individuals.find(x => x.id === profile?.individual_id);
        const d = sub.data || {};
        const periodLabel = sub.period
          ? new Date(sub.period + "T12:00:00").toLocaleDateString("en-CA", { month: "long", year: "numeric" })
          : "Unknown period";

        return (
          <div key={sub.id} style={{ borderTop: si > 0 ? `1px solid ${C.border}` : "none", paddingTop: si > 0 ? 16 : 0, marginTop: si > 0 ? 16 : 0 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {profile?.display_name || "Unknown member"}
              </div>
              <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                {periodLabel} · submitted {new Date(sub.submitted_at).toLocaleDateString()}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8, marginBottom: 12 }}>
              {[
                { label: "Accounts",     nv: d.accounts,       ov: current?.accounts },
                { label: "Cash",         nv: d.cash,           ov: current?.cash },
                { label: "Securities",   nv: d.securities,     ov: current?.securities },
                { label: "Crypto",       nv: d.crypto,         ov: current?.crypto },
                { label: "Phys. Assets", nv: d.physicalAssets, ov: current?.physicalAssets },
              ].map(f => (
                <div key={f.label} style={{ background: C.bg, borderRadius: 6, padding: "6px 10px" }}>
                  <div style={{ color: C.textDim, fontSize: 10, marginBottom: 3 }}>{f.label}</div>
                  <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: C.mono, color: C.textMid, fontSize: 11 }}>{$K(f.ov)}</span>
                    <span style={{ color: C.textDim, fontSize: 10 }}>→</span>
                    <span style={{ fontFamily: C.mono, fontWeight: 700, color: safe(f.nv) !== safe(f.ov) ? C.gold : C.text, fontSize: 11 }}>{$K(f.nv)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => onApprove(sub)}
                style={{ padding: "8px 20px", background: C.green, border: "none", borderRadius: 7, color: "#FFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Approve
              </button>
              <input
                placeholder="Rejection note (optional)"
                value={notes[sub.id] || ""}
                onChange={e => setNotes(n => ({ ...n, [sub.id]: e.target.value }))}
                style={{ flex: 1, minWidth: 140, padding: "8px 10px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, outline: "none", fontFamily: C.sans }}
              />
              <button onClick={() => onReject(sub.id, notes[sub.id] || "")}
                style={{ padding: "8px 16px", background: C.redLight, border: `1px solid #F5C6C3`, borderRadius: 7, color: C.redText, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true); setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setError(authError.message || "Invalid email or password.");
      setLoading(false);
    }
    // On success, onAuthStateChange in App root fires automatically — no manual setCurrentUser needed
  };

  const inp = {
    width: "100%", padding: "11px 14px", background: C.bg,
    border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
    fontSize: 14, fontFamily: C.sans, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: C.sans, padding: 20 }}>
      <div style={{ marginBottom: 36, textAlign: "center" }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: C.gold, letterSpacing: "0.08em" }}>JMF</div>
        <div style={{ fontSize: 12, color: C.textMid, marginTop: 6, letterSpacing: "0.04em" }}>Jebrayilli Majidov Family</div>
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>Family Office · Private & Confidential</div>
      </div>

      <div style={{ width: "100%", maxWidth: 360, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>Sign in</div>
        <div style={{ fontSize: 13, color: C.textDim, marginBottom: 22 }}>Private access only.</div>

        <div style={{ marginBottom: 14 }}>
          <Label>Email</Label>
          <input type="email" placeholder="you@example.com" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") login(); }}
            style={inp} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <Label>Password</Label>
          <input type="password" placeholder="••••••••" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") login(); }}
            style={inp} />
        </div>

        {error && (
          <div style={{ background: C.redLight, border: "1px solid #F5C6C3", borderRadius: 7, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.redText }}>
            {error}
          </div>
        )}

        <button onClick={login} disabled={loading}
          style={{ width: "100%", padding: "12px", background: C.gold, border: "none", borderRadius: 8, color: "#FFF", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.textDim, lineHeight: 1.8 }}>
          <div><strong style={{ color: C.textMid }}>Admin</strong> — full dashboard access</div>
          <div><strong style={{ color: C.textMid }}>Members</strong> — view & submit own data</div>
        </div>
      </div>
    </div>
  );
}

// ─── MEMBER VIEW ──────────────────────────────────────────────────────────────
// user.id = auth UUID  |  user.profile.individual_id = individuals[].id
function MemberView({ user, data, onUpdate, onSaveIncome, onLogout }) {
  const [saved, setSaved]               = useState(false);
  const [cashModal, setCashModal]       = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [currentSub, setCurrentSub]     = useState(undefined); // undefined=loading
  const [missingPeriod, setMissingPeriod] = useState(null);   // { period_date, label }
  const [memberTab, setMemberTab]       = useState("snapshot");

  const individualId = user.profile?.individual_id;
  const isAhmed      = individualId === 1;

  // All hooks run unconditionally before any early return
  useEffect(() => {
    async function checkPeriods() {
      const [periods, userSubs] = await Promise.all([
        fetchReportingPeriods(),
        getSubmissionsForUser(user.id),
      ]);

      // Find the most recent period with no pending/approved submission
      const missing = periods.find(p => {
        const sub = userSubs.find(s => s.period === p.period_date);
        return !sub || sub.status === "rejected";
      });

      if (missing) {
        setMissingPeriod(missing);
        // Find the existing submission for this period if it was rejected
        const existingSub = userSubs.find(s => s.period === missing.period_date) || null;
        setCurrentSub(existingSub);
        setShowSubModal(true);
      } else {
        // No missing — show latest submission status
        const latest = userSubs[0] || null;
        setCurrentSub(latest);
        setShowSubModal(false);
      }
    }
    checkPeriods();
  }, [user.id]);

  const f = data.individuals.find(x => x.id === individualId);
  if (!f) return <LoadingScreen />;

  const net        = safe(f.cash) + safe(f.accounts) + safe(f.securities) + safe(f.crypto) + safe(f.physicalAssets);
  const isPositive = net >= 0;
  const cashStale  = isAhmed && safe(f.cash) === 0;

  const handleUpdate = (id, field, val) => {
    onUpdate(id, field, val);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSubmit = async (fields) => {
    if (!missingPeriod) return;
    const ok = await createSubmission(user.id, missingPeriod.period_date, fields);
    if (ok) {
      setCurrentSub({ status: "pending", data: fields, period: missingPeriod.period_date });
      setShowSubModal(false);
    }
  };

  const subStatusBadge = () => {
    if (currentSub === undefined) return null;
    if (!currentSub && missingPeriod) return (
      <button onClick={() => setShowSubModal(true)}
        style={{ fontSize: 11, color: C.amber, background: C.amberLight, border: `1px solid #F0D080`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>
        {missingPeriod.label || "Monthly update"} required
      </button>
    );
    if (currentSub?.status === "pending")  return <span style={{ fontSize: 11, color: C.blue,  background: C.blueLight,  borderRadius: 6, padding: "4px 10px" }}>Awaiting review</span>;
    if (currentSub?.status === "approved") return <span style={{ fontSize: 11, color: C.green, background: C.greenLight, borderRadius: 6, padding: "4px 10px" }}>✓ Approved</span>;
    if (currentSub?.status === "rejected") return (
      <button onClick={() => setShowSubModal(true)}
        style={{ fontSize: 11, color: C.red, background: C.redLight, border: `1px solid #F5C6C3`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>
        Rejected — resubmit
      </button>
    );
    return null;
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: C.sans }}>
      {showSubModal && missingPeriod && (
        <SubmissionModal
          currentData={f}
          periodLabel={missingPeriod.label || missingPeriod.period_date}
          onSubmit={handleSubmit}
          onClose={() => setShowSubModal(false)}
        />
      )}
      {cashModal && (
        <CashModal
          current={safe(f.cash)}
          onSave={v => handleUpdate(f.id, "cash", v)}
          onClose={() => setCashModal(false)}
        />
      )}

      {/* Nav */}
      <div style={{ background: C.nav, borderBottom: `1px solid ${C.navBorder}`, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:C.gold }} />
            <span style={{ fontSize: 15, fontWeight: 800, color: C.gold, letterSpacing:"0.08em", flexShrink: 0 }}>JMF</span>
          </div>
          <span style={{ fontSize: 12, color: C.navText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
          {saved && <span style={{ fontSize: 10, color: "#FFF", background: C.green, borderRadius: 4, padding: "2px 8px", flexShrink: 0 }}>✓ SAVED</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {subStatusBadge()}
          {cashStale && (
            <button onClick={() => setCashModal(true)}
              style={{ fontSize: 11, color: C.amber, background: "rgba(183,119,13,0.15)", border: `1px solid rgba(183,119,13,0.3)`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>
              Cash not updated
            </button>
          )}
          <button onClick={onLogout}
            style={{ background: "transparent", border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 6, color: C.navText, fontSize: 11, padding: "4px 12px", cursor: "pointer" }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Member tab bar */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display:"flex", padding:"0 16px" }}>
          {[["snapshot","My Snapshot"],["expenses","My Expenses"],["history","My History"]].map(([id, label]) => (
            <button key={id} onClick={() => setMemberTab(id)}
              style={{ padding:"11px 16px", fontSize:12, fontWeight:600, border:"none", cursor:"pointer", background:"transparent", fontFamily:C.sans,
                color: memberTab === id ? C.gold : C.textDim,
                borderBottom: memberTab === id ? `2px solid ${C.gold}` : "2px solid transparent" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* My Expenses tab */}
      {memberTab === "expenses" && (
        <div style={{ padding: 20, maxWidth: 540, margin: "0 auto" }}>
          <ExpensesTab userId={user.id} isAdmin={false} allProfiles={[]} individuals={data.individuals} />
        </div>
      )}

      {/* My History tab */}
      {memberTab === "history" && (
        <div style={{ padding: 20, maxWidth: 540, margin: "0 auto" }}>
          {(() => {
            const myLog = [...(f.accountsLog || [])].reverse();
            const snapshots = [...(data.snapshots || [])].reverse();
            return (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Accounts Log</div>
                <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>Historical account balance entries logged by admin.</div>
                {myLog.length === 0
                  ? <div style={{ fontSize: 12, color: C.textDim, fontStyle: "italic", marginBottom: 24 }}>No entries yet.</div>
                  : myLog.map((e, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                      <div>
                        <span style={{ color: C.textMid, fontWeight: 600 }}>{monthLabel(e.month)}</span>
                        {e.note && <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{e.note}</div>}
                        {e.timestamp && <div style={{ fontSize: 10, color: C.textDim, marginTop: 1 }}>{new Date(e.timestamp).toLocaleDateString()}</div>}
                      </div>
                      <span style={{ fontFamily: C.mono, color: e.value >= 0 ? C.green : C.red, fontWeight: 700 }}>{$F(e.value)}</span>
                    </div>
                  ))
                }
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginTop: 28, marginBottom: 4 }}>JMF Snapshots</div>
                <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>Portfolio-wide net worth snapshots.</div>
                {snapshots.length === 0
                  ? <div style={{ fontSize: 12, color: C.textDim, fontStyle: "italic" }}>No snapshots captured yet.</div>
                  : snapshots.map((s, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{monthLabel(s.month)}</div>
                        <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{new Date(s.capturedAt).toLocaleDateString()}{s.note ? ` · ${s.note}` : ""}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: C.mono, fontSize: 17, fontWeight: 800, color: s.nw >= 0 ? C.gold : C.red }}>{$F(s.nw)}</div>
                        <div style={{ fontSize: 10, color: C.textDim }}>Net Worth</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            );
          })()}
        </div>
      )}

      {/* Content */}
      {memberTab === "snapshot" && (
      <div style={{ padding: 20, maxWidth: 540, margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
          <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8 }}>Net Worth</div>
          <div style={{ fontSize: 48, fontWeight: 800, fontFamily: C.mono, color: isPositive ? C.gold : C.red, letterSpacing: -1 }}>{$F(net)}</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 6 }}>{data.lastUpdated}</div>
        </div>

        {/* Submission status banner */}
        {currentSub?.status && (
          <div style={{
            background: currentSub.status === "approved" ? C.greenLight : currentSub.status === "rejected" ? C.redLight : C.blueLight,
            border: `1px solid ${currentSub.status === "approved" ? "#A8D8B8" : currentSub.status === "rejected" ? "#F5C6C3" : "#A8C4E0"}`,
            borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: C.textMid, lineHeight: 1.6,
          }}>
            <strong style={{ color: C.text }}>
              {missingPeriod?.label || (currentSub.period ? new Date(currentSub.period + "T12:00:00").toLocaleDateString("en-CA", { month: "long", year: "numeric" }) : "")} submission
            </strong>
            {" — "}
            {currentSub.status === "pending"  && "Awaiting admin review."}
            {currentSub.status === "approved" && "✓ Approved and applied to the dashboard."}
            {currentSub.status === "rejected" && `Rejected. ${currentSub.admin_note || "Please resubmit."}`}
          </div>
        )}

        {/* Editable snapshot */}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{f.name}</div>
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>Click any value to update — saves automatically</div>
          {[
            { l: "Accounts",        fi: "accounts",       desc: "Net bank balance" },
            { l: "Cash (vault)",    fi: "cash",           desc: "Physical cash" },
            { l: "Securities",      fi: "securities",     desc: "TFSA, investments, mutual funds" },
            { l: "Crypto",          fi: "crypto",         desc: "Market value" },
            { l: "Physical Assets", fi: "physicalAssets", desc: "Gold, silver, etc." },
          ].map((row, i, arr) => (
            <div key={row.fi} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{row.l}</div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 1 }}>{row.desc}</div>
              </div>
              <EditNum value={safe(f[row.fi])} onChange={v => handleUpdate(f.id, row.fi, v)} />
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, marginTop: 4, borderTop: `2px solid ${C.border}` }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.textMid }}>Net Worth</span>
            <span style={{ fontSize: 22, fontFamily: C.mono, fontWeight: 800, color: isPositive ? C.gold : C.red }}>{$F(net)}</span>
          </div>
        </Card>

        {/* Monthly Income submission */}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <div style={{ fontSize:14, fontWeight:600, color:C.text }}>Monthly Income</div>
            <span style={{ fontSize:10, color:C.textDim }}>{monthLabel(currentYM())}</span>
          </div>
          <div style={{ fontSize:12, color:C.textDim, marginBottom:16 }}>
            Enter your total personal income for this month — salary, distributions, etc. This is reported to admin.
          </div>
          {(() => {
            const entry = (f.monthlyIncome || []).find(p => p.month === currentYM());
            const income = safe(entry?.income);
            return (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                <span style={{ fontSize:13, color:C.text }}>Income this month</span>
                <EditNum value={income} onChange={v => {
                  const ym = currentYM();
                  if (onSaveIncome) onSaveIncome(f.id, ym, safe(v));
                }} />
              </div>
            );
          })()}
        </Card>

        <Card>
          <Label>JMF Group — Summary</Label>
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>Contact Ahmed for full details.</div>
          <Row label="Properties"        last={false}><span style={{ color: C.text, fontFamily: C.mono }}>{data.properties.length} holdings</span></Row>
          <Row label="Business entities" last={true}><span style={{ color: C.text, fontFamily: C.mono }}>{data.businesses.length} companies</span></Row>
        </Card>
      </div>
      )}
    </div>
  );
}

function LeaseEditorModal({ propertyName, unit, onSave, onClose }) {
  const existing = unit?.lease ? makeLease(unit.lease) : makeLease({ unit_label: unit?.label || "", lease_status: "active" });
  const [tenantFullName, setTenantFullName] = useState(existing.tenant_full_name);
  const [phoneNumber, setPhoneNumber] = useState(existing.phone_number);
  const [email, setEmail] = useState(existing.email);
  const [leaseStartDate, setLeaseStartDate] = useState(existing.lease_start_date);
  const [leaseEndDate, setLeaseEndDate] = useState(existing.lease_end_date);
  const [monthlyRent, setMonthlyRent] = useState(safe(existing.monthly_rent));
  const [depositReceived, setDepositReceived] = useState(safe(existing.deposit_received));
  const [depositDate, setDepositDate] = useState(existing.deposit_date);
  const [paymentFrequency, setPaymentFrequency] = useState(existing.payment_frequency || "monthly");
  const [leaseNotes, setLeaseNotes] = useState(existing.lease_notes);
  const [leaseStatus, setLeaseStatus] = useState(existing.lease_status || "active");
  const inp = { width:"100%", padding:"10px 12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, color:C.text, fontSize:13, fontFamily:C.sans, outline:"none", boxSizing:"border-box" };

  const save = () => {
    const nextLease = leaseStatus === "vacant" ? null : makeLease({
      ...existing,
      tenant_full_name: tenantFullName,
      phone_number: phoneNumber,
      email,
      unit_label: unit.label,
      lease_start_date: leaseStartDate,
      lease_end_date: leaseEndDate,
      lease_term_months: monthsInLeaseWindow(leaseStartDate, leaseEndDate),
      monthly_rent: safe(monthlyRent),
      deposit_received: safe(depositReceived),
      deposit_date: depositDate,
      payment_frequency: paymentFrequency,
      lease_notes: leaseNotes,
      lease_status: leaseStatus,
    });
    onSave({
      ...unit,
      status: leaseStatus === "vacant" ? "vacant" : leaseStatus,
      market_rent: safe(monthlyRent),
      lease: nextLease,
    });
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(7,15,30,0.42)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1300, padding:20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:20, padding:28, width:"100%", maxWidth:700, boxShadow:"0 18px 60px rgba(11,24,41,0.18)", maxHeight:"92vh", overflowY:"auto" }}>
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase" }}>{propertyName}</div>
          <div style={{ fontSize:22, fontWeight:700, color:C.text, marginTop:4 }}>{unit.label} Lease</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:14 }}>
          <div>
            <Label>Tenant Full Name</Label>
            <input value={tenantFullName} onChange={e => setTenantFullName(e.target.value)} style={inp} />
          </div>
          <div>
            <Label>Phone Number</Label>
            <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} style={inp} />
          </div>
          <div>
            <Label>Email</Label>
            <input value={email} onChange={e => setEmail(e.target.value)} style={inp} />
          </div>
          <div>
            <Label>Unit / Level</Label>
            <input value={unit.label} disabled style={{ ...inp, color:C.textMid }} />
          </div>
          <div>
            <Label>Lease Start Date</Label>
            <input type="date" value={leaseStartDate} onChange={e => setLeaseStartDate(e.target.value)} style={inp} />
          </div>
          <div>
            <Label>Lease End Date</Label>
            <input type="date" value={leaseEndDate} onChange={e => setLeaseEndDate(e.target.value)} style={inp} />
          </div>
          <div>
            <Label>Monthly Rent</Label>
            <input type="number" value={monthlyRent} onChange={e => setMonthlyRent(e.target.value)} style={{ ...inp, fontFamily:C.mono }} />
          </div>
          <div>
            <Label>Deposit Received</Label>
            <input type="number" value={depositReceived} onChange={e => setDepositReceived(e.target.value)} style={{ ...inp, fontFamily:C.mono }} />
          </div>
          <div>
            <Label>Deposit Date</Label>
            <input type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)} style={inp} />
          </div>
          <div>
            <Label>Payment Frequency</Label>
            <select value={paymentFrequency} onChange={e => setPaymentFrequency(e.target.value)} style={{ ...inp, cursor:"pointer" }}>
              {["monthly", "bi-weekly", "weekly", "quarterly"].map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <Label>Lease Status</Label>
            <select value={leaseStatus} onChange={e => setLeaseStatus(e.target.value)} style={{ ...inp, cursor:"pointer" }}>
              <option value="active">Active</option>
              <option value="signed_pending">Signed / Pending</option>
              <option value="expired">Expired</option>
              <option value="vacant">Vacant</option>
            </select>
          </div>
          <div style={{ gridColumn:"1 / -1" }}>
            <Label>Lease Notes / Terms</Label>
            <textarea value={leaseNotes} onChange={e => setLeaseNotes(e.target.value)} rows={4}
              style={{ ...inp, resize:"vertical", minHeight:100 }} />
          </div>
        </div>
        <div style={{ display:"flex", gap:10, marginTop:22 }}>
          <button onClick={save} style={{ flex:1, padding:"12px 16px", background:C.gold, border:"none", borderRadius:10, color:"#FFF", fontSize:14, fontWeight:700, cursor:"pointer" }}>Save Tenant & Lease</button>
          <button onClick={onClose} style={{ flex:1, padding:"12px 16px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:10, color:C.textMid, fontSize:14, cursor:"pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function PropCard({ prop, rentPayments, onUpdate, onPatch, onSaveRentPayment, isAdmin }) {
  const [open, setOpen] = useState(false);
  const [propTab, setPropTab] = useState("overview");
  const [taxNoteOpen, setTaxNoteOpen] = useState(false);
  const [valFormOpen, setValFormOpen] = useState(false);
  const [valForm, setValForm] = useState({ date:"", value:"", note:"" });
  const [editingUnit, setEditingUnit] = useState(null);
  const [loggingRent, setLoggingRent] = useState(null);
  const [scheduleRows, setScheduleRows] = useState(12);

  const mortgage = calculateMortgageSnapshot(prop, currentYM());
  const market = safe(prop.market);
  const balance = mortgage.displayedBalance;
  const rawEquity = market - balance;
  const realtorFee = market * 0.035;
  const sellingCosts = realtorFee + (realtorFee * 0.13) + 5000;
  const liquidValue = rawEquity - sellingCosts;
  const netEquity = liquidValue; // kept for existing "Est. net if sold" row
  const ltv = balance > 0 && market > 0 ? (balance / market * 100) : 0;
  const units = getPropertyUnits(prop);
  const occupancyStatus = propertyOccupancyStatus(prop);
  const effectiveRent = propEffectiveRent(prop);
  const operatingMortgagePayment = getMortgageOperatingPayment(prop);
  const operatingMortgageLabel = hasSeparateMortgageTax(prop) ? "Mortgage payment (P&I)" : "Mortgage payment";
  const totalOut = propMonthlyOut(prop);
  const monthlyNCF = effectiveRent - totalOut;
  const ownership = propOwnership(prop);
  const jmfEquity = propJMFEquity(prop);
  const isPartial = ownership < 0.9999;
  const displayEquity = isPartial ? jmfEquity : rawEquity;
  const displayEqColor = displayEquity > 500000 ? C.gold : displayEquity > 0 ? C.amber : C.red;
  const jmfLiquid = liquidValue * ownership;
  const displayLiquid = isPartial ? jmfLiquid : liquidValue;
  const displayLiquidColor = displayLiquid > 0 ? C.green : C.red;
  const ledgers = propertyLeaseLedgers(prop, rentPayments);
  const nextExpected = propertyExpectedRentForMonth(prop, currentYM());
  const collectedThisMonth = propertyCollectedRentForMonth(prop, rentPayments, currentYM());
  const collectedTotal = propertyCollectedRentTotal(prop, rentPayments);

  // Build amortization schedule for Payment Schedule tab
  const curYM = currentYM();
  const scheduleMonths = monthsBetween(curYM, (() => {
    const [y, m] = curYM.split("-").map(Number);
    const endM = m - 1 + 120;
    return `${y + Math.floor(endM / 12)}-${String((endM % 12) + 1).padStart(2, "0")}`;
  })());
  const scheduleData = scheduleMonths.map(ym => {
    const snap = calculateMortgageSnapshot(prop, ym);
    return { ym, balance: snap.displayedBalance, interest: snap.currentInterest, principal: snap.currentPrincipal, payment: snap.monthlyPI };
  });
  const piPayment = mortgage.monthlyPI;
  const totalInterest = piPayment > 0 ? mortgage.currentInterest : 0;
  const totalPrincipal = piPayment > 0 ? mortgage.currentPrincipal : 0;
  const interestPct = piPayment > 0 ? Math.round((totalInterest / piPayment) * 100) : 0;
  const rateSavings = balance > 0 ? balance * 0.0025 / 12 : 0;

  // Balance curve: sample every 12 months for the polyline
  const curvePoints = scheduleData.filter((_, i) => i % 12 === 0);
  const maxBal = Math.max(1, ...curvePoints.map(d => d.balance));
  const CURVE_W = 560;
  const CURVE_H = 120;
  const CURVE_PAD_L = 52;
  const CURVE_PAD_B = 28;
  const plotW = CURVE_W - CURVE_PAD_L - 8;
  const plotH = CURVE_H - CURVE_PAD_B - 8;
  const toX = (i) => CURVE_PAD_L + (i / Math.max(1, curvePoints.length - 1)) * plotW;
  const toY = (bal) => 8 + plotH - (bal / maxBal) * plotH;
  const polylinePoints = curvePoints.map((d, i) => `${toX(i)},${toY(d.balance)}`).join(" ");
  const fillPoints = curvePoints.length > 1
    ? `${toX(0)},${toY(0)} ${polylinePoints} ${toX(curvePoints.length - 1)},${toY(0)}`
    : "";

  function updateUnits(nextUnits) {
    const normalized = nextUnits.map(makeUnit);
    const nextProp = { ...prop, units: normalized };
    onPatch({
      units: normalized,
      occupancy_status: propertyOccupancyStatus(nextProp),
      tenant_summary: buildTenantSummary(normalized),
      rentalIncome: propEffectiveRent(nextProp),
    });
  }

  function saveUnit(unit) {
    updateUnits(units.map(item => item.id === unit.id ? makeUnit(unit) : item));
  }

  const tabStyle = (id) => ({
    padding: "11px 18px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
    background: "transparent", fontFamily: C.sans, whiteSpace: "nowrap",
    color: propTab === id ? C.gold : C.textDim,
    borderBottom: propTab === id ? `2px solid ${C.gold}` : "2px solid transparent",
  });

  return (
    <div style={{ background:C.card, border:`1px solid ${open ? C.gold : C.border}`, borderRadius:18, overflow:"hidden", marginBottom:16, boxShadow: open ? C.shadowMd : C.shadow, transition:"border-color 0.18s, box-shadow 0.18s", fontFamily:C.sans }}>
      {editingUnit && <LeaseEditorModal propertyName={prop.name} unit={editingUnit} onSave={saveUnit} onClose={() => setEditingUnit(null)} />}
      {loggingRent && (
        <RentLogModal
          propertyName={prop.name}
          unitLabel={loggingRent.unit.label}
          lease={loggingRent.ledger.lease}
          month={loggingRent.month}
          expected={loggingRent.row.amount}
          creditApplied={loggingRent.row.creditApplied}
          current={loggingRent.current}
          onSave={(amount, note, date) => {
            onSaveRentPayment({
              propertyId: prop.id,
              unitId: loggingRent.unit.id,
              leaseId: loggingRent.ledger.lease.id,
              month: loggingRent.month,
              amount,
              note,
              date,
            });
          }}
          onClose={() => setLoggingRent(null)}
        />
      )}

      {/* Card header — click to open/close */}
      <div onClick={() => { setOpen(o => { if (o) setPropTab("overview"); return !o; }); }} style={{ padding:"18px 22px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", gap:14 }}>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:8 }}>
            <StatusPill status={prop.status} />
            <OccupancyBadge status={occupancyStatus} />
            {isPartial && <span style={{ background:C.purpleLight, color:C.purpleText, borderRadius:20, fontSize:10, fontWeight:700, padding:"3px 10px" }}>JMF {Math.round(ownership * 100)}%</span>}
          </div>
          <div style={{ fontSize:21, fontWeight:700, color:C.text, letterSpacing:-0.4 }}>{prop.name}</div>
          <div style={{ fontSize:12, color:C.textDim, marginTop:4 }}>{prop.lender} · {prop.rate}{isPartial ? ` · ${prop.co_owner}` : ""}</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4, minmax(84px, 1fr))", gap:10, minWidth:360 }}>
          {[
            { label:"Market",                              value:$K(market),        color:C.text              },
            { label:"Debt",                                value:$K(balance),       color:C.red               },
            { label:isPartial ? "JMF Equity" : "Equity",  value:$K(displayEquity), color:displayEqColor      },
            { label:isPartial ? "JMF Liquid" : "Liquid",  value:$K(displayLiquid), color:displayLiquidColor  },
          ].map(item => (
            <div key={item.label} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:12, padding:"10px 12px", textAlign:"right" }}>
              <div style={{ fontSize:9, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>{item.label}</div>
              <div style={{ fontSize:16, fontFamily:C.mono, fontWeight:700, color:item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {open && (
        <div style={{ borderTop:`1px solid ${C.border}` }}>

          {/* Tab bar */}
          <div style={{ background:C.bg, borderBottom:`1px solid ${C.border}`, overflowX:"auto" }}>
            <div style={{ display:"flex" }}>
              {[["overview","Overview"],["schedule","Payment Schedule"],["tenants","Tenants & Rent"],["valuation","Valuation"]].map(([id, label]) => (
                <button key={id} onClick={e => { e.stopPropagation(); setPropTab(id); }} style={tabStyle(id)}>{label}</button>
              ))}
            </div>
          </div>

          {/* ── TAB 1: OVERVIEW ── */}
          {propTab === "overview" && (
            <div>
              <div style={{ padding:"22px" }}>
                <Label>Property Overview</Label>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))", gap:12, marginTop:12 }}>
                  {[
                    { label:"Purchase", value:$F(prop.purchase), color:C.text },
                    { label:"Market Value", value:$F(market), color:C.text },
                    { label:"Current Debt", value:$F(balance), color:C.red },
                    { label:"Gross Equity", value:$F(rawEquity), color:rawEquity >= 0 ? C.gold : C.red },
                    { label:"Expected Rent", value:$F(nextExpected || effectiveRent), color:C.green },
                    { label:"Monthly Cash Flow", value:`${monthlyNCF >= 0 ? "+" : ""}${$F(monthlyNCF)}`, color:monthlyNCF >= 0 ? C.green : C.red },
                  ].map(item => (
                    <div key={item.label} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:"14px 16px" }}>
                      <div style={{ fontSize:9, color:C.textDim, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{item.label}</div>
                      <div style={{ fontSize:18, fontFamily:C.mono, fontWeight:700, color:item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:18, marginTop:18 }}>
                  <div>
                    <Row label="Occupancy"><span style={{ fontSize:13, color:C.text }}>{units.length ? `${units.filter(u => getActiveLease(u)).length}/${units.length} units with leases` : "No tracked units"}</span></Row>
                    <Row label="Tenant Summary"><span style={{ fontSize:13, color: prop.tenant_summary ? C.text : C.textDim, textAlign:"right" }}>{prop.tenant_summary || "No active tenants yet"}</span></Row>
                    <Row label="Est. net if sold" last><span style={{ fontFamily:C.mono, color:netEquity >= 0 ? C.green : C.red }}>{$F(netEquity)}</span></Row>
                  </div>
                  <div>
                    <Row label="LTV"><span style={{ color: ltv > 80 ? C.red : ltv > 65 ? C.amber : C.green, fontFamily:C.mono, fontWeight:700 }}>{ltv.toFixed(1)}%</span></Row>
                    {prop.co_owner && <Row label="Co-owner"><span style={{ fontSize:13, color:C.text }}>{prop.co_owner}</span></Row>}
                    <Row label="Notes" last><span style={{ fontSize:13, color: prop.notes ? C.textMid : C.textDim, textAlign:"right" }}>{prop.notes || "—"}</span></Row>
                  </div>
                </div>
              </div>

              <div style={{ padding:"22px", borderTop:`1px solid ${C.border}` }}>
                <Label>Mortgage</Label>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:20, marginTop:12 }}>
                  <div>
                    <Row label="Lender"><span style={{ fontSize:13, color:C.text }}>{prop.lender}</span></Row>
                    <Row label="Rate"><span style={{ fontFamily:C.mono, color:C.amber }}>{prop.rate}</span></Row>
                    <Row label="Payment structure" last>
                      {isAdmin ? (
                        <select value={prop.payment_structure || "amortizing"} onChange={e => onUpdate("payment_structure", e.target.value)}
                          style={{ padding:"6px 10px", border:`1px solid ${C.border}`, borderRadius:8, background:C.surface, color:C.text, fontSize:12, fontFamily:C.sans }}>
                          <option value="amortizing">Amortizing</option>
                          <option value="interest_only">Interest only</option>
                        </select>
                      ) : (
                        <span style={{ fontSize:13, color:C.text }}>{mortgage.paymentStructure}</span>
                      )}
                    </Row>
                  </div>
                  <div>
                    <Row label="Maturity Date">
                      <EditText
                        value={prop.maturity || ""}
                        onChange={v => onUpdate("maturity", v)}
                        locked={!isAdmin}
                        placeholder="e.g. Apr 1, 2027"
                        width={150}
                      />
                    </Row>
                    <Row label="Term" last>
                      <EditText
                        value={prop.rateType || ""}
                        onChange={v => onUpdate("rateType", v)}
                        locked={!isAdmin}
                        placeholder="e.g. 12 Month Fixed Closed"
                        width={190}
                      />
                    </Row>
                  </div>
                </div>
              </div>

              <div style={{ padding:"22px", borderTop:`1px solid ${C.border}` }}>
                <Label>Fixed Monthly Operating Expenses</Label>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:18, marginTop:12 }}>
                  <div>
                    <Row label={operatingMortgageLabel}>
                      <EditNum
                        value={operatingMortgagePayment}
                        onChange={v => onUpdate(hasSeparateMortgageTax(prop) ? "monthly_pi" : "monthlyPayment", v)}
                        locked={!isAdmin}
                      />
                    </Row>
                    <div style={{borderBottom:`1px solid ${C.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0"}}>
                        <button onClick={e => { e.stopPropagation(); setTaxNoteOpen(o => !o); }} style={{background:"none",border:"none",padding:0,cursor:"pointer",fontSize:13,color:C.textMid,fontFamily:C.sans,display:"flex",alignItems:"center",gap:5}}>
                          Property tax
                          <span style={{fontSize:10,color:taxNoteOpen ? C.gold : C.muted,transition:"color 0.15s"}}>▾ notes</span>
                        </button>
                        <span><EditNum value={safe(prop.monthlyTax)} onChange={v => onUpdate("monthlyTax", v)} locked={!isAdmin} /></span>
                      </div>
                      {taxNoteOpen && (
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 14px 10px",marginBottom:10,position:"relative"}} onClick={e => e.stopPropagation()}>
                          <button onClick={() => setTaxNoteOpen(false)} style={{position:"absolute",top:8,right:10,background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:14,lineHeight:1}}>✕</button>
                          {prop.taxes_paid_by === "lender" && (
                            <div style={{marginBottom:10}}>
                              <div style={{fontSize:11,color:C.muted,marginBottom:4,fontFamily:C.sans}}>Tax account balance</div>
                              <EditNum value={safe(prop.tax_account_balance)} onChange={v => onUpdate("tax_account_balance", v)} locked={!isAdmin} />
                            </div>
                          )}
                          <div style={{fontSize:11,color:C.muted,marginBottom:4,fontFamily:C.sans}}>Notes</div>
                          <input
                            type="text"
                            value={prop.tax_account_note || ""}
                            onChange={e => onUpdate("tax_account_note", e.target.value)}
                            disabled={!isAdmin}
                            placeholder="e.g. Equitable escrowed · balance as of Apr 18 2026"
                            style={{width:"100%",padding:"7px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:12,fontFamily:C.sans,outline:"none",boxSizing:"border-box",opacity:!isAdmin?0.6:1}}
                          />
                        </div>
                      )}
                    </div>
                    <Row label="Insurance" last><EditNum value={safe(prop.monthly_insurance)} onChange={v => onUpdate("monthly_insurance", v)} locked={!isAdmin} /></Row>
                  </div>
                  <div>
                    <Row label="Maintenance fees"><EditNum value={safe(prop.maintenance_reserve_monthly)} onChange={v => onUpdate("maintenance_reserve_monthly", v)} locked={!isAdmin} /></Row>
                    <Row label="Total monthly outflow" last><span style={{ fontFamily:C.mono, fontSize:15, fontWeight:700, color:C.red }}>{$F(totalOut)}</span></Row>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: PAYMENT SCHEDULE ── */}
          {propTab === "schedule" && (
            <div style={{ padding:"22px" }}>

              {/* Section A — 4 stat chips */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:10, marginBottom:24 }}>
                {[
                  { label:"Balance", value:$F(balance), color:C.red },
                  { label:"Interest this month", value:$F(mortgage.currentInterest), color:C.red },
                  { label:"Principal this month", value:$F(mortgage.currentPrincipal), color:C.green },
                  { label:"Rate", value:prop.rate || "N/A", color:C.amber },
                ].map(item => (
                  <div key={item.label} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:14, padding:"14px 16px" }}>
                    <div style={{ fontSize:9, color:C.textDim, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{item.label}</div>
                    <div style={{ fontSize:item.label === "Rate" ? 14 : 18, fontFamily:C.mono, fontWeight:700, color:item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Section B — Payment breakdown donut */}
              {piPayment > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:28, marginBottom:24, flexWrap:"wrap" }}>
                  {/* SVG donut */}
                  <div style={{ flexShrink:0 }}>
                    {(() => {
                      const R = 44, CX = 52, CY = 52, STROKE = 10;
                      const circ = 2 * Math.PI * R;
                      const intDash = (interestPct / 100) * circ;
                      return (
                        <svg width={104} height={104} style={{ display:"block" }}>
                          <circle cx={CX} cy={CY} r={R} fill="none" stroke={C.redLight} strokeWidth={STROKE} />
                          <circle cx={CX} cy={CY} r={R} fill="none" stroke={C.green} strokeWidth={STROKE}
                            strokeDasharray={`${circ - intDash} ${intDash}`}
                            strokeDashoffset={circ * 0.25}
                            style={{ transform:`rotate(-90deg)`, transformOrigin:`${CX}px ${CY}px` }} />
                          <text x={CX} y={CY - 4} textAnchor="middle" fontSize={16} fontWeight={700} fill={C.red} fontFamily={C.mono}>{interestPct}%</text>
                          <text x={CX} y={CY + 13} textAnchor="middle" fontSize={9} fill={C.textDim} fontFamily={C.sans}>interest</text>
                        </svg>
                      );
                    })()}
                  </div>
                  {/* Breakdown rows */}
                  <div style={{ flex:1, minWidth:180 }}>
                    {[
                      { label:"Interest", value:$F(totalInterest), color:C.red },
                      { label:"Principal", value:$F(totalPrincipal), color:C.green },
                      { label:"Total payment", value:$F(piPayment), color:C.text },
                    ].map((r, i, arr) => (
                      <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <span style={{ fontSize:13, color:C.textMid }}>{r.label}</span>
                        <span style={{ fontFamily:C.mono, fontWeight:700, color:r.color, fontSize:14 }}>{r.value}</span>
                      </div>
                    ))}
                    {rateSavings > 0 && (
                      <div style={{ fontSize:11, color:C.textDim, marginTop:10 }}>
                        Every 0.25% rate cut saves ~<strong style={{ color:C.green }}>{$F(rateSavings)}</strong>/mo in interest.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section C — Balance curve */}
              {curvePoints.length > 1 && (
                <div style={{ marginBottom:24 }}>
                  <Label>Balance — Next 10 Years</Label>
                  <div style={{ overflowX:"auto", marginTop:10 }}>
                    <svg width={CURVE_W} height={CURVE_H} style={{ display:"block", overflow:"visible" }}>
                      {/* Y-axis labels */}
                      {[0, 0.5, 1].map(frac => {
                        const yVal = maxBal * frac;
                        const yPx = toY(yVal);
                        return (
                          <g key={frac}>
                            <line x1={CURVE_PAD_L - 4} y1={yPx} x2={CURVE_W - 8} y2={yPx} stroke={C.border} strokeWidth={1} />
                            <text x={CURVE_PAD_L - 6} y={yPx + 4} textAnchor="end" fontSize={9} fill={C.textDim} fontFamily={C.mono}>{$K(yVal)}</text>
                          </g>
                        );
                      })}
                      {/* Fill */}
                      {fillPoints && <polygon points={fillPoints} fill={C.blueLight} opacity={0.6} />}
                      {/* Line */}
                      <polyline points={polylinePoints} fill="none" stroke={C.blue} strokeWidth={2} strokeLinejoin="round" />
                      {/* X-axis labels */}
                      {curvePoints.map((d, i) => (
                        <text key={d.ym} x={toX(i)} y={CURVE_H - 4} textAnchor="middle" fontSize={9} fill={C.textDim} fontFamily={C.sans}>
                          {monthLabel(d.ym).split(" ")[1]}
                        </text>
                      ))}
                    </svg>
                  </div>
                </div>
              )}

              {/* Section D — Monthly schedule table */}
              <div>
                <Label>Monthly Schedule</Label>
                <div style={{ marginTop:10, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:0, background:C.bg, padding:"10px 14px", borderBottom:`1px solid ${C.borderDark}`, fontSize:9, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase" }}>
                    <span>Month</span><span style={{ textAlign:"right" }}>Payment</span><span style={{ textAlign:"right", color:C.red }}>Interest</span><span style={{ textAlign:"right", color:C.green }}>Principal</span><span style={{ textAlign:"right" }}>Balance</span>
                  </div>
                  {scheduleData.slice(0, scheduleRows).map((row, idx) => (
                    <div key={row.ym} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:0, padding:"9px 14px", borderBottom: idx < Math.min(scheduleRows, scheduleData.length) - 1 ? `1px solid ${C.border}` : "none", background: row.ym === curYM ? C.bg : "transparent", alignItems:"center" }}>
                      <span style={{ fontSize:12, color:C.text, fontWeight: row.ym === curYM ? 700 : 400 }}>{monthLabel(row.ym)}</span>
                      <span style={{ fontFamily:C.mono, fontSize:12, color:C.text, textAlign:"right" }}>{row.payment > 0 ? $F(row.payment) : "—"}</span>
                      <span style={{ fontFamily:C.mono, fontSize:12, color:C.red, textAlign:"right" }}>{row.interest > 0 ? $F(row.interest) : "—"}</span>
                      <span style={{ fontFamily:C.mono, fontSize:12, color:C.green, textAlign:"right" }}>{row.principal > 0 ? $F(row.principal) : "—"}</span>
                      <span style={{ fontFamily:C.mono, fontSize:12, color:C.text, textAlign:"right" }}>{$F(row.balance)}</span>
                    </div>
                  ))}
                </div>
                {scheduleData.length > 12 && (
                  <button onClick={() => setScheduleRows(r => r === 12 ? 24 : 12)}
                    style={{ marginTop:10, fontSize:12, color:C.gold, background:"transparent", border:`1px solid ${C.gold}`, borderRadius:8, padding:"7px 16px", cursor:"pointer", fontFamily:C.sans, fontWeight:600 }}>
                    {scheduleRows === 12 ? "Show 24 months" : "Show 12 months"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 3: TENANTS & RENT ── */}
          {propTab === "tenants" && (
            <div>
              <div style={{ padding:"22px" }}>
                <div style={{ marginBottom:12 }}>
                  <Label>Tenants / Leases</Label>
                </div>
                {units.length === 0 ? (
                  <div style={{ fontSize:13, color:C.textDim }}>This property does not currently have tracked rental units.</div>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:14 }}>
                    {units.map(unit => {
                      const lease = unit.lease ? makeLease(unit.lease) : null;
                      const leaseBadge = !lease ? "Vacant" : lease.lease_status === "signed_pending" ? "Pending" : lease.lease_status === "expired" ? "Expired" : lease.lease_status === "active" ? "Leased" : lease.lease_status;
                      return (
                        <div key={unit.id} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:16, padding:16 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:10 }}>
                            <div>
                              <div style={{ fontSize:16, fontWeight:700, color:C.text }}>{unit.label}</div>
                              <div style={{ fontSize:11, color:C.textDim, marginTop:3 }}>{lease?.tenant_full_name || "No tenant assigned"}</div>
                            </div>
                            <span style={{ background: lease ? C.greenLight : C.border, color: lease ? C.greenText : C.textDim, borderRadius:20, fontSize:10, fontWeight:700, padding:"4px 10px", textTransform:"capitalize" }}>
                              {leaseBadge}
                            </span>
                          </div>
                          <div style={{ display:"grid", gap:8 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                              <span style={{ color:C.textDim }}>Monthly rent</span>
                              <span style={{ fontFamily:C.mono, color:C.text }}>{$F(lease?.monthly_rent || unit.market_rent)}</span>
                            </div>
                            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                              <span style={{ color:C.textDim }}>Lease window</span>
                              <span style={{ color:C.text }}>{lease ? `${formatDate(lease.lease_start_date)} - ${formatDate(lease.lease_end_date)}` : "—"}</span>
                            </div>
                            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                              <span style={{ color:C.textDim }}>Deposit</span>
                              <span style={{ fontFamily:C.mono, color:safe(lease?.deposit_received) > 0 ? C.gold : C.textDim }}>{$F(lease?.deposit_received || 0)}</span>
                            </div>
                            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                              <span style={{ color:C.textDim }}>Deposit date</span>
                              <span style={{ color:C.text }}>{lease?.deposit_date ? formatDate(lease.deposit_date) : "—"}</span>
                            </div>
                            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                              <span style={{ color:C.textDim }}>Payment frequency</span>
                              <span style={{ color:C.text, textTransform:"capitalize" }}>{lease?.payment_frequency || "—"}</span>
                            </div>
                            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                              <span style={{ color:C.textDim }}>Lease status</span>
                              <span style={{ color:C.text, textTransform:"capitalize" }}>{lease?.lease_status?.replace("_", " ") || "—"}</span>
                            </div>
                            {lease?.phone_number && <div style={{ fontSize:12, color:C.textMid }}>{lease.phone_number}</div>}
                            {lease?.email && <div style={{ fontSize:12, color:C.textMid }}>{lease.email}</div>}
                            {lease?.lease_notes && <div style={{ fontSize:12, color:C.textMid, lineHeight:1.55 }}>{lease.lease_notes}</div>}
                          </div>
                          {isAdmin && (
                            <button onClick={() => setEditingUnit(unit)}
                              style={{ width:"100%", marginTop:14, padding:"10px 12px", background:lease ? C.surface : C.goldLight, border:`1px solid ${lease ? C.border : C.gold}`, borderRadius:10, color:lease ? C.textMid : C.goldText, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                              {lease ? "Edit Tenant / Lease" : "Add Tenant"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ padding:"22px", borderTop:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:14, flexWrap:"wrap" }}>
                  <div>
                    <Label>Rent Ledger</Label>
                    <div style={{ fontSize:12, color:C.textDim }}>Lease-aware rent due, payments, deposit credit, and remaining value through expiry.</div>
                  </div>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                    <span style={{ background:C.bg, borderRadius:999, padding:"6px 10px", fontSize:11, color:C.textMid }}>Due this month: <strong style={{ color:C.text }}>{$F(nextExpected)}</strong></span>
                    <span style={{ background:C.bg, borderRadius:999, padding:"6px 10px", fontSize:11, color:C.textMid }}>Collected this month: <strong style={{ color:collectedThisMonth > 0 ? C.green : C.text }}>{$F(collectedThisMonth)}</strong></span>
                    <span style={{ background:C.bg, borderRadius:999, padding:"6px 10px", fontSize:11, color:C.textMid }}>Collected total: <strong style={{ color:C.green }}>{$F(collectedTotal)}</strong></span>
                  </div>
                </div>
                {ledgers.length === 0 ? (
                  <div style={{ fontSize:13, color:C.textDim }}>Add a tenant lease to generate a rent ledger for this property.</div>
                ) : (
                  <div style={{ display:"grid", gap:14 }}>
                    {ledgers.map(({ unit, ledger }) => (
                      <div key={unit.id} style={{ border:`1px solid ${C.border}`, borderRadius:16, overflow:"hidden" }}>
                        <div style={{ padding:"14px 16px", background:C.bg, display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                          <div>
                            <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{unit.label} · {ledger.lease.tenant_full_name || "Tenant TBD"}</div>
                            <div style={{ fontSize:11, color:C.textDim, marginTop:4 }}>{formatDate(ledger.lease.lease_start_date)} - {formatDate(ledger.lease.lease_end_date)} · {ledger.lease.payment_frequency}</div>
                          </div>
                          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                            {[
                              { label:"Lease Value", value:$F(ledger.totalDue), color:C.text },
                              { label:"Paid", value:$F(ledger.totalPaid), color:C.green },
                              { label:"Credited", value:$F(ledger.totalCredited), color:C.gold },
                              { label:"Outstanding", value:$F(ledger.totalOutstanding), color:ledger.totalOutstanding > 0 ? C.red : C.green },
                              { label:"Remaining", value:$F(ledger.remainingLeaseValue), color:ledger.remainingLeaseValue > 0 ? C.amber : C.green },
                            ].map(item => (
                              <div key={item.label} style={{ textAlign:"right" }}>
                                <div style={{ fontSize:9, color:C.textDim, textTransform:"uppercase", letterSpacing:"0.08em" }}>{item.label}</div>
                                <div style={{ fontSize:13, fontFamily:C.mono, fontWeight:700, color:item.color }}>{item.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {safe(ledger.lease.deposit_received) > 0 && (
                          <div style={{ padding:"10px 16px", borderTop:`1px solid ${C.border}`, background:C.goldLight, fontSize:12, color:C.goldText }}>
                            Deposit recorded: {$F(ledger.lease.deposit_received)} on {formatDate(ledger.lease.deposit_date)}. This amount is currently being applied as prepaid rent credit.
                          </div>
                        )}
                        <div style={{ padding:"0 16px 14px" }}>
                          <div style={{ display:"grid", gridTemplateColumns:"110px 110px 1fr 1fr 1fr 88px", gap:"8px", padding:"12px 0 8px", borderBottom:`1px solid ${C.borderDark}`, fontSize:9, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase" }}>
                            <span>Month</span>
                            <span>Due Date</span>
                            <span>Rent Due</span>
                            <span>Paid</span>
                            <span>Credit / Owing</span>
                            <span></span>
                          </div>
                          {ledger.rows.map((row, idx) => {
                            const current = ledger.payments.find(entry => entry.month === row.month);
                            return (
                              <div key={`${unit.id}-${row.month}`} style={{ display:"grid", gridTemplateColumns:"110px 110px 1fr 1fr 1fr 88px", gap:"8px", padding:"10px 0", borderBottom: idx < ledger.rows.length - 1 ? `1px solid ${C.border}` : "none", alignItems:"center" }}>
                                <span style={{ fontSize:12, color:C.text }}>{monthLabel(row.month)}</span>
                                <span style={{ fontSize:12, color:C.textMid }}>{formatDate(row.dueDate)}</span>
                                <span style={{ fontFamily:C.mono, fontSize:13, color:C.text }}>{$F(row.amount)}</span>
                                <div>
                                  <div style={{ fontFamily:C.mono, fontSize:13, color:row.paid > 0 ? C.green : C.textDim }}>{row.paid > 0 ? $F(row.paid) : "—"}</div>
                                  {current?.note && <div style={{ fontSize:10, color:C.textDim }}>{current.note}</div>}
                                </div>
                                <div>
                                  <div style={{ fontFamily:C.mono, fontSize:13, color:row.creditApplied > 0 ? C.gold : (row.outstanding > 0 ? C.red : C.green) }}>
                                    {row.creditApplied > 0 ? `Credit ${$F(row.creditApplied)}` : row.outstanding > 0 ? `Owing ${$F(row.outstanding)}` : "Settled"}
                                  </div>
                                </div>
                                <button onClick={() => setLoggingRent({ unit, ledger, row, month: row.month, current })}
                                  style={{ fontSize:11, padding:"6px 10px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.textMid, cursor:"pointer", fontWeight:700 }}>
                                  {current ? "Edit" : "Log"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 4: VALUATION ── */}
          {propTab === "valuation" && (() => {
            const vals = (prop.valuations || []).slice().sort((a, b) => b.date.localeCompare(a.date));
            function submitVal(e) {
              e.stopPropagation();
              const v = parseFloat(String(valForm.value).replace(/[^0-9.]/g, ""));
              if (!valForm.date || isNaN(v) || v <= 0) return;
              const entry = { date: valForm.date, value: v, note: valForm.note };
              const updated = [entry, ...(prop.valuations || [])].sort((a, b) => b.date.localeCompare(a.date));
              onPatch({ market: updated[0].value, valuations: updated });
              setValForm({ date:"", value:"", note:"" });
              setValFormOpen(false);
            }
            return (
              <div style={{ padding:"22px" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                  <Label>Valuation History</Label>
                  {isAdmin && !valFormOpen && (
                    <button onClick={e => { e.stopPropagation(); setValFormOpen(true); }}
                      style={{ padding:"8px 16px", background:C.gold, border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:C.sans }}>
                      + Log Valuation
                    </button>
                  )}
                </div>

                {valFormOpen && (
                  <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"18px 18px 14px", marginBottom:20 }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.textMid, marginBottom:14 }}>New Valuation Entry</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                      <div>
                        <div style={{ fontSize:11, color:C.muted, marginBottom:4, fontFamily:C.sans }}>Valuation Date</div>
                        <input type="date" value={valForm.date} onChange={e => setValForm(f => ({ ...f, date:e.target.value }))}
                          style={{ width:"100%", padding:"8px 10px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, fontSize:13, fontFamily:C.sans, outline:"none", boxSizing:"border-box" }} />
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:C.muted, marginBottom:4, fontFamily:C.sans }}>Market Value ($)</div>
                        <input type="number" value={valForm.value} onChange={e => setValForm(f => ({ ...f, value:e.target.value }))} placeholder="e.g. 2000000"
                          style={{ width:"100%", padding:"8px 10px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, fontSize:13, fontFamily:C.mono, outline:"none", boxSizing:"border-box" }} />
                      </div>
                    </div>
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:11, color:C.muted, marginBottom:4, fontFamily:C.sans }}>Note (optional)</div>
                      <input type="text" value={valForm.note} onChange={e => setValForm(f => ({ ...f, note:e.target.value }))} placeholder="e.g. MPAC assessment, broker opinion, appraisal"
                        style={{ width:"100%", padding:"8px 10px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, fontSize:12, fontFamily:C.sans, outline:"none", boxSizing:"border-box" }} />
                    </div>
                    <div style={{ display:"flex", gap:10 }}>
                      <button onClick={submitVal}
                        style={{ flex:1, padding:"10px 0", background:C.gold, border:"none", borderRadius:8, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:C.sans }}>
                        Save Valuation
                      </button>
                      <button onClick={e => { e.stopPropagation(); setValFormOpen(false); setValForm({ date:"", value:"", note:"" }); }}
                        style={{ padding:"10px 18px", background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.textMid, fontSize:13, cursor:"pointer", fontFamily:C.sans }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {vals.length === 0 ? (
                  <div style={{ fontSize:13, color:C.textDim }}>No valuations logged yet.</div>
                ) : (
                  <div>
                    {vals.map((v, i) => {
                      const prev = vals[i + 1];
                      const delta = prev ? v.value - prev.value : null;
                      return (
                        <div key={i} style={{ padding:"14px 0", borderBottom: i < vals.length - 1 ? `1px solid ${C.border}` : "none" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                            <div>
                              <div style={{ fontSize:12, color:C.textDim, marginBottom:4 }}>{v.date}</div>
                              <div style={{ fontSize:20, fontFamily:C.mono, fontWeight:700, color:C.text }}>{$F(v.value)}</div>
                              {v.note && <div style={{ fontSize:11, color:C.textMid, marginTop:4 }}>{v.note}</div>}
                            </div>
                            {delta !== null && (
                              <div style={{ fontFamily:C.mono, fontSize:13, fontWeight:600, color: delta >= 0 ? C.green : C.red }}>
                                {delta >= 0 ? "+" : ""}{$F(delta)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      )}
    </div>
  );
}

// ─── MAINTENANCE ALERTS WIDGET ────────────────────────────────────────────────
function MaintenanceAlertsWidget() {
  const [reminders, setReminders] = useState([]);
  useEffect(() => { loadMaintenanceReminders(null).then(setReminders); }, []);

  const today = new Date().toISOString().slice(0,10);
  const soon  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0,10);
  const active  = reminders.filter(r => r.status !== "completed");
  const overdue = active.filter(r => r.due_date && r.due_date < today);
  const dueSoon = active.filter(r => r.due_date && r.due_date >= today && r.due_date <= soon);
  if (overdue.length === 0 && dueSoon.length === 0) return null;

  const items = [
    ...overdue.map(r => ({ ...r, _t:"overdue" })),
    ...dueSoon.map(r => ({ ...r, _t:"soon" })),
  ];
  return (
    <Card accent={overdue.length > 0 ? C.red : C.amber} style={{ marginBottom:16, paddingTop:24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.1em", textTransform:"uppercase" }}>Maintenance Alerts</div>
        {overdue.length > 0 && <span style={{ background:C.redLight, color:C.redText, borderRadius:20, fontSize:10, fontWeight:700, padding:"2px 10px" }}>{overdue.length} overdue</span>}
        {dueSoon.length > 0 && <span style={{ background:C.amberLight, color:C.amber, borderRadius:20, fontSize:10, fontWeight:700, padding:"2px 10px" }}>{dueSoon.length} due soon</span>}
      </div>
      {items.map(r => (
        <div key={r.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:8, marginBottom:6, background: r._t === "overdue" ? C.redLight : C.amberLight }}>
          <div style={{ flex:1 }}>
            <span style={{ fontSize:13, fontWeight:600, color: r._t === "overdue" ? C.redText : C.amber }}>{r.property_name}</span>
            <span style={{ fontSize:12, color:C.textMid }}> — {r.title}</span>
          </div>
          <span style={{ fontSize:11, color:C.textDim, whiteSpace:"nowrap" }}>Due {r.due_date}</span>
        </div>
      ))}
    </Card>
  );
}

// ─── BUSINESS CARD ────────────────────────────────────────────────────────────
function BizCard({ biz, onUpdate, onUpdateProfit, onUpdateProfitField, isAdmin }) {
  const [open, setOpen] = useState(false);
  const [bizTab, setBizTab] = useState("overview");
  const isNonProfit = biz.type === "nonprofit";
  const netEquity   = safe(biz.cashAccounts) - safe(biz.liabilities);

  const monthlyRows = monthsBetween(SYSTEM_START, currentYM()).slice(-6).reverse();
  const profitRows = monthlyRows.map(month => {
    const entry = (biz.monthlyProfits || []).find(p => p.month === month) || {};
    const revenue = entry.revenue != null ? safe(entry.revenue) : 0;
    const expenses = entry.expenses != null ? safe(entry.expenses) : 0;
    const profit = entry.profit != null ? safe(entry.profit) : (revenue - expenses);
    return { month, entry, revenue, expenses, profit };
  });
  const maxProfitMagnitude = Math.max(1, ...profitRows.map(row => Math.abs(row.profit)));

  const assetItems = (biz.accounts && biz.accounts.length ? biz.accounts : [
    { label: "Cash & accounts", amount: safe(biz.cashAccounts) },
  ]).map((item, idx) => ({
    id: item.id || `asset-${idx}`,
    label: item.label || item.name || item.account_name || `Asset ${idx + 1}`,
    amount: safe(item.amount ?? item.balance ?? item.value),
  }));

  const fallbackLiabilityItems = [];
  if (safe(biz.taxPayable) > 0) fallbackLiabilityItems.push({ label: "CRA Payable", amount: safe(biz.taxPayable) });
  if (safe(biz.creditCards) > 0) fallbackLiabilityItems.push({ label: "Credit Cards", amount: safe(biz.creditCards) });
  const otherLiabilities = Math.max(0, safe(biz.liabilities) - safe(biz.taxPayable) - safe(biz.creditCards));
  if (otherLiabilities > 0) fallbackLiabilityItems.push({ label: "Other Liabilities", amount: otherLiabilities });
  if (!fallbackLiabilityItems.length && safe(biz.liabilities) > 0) fallbackLiabilityItems.push({ label: "Total Liabilities", amount: safe(biz.liabilities) });

  const liabilityItems = (biz.liabItems && biz.liabItems.length ? biz.liabItems : fallbackLiabilityItems).map((item, idx) => ({
    id: item.id || `liab-${idx}`,
    label: item.label || item.name || item.liability_name || `Liability ${idx + 1}`,
    amount: safe(item.amount ?? item.balance ?? item.value),
  }));

  const totalAssets = assetItems.reduce((sum, item) => sum + safe(item.amount), 0) || safe(biz.cashAccounts);
  const totalLiabilities = liabilityItems.reduce((sum, item) => sum + safe(item.amount), 0) || safe(biz.liabilities);
  const balanceSheetEquity = totalAssets - totalLiabilities;
  const capitalBase = Math.max(1, Math.abs(balanceSheetEquity) + totalLiabilities);
  const equityPct = Math.max(0, (Math.max(balanceSheetEquity, 0) / capitalBase) * 100);
  const liabilitiesPct = Math.max(0, (totalLiabilities / capitalBase) * 100);

  const tabStyle = (id) => ({
    padding: "11px 18px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
    background: "transparent", fontFamily: C.sans, whiteSpace: "nowrap",
    color: bizTab === id ? C.gold : C.textDim,
    borderBottom: bizTab === id ? `2px solid ${C.gold}` : "2px solid transparent",
  });

  return (
    <div style={{ background: C.card, border: `1px solid ${open ? (isNonProfit ? "#9B59B6" : C.gold) : C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
      <div onClick={() => setOpen(o => { if (o) setBizTab("overview"); return !o; })} style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: isNonProfit ? C.purpleLight : C.blueLight, color: isNonProfit ? C.purpleText : C.blueText, borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "4px 8px", letterSpacing: "0.06em", flexShrink: 0 }}>
            {isNonProfit ? "NON-PROFIT" : "CORP"}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{biz.name}</div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
              {isNonProfit ? "Non-profit · Excluded from consolidated NW" : `Ontario corporation · ${biz.abbr}`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 2 }}>{isNonProfit ? "Cash balance" : "Corp. equity"}</div>
            <div style={{ fontSize: 18, fontFamily: C.mono, fontWeight: 700, color: isNonProfit ? C.purple : (netEquity >= 0 ? C.gold : C.red) }}>
              {$K(isNonProfit ? safe(biz.cashAccounts) : netEquity)}
            </div>
          </div>
          <span style={{ color: open ? C.gold : C.textDim, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {!isNonProfit && (
            <div style={{ background:C.bg, borderBottom:`1px solid ${C.border}`, overflowX:"auto" }}>
              <div style={{ display:"flex" }}>
                {[["overview","Overview"],["profits","P&L / Profits"],["balancesheet","Balance Sheet"]].map(([id, label]) => (
                  <button key={id} onClick={e => { e.stopPropagation(); setBizTab(id); }} style={tabStyle(id)}>{label}</button>
                ))}
              </div>
            </div>
          )}

          <div style={{ padding: 20 }}>
            {isNonProfit ? (
              <div>
                {biz.notes && <div style={{ fontSize: 12, color: C.textMid, fontStyle: "italic", marginBottom: 16, lineHeight: 1.6 }}>{biz.notes}</div>}
                <div style={{ background: C.purpleLight, borderRadius: 8, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.purpleText, marginBottom: 4 }}>Collective fund — tracked for reference only</div>
                  <div style={{ fontSize: 12, color: C.textMid }}>Does NOT count toward JMF consolidated net worth.</div>
                </div>
                <Row label="Cash balance" last><span style={{ fontFamily: C.mono, color: C.purple, fontWeight: 700, fontSize: 14 }}>{$F(safe(biz.cashAccounts))}</span></Row>
              </div>
            ) : (
              <>
                {bizTab === "overview" && (
                  <div>
                    {biz.notes && <div style={{ fontSize: 12, color: C.textMid, fontStyle: "italic", marginBottom: 16, lineHeight: 1.6 }}>{biz.notes}</div>}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
                      <div>
                        <Label>Overview</Label>
                        <Row label="Cash & accounts"><EditNum value={safe(biz.cashAccounts)} onChange={v => onUpdate("cashAccounts", v)} locked={!isAdmin} /></Row>
                        <Row label="Revenue"><EditNum value={safe(biz.revenue)} onChange={v => onUpdate("revenue", v)} locked={!isAdmin} /></Row>
                        <Row label="Expenses" last><EditNum value={safe(biz.expenses)} onChange={v => onUpdate("expenses", v)} locked={!isAdmin} /></Row>
                      </div>
                      <div>
                        <Label>Liabilities</Label>
                        <Row label="Total liabilities" labelStyle={{ fontWeight: 700, color: C.text }}><span style={{ color: C.red, fontFamily: C.mono, fontSize: 14 }}>{$F(safe(biz.liabilities))}</span></Row>
                        <Row label="CRA tax payable"><EditNum value={safe(biz.taxPayable)} onChange={v => onUpdate("taxPayable", v)} locked={!isAdmin} /></Row>
                        <Row label="Credit cards"><span style={{ color: C.red, fontFamily: C.mono, fontSize: 14 }}>{$F(safe(biz.creditCards))}</span></Row>
                        <Row label="Net equity" last labelStyle={{ fontWeight: 700, background: C.gold, color: "#FFF", borderRadius: 4, padding: "2px 8px" }}><span style={{ color: netEquity >= 0 ? C.gold : C.red, fontFamily: C.mono, fontWeight: 700, fontSize: 14 }}>{$F(netEquity)}</span></Row>
                      </div>
                    </div>
                  </div>
                )}

                {bizTab === "profits" && (
                  <div>
                    <Label>P&L / Profits</Label>
                    <div style={{ marginTop: 12, border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden" }}>
                      <div style={{ display:"grid", gridTemplateColumns:"110px 1fr 1fr 1fr", gap:12, padding:"10px 14px", background:C.bg, borderBottom:`1px solid ${C.borderDark}`, fontSize:9, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase" }}>
                        <span>Month</span>
                        <span style={{ textAlign:"right" }}>Revenue</span>
                        <span style={{ textAlign:"right" }}>Expenses</span>
                        <span style={{ textAlign:"right" }}>Profit</span>
                      </div>
                      {profitRows.map((row, idx) => {
                        const profitWidth = `${Math.max(6, (Math.abs(row.profit) / maxProfitMagnitude) * 100)}%`;
                        const profitColor = row.profit >= 0 ? C.gold : C.red;
                        return (
                          <div key={row.month} style={{ padding:"12px 14px", borderBottom: idx < profitRows.length - 1 ? `1px solid ${C.border}` : "none" }}>
                            <div style={{ display:"grid", gridTemplateColumns:"110px 1fr 1fr 1fr", gap:12, alignItems:"center" }}>
                              <span style={{ fontSize:12, color:C.textMid }}>{monthLabel(row.month)}</span>
                              <div style={{ textAlign:"right" }}>
                                {isAdmin
                                  ? <EditNum value={row.revenue} onChange={v => onUpdateProfitField && onUpdateProfitField(row.month, "revenue", v)} />
                                  : <span style={{ fontFamily:C.mono, fontSize:13, color:row.entry.revenue != null ? C.text : C.textDim }}>{row.entry.revenue != null ? $F(row.revenue) : "—"}</span>}
                              </div>
                              <div style={{ textAlign:"right" }}>
                                {isAdmin
                                  ? <EditNum value={row.expenses} onChange={v => onUpdateProfitField && onUpdateProfitField(row.month, "expenses", v)} />
                                  : <span style={{ fontFamily:C.mono, fontSize:13, color:row.entry.expenses != null ? C.text : C.textDim }}>{row.entry.expenses != null ? $F(row.expenses) : "—"}</span>}
                              </div>
                              <div style={{ textAlign:"right" }}>
                                {isAdmin
                                  ? <EditNum value={row.profit} onChange={v => (onUpdateProfitField ? onUpdateProfitField(row.month, "profit", v) : onUpdateProfit && onUpdateProfit(row.month, v))} />
                                  : <span style={{ fontFamily:C.mono, fontSize:13, color:row.profit >= 0 ? C.gold : C.red }}>{(row.entry.profit != null || row.entry.revenue != null || row.entry.expenses != null) ? $F(row.profit) : "—"}</span>}
                              </div>
                            </div>
                            <div style={{ marginTop:8, height:6, background:C.border, borderRadius:999, overflow:"hidden" }}>
                              <div style={{ width: profitWidth, height:"100%", background: profitColor, opacity:0.78, borderRadius:999, marginLeft: row.profit >= 0 ? 0 : "auto" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {bizTab === "balancesheet" && (
                  <div>
                    <Label>Balance Sheet</Label>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:20, marginTop:12 }}>
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>Assets / Accounts</div>
                        <div style={{ border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
                          {assetItems.map((item, idx) => (
                            <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderBottom: idx < assetItems.length - 1 ? `1px solid ${C.border}` : "none" }}>
                              <span style={{ fontSize:13, color:C.text }}>{item.label}</span>
                              <span style={{ fontFamily:C.mono, fontSize:13, color:C.text }}>{$F(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>Liabilities</div>
                        <div style={{ border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
                          {(liabilityItems.length ? liabilityItems : [{ id:"liab-empty", label:"No liabilities recorded", amount:0 }]).map((item, idx, arr) => (
                            <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderBottom: idx < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                              <span style={{ fontSize:13, color:item.amount === 0 && item.label === "No liabilities recorded" ? C.textDim : C.text }}>{item.label}</span>
                              <span style={{ fontFamily:C.mono, fontSize:13, color:item.amount > 0 ? C.red : C.textDim }}>{item.amount > 0 ? $F(item.amount) : "—"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop:18, border:`1px solid ${C.border}`, borderRadius:14, padding:16 }}>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:12 }}>
                        <div>
                          <div style={{ fontSize:9, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:5 }}>Total Assets</div>
                          <div style={{ fontSize:18, fontFamily:C.mono, fontWeight:700, color:C.text }}>{$F(totalAssets)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:9, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:5 }}>Total Liabilities</div>
                          <div style={{ fontSize:18, fontFamily:C.mono, fontWeight:700, color:C.red }}>{$F(totalLiabilities)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:9, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:5 }}>Net Equity</div>
                          <div style={{ fontSize:18, fontFamily:C.mono, fontWeight:700, color:balanceSheetEquity >= 0 ? C.gold : C.red }}>{$F(balanceSheetEquity)}</div>
                        </div>
                      </div>
                      <div style={{ marginTop:14 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.textDim, marginBottom:6 }}>
                          <span>Equity {equityPct.toFixed(0)}%</span>
                          <span>Liabilities {liabilitiesPct.toFixed(0)}%</span>
                        </div>
                        <div style={{ display:"flex", height:10, background:C.border, borderRadius:999, overflow:"hidden" }}>
                          <div style={{ width:`${equityPct}%`, background:C.gold, minWidth:equityPct > 0 ? 8 : 0 }} />
                          <div style={{ width:`${liabilitiesPct}%`, background:C.red, minWidth:liabilitiesPct > 0 ? 8 : 0 }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EXPENSES TAB ─────────────────────────────────────────────────────────────
function ExpensesTab({ userId, isAdmin, allProfiles, individuals }) {
  const [subTab, setSubTab]               = useState("thismonth");
  const [expenses, setExpenses]           = useState(null); // null = loading
  const [allFamilyExp, setAllFamilyExp]   = useState([]);
  const [budgetTargets, setBudgetTargets] = useState([]);
  const [viewingUserId, setViewingUserId] = useState(null); // null = family summary (admin)
  const [showAddModal, setShowAddModal]   = useState(false);
  const [editingBudgetCat, setEditingBudgetCat] = useState(null);
  const [budgetInput, setBudgetInput]     = useState("");
  const [search, setSearch]               = useState("");
  const [filterCat, setFilterCat]         = useState("All");
  const [filterMethod, setFilterMethod]   = useState("All");
  const [sortDesc, setSortDesc]           = useState(true);

  const curYM = currentYM();

  useEffect(() => {
    if (isAdmin) loadAllPersonalExpenses().then(setAllFamilyExp);
  }, [isAdmin]);

  useEffect(() => {
    const loadId = isAdmin ? viewingUserId : userId;
    if (!loadId) { setExpenses([]); setBudgetTargets([]); return; }
    setExpenses(null);
    Promise.all([loadPersonalExpenses(loadId), loadBudgetTargets(loadId)]).then(([exps, targets]) => {
      setExpenses(exps);
      setBudgetTargets(targets);
    });
  }, [userId, viewingUserId, isAdmin]);

  const loadId         = isAdmin ? viewingUserId : userId;
  const displayExp     = loadId ? (expenses || []) : allFamilyExp;
  const thisMonthExp   = displayExp.filter(e => e.date && e.date.slice(0,7) === curYM);
  const thisMonthTotal = thisMonthExp.reduce((s, e) => s + safe(e.amount), 0);

  const categoryTotals = Object.fromEntries(
    PERSONAL_CATEGORIES.map(cat => [cat, thisMonthExp.filter(e => e.category === cat).reduce((s, e) => s + safe(e.amount), 0)])
  );
  const getBudget = (cat) => safe(budgetTargets.find(t => t.category === cat && t.month === curYM)?.amount);

  const handleSetBudget = async (cat, val) => {
    if (!loadId) return;
    const ok = await saveBudgetTarget(loadId, curYM, cat, safe(val));
    if (ok) setBudgetTargets(prev => {
      const exists = prev.find(t => t.category === cat && t.month === curYM);
      if (exists) return prev.map(t => t.category === cat && t.month === curYM ? { ...t, amount: safe(val) } : t);
      return [...prev, { user_id: loadId, month: curYM, category: cat, amount: safe(val) }];
    });
  };

  const last6 = monthsBetween(SYSTEM_START, curYM).slice(-6);
  const monthlyTotals = last6.map(m => ({
    month: m,
    total: displayExp.filter(e => e.date && e.date.slice(0,7) === m).reduce((s, e) => s + safe(e.amount), 0),
  }));
  const maxMTotal = Math.max(1, ...monthlyTotals.map(m => m.total));

  const filteredAll = [...displayExp]
    .filter(e => filterCat === "All"    || e.category === filterCat)
    .filter(e => filterMethod === "All" || e.payment_method === filterMethod)
    .filter(e => !search || (e.description || "").toLowerCase().includes(search.toLowerCase()) || (e.category || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortDesc ? (b.date||"").localeCompare(a.date||"") : (a.date||"").localeCompare(b.date||""));

  const memberProfiles = (allProfiles || []).filter(p => p.role !== "admin" && p.individual_id);

  const subBtnStyle = (id) => ({
    padding:"10px 16px", fontSize:12, fontWeight:600, border:"none", cursor:"pointer",
    background:"transparent", fontFamily:C.sans, whiteSpace:"nowrap",
    color: subTab === id ? C.gold : C.textDim,
    borderBottom: subTab === id ? `2px solid ${C.gold}` : "2px solid transparent",
  });

  const addExpenseFor = loadId || userId;

  return (
    <div>
      {showAddModal && (
        <AddPersonalExpenseModal userId={addExpenseFor} onSave={e => {
          setExpenses(prev => [e, ...(prev || [])]);
          if (isAdmin) setAllFamilyExp(prev => [e, ...prev]);
        }} onClose={() => setShowAddModal(false)} />
      )}

      {/* Admin family summary */}
      {isAdmin && (
        <Card style={{ marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14, flexWrap:"wrap", gap:10 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>Family Spending — {monthLabel(curYM)}</div>
              <div style={{ fontSize:32, fontFamily:C.mono, fontWeight:800, color:C.gold }}>
                {$F(allFamilyExp.filter(e => e.date && e.date.slice(0,7) === curYM).reduce((s, e) => s + safe(e.amount), 0))}
              </div>
            </div>
            <button onClick={() => setViewingUserId(null)}
              style={{ padding:"7px 16px", background: !viewingUserId ? C.goldLight : "transparent", border:`1px solid ${C.gold}`, borderRadius:8, color:C.goldText, fontSize:12, fontWeight:600, cursor:"pointer" }}>
              Family View
            </button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))", gap:8 }}>
            {memberProfiles.map(p => {
              const mExp  = allFamilyExp.filter(e => e.user_id === p.id && e.date && e.date.slice(0,7) === curYM);
              const total = mExp.reduce((s, e) => s + safe(e.amount), 0);
              const topCat = PERSONAL_CATEGORIES.reduce((best, cat) => {
                const ct = mExp.filter(e => e.category === cat).reduce((s, e) => s + safe(e.amount), 0);
                return ct > best.total ? { cat, total: ct } : best;
              }, { cat:"", total:0 }).cat;
              const ind = (individuals || []).find(x => x.id === p.individual_id);
              const isViewing = viewingUserId === p.id;
              return (
                <div key={p.id} onClick={() => setViewingUserId(p.id)}
                  style={{ background: isViewing ? C.goldLight : C.bg, border:`1px solid ${isViewing ? C.gold : C.border}`, borderRadius:10, padding:12, cursor:"pointer", transition:"border-color 0.15s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                    <div style={{ width:26, height:26, borderRadius:"50%", background:C.goldLight, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:C.goldText }}>
                      {p.initials || ind?.initials || "?"}
                    </div>
                    <div style={{ fontSize:12, fontWeight:600, color:C.text, lineHeight:1.2 }}>{p.display_name || ind?.name || "Member"}</div>
                  </div>
                  <div style={{ fontSize:18, fontFamily:C.mono, fontWeight:700, color:C.gold }}>{$F(total)}</div>
                  {topCat && <div style={{ fontSize:10, color:C.textDim, marginTop:3 }}>Top: {topCat}</div>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Sub-tab bar */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, padding:"0 4px", alignItems:"center" }}>
          {[["thismonth","This Month"],["trends","Trends"],["allexpenses","All Transactions"]].map(([id, label]) => (
            <button key={id} onClick={() => setSubTab(id)} style={subBtnStyle(id)}>{label}</button>
          ))}
          <div style={{ flex:1 }} />
          {!!loadId && (
            <button onClick={() => setShowAddModal(true)}
              style={{ margin:"6px 8px", padding:"7px 16px", background:C.gold, border:"none", borderRadius:8, color:"#FFF", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              + Add Expense
            </button>
          )}
        </div>

        <div style={{ padding:20 }}>

          {/* ── THIS MONTH ── */}
          {subTab === "thismonth" && (
            <div>
              <div style={{ textAlign:"center", padding:"16px 0 24px" }}>
                <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:8 }}>Total Spent — {monthLabel(curYM)}</div>
                <div style={{ fontSize:48, fontFamily:C.mono, fontWeight:800, color:C.gold, letterSpacing:-1 }}>{$F(thisMonthTotal)}</div>
              </div>

              {expenses === null && loadId ? (
                <div style={{ textAlign:"center", color:C.textDim, fontSize:13, padding:"20px 0" }}>Loading…</div>
              ) : !loadId && allFamilyExp.length === 0 ? (
                <div style={{ textAlign:"center", padding:"24px 0" }}>
                  <div style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:6 }}>No expenses recorded yet</div>
                  <div style={{ fontSize:12, color:C.textDim }}>Select a family member above to view their spending.</div>
                </div>
              ) : (
                <div>
                  {/* Budget progress */}
                  {!!loadId && (
                    <div style={{ marginBottom:24 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.09em", textTransform:"uppercase", marginBottom:12 }}>Budget Progress — {monthLabel(curYM)}</div>
                      {PERSONAL_CATEGORIES.filter(cat => categoryTotals[cat] > 0 || getBudget(cat) > 0).length === 0 && (
                        <div style={{ color:C.textDim, fontSize:12 }}>No spending or budgets set this month.</div>
                      )}
                      {PERSONAL_CATEGORIES.filter(cat => categoryTotals[cat] > 0 || getBudget(cat) > 0).map(cat => {
                        const spent  = categoryTotals[cat];
                        const budget = getBudget(cat);
                        const pct    = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
                        const isOver = budget > 0 && spent >= budget * 0.9;
                        return (
                          <div key={cat} style={{ marginBottom:14 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5, flexWrap:"wrap", gap:6 }}>
                              <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{cat}</span>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <span style={{ fontSize:12, fontFamily:C.mono, color:C.text }}>{$F(spent)}</span>
                                {budget > 0 && <span style={{ fontSize:11, color:C.textDim }}>/ {$F(budget)}</span>}
                                {editingBudgetCat === cat ? (
                                  <input type="number" value={budgetInput} autoFocus
                                    onChange={e => setBudgetInput(e.target.value)}
                                    onBlur={() => { handleSetBudget(cat, budgetInput); setEditingBudgetCat(null); }}
                                    onKeyDown={e => { if (e.key === "Enter") { handleSetBudget(cat, budgetInput); setEditingBudgetCat(null); } if (e.key === "Escape") setEditingBudgetCat(null); }}
                                    style={{ width:84, padding:"2px 6px", background:C.goldLight, border:`1px solid ${C.gold}`, borderRadius:4, fontSize:12, fontFamily:C.mono, outline:"none" }}
                                  />
                                ) : (
                                  <button onClick={() => { setBudgetInput(budget > 0 ? budget.toString() : ""); setEditingBudgetCat(cat); }}
                                    style={{ fontSize:10, padding:"2px 8px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:4, color:C.textDim, cursor:"pointer" }}>
                                    {budget > 0 ? "Edit" : "Set Budget"}
                                  </button>
                                )}
                              </div>
                            </div>
                            {budget > 0 && (
                              <>
                                <div style={{ background:C.border, borderRadius:4, height:6, overflow:"hidden" }}>
                                  <div style={{ width:`${pct}%`, height:"100%", background: isOver ? C.red : C.green, transition:"width 0.3s", borderRadius:4 }} />
                                </div>
                                <div style={{ fontSize:10, color: isOver ? C.redText : C.textDim, marginTop:3 }}>
                                  {isOver ? `Over by ${$F(spent - budget)}` : `${$F(budget - spent)} remaining`}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Recent transactions */}
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.09em", textTransform:"uppercase", marginBottom:10 }}>Recent Transactions</div>
                    {thisMonthExp.length === 0 ? (
                      <div style={{ textAlign:"center", padding:"20px 0" }}>
                        <div style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:6 }}>No expenses this month</div>
                        <div style={{ fontSize:12, color:C.textDim, marginBottom:14 }}>Track your spending to see progress here.</div>
                        {!!loadId && (
                          <button onClick={() => setShowAddModal(true)}
                            style={{ padding:"10px 24px", background:C.gold, border:"none", borderRadius:10, color:"#FFF", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                            Add First Expense
                          </button>
                        )}
                      </div>
                    ) : thisMonthExp.slice(0, 20).map(e => (
                      <div key={e.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:500, color:C.text }}>{e.category}{e.subcategory ? ` · ${e.subcategory}` : ""}</div>
                          {e.description && <div style={{ fontSize:11, color:C.textDim, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.description}</div>}
                          <div style={{ fontSize:10, color:C.textDim }}>{e.date} · {e.payment_method}</div>
                        </div>
                        <span style={{ fontFamily:C.mono, fontWeight:700, color:C.red, flexShrink:0 }}>{$F(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TRENDS ── */}
          {subTab === "trends" && (
            <div>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.09em", textTransform:"uppercase", marginBottom:12 }}>Monthly Spending — Last 6 Months</div>
                <div style={{ overflowX:"auto" }}>
                  <svg width={Math.max(360, last6.length * 80)} height={160} style={{ display:"block" }}>
                    {monthlyTotals.map((m, i) => {
                      const barH = Math.max(4, (m.total / maxMTotal) * 100);
                      const bX   = i * 80 + 10;
                      const bW   = 60;
                      const bY   = 110 - barH;
                      return (
                        <g key={m.month}>
                          <rect x={bX} y={bY} width={bW} height={barH} rx={4} fill={m.month === curYM ? C.gold : C.blueLight} />
                          <text x={bX + bW/2} y={148} textAnchor="middle" fontSize={10} fill={C.textDim} fontFamily={C.sans}>{monthLabel(m.month).split(" ")[0]}</text>
                          {m.total > 0 && <text x={bX + bW/2} y={bY - 4} textAnchor="middle" fontSize={9} fill={C.textMid} fontFamily={C.mono}>{$K(m.total)}</text>}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:16 }}>
                {[
                  { label:"This Month", ym: curYM },
                  { label:"Last Month", ym: monthsBetween(SYSTEM_START, curYM).slice(-2)[0] },
                ].map(({ label, ym }) => {
                  const periodExp = displayExp.filter(e => e.date && e.date.slice(0,7) === ym);
                  const total = periodExp.reduce((s, e) => s + safe(e.amount), 0);
                  const byCat = PERSONAL_CATEGORIES
                    .map(cat => ({ cat, total: periodExp.filter(e => e.category === cat).reduce((s, e) => s + safe(e.amount), 0) }))
                    .filter(x => x.total > 0).sort((a, b) => b.total - a.total).slice(0, 3);
                  return (
                    <Card key={label}>
                      <div style={{ fontSize:11, fontWeight:700, color:C.textDim, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>{label}</div>
                      <div style={{ fontSize:24, fontFamily:C.mono, fontWeight:800, color:C.gold, marginBottom:14 }}>{$F(total)}</div>
                      {byCat.length === 0 ? <div style={{ color:C.textDim, fontSize:12 }}>No data.</div> : byCat.map(x => (
                        <div key={x.cat} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                          <span style={{ fontSize:13, color:C.text }}>{x.cat}</span>
                          <span style={{ fontFamily:C.mono, fontSize:13, color:C.gold }}>{$F(x.total)}</span>
                        </div>
                      ))}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ALL TRANSACTIONS ── */}
          {subTab === "allexpenses" && (
            <div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions…"
                  style={{ flex:1, minWidth:130, padding:"8px 12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, fontFamily:C.sans, outline:"none" }} />
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                  style={{ padding:"8px 12px", border:`1px solid ${C.border}`, borderRadius:8, background:C.surface, color:C.text, fontSize:13, cursor:"pointer", outline:"none" }}>
                  <option value="All">All Categories</option>
                  {PERSONAL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
                  style={{ padding:"8px 12px", border:`1px solid ${C.border}`, borderRadius:8, background:C.surface, color:C.text, fontSize:13, cursor:"pointer", outline:"none" }}>
                  <option value="All">All Methods</option>
                  {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
                <button onClick={() => setSortDesc(d => !d)}
                  style={{ padding:"8px 14px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.textMid, fontSize:12, cursor:"pointer" }}>
                  {sortDesc ? "Newest ↓" : "Oldest ↑"}
                </button>
              </div>
              {filteredAll.length === 0 ? (
                <div style={{ textAlign:"center", padding:"32px 0", color:C.textDim }}>
                  <div style={{ fontSize:14, marginBottom:10 }}>No transactions found.</div>
                  {!!loadId && (
                    <button onClick={() => setShowAddModal(true)}
                      style={{ padding:"8px 20px", background:C.gold, border:"none", borderRadius:8, color:"#FFF", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                      Add Expense
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:11, color:C.textDim, marginBottom:10 }}>{filteredAll.length} transaction{filteredAll.length !== 1 ? "s" : ""}</div>
                  {filteredAll.map(e => (
                    <div key={e.id} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", marginBottom:2 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{e.category}</span>
                          {e.subcategory && <span style={{ fontSize:11, color:C.textDim }}>{e.subcategory}</span>}
                          <span style={{ background:C.bg, color:C.textMid, borderRadius:4, fontSize:10, padding:"1px 6px" }}>{e.payment_method}</span>
                        </div>
                        {e.description && <div style={{ fontSize:12, color:C.textMid }}>{e.description}</div>}
                        <div style={{ fontSize:10, color:C.textDim }}>{e.date}</div>
                      </div>
                      <span style={{ fontFamily:C.mono, fontWeight:700, color:C.red, flexShrink:0, fontSize:14 }}>{$F(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── HISTORY TAB ──────────────────────────────────────────────────────────────
function HistoryTab({ data, onSaveSnapshot }) {
  const [drill, setDrill] = useState(null); // snapshot object
  const [snapNote, setSnapNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const snapshots = [...(data.snapshots || [])].reverse();
  const curYM = currentYM();
  const hasThisMonth = (data.snapshots || []).some(s => s.month === curYM);

  if (drill) {
    return (
      <div>
        <button onClick={() => setDrill(null)} style={{ fontSize: 12, background: "none", border: `1px solid ${C.border}`, borderRadius: 6, color: C.textDim, padding: "6px 14px", cursor: "pointer", marginBottom: 20 }}>← Back</button>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Snapshot — {monthLabel(drill.month)}</div>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>Captured {new Date(drill.capturedAt).toLocaleString()}</div>
          {drill.note && <div style={{ fontSize: 12, color: C.textMid, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", marginBottom: 8 }}>{drill.note}</div>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Net Worth",      val: $F(drill.nw),         color: drill.nw >= 0 ? C.gold : C.red },
            { label: "Liquid RE",      val: $K(drill.reLiquid),   color: C.gold },
            { label: "RE Equity",      val: $K(drill.reEquity),   color: C.amber },
            { label: "Individuals",    val: $K(drill.individuals),color: drill.individuals >= 0 ? C.green : C.red },
            { label: "Businesses",     val: $K(drill.businesses), color: C.blue },
          ].map((s, i) => (
            <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontFamily: C.mono, fontWeight: 700, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
        {drill.individualBreakdown && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Individuals</div>
            {drill.individualBreakdown.map((x, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <span style={{ color: C.textMid }}>{x.name}</span>
                <span style={{ fontFamily: C.mono, color: x.net >= 0 ? C.green : C.red, fontWeight: 700 }}>{$F(x.net)}</span>
              </div>
            ))}
          </Card>
        )}
        {drill.reBreakdown && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Real Estate</div>
            {drill.reBreakdown.map((x, i) => (
              <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ color: C.text, fontWeight: 600 }}>{x.name}</span>
                  <span style={{ fontFamily: C.mono, color: C.gold, fontWeight: 700 }}>{$K(x.liquid)} liq.</span>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <span style={{ fontSize: 11, color: C.textDim }}>Market: {$K(x.market)}</span>
                  <span style={{ fontSize: 11, color: C.textDim }}>Debt: {$K(x.debt)}</span>
                  <span style={{ fontSize: 11, color: C.textDim }}>Equity: {$K(x.equity)}</span>
                </div>
              </div>
            ))}
          </Card>
        )}
        {drill.businessBreakdown && (
          <Card>
            <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Businesses</div>
            {drill.businessBreakdown.map((x, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <span style={{ color: C.textMid }}>{x.name}{x.type === "nonprofit" ? " (NP)" : ""}</span>
                <span style={{ fontFamily: C.mono, color: x.eq >= 0 ? C.blue : C.red, fontWeight: 700 }}>{$F(x.eq)}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Capture Snapshot */}
      <div style={{ background: hasThisMonth ? C.greenLight : C.amberLight, border: `1px solid ${hasThisMonth ? "#A8D8B8" : "#F0D080"}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: hasThisMonth ? C.green : C.amber }}>
            {hasThisMonth ? `✓ ${monthLabel(curYM)} locked` : `No snapshot yet for ${monthLabel(curYM)}`}
          </div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
            {hasThisMonth ? "One snapshot per month. Next capture available in the following month." : "Snapshots record the full NW breakdown at a point in time."}
          </div>
        </div>
        {!hasThisMonth && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {showNoteInput && (
              <input type="text" placeholder="Optional note for this snapshot" value={snapNote} onChange={e => setSnapNote(e.target.value)}
                style={{ padding: "7px 12px", border: `1px solid ${C.border}`, borderRadius: 7, background: C.bg, color: C.text, fontSize: 12, fontFamily: C.sans, outline: "none", minWidth: 220 }} />
            )}
            <button onClick={() => { if (!showNoteInput) { setShowNoteInput(true); } else { onSaveSnapshot(snapNote); setSnapNote(""); setShowNoteInput(false); } }}
              style={{ fontSize: 12, background: C.gold, color: "#1A1508", border: "none", borderRadius: 7, padding: "8px 18px", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
              {showNoteInput ? "Confirm Capture" : "Capture Snapshot"}
            </button>
            {showNoteInput && (
              <button onClick={() => { setShowNoteInput(false); setSnapNote(""); }}
                style={{ fontSize: 12, background: "none", border: `1px solid ${C.border}`, borderRadius: 7, color: C.textDim, padding: "8px 14px", cursor: "pointer" }}>Cancel</button>
            )}
          </div>
        )}
      </div>

      {/* Snapshot list */}
      {snapshots.length === 0
        ? <div style={{ textAlign: "center", padding: "48px 0", color: C.textDim, fontSize: 13 }}>No snapshots captured yet.</div>
        : snapshots.map((s, i) => (
          <div key={i} onClick={() => setDrill(s)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 8, cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.boxShadow = C.shadowMd; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{monthLabel(s.month)}</div>
              <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{new Date(s.capturedAt).toLocaleDateString()}{s.note ? ` · ${s.note}` : ""}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 800, color: s.nw >= 0 ? C.gold : C.red }}>{$F(s.nw)}</div>
              <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>Net Worth</div>
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
// user.id = admin auth UUID  |  user.profile.role === "admin"
function AdminDashboard({ user, data, setData, onLogout }) {
  const [tab, setTab]               = useState("overview");
  const [saved, setSaved]           = useState(false);
  const [cashModal, setCashModal]   = useState(false);
  const [pendingSubs, setPendingSubs] = useState([]);
  const [profiles, setProfiles]     = useState([]);
  const [showReminder, setShowReminder] = useState(false);
  const [reminderData, setReminderData] = useState({ missingRent: [], missingProfits: [] });
  const [cfMonth, setCFMonth]       = useState(currentYM());
  const [accLogOpen, setAccLogOpen] = useState(null); // individual id whose log form is open
  const [accLogForm, setAccLogForm] = useState({ month: currentYM(), value: "", note: "" });
  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  useEffect(() => {
    // Load pending submissions and all member profiles in parallel
    Promise.all([getPendingSubmissions(), fetchAllProfiles()]).then(([subs, profs]) => {
      setPendingSubs(subs);
      setProfiles(profs);
    });
  }, [tab]);

  // ── One-time reminder check on mount ──
  useEffect(() => {
    const ym = currentYM();
    const missingRent = data.properties
      .filter(p => propertyOutstandingForMonth(p, data.rentPayments || [], ym) > 0);
    const missingProfits = data.businesses
      .filter(b => b.type !== "nonprofit")
      .filter(b => !(b.monthlyProfits || []).find(p => p.month === ym));
    if (missingRent.length > 0 || missingProfits.length > 0) {
      setReminderData({ missingRent, missingProfits });
      setShowReminder(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived totals (ASWC excluded from business equity) ──
  const indNet        = f => safe(f.cash) + safe(f.accounts) + safe(f.securities) + safe(f.crypto) + safe(f.physicalAssets);
  const totalREEqGross = data.properties.reduce((s, p) => s + propGrossEquity(p), 0);
  const totalREEq      = data.properties.reduce((s, p) => s + propJMFEquity(p), 0); // JMF-attributable gross equity
  const totalRENetSale = data.properties.reduce((s, p) => {
    const mkt = safe(p.market);
    const fee = mkt * 0.035;
    const selling = fee + (fee * 0.13) + 5000;
    return s + ((mkt - propCurrentMortgageBalance(p) - selling) * propOwnership(p));
  }, 0); // JMF net proceeds if all RE sold
  const totalRELiquid = totalRENetSale; // alias — liquid = JMF net after selling costs, ownership-adjusted
  const totalREVal     = data.properties.reduce((s, p) => s + safe(p.market), 0);
  const totalREDbt     = data.properties.reduce((s, p) => s + propCurrentMortgageBalance(p), 0);
  const totalPers  = data.individuals.reduce((s, f) => s + indNet(f), 0);
  const totalBiz   = data.businesses.filter(b => b.type !== "nonprofit").reduce((s, b) => s + (safe(b.cashAccounts) - safe(b.liabilities)), 0);
  const totalNW    = totalRENetSale + totalPers + totalBiz;
  const curYM      = currentYM();
  const totalMtg      = data.properties.reduce((s, p) => s + safe(p.monthlyPayment), 0);
  const totalREIncome = data.properties.reduce((s, p) => s + propEffectiveRent(p), 0);
  const totalREOut    = data.properties.reduce((s, p) => s + propMonthlyOut(p), 0);
  const totalRENCF    = totalREIncome - totalREOut;
  const aj         = data.individuals.find(f => f.id === 1);
  const cashStale  = safe(aj?.cash) === 0;

  // ── Update helpers ──
  function updPropPatch(id, patch) {
    setData(prev => {
      const arr = prev.properties.map(p => {
        if (p.id !== id) return p;
        const incoming = typeof patch === "function" ? patch(p) : patch;
        const next = { ...p, ...incoming };

        // When tax is tracked separately, preserve both the P&I component and the all-in debit.
        if (hasSeparateMortgageTax(next) || next.taxes_paid_by === "lender") {
          const touchedMonthlyTax = Object.prototype.hasOwnProperty.call(incoming, "monthlyTax");
          const touchedMonthlyPI = Object.prototype.hasOwnProperty.call(incoming, "monthly_pi");
          const touchedMonthlyPayment = Object.prototype.hasOwnProperty.call(incoming, "monthlyPayment");

          if (touchedMonthlyTax && !touchedMonthlyPayment) {
            next.monthly_payment_tax = safe(next.monthlyTax);
            next.monthlyPayment = getMortgageOperatingPayment(next) + safe(next.monthlyTax);
          }
          if (touchedMonthlyPI && !touchedMonthlyPayment) {
            next.monthlyPayment = safe(next.monthly_pi) + safe(next.monthlyTax);
          }
          if (touchedMonthlyPayment) {
            next.monthly_payment_tax = safe(next.monthlyTax);
            next.monthly_pi = Math.max(0, safe(next.monthlyPayment) - safe(next.monthlyTax));
          }
        }

        return next;
      });
      saveToDB("properties", arr);
      return { ...prev, properties: arr };
    });
    showSaved();
  }
  function updProp(id, f, v) {
    const val = Array.isArray(v) || typeof v === "string" ? v : safe(v);
    updPropPatch(id, { [f]: val });
  }
  function updInd(id, f, v) {
    const arr = data.individuals.map(x => x.id === id ? { ...x, [f]: safe(v) } : x);
    saveToDB("individuals", arr); setData(d => ({ ...d, individuals: arr })); showSaved();
  }
  function updBiz(id, f, v) {
    const arr = data.businesses.map(b => b.id === id ? { ...b, [f]: safe(v) } : b);
    saveToDB("businesses", arr); setData(d => ({ ...d, businesses: arr })); showSaved();
  }
  function updIndIncome(indId, month, income) {
    const arr = data.individuals.map(x => {
      if (x.id !== indId) return x;
      const existing = x.monthlyIncome || [];
      const has = existing.find(p => p.month === month);
      const updated = has
        ? existing.map(p => p.month === month ? { ...p, income: safe(income) } : p)
        : [...existing, { month, income: safe(income) }];
      return { ...x, monthlyIncome: updated };
    });
    saveToDB("individuals", arr); setData(d => ({ ...d, individuals: arr })); showSaved();
  }
  function updIndAccountsLog(indId, entry) {
    const arr = data.individuals.map(x => {
      if (x.id !== indId) return x;
      const log = [...(x.accountsLog || []), { ...entry, timestamp: new Date().toISOString() }];
      return { ...x, accountsLog: log };
    });
    saveToDB("individuals", arr); setData(d => ({ ...d, individuals: arr })); showSaved();
  }
  function saveSnapshot(note) {
    const indNet = f => safe(f.cash) + safe(f.accounts) + safe(f.securities) + safe(f.crypto) + safe(f.physicalAssets);
    const snapNW = data.properties.reduce((s, p) => {
      const mkt = safe(p.market); const fee = mkt * 0.035; const sell = fee + fee * 0.13 + 5000;
      return s + (mkt - propCurrentMortgageBalance(p) - sell) * propOwnership(p);
    }, 0)
      + data.individuals.reduce((s, f) => s + indNet(f), 0)
      + data.businesses.filter(b => b.type !== "nonprofit").reduce((s, b) => s + safe(b.cashAccounts) - safe(b.liabilities), 0);
    const snapREEq  = data.properties.reduce((s, p) => s + propJMFEquity(p), 0);
    const snapRELiq = data.properties.reduce((s, p) => {
      const mkt = safe(p.market); const fee = mkt * 0.035; const sell = fee + fee * 0.13 + 5000;
      return s + (mkt - propCurrentMortgageBalance(p) - sell) * propOwnership(p);
    }, 0);
    const snap = {
      month: currentYM(), capturedAt: new Date().toISOString(), nw: snapNW, note: note || "",
      reEquity: snapREEq, reLiquid: snapRELiq,
      individuals: data.individuals.reduce((s, f) => s + indNet(f), 0),
      businesses: data.businesses.filter(b => b.type !== "nonprofit").reduce((s, b) => s + safe(b.cashAccounts) - safe(b.liabilities), 0),
      individualBreakdown: data.individuals.map(f => ({ id: f.id, name: f.name, net: indNet(f) })),
      businessBreakdown: data.businesses.map(b => ({ id: b.id, name: b.name, eq: safe(b.cashAccounts) - safe(b.liabilities), type: b.type })),
      reBreakdown: data.properties.map(p => {
        const mkt = safe(p.market); const fee = mkt * 0.035; const sell = fee + fee * 0.13 + 5000;
        return { id: p.id, name: p.name, market: mkt, debt: propCurrentMortgageBalance(p), equity: propJMFEquity(p), liquid: (mkt - propCurrentMortgageBalance(p) - sell) * propOwnership(p) };
      }),
    };
    const existing = data.snapshots || [];
    if (existing.some(s => s.month === snap.month)) return null; // hard lock — one per month
    const updated = [...existing, snap];
    saveToDB("snapshots", updated);
    setData(d => ({ ...d, snapshots: updated }));
    showSaved();
    return snap;
  }
  function updBizProfit(bizId, month, profit) {
    const arr = data.businesses.map(b => {
      if (b.id !== bizId) return b;
      const existing = b.monthlyProfits || [];
      const has = existing.find(p => p.month === month);
      const updated = has
        ? existing.map(p => p.month === month ? { ...p, profit: safe(profit) } : p)
        : [...existing, { month, profit: safe(profit) }];
      return { ...b, monthlyProfits: updated };
    });
    saveToDB("businesses", arr); setData(d => ({ ...d, businesses: arr })); showSaved();
  }
  function updBizProfitField(bizId, month, field, value) {
    const arr = data.businesses.map(b => {
      if (b.id !== bizId) return b;
      const existing = b.monthlyProfits || [];
      const has = existing.find(p => p.month === month);
      const current = has || { month };
      const nextEntry = { ...current, [field]: safe(value) };

      if (field !== "profit" && current.profit == null) {
        nextEntry.profit = safe(nextEntry.revenue) - safe(nextEntry.expenses);
      }

      const updated = has
        ? existing.map(p => p.month === month ? nextEntry : p)
        : [...existing, nextEntry];

      return { ...b, monthlyProfits: updated };
    });
    saveToDB("businesses", arr); setData(d => ({ ...d, businesses: arr })); showSaved();
  }
  function updRentPayment(payloadOrPropertyId, month, received, note) {
    const payload = typeof payloadOrPropertyId === "object"
      ? payloadOrPropertyId
      : { propertyId: payloadOrPropertyId, month, amount: received, note };
    const existing = (data.rentPayments || []).map(normalizeRentPayment);
    const idx = existing.findIndex(r =>
      r.propertyId === payload.propertyId &&
      r.unitId === (payload.unitId || "") &&
      r.leaseId === (payload.leaseId || "") &&
      r.month === payload.month &&
      r.type === "payment"
    );
    const entry = normalizeRentPayment({
      ...payload,
      type: "payment",
      amount: safe(payload.amount),
      date: payload.date || `${payload.month}-01`,
    });
    const updated = idx >= 0
      ? existing.map((r, i) => i === idx ? entry : r)
      : [...existing, entry];
    saveToDB("rentPayments", updated); setData(d => ({ ...d, rentPayments: updated })); showSaved();
  }
  function updCF(type, idx, v) {
    const a = [...data.cashflow[type]];
    a[idx] = { ...a[idx], amount: safe(v) };
    const cf = { ...data.cashflow, [type]: a };
    saveToDB("cashflow", cf); setData(d => ({ ...d, cashflow: cf })); showSaved();
  }
  function delCF(type, idx) {
    const a = data.cashflow[type].filter((_, i) => i !== idx);
    const cf = { ...data.cashflow, [type]: a };
    saveToDB("cashflow", cf); setData(d => ({ ...d, cashflow: cf })); showSaved();
  }

  // ── Approve: apply submitted data to individuals, mark approved ──
  async function handleApprove(sub) {
    const profile = profiles.find(p => p.id === sub.user_id);
    const individualId = profile?.individual_id;
    if (!individualId) { console.warn("Cannot approve — no individual_id in profile for", sub.user_id); return; }

    const d = sub.data || {};
    const arr = data.individuals.map(x =>
      x.id === individualId
        ? { ...x, ...Object.fromEntries(Object.entries(d).map(([k, val]) => [k, safe(val)])) }
        : x
    );
    const ok = await approveSubmission(sub.id, user.id);
    if (!ok) return;
    saveToDB("individuals", arr);
    setData(prev => ({ ...prev, individuals: arr }));
    setPendingSubs(s => s.filter(x => x.id !== sub.id));
    showSaved();
  }

  async function handleReject(subId, note) {
    const ok = await rejectSubmission(subId, user.id, note);
    if (ok) setPendingSubs(s => s.filter(x => x.id !== subId));
  }

  const TABS = ["Overview", "Real Estate", "Individuals", "Businesses", "Cash Flow", "History"];
  const tabId = t => t.toLowerCase().replace(/ /g, "");

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: C.sans }}>
      {cashModal && <CashModal current={safe(aj?.cash)} onSave={v => updInd(1, "cash", v)} onClose={() => setCashModal(false)} />}
      {showReminder && (
        <ReminderModal
          missingRent={reminderData.missingRent}
          missingProfits={reminderData.missingProfits}
          onSaveRent={(propertyId, received, note) => updRentPayment(propertyId, currentYM(), received, note)}
          onSaveProfit={(bizId, profit) => updBizProfit(bizId, currentYM(), profit)}
          onDismiss={() => setShowReminder(false)}
        />
      )}
      {/* NAV */}
      <div style={{ background: C.nav, borderBottom: `1px solid ${C.navBorder}`, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:C.gold, boxShadow:`0 0 8px ${C.gold}` }} />
            <span style={{ fontSize: 17, fontWeight: 800, color: C.gold, letterSpacing: "0.1em" }}>JMF</span>
          </div>
          <span style={{ fontSize: 11, color: C.navText, letterSpacing:"0.05em" }}>Family Office</span>
          {saved && <span style={{ fontSize: 10, color: "#FFF", background: C.green, borderRadius: 4, padding: "2px 8px", letterSpacing:"0.04em" }}>✓ SAVED</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {pendingSubs.length > 0 && (
            <button onClick={() => setTab("overview")}
              style={{ fontSize: 11, color: C.amber, background: "rgba(183,119,13,0.15)", border: `1px solid rgba(183,119,13,0.3)`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}>
              {pendingSubs.length} pending review
            </button>
          )}
          {cashStale && (
            <button onClick={() => setCashModal(true)}
              style={{ fontSize: 11, color: C.amber, background: "rgba(183,119,13,0.15)", border: `1px solid rgba(183,119,13,0.3)`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}>
              Cash not updated
            </button>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, color: C.gold, background: "rgba(184,150,46,0.15)", border:`1px solid rgba(184,150,46,0.25)`, borderRadius: 4, padding: "3px 8px", letterSpacing:"0.06em" }}>ADMIN</span>
          <span style={{ fontSize: 12, color: C.navText }}>{user.profile?.display_name || user.email}</span>
          <button onClick={onLogout} style={{ background: "transparent", border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 6, color: C.navText, fontSize: 11, padding: "5px 12px", cursor: "pointer" }}>Sign out</button>
        </div>
      </div>

      {/* HERO */}
      <div style={{ background: `linear-gradient(160deg, ${C.nav} 0%, #152238 100%)`, padding: "52px 28px 44px", textAlign: "center" }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 16 }}>JMF Consolidated Net Worth</div>
        <div style={{ fontSize: 62, fontWeight: 800, fontFamily: C.mono, color: totalNW < 0 ? "#FF6B6B" : C.gold, letterSpacing: -2, lineHeight: 1, textShadow: totalNW >= 0 ? `0 0 40px rgba(184,150,46,0.3)` : "none" }}>
          {$F(totalNW)}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 16, letterSpacing: "0.06em" }}>
          Est. net if sold · {data.lastUpdated}
        </div>
      </div>

      {/* KPI STRIP — 3 clean stats */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", maxWidth: 800, margin: "0 auto" }}>
          {[
            { label: "Liquid RE Value",     val: $K(totalRELiquid), sub: `${((totalRELiquid / Math.max(1, Math.abs(totalNW))) * 100).toFixed(0)}% of NW`, color: C.gold },
            { label: "Net of Individuals",  val: $K(totalPers),  sub: totalPers < 0 ? "Deficit" : "All members",                                   color: totalPers < 0 ? C.red : C.green },
            { label: "Business Equity",     val: $K(totalBiz),   sub: "Operating corps only",                                                       color: C.blue  },
          ].map((k, i, arr) => (
            <div key={i} style={{ flex:1, padding: "18px 24px", borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : "none", textAlign:"center" }}>
              <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: C.mono, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent:"center", padding: "0 28px" }}>
          <div style={{ display: "flex", overflowX:"auto", justifyContent:"center", width:"100%", maxWidth:860 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(tabId(t))}
              style={{ padding: "12px 18px", fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", border: "none", cursor: "pointer", background: "transparent", color: tab === tabId(t) ? C.gold : C.textDim, borderBottom: tab === tabId(t) ? `2px solid ${C.gold}` : "2px solid transparent", whiteSpace: "nowrap", fontFamily: C.sans, transition:"color 0.15s" }}>
              {t}
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* PAGE CONTENT */}
      <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div>
            <ApprovalQueue pendingSubs={pendingSubs} profiles={profiles} individuals={data.individuals} onApprove={handleApprove} onReject={handleReject} />

            {/* 3 summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Liquid RE Value",     val: $K(totalRELiquid), color: C.gold,  accent: C.gold,  sub: `After selling costs · ${data.properties.length} properties`, bg: C.goldLight },
                { label: "Net of Individuals", val: $K(totalPers),  color: totalPers < 0 ? C.red : C.green, accent: totalPers < 0 ? C.red : C.green, sub: `${data.individuals.length} members`, bg: totalPers < 0 ? C.redLight : C.greenLight },
                { label: "Business Equity",    val: $K(totalBiz),   color: C.blue,  accent: C.blue,  sub: "Operating corps only", bg: C.blueLight },
              ].map((s, i) => (
                <div key={i} style={{ background: s.bg, borderRadius: 14, padding: "22px 24px", borderTop: `3px solid ${s.accent}`, boxShadow: C.shadow }}>
                  <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>{s.label}</div>
                  <div style={{ fontSize: 30, fontFamily: C.mono, fontWeight: 800, color: s.color, letterSpacing: -0.5 }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 8 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Maintenance alerts */}
            <MaintenanceAlertsWidget />

            {/* RE portfolio mini-cards */}
            <Card accent={C.gold} style={{ marginBottom: 16, paddingTop: 24 }}>
              <Label>Real Estate Portfolio</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                {data.properties.map(p => {
                  const eq = safe(p.market) - propCurrentMortgageBalance(p);
                  return (
                    <div key={p.id} onClick={() => setTab("realestate")} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, cursor: "pointer", transition:"border-color 0.15s, box-shadow 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.boxShadow = C.shadowMd; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 7 }}>{p.name}</div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                        <StatusPill status={p.status} />
                        <OccupancyBadge status={p.occupancy_status} />
                      </div>
                      <div style={{ fontSize: 19, fontFamily: C.mono, fontWeight: 800, color: eq > 500000 ? C.gold : eq > 0 ? C.amber : C.red }}>{$K(eq)}</div>
                      <div style={{ fontSize: 10, color: C.textDim, marginTop: 3 }}>{p.rate}</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Business entity mini-cards */}
            <Card accent={C.blue} style={{ marginBottom: 16, paddingTop: 24 }}>
              <Label>Business Entities</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {data.businesses.map(b => {
                  const eq = safe(b.cashAccounts) - safe(b.liabilities);
                  const isNP = b.type === "nonprofit";
                  return (
                    <div key={b.id} onClick={() => setTab("businesses")} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, cursor: "pointer", transition:"border-color 0.15s, box-shadow 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = isNP ? C.purple : C.blue; e.currentTarget.style.boxShadow = C.shadowMd; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}>
                      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
                        <div style={{ background: isNP ? C.purpleLight : C.blueLight, color: isNP ? C.purpleText : C.blueText, borderRadius:4, fontSize:9, fontWeight:700, padding:"2px 6px" }}>{isNP ? "NON-PROFIT" : "CORP"}</div>
                        <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{b.name}</div>
                      </div>
                      {isNP ? (
                        <div style={{ fontFamily:C.mono, fontWeight:700, color:C.purple, fontSize:16 }}>{$K(safe(b.cashAccounts))}</div>
                      ) : (
                        <div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}><span style={{ color:C.textDim }}>Cash</span><span style={{ fontFamily:C.mono, color:C.green }}>{$K(safe(b.cashAccounts))}</span></div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:8 }}><span style={{ color:C.textDim }}>Liabilities</span><span style={{ fontFamily:C.mono, color:C.red }}>{$K(safe(b.liabilities))}</span></div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
                            <span style={{ color:C.textMid, fontWeight:600 }}>Net equity</span>
                            <span style={{ fontFamily:C.mono, fontWeight:700, color: eq >= 0 ? C.gold : C.red }}>{$K(eq)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Individuals mini-cards */}
            <Card accent={C.green} style={{ marginBottom: 16, paddingTop: 24 }}>
              <Label>Individuals</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
                {data.individuals.map(f => {
                  const net = indNet(f);
                  const isPos = net >= 0;
                  const curInc = (f.monthlyIncome || []).find(p => p.month === curYM)?.income;
                  return (
                    <div key={f.id} onClick={() => setTab("individuals")} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, cursor: "pointer", transition:"border-color 0.15s, box-shadow 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.green; e.currentTarget.style.boxShadow = C.shadowMd; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                        <div style={{ width:30, height:30, borderRadius:"50%", background: isPos ? C.goldLight : C.redLight, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color: isPos ? C.goldText : C.redText, flexShrink:0 }}>{f.initials}</div>
                        <div style={{ fontSize:12, fontWeight:600, color:C.text, lineHeight:1.3 }}>{f.name}</div>
                      </div>
                      <div style={{ fontSize:18, fontFamily:C.mono, fontWeight:800, color: isPos ? C.gold : C.red }}>{$K(net)}</div>
                      {curInc != null && <div style={{ fontSize:10, color:C.textDim, marginTop:4 }}>Income {monthLabel(curYM)}: {$K(curInc)}</div>}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Cash flow graph */}
            <CashFlowGraph data={data} />
          </div>
        )}

        {/* ── REAL ESTATE ── */}
        {tab === "realestate" && (() => {
          const pastMonths = monthsBetween(SYSTEM_START, currentYM()).slice(0, -1);
          const missedRents = data.properties
            .filter(p => pastMonths.some(m => propertyOutstandingForMonth(p, data.rentPayments || [], m) > 0))
            .flatMap(p => pastMonths.filter(m => {
              return propertyOutstandingForMonth(p, data.rentPayments || [], m) > 0;
            }).map(m => ({ prop: p, month: m })));
          return (
          <div>
            {missedRents.length > 0 && (
              <div style={{ background:`linear-gradient(135deg, ${C.red} 0%, #922B21 100%)`, borderRadius:12, padding:"14px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:14, boxShadow:`0 4px 16px rgba(192,57,43,0.3)` }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:"#FFF", flexShrink:0, boxShadow:"0 0 8px rgba(255,255,255,0.8)" }} />
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#FFF", marginBottom:2 }}>
                    Attention — {missedRents.length} missed rent payment{missedRents.length > 1 ? "s" : ""}
                  </div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)" }}>
                    {missedRents.map(r => `${r.prop.name} · ${monthLabel(r.month)}`).join(" · ")}
                  </div>
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Portfolio Value",    val: $K(totalREVal),    color: C.text,  sub: "Gross (5 properties)" },
                { label: "Total Debt",        val: $K(totalREDbt),    color: C.red,   sub: "All mortgages" },
                { label: "Gross Equity",      val: $K(totalREEqGross),color: C.amber, sub: "100% of all equity" },
                { label: "JMF Equity",        val: $K(totalREEq),     color: C.gold,  sub: "Ownership-adjusted" },
                { label: "Liquid RE Value",   val: $K(totalRELiquid), color: totalRELiquid >= 0 ? C.green : C.red, sub: "After selling costs · JMF share" },
                { label: "Monthly Payments",  val: $K(totalMtg),      color: C.red,   sub: `${$K(totalMtg * 12)}/yr` },
                { label: "RE Cash Flow",      val: $K(totalRENCF),    color: totalRENCF >= 0 ? C.green : C.red, sub: "Income − outflows" },
              ].map((s, i) => (
                <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontFamily: C.mono, fontWeight: 700, color: s.color }}>{s.val}</div>
                  {s.sub && <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>{s.sub}</div>}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>
              Click any property to expand. The real estate view now focuses on overview, mortgage, operating expenses, leases, and a lease-aware ledger.
            </div>
            {data.properties.map(p => (
              <PropCard
                key={p.id}
                prop={p}
                rentPayments={data.rentPayments || []}
                onUpdate={(f, v) => updProp(p.id, f, v)}
                onPatch={patch => updPropPatch(p.id, patch)}
                onSaveRentPayment={updRentPayment}
                isAdmin={true}
              />
            ))}
          </div>
          );
        })()}

        {/* ── INDIVIDUALS ── */}
        {tab === "individuals" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {data.individuals.map(f => {
              const net   = indNet(f);
              const isPos = net >= 0;
              return (
                <Card key={f.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: isPos ? C.goldLight : C.redLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: isPos ? C.goldText : C.redText, flexShrink: 0 }}>
                      {f.initials}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{f.name}</div>
                      <div style={{ fontSize: 20, fontFamily: C.mono, fontWeight: 800, color: isPos ? C.gold : C.red }}>{$F(net)}</div>
                    </div>
                  </div>
                  {[
                    { l: "Accounts",        fi: "accounts"       },
                    { l: "Cash / Vault",    fi: "cash"           },
                    { l: "Securities",      fi: "securities"     },
                    { l: "Crypto",          fi: "crypto"         },
                    { l: "Physical Assets", fi: "physicalAssets" },
                  ].map((row, i, arr) => (
                    <div key={row.fi} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", fontSize: 12 }}>
                      <span style={{ color: C.textMid }}>{row.l}</span>
                      <EditNum value={safe(f[row.fi])} onChange={v => updInd(f.id, row.fi, v)} />
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, marginTop: 4, borderTop: `2px solid ${C.border}` }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.textMid }}>Net worth</span>
                    <span style={{ fontFamily: C.mono, fontWeight: 800, fontSize: 15, color: isPos ? C.gold : C.red }}>{$F(net)}</span>
                  </div>

                  {/* Accounts Log */}
                  <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>Accounts Log</span>
                      <button onClick={() => { setAccLogOpen(accLogOpen === f.id ? null : f.id); setAccLogForm({ month: currentYM(), value: safe(f.accounts), note: "" }); }}
                        style={{ fontSize: 10, background: C.goldLight, color: C.goldText, border: `1px solid rgba(184,150,46,0.3)`, borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontWeight: 600 }}>
                        {accLogOpen === f.id ? "Cancel" : "+ Log Snapshot"}
                      </button>
                    </div>
                    {accLogOpen === f.id && (
                      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 8 }}>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 3 }}>Month</div>
                            <input type="month" value={accLogForm.month} onChange={e => setAccLogForm(p => ({ ...p, month: e.target.value }))}
                              style={{ width: "100%", padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg, color: C.text, fontSize: 12, fontFamily: C.sans, outline: "none", boxSizing: "border-box" }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 3 }}>Accounts Balance</div>
                            <input type="number" placeholder="e.g. 15000" value={accLogForm.value} onChange={e => setAccLogForm(p => ({ ...p, value: e.target.value }))}
                              style={{ width: "100%", padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg, color: C.text, fontSize: 12, fontFamily: C.mono, outline: "none", boxSizing: "border-box" }} />
                          </div>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 3 }}>Note (optional)</div>
                          <input type="text" placeholder="Context for this snapshot" value={accLogForm.note} onChange={e => setAccLogForm(p => ({ ...p, note: e.target.value }))}
                            style={{ width: "100%", padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg, color: C.text, fontSize: 12, fontFamily: C.sans, outline: "none", boxSizing: "border-box" }} />
                        </div>
                        <button onClick={() => {
                          if (!accLogForm.value && accLogForm.value !== 0) return;
                          updIndAccountsLog(f.id, { month: accLogForm.month, value: safe(accLogForm.value), note: accLogForm.note });
                          setAccLogOpen(null);
                        }} style={{ fontSize: 12, background: C.gold, color: "#1A1508", border: "none", borderRadius: 6, padding: "7px 16px", cursor: "pointer", fontWeight: 700 }}>
                          Save Snapshot
                        </button>
                      </div>
                    )}
                    {(f.accountsLog || []).length === 0
                      ? <div style={{ fontSize: 11, color: C.textDim, fontStyle: "italic" }}>No entries yet.</div>
                      : [...(f.accountsLog || [])].reverse().map((e, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "5px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                          <div>
                            <span style={{ color: C.textMid, fontWeight: 600 }}>{monthLabel(e.month)}</span>
                            {e.note && <div style={{ fontSize: 10, color: C.textDim, marginTop: 1 }}>{e.note}</div>}
                          </div>
                          <span style={{ fontFamily: C.mono, color: e.value >= 0 ? C.green : C.red, fontWeight: 700 }}>{$F(e.value)}</span>
                        </div>
                      ))
                    }
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── BUSINESSES ── */}
        {tab === "businesses" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Corp Cash",       val: $K(data.businesses.filter(b => b.type !== "nonprofit").reduce((s, b) => s + safe(b.cashAccounts), 0)), color: C.green },
                { label: "Total Liab.",     val: $K(data.businesses.reduce((s, b) => s + safe(b.liabilities), 0)),  color: C.red   },
                { label: "CRA Payable",     val: $K(data.businesses.reduce((s, b) => s + safe(b.taxPayable), 0)),   color: C.amber },
                { label: "Net Corp Equity", val: $K(totalBiz),                                                       color: C.gold  },
              ].map((s, i) => (
                <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontFamily: C.mono, fontWeight: 700, color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>
            <div style={{ background: C.amberLight, border: `1px solid #F0D080`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: C.amber, lineHeight: 1.7 }}>
              Operating corporations are legally separate from personal finances. ASWC is a non-profit tracked for reference only — excluded from all NW calculations.
            </div>
            {data.businesses.map(b => <BizCard key={b.id} biz={b} onUpdate={(f, v) => updBiz(b.id, f, v)} onUpdateProfit={(month, profit) => updBizProfit(b.id, month, profit)} onUpdateProfitField={(month, field, value) => updBizProfitField(b.id, month, field, value)} isAdmin={true} />)}
          </div>
        )}

        {/* ── CASH FLOW ── */}
        {tab === "cashflow" && (() => {
          // Computed income for selected month
          const cfBizIn  = data.businesses.filter(b => b.type !== "nonprofit").reduce((s, b) => {
            const e = (b.monthlyProfits || []).find(p => p.month === cfMonth);
            return s + safe(e?.profit);
          }, 0);
          const cfRentIn  = (data.rentPayments || []).map(normalizeRentPayment).filter(r => r.month === cfMonth).reduce((s, r) => s + safe(r.amount), 0);
          const cfPayroll = data.individuals.reduce((s, ind) => {
            const e = (ind.monthlyIncome || []).find(p => p.month === cfMonth);
            return s + safe(e?.income);
          }, 0);
          const cfOther  = data.cashflow.income.reduce((s, i) => s + safe(i.amount), 0);
          const cfTotalIn  = cfBizIn + cfRentIn + cfPayroll + cfOther;
          const cfTotalOut = data.cashflow.obligations.reduce((s, o) => s + safe(o.amount), 0);
          const cfGap      = cfTotalIn - cfTotalOut;
          return (
            <div>
              {/* Month selector */}
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
                <span style={{ fontSize:12, color:C.textMid, fontWeight:600 }}>Viewing month:</span>
                <select value={cfMonth} onChange={e => setCFMonth(e.target.value)}
                  style={{ padding:"7px 12px", border:`1px solid ${C.border}`, borderRadius:8, background:C.surface, color:C.text, fontSize:13, fontFamily:C.sans, cursor:"pointer", outline:"none" }}>
                  {[...monthsBetween(SYSTEM_START, currentYM())].reverse().map(m => (
                    <option key={m} value={m}>{monthLabel(m)}</option>
                  ))}
                </select>
              </div>

              {/* Summary banner */}
              <div style={{ borderRadius: 12, padding: "24px 20px", marginBottom: 20, textAlign: "center", background: cfGap >= 0 ? C.greenLight : C.redLight, border: `1px solid ${cfGap >= 0 ? "#A8D8B8" : "#F5C6C3"}` }}>
                <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Cash Flow — {monthLabel(cfMonth)}</div>
                <div style={{ fontSize: 48, fontFamily: C.mono, fontWeight: 800, color: cfGap >= 0 ? C.green : C.red }}>{cfGap >= 0 ? "+" : ""}{$F(cfGap)}</div>
                <div style={{ fontSize: 13, color: C.textMid, marginTop: 10 }}>
                  {cfTotalIn === 0
                    ? "Log business profits and rent to see your true monthly position."
                    : cfGap < 0
                      ? `Need ${$F(Math.abs(cfGap))} more to break even.`
                      : `${$F(cfGap)} surplus.`}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                <Card>
                  <div style={{ fontSize: 11, color: C.green, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>↑ Income — {monthLabel(cfMonth)}</div>

                  {/* Business net profits */}
                  {data.businesses.filter(b => b.type !== "nonprofit").map(b => {
                    const entry  = (b.monthlyProfits || []).find(p => p.month === cfMonth);
                    const profit = safe(entry?.profit);
                    return (
                      <div key={b.id} style={{ padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontSize: 13, color: C.text }}>{b.name}</span>
                          <span style={{ fontFamily: C.mono, fontSize: 14, color: entry ? (profit >= 0 ? C.gold : C.red) : C.textDim }}>
                            {entry ? $F(profit) : "—"}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>Net profit · log in Businesses tab</div>
                      </div>
                    );
                  })}

                  {/* Rental income from ledger */}
                  <div style={{ padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize: 13, color: C.text }}>Rental income</span>
                      <span style={{ fontFamily: C.mono, fontSize: 14, color: cfRentIn > 0 ? C.gold : C.textDim }}>{cfRentIn > 0 ? $F(cfRentIn) : "—"}</span>
                    </div>
                    <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>From rent ledger · log in Real Estate tab</div>
                  </div>

                  {/* Monthly Income — per individual */}
                  <div style={{ padding: "9px 0 4px", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom: 8 }}>Monthly Income</div>
                    {data.individuals.map(ind => {
                      const entry  = (ind.monthlyIncome || []).find(p => p.month === cfMonth);
                      const income = safe(entry?.income);
                      return (
                        <div key={ind.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0" }}>
                          <span style={{ fontSize:12, color:C.text }}>{ind.name}</span>
                          <EditNum value={income} onChange={v => updIndIncome(ind.id, cfMonth, v)} />
                        </div>
                      );
                    })}
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, paddingTop:6, borderTop:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:11, color:C.textMid }}>Total monthly income</span>
                      <span style={{ fontFamily:C.mono, fontSize:12, color: cfPayroll > 0 ? C.gold : C.textDim }}>{cfPayroll > 0 ? $F(cfPayroll) : "—"}</span>
                    </div>
                  </div>

                  {/* Other static income */}
                  {data.cashflow.income.map((item, i) => (
                    <div key={i} style={{ padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{item.label}</span>
                        <EditNum value={safe(item.amount)} onChange={v => updCF("income", i, v)} />
                        <button onClick={() => delCF("income", i)} title="Remove" style={{ background:"none", border:"none", color:C.textDim, cursor:"pointer", fontSize:16, padding:"0 2px", lineHeight:1, flexShrink:0 }}>×</button>
                      </div>
                    </div>
                  ))}

                  <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0 0", fontWeight: 700 }}>
                    <span style={{ color: C.textMid }}>Total in</span>
                    <span style={{ fontFamily: C.mono, fontSize: 15, color: C.green }}>{$F(cfTotalIn)}</span>
                  </div>
                </Card>

                <Card>
                  <div style={{ fontSize: 11, color: C.red, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>↓ Monthly Obligations</div>
                  {data.cashflow.obligations.map((item, i) => (
                    <div key={i} style={{ padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{item.label}</span>
                        <EditNum value={safe(item.amount)} onChange={v => updCF("obligations", i, v)} />
                        <button onClick={() => delCF("obligations", i)} title="Remove" style={{ background:"none", border:"none", color:C.textDim, cursor:"pointer", fontSize:16, padding:"0 2px", lineHeight:1, flexShrink:0 }}>×</button>
                      </div>
                      {item.note && <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{item.note}</div>}
                    </div>
                  ))}
                  <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0 0", fontWeight: 700 }}>
                    <span style={{ color: C.textMid }}>Total out</span>
                    <span style={{ fontFamily: C.mono, fontSize: 15, color: C.red }}>{$F(cfTotalOut)}</span>
                  </div>
                </Card>
              </div>
            </div>
          );
        })()}

        {/* ── HISTORY ── */}
        {tab === "history" && (
          <HistoryTab data={data} onSaveSnapshot={note => saveSnapshot(note)} />
        )}

      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(null);
  const [data, setData]       = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(s) {
      if (!s) {
        if (!cancelled) { setSession(null); setProfile(null); setData(null); }
        return;
      }

      // Load profile and dashboard data in parallel
      const [prof, dbData] = await Promise.all([
        fetchProfile(s.user.id),
        loadFromDB(),
      ]);

      if (cancelled) return;

      setSession(s);
      setProfile(prof);

      if (dbData) {
        const mergedProperties = mergeById(DEFAULT.properties, dbData.properties).map(normalizeProperty);
        const mergedRentPayments = (dbData.rentPayments || DEFAULT.rentPayments).map(normalizeRentPayment);
        const correctedBalances = {
          1: 728134.68,   // 27 Roytec Rd.
          3: 1824886.46,  // 121 Milky Way
          4: 1523755.81,  // 51 Ahchie Crt.
          5: 894768.98,   // 4 New Seabury Dr.
        };
        // Temporary market override — protects against stale Supabase values overriding DEFAULT via mergeById.
        // Remove per-property entries here once Valuation Log becomes the source of truth for market value.
        const marketFix = {
          1: 2000000,   // 27 Roytec Rd.
          2: 1200000,   // Farr Ave.
          3: 2850000,   // 121 Milky Way
          4: 1750000,   // 51 Ahchie Crt.
          5: 958800,    // 4 New Seabury Dr.
        };
        const correctedProps = mergedProperties.map(p => {
          const balFix  = correctedBalances[p.id];
          const rateFix    = { 3: 5.79,                    4: 5.79                    }[p.id];
          const rateStrFix = { 3: "5.79%",                4: "5.79%"                 }[p.id];
          const rateTypFix = { 3: "12 Month Fixed Closed", 4: "12 Month Fixed Closed" }[p.id];
          const matFix     = { 3: "Apr 1, 2027",           4: "Apr 1, 2027"           }[p.id];
          const pifix      = { 3: 11722.76,                4: 9107                    }[p.id];
          const taxfix     = { 3: 905.29,                  4: 1235.14                 }[p.id];
          const pmtfix     = { 3: 12628.05,                4: 10342.14                }[p.id];
          return {
            ...p,
            ...(balFix     !== undefined && { mortgage:             balFix     }),
            ...(rateFix    !== undefined && { interest_rate:        rateFix    }),
            ...(rateStrFix !== undefined && { rate:                 rateStrFix }),
            ...(rateTypFix !== undefined && { rateType:             rateTypFix }),
            ...(matFix     !== undefined && { maturity:             matFix     }),
            ...(pifix      !== undefined && { monthly_pi:           pifix      }),
            ...(taxfix     !== undefined && { monthly_payment_tax:  taxfix     }),
            ...(pmtfix     !== undefined && { monthlyPayment:       pmtfix     }),
            ...(marketFix[p.id] !== undefined && { market:          marketFix[p.id] }),
          };
        });
        saveToDB("properties", correctedProps);
        setData({
          ...DEFAULT,
          individuals:  mergeById(DEFAULT.individuals, dbData.individuals),
          properties:   correctedProps,
          businesses:   mergeById(DEFAULT.businesses,  dbData.businesses),
          cashflow:     dbData.cashflow     || DEFAULT.cashflow,
          rentPayments: mergedRentPayments,
          snapshots:    dbData.snapshots    || [],
        });
      } else {
        // First run — seed the database with defaults
        saveToDB("individuals",  DEFAULT.individuals);
        saveToDB("properties",   DEFAULT.properties);
        saveToDB("businesses",   DEFAULT.businesses);
        saveToDB("cashflow",     DEFAULT.cashflow);
        saveToDB("rentPayments", DEFAULT.rentPayments);
        setData({
          ...DEFAULT,
          properties: DEFAULT.properties.map(normalizeProperty),
          rentPayments: DEFAULT.rentPayments.map(normalizeRentPayment),
        });
      }
    }

    // Restore existing session on page load
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!cancelled) bootstrap(s);
    });

    // React to auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (cancelled) return;
      if (event === "SIGNED_OUT") {
        setSession(null); setProfile(null); setData(null);
      } else if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        bootstrap(s);
      } else if (event === "TOKEN_REFRESHED") {
        setSession(s); // just update token, don't reload everything
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  function updInd(id, field, val) {
    if (!data) return;
    const arr = data.individuals.map(x => x.id === id ? { ...x, [field]: safe(val) } : x);
    saveToDB("individuals", arr);
    setData(d => ({ ...d, individuals: arr }));
  }

  // Still checking session
  if (session === undefined) return <LoadingScreen />;

  // Not logged in
  if (!session) return <LoginScreen />;

  // Logged in but profile or data not yet loaded
  if (!profile || !data) return <LoadingScreen />;

  const currentUser = { ...session.user, profile };
  const isAdmin     = profile.role === "admin";
  const logout      = () => supabase.auth.signOut();

  if (isAdmin) {
    return <AdminDashboard user={currentUser} data={data} setData={setData} onLogout={logout} />;
  }
  return <MemberView user={currentUser} data={data} onUpdate={updInd} onSaveIncome={(indId, month, income) => {
    const arr = data.individuals.map(x => {
      if (x.id !== indId) return x;
      const existing = x.monthlyIncome || [];
      const has = existing.find(p => p.month === month);
      const updated = has
        ? existing.map(p => p.month === month ? { ...p, income } : p)
        : [...existing, { month, income }];
      return { ...x, monthlyIncome: updated };
    });
    saveToDB("individuals", arr);
    setData(d => ({ ...d, individuals: arr }));
  }} onLogout={logout} />;
}
