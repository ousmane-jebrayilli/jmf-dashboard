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

// ─── DEFAULT DATA — April 1, 2026 ─────────────────────────────────────────────
const DEFAULT = {
  lastUpdated: "April 1, 2026",

  individuals: [
    { id:1, name:"Ahmed (AJ)",         initials:"AJ", cash:0,   accounts:1023,  debt:0, securities:46610, crypto:1466, physicalAssets:0, monthlyIncome:[] },
    { id:2, name:"Nazila Isgandarova", initials:"NI", cash:0,   accounts:15647, debt:0, securities:39939, crypto:0,    physicalAssets:0, monthlyIncome:[] },
    { id:3, name:"Yasin Majidov",      initials:"YM", cash:500, accounts:0,     debt:0, securities:0,     crypto:0,    physicalAssets:0, monthlyIncome:[] },
    { id:4, name:"Maryam Majidova",    initials:"MM", cash:0,   accounts:1305,  debt:0, securities:0,     crypto:0,    physicalAssets:0, monthlyIncome:[] },
    { id:5, name:"Akbar Majidov",      initials:"AM", cash:0,   accounts:-1089, debt:0, securities:0,     crypto:0,    physicalAssets:0, monthlyIncome:[] },
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
      purchase:1020000, market:2000000, mortgage:728134, original_balance:0, ownership:1,
      interest_rate:6.25, rate:"P+1.80% (≈6.25%)", rateType:"Floating / Prime + 1.80",
      maturity:"TBC", remaining_amortization_months:300, taxes_paid_by:"owner",
      monthlyPayment:0, monthly_pi:0, monthly_payment_tax:0,
      tax_account_balance:0, monthlyTax:0, annual_property_tax_estimate:0,
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
      covenant_notes:"DSCR ≥ 1.25× inception · ≥ 1.20× renewal · Min. vacancy factor 5% · Min. mgmt fee 5% · Business interruption ins. ≥ 12 months rent · Fire ins. ≥ $750K · Liability ≥ $2M · Arrangement fee $3,000 · Annual renewal fee $1,000",
      lender:"TD Bank",
      notes:"Borrower: PRIMA Centre for Mental Health and Wellness Inc. Floating — 6.25% is a scenario (prime 4.45% + 1.80%). Balance $728,134 confirmed April 1, 2026.",
    },
    {
      id:2, name:"3705 Farr Ave.", status:"STRONG", property_type:"vacant_land",
      purchase:250000, market:1200000, mortgage:0, original_balance:0,
      interest_rate:0, rate:"N/A", rateType:"Mortgage-free",
      maturity:"N/A", remaining_amortization_months:0, taxes_paid_by:"owner",
      monthlyPayment:0, monthly_pi:0, monthly_payment_tax:0,
      tax_account_balance:0, monthlyTax:0, annual_property_tax_estimate:0,
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
    },
    {
      id:3, name:"121 Milky Way", status:"WATCH", property_type:"residential",
      purchase:3079729, market:2850000, mortgage:1824726, original_balance:2000000,
      interest_rate:7.95, rate:"7.95%", rateType:"12 Month Fixed Open",
      maturity:"Dec 2026", remaining_amortization_months:285, taxes_paid_by:"lender",
      monthlyPayment:15013, monthly_pi:14108, monthly_payment_tax:905,
      tax_account_balance:2362, monthlyTax:905, annual_property_tax_estimate:10863,
      tax_notice_outstanding:0, tax_notice_penalty:0, tax_notice_next_installment:0, tax_notice_next_due:"",
      monthly_insurance:0, annual_insurance:0,
      maintenance_reserve_monthly:0, management_fee_monthly:0, utilities_monthly:0, capex_reserve_monthly:0,
      rentalIncome:0, rental_market_monthly:0,
      occupancy_status:"owner_occupied",
      tenant_summary:"Owner-resided by family", vacancy_notes:"",
      sections:[], covenant_notes:"",
      lender:"Equitable Bank",
      notes:"Fixed Open — refinanceable without penalty. Tax escrowed by lender. Fee balance: $160.",
    },
    {
      id:4, name:"51 Ahchie Crt.", status:"RISK", property_type:"residential",
      purchase:2119105, market:1750000, mortgage:1523326, original_balance:1553670,
      interest_rate:5.24, rate:"5.24%", rateType:"36 Month ARM Closed",
      maturity:"Apr 2026", remaining_amortization_months:336, taxes_paid_by:"lender",
      monthlyPayment:9837, monthly_pi:8601, monthly_payment_tax:1235,
      tax_account_balance:21603, monthlyTax:1235, annual_property_tax_estimate:14820,
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
      ], covenant_notes:"",
      lender:"Equitable Bank",
      notes:"ARM matured April 2026 — renewal due immediately. Market $369K below purchase. Tax account $21,603 — review with lender. Fee balance: $430.",
    },
    {
      id:5, name:"4 New Seabury Dr.", status:"WATCH", property_type:"residential",
      purchase:349000, market:958800, mortgage:894769, original_balance:960000,
      interest_rate:5.94, rate:"5.94%", rateType:"60 Month Fixed Closed",
      maturity:"Dec 2029", remaining_amortization_months:311, taxes_paid_by:"lender",
      monthlyPayment:5979, monthly_pi:5605, monthly_payment_tax:374,
      tax_account_balance:1458, monthlyTax:374, annual_property_tax_estimate:4484,
      tax_notice_outstanding:0, tax_notice_penalty:0, tax_notice_next_installment:0, tax_notice_next_due:"",
      monthly_insurance:0, annual_insurance:0,
      maintenance_reserve_monthly:0, management_fee_monthly:0, utilities_monthly:0, capex_reserve_monthly:0,
      rentalIncome:3900, rental_market_monthly:3900,
      occupancy_status:"lease_signed_pending_possession",
      tenant_summary:"Lease signed. Possession: April 20, 2026.",
      vacancy_notes:"Currently vacant. Rent collection begins at possession.",
      sections:[], covenant_notes:"",
      ownership:0.6667, co_owner:"Abassli family (33.3%)",
      lender:"Equitable Bank",
      notes:"Fixed 5.94%. JMF 2/3 share — co-owned with Abassli family. Fee balance: $550. Tax escrowed by lender.",
    },
  ],

  cashflow: {
    income: [
      { label:"Other income", amount:0, note:"" },
    ],
    obligations: [
      { label:"121 Milky Way mortgage",  amount:15013, note:"7.95% · Equitable · Dec 2026" },
      { label:"51 Ahchie Crt. mortgage", amount:9837,  note:"5.24% · Equitable · renewal due Apr 2026" },
      { label:"4 New Seabury mortgage",  amount:5979,  note:"5.94% · Equitable · Dec 2029" },
      { label:"27 Roytec Rd. mortgage",  amount:0,     note:"TD Bank · P+1.80% (≈6.25%) · pending" },
    ],
  },

  rentPayments: [], // { propertyId, month:"YYYY-MM", received, note }
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
// Returns the rent currently being collected based on occupancy status
function propEffectiveRent(prop) {
  const secs = prop.sections || [];
  const st   = prop.occupancy_status;
  if (!st || st === "vacant" || st === "vacant_land" || st === "owner_occupied" || st === "lease_signed_pending_possession") return 0;
  if (st === "partially_leased" && secs.length) return secs.filter(s => s.status === "leased").reduce((sum, s) => sum + safe(s.rent), 0);
  return safe(prop.rentalIncome);
}
// Returns total monthly cash outflows for a property
function propMonthlyOut(prop) {
  const taxOut = prop.taxes_paid_by === "lender" ? 0 : safe(prop.monthlyTax);
  return safe(prop.monthlyPayment) + taxOut + safe(prop.monthly_insurance) +
    safe(prop.management_fee_monthly) + safe(prop.maintenance_reserve_monthly) +
    safe(prop.utilities_monthly) + safe(prop.capex_reserve_monthly);
}
// Returns JMF ownership fraction (0–1). Defaults to 1 (100%) if field absent.
function propOwnership(prop) { const o = safe(prop.ownership); return (o > 0 && o <= 1) ? o : 1; }
// Gross equity regardless of ownership split
function propGrossEquity(prop) { return safe(prop.market) - safe(prop.mortgage); }
// JMF-attributable equity (gross × ownership share)
function propJMFEquity(prop) { return propGrossEquity(prop) * propOwnership(prop); }
// Expected monthly rent for ledger (shows agreed rent even pre-possession)
function propLedgerExpected(prop) {
  const secs = prop.sections || [];
  if (prop.occupancy_status === "partially_leased" && secs.length)
    return secs.filter(s => s.status === "leased").reduce((sum, s) => sum + safe(s.rent), 0);
  return safe(prop.rentalIncome);
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
function EditText({ value, onChange, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value || "");
  if (editing) return (
    <input autoFocus type="text" value={v}
      onChange={e => setV(e.target.value)}
      onBlur={() => { onChange(v); setEditing(false); }}
      onKeyDown={e => { if (e.key === "Enter") { onChange(v); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
      placeholder={placeholder}
      style={{ background: C.goldLight, border: `1.5px solid ${C.gold}`, borderRadius: 6, color: C.goldText, padding: "4px 10px", width: 140, fontSize: 13, fontFamily: C.sans, outline: "none" }}
    />
  );
  return (
    <span onClick={() => { setV(value || ""); setEditing(true); }} title="Click to edit"
      style={{ cursor: "pointer", color: value ? C.text : C.textDim, fontSize: 13, fontFamily: C.sans, borderBottom: `1.5px dashed ${C.borderDark}`, paddingBottom: 1 }}>
      {value || placeholder || "—"}
    </span>
  );
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
    const rentIn = (data.rentPayments || []).filter(r => r.month === m).reduce((s, r) => s + safe(r.received), 0);
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
function RentLogModal({ propertyName, month, current, onSave, onClose }) {
  const [received, setReceived] = useState(safe(current?.received));
  const [note, setNote]         = useState(current?.note || "");
  const inp = { width:"100%", padding:"10px 12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:14, fontFamily:C.mono, outline:"none", boxSizing:"border-box", marginBottom:14 };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:28, width:"100%", maxWidth:360, boxShadow:"0 8px 48px rgba(0,0,0,0.14)" }}>
        <div style={{ fontSize:17, fontWeight:700, color:C.text, marginBottom:4 }}>Log Rent Payment</div>
        <div style={{ fontSize:13, color:C.textDim, marginBottom:20 }}>{propertyName} · {monthLabel(month)}</div>
        <Label>Amount received (CAD)</Label>
        <input type="number" autoFocus value={received} onChange={e => setReceived(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { onSave(safe(received), note); onClose(); } if (e.key === "Escape") onClose(); }}
          style={inp} />
        <Label>Note (optional)</Label>
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. e-transfer received April 15"
          style={{ ...inp, fontFamily:C.sans, fontSize:13 }} />
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => { onSave(safe(received), note); onClose(); }}
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

      {/* Content */}
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
    </div>
  );
}

// ─── PROPERTY CARD ────────────────────────────────────────────────────────────
function PropCard({ prop, onUpdate, isAdmin }) {
  const [open, setOpen] = useState(false);
  const market        = safe(prop.market);
  const balance       = safe(prop.mortgage);
  const rawEquity     = market - balance;
  const sellingCosts  = (market * 0.035 * 1.13) + 1500;
  const netEquity     = rawEquity - sellingCosts;
  const ltv           = balance > 0 && market > 0 ? (balance / market * 100) : 0;
  const eqColor       = rawEquity > 500000 ? C.gold : rawEquity > 0 ? C.amber : C.red;
  const sections      = prop.sections || [];
  const effectiveRent = propEffectiveRent(prop);
  const totalOut      = propMonthlyOut(prop);
  const monthlyNCF    = effectiveRent - totalOut;
  const ownership     = propOwnership(prop);
  const jmfEquity     = propJMFEquity(prop);
  const isPartial     = ownership < 0.9999;
  const displayEquity = isPartial ? jmfEquity : rawEquity;
  const displayEqColor = displayEquity > 500000 ? C.gold : displayEquity > 0 ? C.amber : C.red;

  function updSection(secId, field, val) {
    const updated = sections.map(s => s.id === secId ? { ...s, [field]: field === "rent" ? safe(val) : val } : s);
    onUpdate("sections", updated);
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${open ? C.gold : C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 10, transition: "border-color 0.15s" }}>

      {/* ── HEADER ── */}
      <div onClick={() => setOpen(o => !o)} style={{ padding: "14px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
          <StatusPill status={prop.status} />
          <OccupancyBadge status={prop.occupancy_status} />
          {isPartial && (
            <span style={{ background: C.purpleLight, color: C.purpleText, borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "3px 10px", whiteSpace: "nowrap" }}>
              JMF {Math.round(ownership * 100)}%
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prop.name}</div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 1 }}>
              {prop.lender} · {prop.rate}{isPartial ? ` · ${prop.co_owner}` : ""}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 2 }}>{isPartial ? "JMF equity" : "Gross equity"}</div>
            <div style={{ fontSize: 18, fontFamily: C.mono, fontWeight: 700, color: displayEqColor }}>{$K(displayEquity)}</div>
          </div>
          <span style={{ color: open ? C.gold : C.textDim, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* ── EXPANDED PANEL ── */}
      {open && (
        <div>

          {/* MORTGAGE */}
          <div style={{ padding: "16px 20px 14px", borderTop: `1px solid ${C.border}` }}>
            <Label>Mortgage</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
              <div>
                <Row label="Lender"><span style={{ color: C.text, fontSize: 13 }}>{prop.lender}</span></Row>
                <Row label="Current balance"><EditNum value={balance} onChange={v => onUpdate("mortgage", v)} locked={!isAdmin} /></Row>
                {safe(prop.original_balance) > 0 && (
                  <Row label="Original balance"><span style={{ color: C.textMid, fontFamily: C.mono, fontSize: 13 }}>{$F(safe(prop.original_balance))}</span></Row>
                )}
                <Row label="Interest rate"><span style={{ color: C.amber, fontFamily: C.mono, fontSize: 14 }}>{prop.rate}</span></Row>
                <Row label="Rate type"><span style={{ color: C.text, fontSize: 12 }}>{prop.rateType}</span></Row>
                <Row label="Maturity">
                  {isAdmin
                    ? <EditText value={prop.maturity} onChange={v => onUpdate("maturity", v)} placeholder="e.g. Dec 2026" />
                    : <span style={{ color: C.text, fontFamily: C.mono, fontSize: 13 }}>{prop.maturity}</span>}
                </Row>
                {safe(prop.remaining_amortization_months) > 0 && (
                  <Row label="Remaining amort." last>
                    <span style={{ color: C.textMid, fontSize: 13 }}>{safe(prop.remaining_amortization_months)} months</span>
                  </Row>
                )}
              </div>
              <div>
                <Label>Monthly payment</Label>
                <Row label="Total"><EditNum value={safe(prop.monthlyPayment)} onChange={v => onUpdate("monthlyPayment", v)} locked={!isAdmin} /></Row>
                {safe(prop.monthly_pi) > 0 && <Row label="↳ Principal + interest"><span style={{ color: C.textMid, fontFamily: C.mono, fontSize: 13 }}>{$F(safe(prop.monthly_pi))}</span></Row>}
                {safe(prop.monthly_payment_tax) > 0 && <Row label="↳ Tax escrow"><span style={{ color: C.textMid, fontFamily: C.mono, fontSize: 13 }}>{$F(safe(prop.monthly_payment_tax))}</span></Row>}
                <Row label="Taxes paid by" last>
                  <span style={{ fontSize: 12, color: C.text }}>{prop.taxes_paid_by === "lender" ? "Lender (escrowed)" : "Owner (separate)"}</span>
                </Row>
              </div>
            </div>
          </div>

          {/* OCCUPANCY & INCOME */}
          <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}` }}>
            <Label>Occupancy & Income</Label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <OccupancyBadge status={prop.occupancy_status} />
              {prop.tenant_summary && <span style={{ fontSize: 11, color: C.textMid }}>{prop.tenant_summary}</span>}
            </div>
            {prop.vacancy_notes && <div style={{ fontSize: 11, color: C.textDim, marginBottom: 10 }}>{prop.vacancy_notes}</div>}

            {/* Commercial sections (Roytec) */}
            {sections.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 120px 80px", gap: "4px 8px", padding: "0 0 6px", borderBottom: `1px solid ${C.border}`, fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  <span>Unit</span><span>Tenant</span><span>Rent / mo</span><span>Status</span>
                </div>
                {sections.map(sec => (
                  <div key={sec.id} style={{ display: "grid", gridTemplateColumns: "110px 1fr 120px 80px", gap: "4px 8px", padding: "8px 0", borderBottom: `1px solid ${C.border}`, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{sec.label}</span>
                    <span>
                      {isAdmin
                        ? <EditText value={sec.tenant} onChange={v => updSection(sec.id, "tenant", v)} placeholder="Tenant name" />
                        : <span style={{ color: sec.tenant ? C.text : C.textDim, fontSize: 13 }}>{sec.tenant || "—"}</span>}
                    </span>
                    <span>
                      {isAdmin
                        ? <EditNum value={safe(sec.rent)} onChange={v => updSection(sec.id, "rent", v)} />
                        : <span style={{ fontFamily: C.mono, fontSize: 13 }}>{$F(safe(sec.rent))}</span>}
                    </span>
                    <span style={{ background: sec.status === "leased" ? C.greenLight : C.redLight, color: sec.status === "leased" ? C.greenText : C.redText, borderRadius: 12, fontSize: 9, fontWeight: 700, padding: "2px 8px", textAlign: "center", display: "inline-block" }}>
                      {sec.status === "leased" ? "Leased" : "Vacant"}
                    </span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0" }}>
                  <span style={{ fontSize: 13, color: C.textMid, fontWeight: 600 }}>Occupied income</span>
                  <span style={{ fontFamily: C.mono, fontWeight: 700, color: C.green, fontSize: 15 }}>{$F(effectiveRent)}/mo</span>
                </div>
              </div>
            )}

            {/* Standard residential income */}
            {sections.length === 0 && (
              <div>
                <Row label="Monthly rent (agreed)"><EditNum value={safe(prop.rentalIncome)} onChange={v => onUpdate("rentalIncome", v)} locked={!isAdmin} /></Row>
                <Row label="Currently collecting">
                  <span style={{ fontFamily: C.mono, fontSize: 14, color: effectiveRent > 0 ? C.green : C.textDim, fontWeight: 600 }}>
                    {$F(effectiveRent)}{effectiveRent === 0 && safe(prop.rentalIncome) > 0 ? " (not yet)" : ""}
                  </span>
                </Row>
                {isAdmin && (
                  <Row label="Market rent (est.)" last>
                    <EditNum value={safe(prop.rental_market_monthly)} onChange={v => onUpdate("rental_market_monthly", v)} />
                  </Row>
                )}
              </div>
            )}
          </div>

          {/* OPERATING EXPENSES */}
          <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}` }}>
            <Label>Monthly Operating Expenses</Label>
            <Row label="Mortgage payment (total)"><EditNum value={safe(prop.monthlyPayment)} onChange={v => onUpdate("monthlyPayment", v)} locked={!isAdmin} /></Row>
            {prop.taxes_paid_by !== "lender" && (
              <Row label="Property tax"><EditNum value={safe(prop.monthlyTax)} onChange={v => onUpdate("monthlyTax", v)} locked={!isAdmin} /></Row>
            )}
            <Row label="Insurance / month (estimate)"><EditNum value={safe(prop.monthly_insurance)} onChange={v => onUpdate("monthly_insurance", v)} locked={!isAdmin} /></Row>
            <Row label="Management fee"><EditNum value={safe(prop.management_fee_monthly)} onChange={v => onUpdate("management_fee_monthly", v)} locked={!isAdmin} /></Row>
            <Row label="Maintenance reserve"><EditNum value={safe(prop.maintenance_reserve_monthly)} onChange={v => onUpdate("maintenance_reserve_monthly", v)} locked={!isAdmin} /></Row>
            <Row label="Utilities"><EditNum value={safe(prop.utilities_monthly)} onChange={v => onUpdate("utilities_monthly", v)} locked={!isAdmin} /></Row>
            <Row label="CapEx reserve" last><EditNum value={safe(prop.capex_reserve_monthly)} onChange={v => onUpdate("capex_reserve_monthly", v)} locked={!isAdmin} /></Row>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, marginTop: 2, borderTop: `2px solid ${C.border}` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.textMid }}>Total out / month</span>
              <span style={{ fontFamily: C.mono, fontWeight: 800, fontSize: 15, color: C.red }}>{$F(totalOut)}</span>
            </div>
          </div>

          {/* CASH FLOW SUMMARY */}
          <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}` }}>
            <Label>Cash Flow</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
              {[
                { label: "Rent agreed",    val: $F(safe(prop.rentalIncome)),                                                  color: C.textMid,                              bg: C.bg         },
                { label: "Collecting now", val: $F(effectiveRent),                                                             color: effectiveRent > 0 ? C.green : C.textDim, bg: effectiveRent > 0 ? C.greenLight : C.bg },
                { label: "Total outflows", val: $F(totalOut),                                                                   color: C.red,                                  bg: C.redLight   },
                { label: "Net / month",    val: `${monthlyNCF >= 0 ? "+" : ""}${$F(monthlyNCF)}`,                              color: monthlyNCF >= 0 ? C.green : C.red,       bg: monthlyNCF >= 0 ? C.greenLight : C.redLight },
                { label: "Net / year",     val: `${monthlyNCF >= 0 ? "+" : ""}${$F(monthlyNCF * 12)}`,                        color: monthlyNCF >= 0 ? C.green : C.red,       bg: monthlyNCF >= 0 ? C.greenLight : C.redLight },
              ].map((chip, i) => (
                <div key={i} style={{ background: chip.bg, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{chip.label}</div>
                  <div style={{ fontSize: 13, fontFamily: C.mono, fontWeight: 700, color: chip.color }}>{chip.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* EQUITY & LEVERAGE */}
          <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}` }}>
            <Label>Equity & Leverage</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
              <div>
                <Row label="Purchase price"><span style={{ color: C.textMid, fontFamily: C.mono, fontSize: 14 }}>{$F(prop.purchase)}</span></Row>
                <Row label="Market value"><EditNum value={market} onChange={v => onUpdate("market", v)} locked={!isAdmin} /></Row>
                <Row label="Mortgage balance"><EditNum value={balance} onChange={v => onUpdate("mortgage", v)} locked={!isAdmin} /></Row>
                <Row label="Gross equity"><span style={{ color: eqColor, fontWeight: 700, fontFamily: C.mono, fontSize: 14 }}>{$F(rawEquity)}</span></Row>
                {isPartial && (
                  <Row label={`JMF equity (${Math.round(ownership * 100)}%)`}>
                    <span style={{ color: displayEqColor, fontWeight: 700, fontFamily: C.mono, fontSize: 14 }}>{$F(jmfEquity)}</span>
                  </Row>
                )}
                {isPartial && prop.co_owner && (
                  <Row label="Co-owner"><span style={{ color: C.textMid, fontSize: 13 }}>{prop.co_owner}</span></Row>
                )}
                <Row label="Est. net if sold" last>
                  <span style={{ color: netEquity > 0 ? C.green : C.red, fontFamily: C.mono, fontSize: 13 }} title="3.5% realtor + HST + $1,500 legal">{$F(netEquity)}</span>
                </Row>
              </div>
              <div>
                <Row label="LTV">
                  <span style={{ color: ltv > 80 ? C.red : ltv > 65 ? C.amber : C.green, fontFamily: C.mono, fontWeight: 600, fontSize: 14 }}>{ltv.toFixed(1)}%</span>
                </Row>
                {safe(prop.tax_account_balance) > 0 && (
                  <Row label="Tax account (lender)"><span style={{ fontFamily: C.mono, color: C.textMid, fontSize: 13 }}>{$F(safe(prop.tax_account_balance))}</span></Row>
                )}
                {safe(prop.annual_property_tax_estimate) > 0 && (
                  <Row label="Annual tax (est.)">
                    {isAdmin
                      ? <EditNum value={safe(prop.annual_property_tax_estimate)} onChange={v => onUpdate("annual_property_tax_estimate", v)} />
                      : <span style={{ fontFamily: C.mono, fontSize: 13 }}>{$F(safe(prop.annual_property_tax_estimate))}</span>}
                  </Row>
                )}
              </div>
            </div>
          </div>

          {/* TAX NOTICE SNAPSHOT (Farr only) */}
          {safe(prop.tax_notice_outstanding) > 0 && (
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}` }}>
              <Label color={C.amber}>Tax Notice Snapshot</Label>
              <div style={{ background: C.amberLight, borderRadius: 8, padding: "10px 14px", fontSize: 11, color: C.amber, marginBottom: 10, lineHeight: 1.7 }}>
                Partial notice only — annual tax not confirmed. Keep editable until full bill is reviewed.
              </div>
              <Row label="Current outstanding"><span style={{ fontFamily: C.mono, color: C.amber, fontSize: 14 }}>{$F(safe(prop.tax_notice_outstanding))}</span></Row>
              <Row label="Penalty & interest"><span style={{ fontFamily: C.mono, color: C.red, fontSize: 13 }}>{$F(safe(prop.tax_notice_penalty))}</span></Row>
              {safe(prop.tax_notice_next_installment) > 0 && (
                <Row label={`Next installment${prop.tax_notice_next_due ? " (due " + prop.tax_notice_next_due + ")" : ""}`} last>
                  <span style={{ fontFamily: C.mono, color: C.text, fontSize: 13 }}>{$F(safe(prop.tax_notice_next_installment))}</span>
                </Row>
              )}
            </div>
          )}

          {/* LOAN COVENANTS */}
          {prop.covenant_notes && (
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}` }}>
              <Label color={C.blue}>Loan Covenants</Label>
              <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.8, background: C.blueLight, borderRadius: 8, padding: "12px 14px" }}>{prop.covenant_notes}</div>
            </div>
          )}

          {/* NOTES */}
          {prop.notes && (
            <div style={{ padding: "10px 20px 18px", borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.textMid, fontStyle: "italic", lineHeight: 1.6 }}>{prop.notes}</div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ─── BUSINESS CARD ────────────────────────────────────────────────────────────
function BizCard({ biz, onUpdate, onUpdateProfit, isAdmin }) {
  const [open, setOpen] = useState(false);
  const isNonProfit = biz.type === "nonprofit";
  const netEquity   = safe(biz.cashAccounts) - safe(biz.liabilities);

  return (
    <div style={{ background: C.card, border: `1px solid ${open ? (isNonProfit ? "#9B59B6" : C.gold) : C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
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
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 20 }}>
          {biz.notes && <div style={{ fontSize: 12, color: C.textMid, fontStyle: "italic", marginBottom: 16, lineHeight: 1.6 }}>{biz.notes}</div>}

          {isNonProfit ? (
            <div>
              <div style={{ background: C.purpleLight, borderRadius: 8, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.purpleText, marginBottom: 4 }}>Collective fund — tracked for reference only</div>
                <div style={{ fontSize: 12, color: C.textMid }}>Does NOT count toward JMF consolidated net worth.</div>
              </div>
              <Row label="Cash balance" last><span style={{ fontFamily: C.mono, color: C.purple, fontWeight: 700, fontSize: 14 }}>{$F(safe(biz.cashAccounts))}</span></Row>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
              <div>
                <Label>Balance Sheet</Label>
                <Row label="Cash & accounts"><EditNum value={safe(biz.cashAccounts)} onChange={v => onUpdate("cashAccounts", v)} locked={!isAdmin} /></Row>

                <div style={{ marginTop: 16 }}>
                  <Label>Monthly Net Profit Log</Label>
                  {monthsBetween(SYSTEM_START, currentYM()).slice(-6).reverse().map(m => {
                    const entry  = (biz.monthlyProfits || []).find(p => p.month === m);
                    const profit = safe(entry?.profit);
                    return (
                      <div key={m} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:`1px solid ${C.border}` }}>
                        <span style={{ fontSize:12, color:C.textMid, minWidth:76 }}>{monthLabel(m)}</span>
                        {isAdmin
                          ? <EditNum value={profit} onChange={v => onUpdateProfit && onUpdateProfit(m, v)} />
                          : <span style={{ fontFamily:C.mono, fontSize:13, color: entry ? (profit >= 0 ? C.gold : C.red) : C.textDim }}>{entry ? $F(profit) : "—"}</span>
                        }
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Liabilities</Label>
                <Row label="Total liabilities" labelStyle={{ fontWeight: 700, color: C.text }}><span style={{ color: C.red, fontFamily: C.mono, fontSize: 14 }}>{$F(safe(biz.liabilities))}</span></Row>
                <Row label="CRA tax payable"><EditNum value={safe(biz.taxPayable)} onChange={v => onUpdate("taxPayable", v)} locked={!isAdmin} /></Row>
                <Row label="Credit cards"><span style={{ color: C.red, fontFamily: C.mono, fontSize: 14 }}>{$F(safe(biz.creditCards))}</span></Row>
                <Row label="Net equity" last labelStyle={{ fontWeight: 700, background: C.gold, color: "#FFF", borderRadius: 4, padding: "2px 8px" }}><span style={{ color: netEquity >= 0 ? C.gold : C.red, fontFamily: C.mono, fontWeight: 700, fontSize: 14 }}>{$F(netEquity)}</span></Row>
              </div>
            </div>
          )}
        </div>
      )}
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
  const [rentLogModal, setRentLogModal] = useState(null); // { propertyId, propertyName, month }
  const [showReminder, setShowReminder] = useState(false);
  const [reminderData, setReminderData] = useState({ missingRent: [], missingProfits: [] });
  const [cfMonth, setCFMonth]       = useState(currentYM());
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
      .filter(p => ["leased", "partially_leased", "lease_signed_pending_possession"].includes(p.occupancy_status))
      .filter(p => {
        const entry = (data.rentPayments || []).find(r => r.propertyId === p.id && r.month === ym);
        return !entry || safe(entry.received) === 0;
      });
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
    const selling = (mkt * 0.035 * 1.13) + 1500;
    return s + ((mkt - safe(p.mortgage) - selling) * propOwnership(p));
  }, 0); // JMF net proceeds if all RE sold
  const totalREVal     = data.properties.reduce((s, p) => s + safe(p.market), 0);
  const totalREDbt     = data.properties.reduce((s, p) => s + safe(p.mortgage), 0);
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
  function updProp(id, f, v) {
    const val = Array.isArray(v) || typeof v === "string" ? v : safe(v);
    const arr = data.properties.map(p => p.id === id ? { ...p, [f]: val } : p);
    saveToDB("properties", arr); setData(d => ({ ...d, properties: arr })); showSaved();
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
  function updRentPayment(propertyId, month, received, note) {
    const existing = data.rentPayments || [];
    const idx = existing.findIndex(r => r.propertyId === propertyId && r.month === month);
    const entry = { propertyId, month, received: safe(received), note: note || "" };
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

  const TABS = ["Overview", "Real Estate", "Individuals", "Businesses", "Cash Flow"];
  const tabId = t => t.toLowerCase().replace(" ", "");

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: C.sans }}>
      {cashModal && <CashModal current={safe(aj?.cash)} onSave={v => updInd(1, "cash", v)} onClose={() => setCashModal(false)} />}
      {rentLogModal && (
        <RentLogModal
          propertyName={rentLogModal.propertyName}
          month={rentLogModal.month}
          current={(data.rentPayments || []).find(r => r.propertyId === rentLogModal.propertyId && r.month === rentLogModal.month)}
          onSave={(received, note) => updRentPayment(rentLogModal.propertyId, rentLogModal.month, received, note)}
          onClose={() => setRentLogModal(null)}
        />
      )}
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
            { label: "JMF RE Equity",      val: $K(totalREEq),  sub: `${((totalREEq / Math.max(1, Math.abs(totalNW))) * 100).toFixed(0)}% of NW`, color: C.gold  },
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
        <div style={{ display: "flex", overflowX:"auto", padding: "0 28px" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(tabId(t))}
              style={{ padding: "12px 18px", fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", border: "none", cursor: "pointer", background: "transparent", color: tab === tabId(t) ? C.gold : C.textDim, borderBottom: tab === tabId(t) ? `2px solid ${C.gold}` : "2px solid transparent", whiteSpace: "nowrap", fontFamily: C.sans, transition:"color 0.15s" }}>
              {t}
            </button>
          ))}
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
                { label: "JMF RE Equity",      val: $K(totalREEq),  color: C.gold,  accent: C.gold,  sub: `Ownership-adjusted · ${data.properties.length} properties`, bg: C.goldLight },
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

            {/* RE portfolio mini-cards */}
            <Card accent={C.gold} style={{ marginBottom: 16, paddingTop: 24 }}>
              <Label>Real Estate Portfolio</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                {data.properties.map(p => {
                  const eq = safe(p.market) - safe(p.mortgage);
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
          // Missed rent alert: past months with no logged payment for leased properties
          const pastMonths = monthsBetween(SYSTEM_START, currentYM()).slice(0, -1);
          const missedRents = data.properties
            .filter(p => ["leased", "partially_leased"].includes(p.occupancy_status))
            .flatMap(p => pastMonths.filter(m => {
              const e = (data.rentPayments || []).find(r => r.propertyId === p.id && r.month === m);
              return !e || safe(e.received) === 0;
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
                { label: "Portfolio Value",  val: $K(totalREVal),       color: C.text, sub: "Gross (5 properties)" },
                { label: "Total Debt",       val: $K(totalREDbt),       color: C.red,  sub: "All mortgages" },
                { label: "Gross Equity",     val: $K(totalREEqGross),   color: C.amber,sub: "100% of all equity" },
                { label: "JMF Equity",       val: $K(totalREEq),        color: C.gold, sub: "Ownership-adjusted" },
                { label: "Monthly Payments", val: $K(totalMtg),         color: C.red,  sub: `${$K(totalMtg * 12)}/yr` },
                { label: "RE Cash Flow",     val: $K(totalRENCF),       color: totalRENCF >= 0 ? C.green : C.red, sub: "Income − outflows" },
              ].map((s, i) => (
                <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontFamily: C.mono, fontWeight: 700, color: s.color }}>{s.val}</div>
                  {s.sub && <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>{s.sub}</div>}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>
              Click any property to expand · "Est. net if sold" deducts 3.5% realtor (HST incl.) + $1,500 legal
            </div>
            {data.properties.map(p => <PropCard key={p.id} prop={p} onUpdate={(f, v) => updProp(p.id, f, v)} isAdmin={true} />)}

            {/* ── RENT COLLECTION LEDGER ── */}
            <div style={{ marginTop: 32 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Rent Collection Ledger</div>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>Tracking from April 2026 · Click Log / Edit to record each payment</div>
              {data.properties
                .filter(p => ["leased", "partially_leased", "lease_signed_pending_possession"].includes(p.occupancy_status))
                .map(prop => {
                  const months  = monthsBetween(SYSTEM_START, currentYM());
                  const expRent = propLedgerExpected(prop);
                  const totalCollected = (data.rentPayments || []).filter(r => r.propertyId === prop.id).reduce((s, r) => s + safe(r.received), 0);
                  return (
                    <Card key={prop.id} style={{ marginBottom: 12 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{prop.name}</div>
                          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Expected: {$F(expRent)}/mo</div>
                        </div>
                        <OccupancyBadge status={prop.occupancy_status} />
                      </div>
                      {/* header row */}
                      <div style={{ display:"grid", gridTemplateColumns:"90px 1fr 1fr 80px", gap:"4px 8px", padding:"0 0 6px", borderBottom:`1px solid ${C.borderDark}`, fontSize:9, color:C.textDim, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                        <span>Month</span><span>Expected</span><span>Received</span><span></span>
                      </div>
                      {months.map((m, i) => {
                        const payment = (data.rentPayments || []).find(r => r.propertyId === prop.id && r.month === m);
                        const received = safe(payment?.received);
                        const isPaid = received > 0;
                        const isCurrent = m === currentYM();
                        return (
                          <div key={m} style={{ display:"grid", gridTemplateColumns:"90px 1fr 1fr 80px", gap:"4px 8px", padding:"8px 0", borderBottom: i < months.length - 1 ? `1px solid ${C.border}` : "none", alignItems:"center" }}>
                            <span style={{ fontSize: 12, color: C.textMid }}>{monthLabel(m)}</span>
                            <span style={{ fontSize: 12, fontFamily: C.mono, color: C.textDim }}>{$F(expRent)}</span>
                            <div>
                              <span style={{ fontSize: 13, fontFamily: C.mono, fontWeight: 600, color: isPaid ? C.green : (isCurrent ? C.amber : C.red) }}>
                                {isPaid ? $F(received) : (isCurrent ? "Pending" : "Not received")}
                              </span>
                              {payment?.note && <div style={{ fontSize: 10, color: C.textDim, fontStyle:"italic", marginTop: 1 }}>{payment.note}</div>}
                            </div>
                            <button
                              onClick={() => setRentLogModal({ propertyId: prop.id, propertyName: prop.name, month: m })}
                              style={{ fontSize: 11, padding:"4px 10px", background: isPaid ? C.bg : C.goldLight, border:`1px solid ${isPaid ? C.border : C.gold}`, borderRadius: 6, color: isPaid ? C.textMid : C.goldText, cursor:"pointer", fontWeight: 600, textAlign:"center" }}>
                              {isPaid ? "Edit" : "Log"}
                            </button>
                          </div>
                        );
                      })}
                      <div style={{ display:"flex", justifyContent:"space-between", paddingTop: 10, marginTop: 4, borderTop:`2px solid ${C.border}` }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.textMid }}>Total collected (all months)</span>
                        <span style={{ fontFamily: C.mono, fontWeight: 800, fontSize: 15, color: C.green }}>{$F(totalCollected)}</span>
                      </div>
                    </Card>
                  );
                })}
            </div>
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
                  {/* Monthly income log */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing:"0.09em", textTransform:"uppercase", marginBottom: 8 }}>Monthly Income Log</div>
                    {monthsBetween(SYSTEM_START, currentYM()).slice(-6).reverse().map(m => {
                      const entry  = (f.monthlyIncome || []).find(p => p.month === m);
                      const income = safe(entry?.income);
                      return (
                        <div key={m} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                          <span style={{ fontSize:11, color:C.textMid, minWidth:72 }}>{monthLabel(m)}</span>
                          <EditNum value={income} onChange={v => updIndIncome(f.id, m, v)} />
                        </div>
                      );
                    })}
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
            {data.businesses.map(b => <BizCard key={b.id} biz={b} onUpdate={(f, v) => updBiz(b.id, f, v)} onUpdateProfit={(month, profit) => updBizProfit(b.id, month, profit)} isAdmin={true} />)}
          </div>
        )}

        {/* ── CASH FLOW ── */}
        {tab === "cashflow" && (() => {
          // Computed income for selected month
          const cfBizIn  = data.businesses.filter(b => b.type !== "nonprofit").reduce((s, b) => {
            const e = (b.monthlyProfits || []).find(p => p.month === cfMonth);
            return s + safe(e?.profit);
          }, 0);
          const cfRentIn  = (data.rentPayments || []).filter(r => r.month === cfMonth).reduce((s, r) => s + safe(r.received), 0);
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

                  {/* Payroll — per individual */}
                  <div style={{ padding: "9px 0 4px", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom: 8 }}>Payroll Income</div>
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
                      <span style={{ fontSize:11, color:C.textMid }}>Total payroll</span>
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
        setData({
          ...DEFAULT,
          individuals:  mergeById(DEFAULT.individuals, dbData.individuals),
          properties:   mergeById(DEFAULT.properties,  dbData.properties),
          businesses:   mergeById(DEFAULT.businesses,  dbData.businesses),
          cashflow:     dbData.cashflow     || DEFAULT.cashflow,
          rentPayments: dbData.rentPayments || DEFAULT.rentPayments,
        });
      } else {
        // First run — seed the database with defaults
        saveToDB("individuals",  DEFAULT.individuals);
        saveToDB("properties",   DEFAULT.properties);
        saveToDB("businesses",   DEFAULT.businesses);
        saveToDB("cashflow",     DEFAULT.cashflow);
        saveToDB("rentPayments", DEFAULT.rentPayments);
        setData(DEFAULT);
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