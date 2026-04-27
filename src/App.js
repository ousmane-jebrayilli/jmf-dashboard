import { useState, useEffect, useRef } from "react";
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

// ─── RESPONSIVE HOOKS ────────────────────────────────────────────────────────
function useIsMobile() {
  const [v, setV] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setV(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return v;
}
function useIsSmall() {
  const [v, setV] = useState(() => window.innerWidth < 480);
  useEffect(() => {
    const h = () => setV(window.innerWidth < 480);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return v;
}


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

const scriptLoaders = {};
const recentReportDownloads = new Map();
function loadScriptOnce(src, globalName) {
  if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
  if (scriptLoaders[src]) return scriptLoaders[src];
  scriptLoaders[src] = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(globalName ? window[globalName] : true), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve(globalName ? window[globalName] : true);
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
  return scriptLoaders[src];
}
async function loadPdfTools() {
  const [jspdfNs, html2canvas] = await Promise.all([
    loadScriptOnce("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js", "jspdf"),
    loadScriptOnce("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js", "html2canvas"),
  ]);
  const jsPDF = jspdfNs?.jsPDF;
  if (!jsPDF || !html2canvas) throw new Error("PDF tools unavailable");
  return { jsPDF, html2canvas };
}
function shouldAutoDownloadReport(key) {
  const now = Date.now();
  const last = recentReportDownloads.get(key) || 0;
  if (now - last < 1500) return false;
  recentReportDownloads.set(key, now);
  return true;
}

// ─── TIME HELPERS ─────────────────────────────────────────────────────────────
const SYSTEM_START = "2026-04"; // April 2026 — first tracking month
function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function periodDateForYM(ym) {
  return ym ? `${ym}-01` : "";
}
function ymFromPeriodDate(value) {
  if (!value) return "";
  return String(value).slice(0, 7);
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
function reportFileName(ym) {
  if (!ym) return "JMF_Report.pdf";
  const [y, m] = ym.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }).replace(/\s+/g, "_");
  return `JMF_Report_${label}.pdf`;
}
function monthIndex(ym) {
  const [y, m] = (ym || SYSTEM_START).split("-").map(Number);
  return (y * 12) + (m - 1);
}
function monthDiff(fromYM, toYM) {
  return monthIndex(toYM) - monthIndex(fromYM);
}
function shiftYM(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
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
  reportHistory: [],

  individuals: [
    { id:1, name:"Ahmed (AJ)",         initials:"AJ", cash:0,   accounts:1023,  debt:0, securities:46610, crypto:1466, physicalAssets:0, monthlyIncome:[], accountsLog:[] },
    { id:2, name:"Nazila Isgandarova", initials:"NI", cash:0,   accounts:15647, debt:0, securities:39939, crypto:0,    physicalAssets:0, monthlyIncome:[], accountsLog:[] },
    { id:3, name:"Yasin Majidov",      initials:"YM", cash:500, accounts:0,     debt:0, securities:0,     crypto:0,    physicalAssets:0, monthlyIncome:[], accountsLog:[] },
    { id:4, name:"Maryam Majidova",    initials:"MM", cash:0,   accounts:1305,  debt:0, securities:0,     crypto:0,    physicalAssets:0, monthlyIncome:[], accountsLog:[] },
    { id:5, name:"Akbar Majidov",      initials:"AM", cash:0,   accounts:-1089, debt:0, securities:0,     crypto:0,    physicalAssets:0, monthlyIncome:[], accountsLog:[] },
    { id:6, name:"Mustafa Majidov",    initials:"MU", cash:0,   accounts:0,     debt:0, securities:0,     crypto:0,    physicalAssets:0, monthlyIncome:[], accountsLog:[] },
  ],

  businesses: [
    { id:1, name:"Kratos Moving Inc.", abbr:"KMI", type:"operating",  cashAccounts:152207, liabilities:133056, taxPayable:120000, creditCards:13056, revenue:0, expenses:0, monthlyProfits:[], historicalData:[], notes:"CEO: James Bond. BMO + RBC + Wise accounts. CRA $120K payable included in liabilities." },
    { id:2, name:"JMF Logistics Inc.", abbr:"JMF", type:"operating",  cashAccounts:2621,   liabilities:0,      taxPayable:0,     creditCards:0,     revenue:0, expenses:0, monthlyProfits:[], historicalData:[], notes:"RBC Chequing. Clean balance sheet. No outstanding liabilities." },
    { id:3, name:"PRIMA",              abbr:"PRIMA",type:"operating",  cashAccounts:10007,  liabilities:2349,   taxPayable:0,     creditCards:2349,  revenue:0, expenses:0, monthlyProfits:[], historicalData:[], notes:"Nazila's operating corporation. TD Chequing $10,007. TD Business Travel Visa $2,349." },
    { id:4, name:"ASWC",               abbr:"ASWC", type:"nonprofit",     cashAccounts:20643, liabilities:0,   taxPayable:0, creditCards:0, revenue:0, expenses:0, monthlyProfits:[], historicalData:[], notes:"Non-profit collective fund. TD Chequing $20,643. NOT included in JMF consolidated net worth." },
    { id:5, name:"NES Bakery Inc.",    abbr:"NES",  type:"tracked_only",  cashAccounts:0,     liabilities:0,   taxPayable:0, creditCards:0, ownership:0.5, revenue:0, expenses:0, monthlyProfits:[], historicalData:[], notes:"50% ownership. Tracked operationally only. Excluded from JMF consolidated net worth per current agreement structure." },
  ],

  properties: [
    {
      id:1, name:"27 Roytec Rd.", status:"STRONG", property_type:"commercial", country:"Canada",
      purchase:1020000, market_value:2000000, market_currency:"CAD", fx_rate_to_cad:1, market:2000000, mortgage:728134.68, original_balance:0, ownership:1,
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
      valuations:[{ date:"2026-04-01", market_value:2000000, market_currency:"CAD", fx_rate_to_cad:1, value:2000000, note:"Initial valuation" }],
    },
    {
      id:2, name:"3705 Farr Ave.", status:"STRONG", property_type:"vacant_land", country:"Canada",
      purchase:250000, market_value:1200000, market_currency:"CAD", fx_rate_to_cad:1, market:1200000, mortgage:0, original_balance:0,
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
      valuations:[{ date:"2026-04-01", market_value:1200000, market_currency:"CAD", fx_rate_to_cad:1, value:1200000, note:"Initial valuation" }],
    },
    {
      id:3, name:"121 Milky Way", status:"WATCH", property_type:"residential", country:"Canada",
      purchase:3079729, market_value:2850000, market_currency:"CAD", fx_rate_to_cad:1, market:2850000, mortgage:1824886.46, original_balance:2000000,
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
      valuations:[{ date:"2026-04-01", market_value:2850000, market_currency:"CAD", fx_rate_to_cad:1, value:2850000, note:"Initial valuation" }],
    },
    {
      id:4, name:"51 Ahchie Crt.", status:"WATCH", property_type:"residential", country:"Canada",
      purchase:2119105, market_value:1750000, market_currency:"CAD", fx_rate_to_cad:1, market:1750000, mortgage:1523755.81, original_balance:1553670,
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
      valuations:[{ date:"2026-04-01", market_value:1750000, market_currency:"CAD", fx_rate_to_cad:1, value:1750000, note:"Initial valuation" }],
    },
    {
      id:5, name:"4 New Seabury Dr.", status:"WATCH", property_type:"residential", country:"Canada",
      purchase:349000, market_value:958800, market_currency:"CAD", fx_rate_to_cad:1, market:958800, mortgage:894768.98, original_balance:960000,
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
      valuations:[{ date:"2026-04-01", market_value:958800, market_currency:"CAD", fx_rate_to_cad:1, value:958800, note:"Initial valuation" }],
    },
    {
      id:6, name:"Saray Twin Land Parcels", status:"STRONG", property_type:"vacant_land", country:"Azerbaijan",
      purchase:0, market_value:130000, market_currency:"AZN", fx_rate_to_cad:0.8, market:104000, mortgage:0, original_balance:0, ownership:1,
      mortgage_as_of_month:SYSTEM_START, payment_structure:"amortizing", mortgage_manual_override:0, mortgage_manual_override_month:"",
      interest_rate:0, rate:"Mortgage-free", rateType:"No financing",
      maturity:"N/A", remaining_amortization_months:0, taxes_paid_by:"owner",
      monthlyPayment:0, monthly_pi:0, monthly_payment_tax:0,
      tax_account_balance:0, monthlyTax:0, annual_property_tax_estimate:0, tax_account_note:"",
      tax_notice_outstanding:0, tax_notice_penalty:0, tax_notice_next_installment:0, tax_notice_next_due:"",
      monthly_insurance:0, annual_insurance:0,
      maintenance_reserve_monthly:0, management_fee_monthly:0, utilities_monthly:0, capex_reserve_monthly:0,
      rentalIncome:0, rental_market_monthly:0,
      occupancy_status:"vacant_land",
      tenant_summary:"", vacancy_notes:"Two adjacent agricultural land parcels.",
      sections:[], units:[], covenant_notes:"",
      lender:"None",
      notes:"Long-term land asset in Saray / Absheron.",
      location:"Absheron District, Saray, Azerbaijan",
      valuations:[{ date:"2026-04-01", market_value:130000, market_currency:"AZN", fx_rate_to_cad:0.8, value:104000, note:"Initial valuation" }],
    },
    {
      id:7, name:"Saray House – Vahab Aliyev 35", status:"STRONG", property_type:"residential", country:"Azerbaijan",
      purchase:0, market_value:95000, market_currency:"AZN", fx_rate_to_cad:0.8, market:76000, mortgage:0, original_balance:0, ownership:1,
      mortgage_as_of_month:SYSTEM_START, payment_structure:"amortizing", mortgage_manual_override:0, mortgage_manual_override_month:"",
      interest_rate:0, rate:"Mortgage-free", rateType:"No financing",
      maturity:"N/A", remaining_amortization_months:0, taxes_paid_by:"owner",
      monthlyPayment:0, monthly_pi:0, monthly_payment_tax:0,
      tax_account_balance:0, monthlyTax:0, annual_property_tax_estimate:0, tax_account_note:"",
      tax_notice_outstanding:0, tax_notice_penalty:0, tax_notice_next_installment:0, tax_notice_next_due:"",
      monthly_insurance:0, annual_insurance:0,
      maintenance_reserve_monthly:0, management_fee_monthly:0, utilities_monthly:0, capex_reserve_monthly:0,
      rentalIncome:0, rental_market_monthly:0,
      occupancy_status:"owner_occupied",
      tenant_summary:"Owner-held residence", vacancy_notes:"",
      sections:[], units:[], covenant_notes:"",
      lender:"None",
      owner_name:"Nazile Isgandarova Telman qizi",
      location:"Absheron rayonu, Saray qesebesi, Vahab Aliyev kucasi ev 35",
      notes:"Small residential house with supporting title / technical passport documents.",
      valuations:[{ date:"2026-04-01", market_value:95000, market_currency:"AZN", fx_rate_to_cad:0.8, value:76000, note:"Initial valuation" }],
    },
  ],

  cashflow: {
    income: [
      { label:"Other income", amount:0, note:"" },
    ],
    obligations: [], // property obligations now derived live from Real Estate data via propMonthlyOut()
  },

  rentPayments: [], // { id, propertyId, unitId, leaseId, month:"YYYY-MM", amount, date, type:"payment", note }

  // Notification completion state — persisted, minimal (content is always computed from live data)
  notificationsMeta: { completed: {}, lastSeenAt: "" },

  vehicles: [
    { id:1, name:"Toyota Sienna 2020", year:2020, make:"Toyota", model:"Sienna",
      owner:"Family", purchasePrice:0, purchaseDate:"", currentMarketValue:0,
      loanBalance:0, monthlyPayment:0, paymentDueDay:1, mileage:0,
      condition:"good", insuranceMonthly:0, notes:"Fully owned.", valuations:[] },
    { id:2, name:"Mitsubishi Lancer", year:0, make:"Mitsubishi", model:"Lancer",
      owner:"Family", purchasePrice:0, purchaseDate:"", currentMarketValue:0,
      loanBalance:0, monthlyPayment:0, paymentDueDay:1, mileage:0,
      condition:"good", insuranceMonthly:0, notes:"Has active loan.", valuations:[] },
  ],
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

// ─── PHASE 4: RELATIONAL WRITE HELPERS ───────────────────────────────────────
async function ensurePeriodExists(monthKey) {
  await supabase.from("monthly_periods").upsert(
    { month_key: monthKey, label: monthLabel(monthKey), status: "open" },
    { onConflict: "month_key", ignoreDuplicates: true }
  );
}
async function writeIndividualLog(indId, entry, userId) {
  await ensurePeriodExists(entry.month);
  await supabase.from("monthly_individual_logs").upsert({
    month_key:       entry.month,
    individual_id:   indId,
    cash:            safe(entry.cash),
    accounts:        safe(entry.accounts),
    securities:      safe(entry.securities),
    crypto:          safe(entry.crypto),
    physical_assets: safe(entry.physicalAssets),
    note:            entry.note || null,
    updated_at:      new Date().toISOString(),
    updated_by:      userId || null,
  }, { onConflict: "month_key,individual_id" });
}

function mergeById(defaults, dbArr) {
  return defaults.map(def => {
    const db = (dbArr || []).find(x => x.id === def.id) || {};
    return { ...def, ...db };
  });
}

// ─── NOTIFICATION ENGINE ──────────────────────────────────────────────────────
// Pure function — derives all Phase 1 notifications from live data.
// Persisted state (completedIds) is handled separately in notificationsMeta.
function computeNotifications(data, profiles, pendingSubs, isAdmin, individualId) {
  const ym = currentYM();
  const prevYM = shiftYM(ym, -1);
  const nextYM = shiftYM(ym, 1);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const dayOfMonth = today.getDate();
  const out = [];

  function notifStatus(dueDateStr, completed) {
    if (completed) return "completed";
    return dueDateStr <= todayStr ? "overdue" : "upcoming";
  }

  if (isAdmin) {
    // ── Rent ─────────────────────────────────────────────────────────────────
    for (const prop of (data.properties || [])) {
      const ledgers = propertyLeaseLedgers(prop, data.rentPayments || []);
      for (const { unit, ledger } of ledgers) {
        let addedUpcoming = false;
        for (const row of ledger.rows) {
          const due = row.dueDate || (row.month + "-01");
          const completed = row.outstanding === 0;
          const status = notifStatus(due, completed);
          if (status === "upcoming") {
            if (addedUpcoming) continue; // only next upcoming per unit
            addedUpcoming = true;
          }
          out.push({
            id: `rent-${prop.id}-${unit.id}-${row.month}`,
            type: status === "overdue" ? (row.month < ym ? "rent_overdue" : "rent_due") : "rent_due",
            category: "Real Estate",
            title: status === "completed" ? "Rent Received" : status === "overdue" ? (row.month < ym ? "Rent Overdue" : "Log Rent Payment") : "Upcoming Rent",
            description: `${prop.name} · ${unit.label || unit.id}`,
            detail: status === "upcoming"
              ? `Due ${due} — ${$F(row.outstanding)}`
              : status === "completed"
              ? `${monthLabel(row.month)} — ${$F(row.amount)} received`
              : `${monthLabel(row.month)} — ${$F(row.outstanding)} ${row.month < ym ? "overdue" : "due"}`,
            month: row.month, dueDate: due,
            severity: status === "overdue" && row.month < ym ? "high" : "medium",
            status,
          });
        }
      }
    }

    // ── Individual snapshots — current month (overdue/completed) ─────────────
    for (const ind of (data.individuals || [])) {
      const dueDate = ym + "-01";
      const submitted = (ind.accountsLog || []).some(e => e.month === ym);
      const hasPendingSub = (() => {
        const profile = profiles.find(p => p.individual_id === ind.id);
        return profile ? pendingSubs.some(s => s.user_id === profile.id && s.period?.slice(0,7) === ym) : false;
      })();
      const completed = submitted || hasPendingSub;
      out.push({
        id: `snapshot-ind-${ind.id}-${ym}`,
        type: "submission_needed", category: "Individuals",
        title: completed ? `Snapshot received — ${ind.name}` : `Snapshot due — ${ind.name}`,
        description: ind.name,
        detail: completed
          ? `${monthLabel(ym)} snapshot submitted`
          : `${monthLabel(ym)} personal snapshot not yet logged`,
        month: ym, dueDate, individualId: ind.id,
        severity: "medium", status: notifStatus(dueDate, completed),
      });
    }

    // ── Individual snapshots — next month (always upcoming) ───────────────────
    for (const ind of (data.individuals || [])) {
      const dueDate = nextYM + "-01";
      out.push({
        id: `snapshot-ind-${ind.id}-${nextYM}`,
        type: "submission_needed", category: "Individuals",
        title: `Upcoming snapshot — ${ind.name}`,
        description: ind.name,
        detail: `${monthLabel(nextYM)} snapshot due ${dueDate}`,
        month: nextYM, dueDate, individualId: ind.id,
        severity: "low", status: "upcoming",
      });
    }

    // ── Pending member submissions awaiting admin review ───────────────────────
    for (const sub of pendingSubs) {
      const profile = profiles.find(p => p.id === sub.user_id);
      const ind = (data.individuals || []).find(x => x.id === profile?.individual_id);
      const subYM = sub.period ? sub.period.slice(0,7) : ym;
      out.push({
        id: `submission-pending-${sub.id}`,
        type: "submission_pending", category: "Individuals",
        title: "Submission Pending Review",
        description: ind?.name || profile?.display_name || "Member",
        detail: `Submitted ${monthLabel(subYM)} — awaiting admin review`,
        month: subYM, dueDate: subYM + "-01",
        severity: "low", status: "overdue",
      });
    }

    // ── Business P&L — previous month (due 5th of current month) ──────────────
    for (const biz of (data.businesses || []).filter(b => b.type !== "nonprofit")) {
      const dueDate = ym + "-05";
      const completed = !!(biz.monthlyProfits || []).find(p => p.month === prevYM)
                     || !!(biz.historicalData  || []).find(e => e.month === prevYM);
      out.push({
        id: `biz-pl-${biz.id}-${prevYM}`,
        type: "biz_pl_needed", category: "Businesses",
        title: completed ? `P&L filed — ${biz.name}` : `P&L due — ${biz.name}`,
        description: biz.name,
        detail: completed
          ? `${monthLabel(prevYM)} P&L recorded`
          : `${monthLabel(prevYM)} P&L due ${dayOfMonth >= 5 ? "now" : `by ${dueDate}`}`,
        month: prevYM, dueDate, bizId: biz.id,
        severity: "medium", status: notifStatus(dueDate, completed),
      });
    }

    // ── Business P&L — current month (due 5th of next month, always upcoming) ──
    for (const biz of (data.businesses || []).filter(b => b.type !== "nonprofit")) {
      const dueDate = nextYM + "-05";
      out.push({
        id: `biz-pl-${biz.id}-${ym}`,
        type: "biz_pl_needed", category: "Businesses",
        title: `Upcoming P&L — ${biz.name}`,
        description: biz.name,
        detail: `${monthLabel(ym)} P&L due ${dueDate}`,
        month: ym, dueDate, bizId: biz.id,
        severity: "low", status: "upcoming",
      });
    }

    // ── Monthly consolidated snapshot ─────────────────────────────────────────
    const snapCaptured = (data.snapshots || []).some(s => s.month === ym);
    out.push({
      id: `snapshot-${ym}`,
      type: "snapshot_needed", category: "Reports",
      title: snapCaptured ? "Snapshot captured" : "Monthly snapshot not captured",
      description: `${monthLabel(ym)} consolidated report`,
      detail: snapCaptured ? `${monthLabel(ym)} report snapshot locked` : "Go to Reports tab to capture",
      month: ym, dueDate: ym + "-01",
      severity: "low", status: snapCaptured ? "completed" : "overdue",
    });

    // ── Vehicle payments ────────────────────────────────────────────────────────
    for (const v of (data.vehicles || [])) {
      if (safe(v.monthlyPayment) <= 0) continue;
      const dueDay = safe(v.paymentDueDay) || 1;
      const dueDateStr = `${ym}-${String(dueDay).padStart(2,"0")}`;
      out.push({
        id: `vehicle-payment-${v.id}-${ym}`,
        type: "vehicle_payment", category: "Vehicles",
        title: `${v.name} payment`,
        description: `${v.make} ${v.model}`,
        detail: `Monthly payment ${$F(v.monthlyPayment)} due ${dueDateStr}`,
        month: ym, dueDate: dueDateStr,
        severity: "medium", status: notifStatus(dueDateStr, false),
      });
    }

  } else {
    // ── Member: own current-month snapshot ────────────────────────────────────
    if (individualId) {
      const ind = (data.individuals || []).find(x => x.id === individualId);
      const dueDate = ym + "-01";
      const submitted = ind ? (ind.accountsLog || []).some(e => e.month === ym) : false;
      out.push({
        id: `snapshot-ind-${individualId}-${ym}`,
        type: "submission_needed", category: "Your Updates",
        title: submitted ? "Snapshot submitted" : "Monthly snapshot due",
        description: submitted ? `${monthLabel(ym)} update received` : `${monthLabel(ym)} update required`,
        detail: submitted ? "Your snapshot has been recorded." : "Submit your monthly financial update",
        month: ym, dueDate, individualId,
        severity: "medium", status: notifStatus(dueDate, submitted),
      });
      // Upcoming next month
      out.push({
        id: `snapshot-ind-${individualId}-${nextYM}`,
        type: "submission_needed", category: "Your Updates",
        title: `Upcoming snapshot — ${monthLabel(nextYM)}`,
        description: `${monthLabel(nextYM)} update due ${nextYM}-01`,
        detail: "Your next monthly snapshot will be due on the 1st.",
        month: nextYM, dueDate: nextYM + "-01", individualId,
        severity: "low", status: "upcoming",
      });
    }
  }

  return out;
}

function getFxRateToCad(propOrEntry) {
  const currency = propOrEntry?.market_currency || propOrEntry?.currency || "CAD";
  const rate = safe(propOrEntry?.fx_rate_to_cad);
  return currency === "CAD" ? 1 : (rate > 0 ? rate : 1);
}
function getNativeMarketValue(propOrEntry) {
  if (propOrEntry?.market_value != null) return safe(propOrEntry.market_value);
  if (propOrEntry?.value != null) return safe(propOrEntry.value);
  if (propOrEntry?.market != null) return safe(propOrEntry.market);
  return 0;
}
function getMarketValueCad(propOrEntry) {
  const currency = propOrEntry?.market_currency || propOrEntry?.currency || "CAD";
  const nativeValue = getNativeMarketValue(propOrEntry);
  if (currency === "CAD") return nativeValue;
  return nativeValue * getFxRateToCad(propOrEntry);
}
function getVehicleMarketValue(v) {
  const sorted = (v.valuations || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return sorted[0] ? safe(sorted[0].value) : safe(v.currentMarketValue);
}
function formatNativeMoney(amount, currency) {
  const value = safe(amount);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const formatted = abs.toLocaleString("en-CA", { maximumFractionDigits: 0 });
  return currency === "AZN" ? `${sign}${formatted} AZN` : `${sign}C$${formatted}`;
}
function getCountryMeta(country) {
  const normalized = country === "Azerbaijan" ? "Azerbaijan" : "Canada";
  return normalized === "Azerbaijan"
    ? { label: "Azerbaijan", flag: "🇦🇿" }
    : { label: "Canada", flag: "🇨🇦" };
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
  const normalizedVals = (prop.valuations || []).map(entry => {
    const market_currency = entry.market_currency || entry.currency || prop.market_currency || "CAD";
    const market_value = entry.market_value != null ? safe(entry.market_value) : safe(entry.value);
    return {
      ...entry,
      market_value,
      market_currency,
      fx_rate_to_cad: getFxRateToCad({ ...prop, ...entry, market_currency }),
      value: getMarketValueCad({ ...prop, ...entry, market_value, market_currency }),
    };
  });
  const latestVal = normalizedVals.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  const market_currency = latestVal?.market_currency || prop.market_currency || "CAD";
  const market_value = latestVal ? latestVal.market_value : (prop.market_value != null ? safe(prop.market_value) : safe(prop.market));
  const fx_rate_to_cad = latestVal?.fx_rate_to_cad || getFxRateToCad(prop);
  return {
    ...prop,
    country: prop.country || "Canada",
    market_currency,
    market_value,
    fx_rate_to_cad,
    market: getMarketValueCad({ ...prop, market_value, market_currency, fx_rate_to_cad }),
    mortgage_as_of_month: prop.mortgage_as_of_month || SYSTEM_START,
    payment_structure: prop.payment_structure || "amortizing",
    mortgage_manual_override: safe(prop.mortgage_manual_override),
    mortgage_manual_override_month: prop.mortgage_manual_override_month || "",
    valuations: normalizedVals,
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
  // Allocate deposit: first month, then last month, then intermediate months in order
  let remainingCredit = lease.deposit_applies_to_rent ? safe(lease.deposit_received) : 0;
  const baseRows = schedule.map(item => ({ ...item, paid: safe(paymentByMonth[item.month]), creditApplied: 0 }));
  function applyCredit(row) {
    const gap = Math.max(row.amount - row.paid, 0);
    const applied = Math.min(gap, remainingCredit);
    remainingCredit -= applied;
    row.creditApplied += applied;
  }
  if (baseRows.length > 0) applyCredit(baseRows[0]);
  if (baseRows.length > 1) applyCredit(baseRows[baseRows.length - 1]);
  for (let i = 1; i < baseRows.length - 1; i++) applyCredit(baseRows[i]);
  const rows = baseRows.map(row => ({ ...row, outstanding: Math.max(0, row.amount - row.paid - row.creditApplied) }));
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
function getLedgerCoverageSummary(ledger) {
  let paidThroughMonth = null;
  for (const row of ledger.rows) {
    if (row.outstanding === 0) paidThroughMonth = row.month;
    else break;
  }
  const today = currentYM();
  const nextDueRow = ledger.rows.find(r => r.month >= today && r.outstanding > 0) || null;
  return { paidThroughMonth, nextDueRow };
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
function propGrossEquity(prop) { return getMarketValueCad(prop) - propCurrentMortgageBalance(prop); }
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

// ─── NET WORTH TRAJECTORY CHART ───────────────────────────────────────────────
function NWChart({ snapshots }) {
  const sorted = [...(snapshots || [])]
    .sort((a, b) => (a.month || "").localeCompare(b.month || ""))
    .slice(-24);

  if (sorted.length < 2) {
    return (
      <Card accent={C.gold} style={{ marginBottom: 16, paddingTop: 20 }}>
        <Label>Net Worth Trajectory</Label>
        <div style={{ textAlign: "center", padding: "28px 0", color: C.textDim, fontSize: 12 }}>
          {sorted.length === 0
            ? "No snapshots captured yet — go to the Reports tab to capture your first monthly snapshot."
            : "Capture one more snapshot next month to see your trajectory."}
        </div>
      </Card>
    );
  }

  const SERIES = [
    { key: "nw",          label: "Total NW",    color: C.gold,    w: 2.5 },
    { key: "reLiquid",    label: "Real Estate", color: C.blue,    w: 1.5 },
    { key: "individuals", label: "Individuals", color: C.green,   w: 1.5 },
    { key: "businesses",  label: "Business",    color: "#6366F1", w: 1.5 },
    { key: "vehicles",    label: "Vehicles",    color: C.amber,   w: 1.5 },
  ];

  const pts = sorted.map(s => ({
    ...s,
    vehicles: safe(s.vehicles) > 0
      ? safe(s.vehicles)
      : Math.max(0, safe(s.nw) - safe(s.reLiquid) - safe(s.individuals) - safe(s.businesses)),
  }));

  const allVals = pts.flatMap(p => SERIES.map(s => safe(p[s.key])));
  const rawMin  = Math.min(...allVals);
  const rawMax  = Math.max(...allVals);
  const minVal  = Math.max(0, rawMin - (rawMax - rawMin) * 0.08);
  const maxVal  = rawMax + (rawMax - rawMin) * 0.08 || rawMax * 1.05 || 1;
  const range   = maxVal - minVal || 1;

  const W = 600, H = 200, PL = 58, PR = 16, PT = 16, PB = 28;
  const CW = W - PL - PR, CH = H - PT - PB;

  const xFor = i  => PL + (i / (pts.length - 1)) * CW;
  const yFor = v  => PT + CH - ((safe(v) - minVal) / range) * CH;
  const pathFor = key =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(safe(p[key])).toFixed(1)}`).join(" ");

  const yTicks  = Array.from({ length: 5 }, (_, i) => minVal + (range * i) / 4);
  const xEvery  = pts.length <= 8 ? 1 : pts.length <= 16 ? 2 : 3;

  const first  = pts[0];
  const last   = pts[pts.length - 1];
  const growth = safe(last.nw) - safe(first.nw);
  const growthPct = safe(first.nw) > 0 ? (growth / safe(first.nw)) * 100 : 0;
  const months    = pts.length - 1;
  const monthlyAvg = months > 0 ? growth / months : 0;

  return (
    <Card accent={C.gold} style={{ marginBottom: 16, paddingTop: 20 }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <div>
          <Label>Net Worth Trajectory</Label>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
            {monthLabel(first.month)} → {monthLabel(last.month)} · {months} month{months !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontFamily: C.mono, fontWeight: 800, color: growth >= 0 ? C.green : C.red, letterSpacing: -0.5 }}>
            {growth >= 0 ? "+" : ""}{$K(growth)}
          </div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 1 }}>
            {growth >= 0 ? "+" : ""}{growthPct.toFixed(1)}% · avg {growth >= 0 ? "+" : ""}{$K(monthlyAvg)}/mo
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
        {SERIES.map(s => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 18, height: s.key === "nw" ? 3 : 2, background: s.color, borderRadius: 2, opacity: s.key === "nw" ? 1 : 0.75 }} />
            <span style={{ fontSize: 10, color: C.textDim }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* SVG chart */}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
        {/* Grid + Y labels */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PL} y1={yFor(v).toFixed(1)} x2={W - PR} y2={yFor(v).toFixed(1)}
              stroke={C.border} strokeWidth="0.6" strokeDasharray={i === 0 ? "none" : "3,4"} />
            <text x={PL - 5} y={yFor(v) + 3.5} textAnchor="end"
              fontSize="9" fill={C.textDim} fontFamily="monospace">{$K(v)}</text>
          </g>
        ))}

        {/* X labels */}
        {pts.map((p, i) => i % xEvery === 0 && (
          <text key={i} x={xFor(i).toFixed(1)} y={H - 4} textAnchor="middle"
            fontSize="9" fill={C.textDim}>{monthLabel(p.month).split(" ")[0]} {p.month?.slice(2, 4)}</text>
        ))}

        {/* Category lines (behind NW) */}
        {SERIES.filter(s => s.key !== "nw").map(s => (
          <path key={s.key} d={pathFor(s.key)} fill="none"
            stroke={s.color} strokeWidth={s.w} strokeLinejoin="round" strokeLinecap="round" opacity="0.65" />
        ))}

        {/* NW area fill */}
        <path
          d={`${pathFor("nw")} L${xFor(pts.length - 1).toFixed(1)},${PT + CH} L${PL},${PT + CH} Z`}
          fill={C.gold} opacity="0.07" />

        {/* NW line */}
        <path d={pathFor("nw")} fill="none"
          stroke={C.gold} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Latest value callout */}
        <text
          x={xFor(pts.length - 1) - 7} y={yFor(safe(last.nw)) - 8}
          textAnchor="end" fontSize="10" fontWeight="700" fill={C.gold} fontFamily="monospace">
          {$K(last.nw)}
        </text>

        {/* End dot */}
        <circle cx={xFor(pts.length - 1).toFixed(1)} cy={yFor(safe(last.nw)).toFixed(1)}
          r="4" fill={C.gold} stroke={C.card} strokeWidth="1.5" />
      </svg>
    </Card>
  );
}

// ─── ASSET ALLOCATION + LIQUIDITY CARD ───────────────────────────────────────
function AllocationCard({ totalRELiquid, totalPers, totalBiz, totalVehicles, individuals }) {
  const slices = [
    { label: "Real Estate",  val: Math.max(0, totalRELiquid), color: C.blue,    sub: "Liquid equity after selling costs" },
    { label: "Individuals",  val: Math.max(0, totalPers),     color: C.green,   sub: "Personal net assets" },
    { label: "Business",     val: Math.max(0, totalBiz),      color: "#6366F1", sub: "Operating corp equity" },
    { label: "Vehicles",     val: Math.max(0, totalVehicles), color: C.amber,   sub: "Net vehicle equity" },
  ].filter(s => s.val > 0);

  const totalNW = slices.reduce((s, sl) => s + sl.val, 0);
  if (totalNW <= 0) return null;

  // Liquidity buckets
  const liqCash = individuals.reduce((s, f) => s + safe(f.cash) + safe(f.accounts) + safe(f.securities) + safe(f.crypto), 0);
  const liqSemi = Math.max(0, totalBiz);
  const liqHard = Math.max(0, totalRELiquid) + Math.max(0, totalVehicles) + individuals.reduce((s, f) => s + safe(f.physicalAssets), 0);
  const liqTotal = Math.max(liqCash + liqSemi + liqHard, 1);

  // SVG donut arc builder
  const R = 54, IR = 36, CX = 64, CY = 64;
  const toXY = (a, r) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  const GAP = 0.025;
  let cursor = -Math.PI / 2;
  const paths = slices.map(sl => {
    const sweep = (sl.val / totalNW) * 2 * Math.PI - GAP;
    const s0 = cursor + GAP / 2, s1 = s0 + sweep;
    const [x1, y1] = toXY(s0, R), [x2, y2] = toXY(s1, R);
    const [xi1, yi1] = toXY(s1, IR), [xi2, yi2] = toXY(s0, IR);
    const lg = sweep > Math.PI ? 1 : 0;
    const d = `M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${lg} 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${xi1.toFixed(2)},${yi1.toFixed(2)} A${IR},${IR} 0 ${lg} 0 ${xi2.toFixed(2)},${yi2.toFixed(2)} Z`;
    cursor += (sl.val / totalNW) * 2 * Math.PI;
    return { ...sl, d, pct: (sl.val / totalNW * 100).toFixed(1) };
  });

  return (
    <Card accent={C.blue} style={{ marginBottom: 16, paddingTop: 20 }}>
      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        {/* Donut */}
        <svg viewBox="0 0 128 128" width={120} height={120} style={{ flexShrink: 0 }}>
          {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} />)}
          <text x={CX} y={CY - 7} textAnchor="middle" fontSize="8" fill={C.textDim} fontFamily={C.sans} letterSpacing="0.05em">TOTAL NW</text>
          <text x={CX} y={CY + 8} textAnchor="middle" fontSize="13" fontWeight="700" fill={C.text} fontFamily="monospace">{$K(totalNW)}</text>
        </svg>
        {/* Legend */}
        <div style={{ flex: 1, minWidth: 160 }}>
          <Label>Asset Allocation</Label>
          {paths.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: C.text }}>{p.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontFamily: C.mono, fontWeight: 700, color: p.color }}>{p.pct}%</span>
                <span style={{ fontSize: 11, color: C.textDim, fontFamily: C.mono }}>{$K(p.val)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Liquidity bar */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Label>Liquidity Profile</Label>
          <div style={{ fontSize: 10, color: C.textDim, display: "flex", gap: 10 }}>
            <span><span style={{ color: C.green, fontWeight: 700 }}>{(liqCash / liqTotal * 100).toFixed(0)}%</span> Liquid</span>
            <span><span style={{ color: C.amber, fontWeight: 700 }}>{(liqSemi / liqTotal * 100).toFixed(0)}%</span> Semi</span>
            <span><span style={{ color: C.blue,  fontWeight: 700 }}>{(liqHard / liqTotal * 100).toFixed(0)}%</span> Illiquid</span>
          </div>
        </div>
        <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 8 }}>
          {[[liqCash, C.green], [liqSemi, C.amber], [liqHard, C.blue]].map(([v, c], i) => (
            <div key={i} style={{ width: `${v / liqTotal * 100}%`, background: c, minWidth: v > 0 ? 2 : 0 }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 10, color: C.textDim, flexWrap: "wrap", gap: 4 }}>
          <span>{$K(liqCash)} liquid — cash, accounts, securities, crypto</span>
          <span>{$K(liqHard)} illiquid — real estate, vehicles</span>
        </div>
      </div>
    </Card>
  );
}

// ─── CASH FLOW GRAPH ──────────────────────────────────────────────────────────
function CashFlowGraph({ data }) {
  const months  = monthsBetween(SYSTEM_START, currentYM());
  const values  = months.map(m => {
    const bizIn  = data.businesses.filter(b => b.type !== "nonprofit").reduce((s, b) => {
      const e = (b.monthlyProfits || []).find(p => p.month === m); return s + safe(e?.profit);
    }, 0);
    const rentIn = data.properties.reduce((s, p) => s + propEffectiveRent(p), 0);
    const indIn  = data.individuals.reduce((s, ind) => {
      const e = (ind.monthlyIncome || []).find(p => p.month === m); return s + safe(e?.income);
    }, 0);
    const other  = data.cashflow.income.reduce((s, i) => s + safe(i.amount), 0);
    const tIn    = bizIn + rentIn + indIn + other;
    const tPropOut  = data.properties.reduce((s, p) => s + propMonthlyOut(p), 0);
    const tOtherOut = data.cashflow.obligations.reduce((s, o) => s + safe(o.amount), 0);
    const tOut      = tPropOut + tOtherOut;
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
  const isMobile = useIsMobile();
  const save = () => { onSave(safe(val)); onClose(); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: isMobile ? 12 : 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: isMobile ? "20px 16px" : 28, width: "100%", maxWidth: 360, boxShadow: "0 8px 48px rgba(0,0,0,0.12)" }}>
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
  const isMobile = useIsMobile();
  const inp = { width:"100%", padding:"10px 12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:14, fontFamily:C.mono, outline:"none", boxSizing:"border-box", marginBottom:14 };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding: isMobile ? 12 : 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding: isMobile ? "20px 16px" : 28, width:"100%", maxWidth:360, boxShadow:"0 8px 48px rgba(0,0,0,0.14)" }}>
        <div style={{ fontSize:17, fontWeight:700, color:C.text, marginBottom:4 }}>Log Rent Payment</div>
        <div style={{ fontSize:13, color:C.textDim, marginBottom:8 }}>{propertyName} · {unitLabel} · {monthLabel(month)}</div>
        <div style={{ background:C.bg, borderRadius:10, padding:"10px 12px", marginBottom:18, fontSize:12, color:C.textMid, lineHeight:1.6 }}>
          <div>Tenant: <strong style={{ color:C.text }}>{lease?.tenant_full_name || "Tenant TBD"}</strong></div>
          <div>Rent due: <strong style={{ color:C.text }}>{$F(expected)}</strong></div>
          {creditApplied > 0 && <div>Prepaid coverage applied: <strong style={{ color:C.gold }}>{$F(creditApplied)}</strong></div>}
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
  const prevYM = shiftYM(ym, -1);
  const [rentVals,   setRentVals]   = useState(() => Object.fromEntries(missingRent.map(p => [p.id, ""])));
  const [profitVals, setProfitVals] = useState(() => Object.fromEntries(missingProfits.map(b => [b.id, ""])));
  const [saving, setSaving]         = useState(false);
  const isMobile = useIsMobile();

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
    <div style={{ position:"fixed", inset:0, background:"rgba(7,15,30,0.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding: isMobile ? 12 : 20 }}>
      <div style={{ background:C.surface, borderRadius:20, width:"100%", maxWidth:460, boxShadow:"0 24px 80px rgba(0,0,0,0.28)", overflow:"hidden" }}>
        {/* Gold accent header */}
        <div style={{ background:`linear-gradient(135deg, ${C.nav} 0%, #1A2E52 100%)`, padding: isMobile ? "18px 20px 16px" : "22px 28px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:C.gold, boxShadow:`0 0 8px ${C.gold}` }} />
            <div style={{ fontSize:11, fontWeight:700, color:C.gold, letterSpacing:"0.12em", textTransform:"uppercase" }}>Monthly Update Required</div>
          </div>
          <div style={{ fontSize:22, fontWeight:800, color:"#FFFFFF", letterSpacing:-0.5 }}>Please Update</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", marginTop:4 }}>
            {missingRent.length + missingProfits.length} item{missingRent.length + missingProfits.length > 1 ? "s" : ""} require attention
          </div>
        </div>

        <div style={{ padding: isMobile ? "20px 20px 24px" : "24px 28px 28px", maxHeight:"70vh", overflowY:"auto" }}>
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
                <div style={{ fontSize:11, fontWeight:700, color:C.textMid, letterSpacing:"0.08em", textTransform:"uppercase" }}>Net Profit — {monthLabel(prevYM)}</div>
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
  const isMobile = useIsMobile();

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
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1200, padding: isMobile ? 12 : 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:18, padding: isMobile ? "20px 16px" : 28, width:"100%", maxWidth:440, boxShadow:"0 12px 60px rgba(0,0,0,0.18)", maxHeight:"92vh", overflowY:"auto" }}>
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
  const isMobile = useIsMobile();
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: isMobile ? 12 : 20 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: isMobile ? "20px 16px" : 28, width: "100%", maxWidth: 420, boxShadow: "0 8px 48px rgba(0,0,0,0.14)", maxHeight: "90vh", overflowY: "auto" }}>
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

// ─── NOTIFICATION UI ──────────────────────────────────────────────────────────
const NOTIF_COLOR = {
  rent_overdue:       "#EF4444",
  rent_due:           "#F59E0B",
  submission_needed:  "#F59E0B",
  submission_pending: "#3B82F6",
  biz_pl_needed:      "#F59E0B",
  snapshot_needed:    "#8B5CF6",
  vehicle_payment:    "#B7770D",
};
const NOTIF_DOT = {
  rent_overdue: "●", rent_due: "●", submission_needed: "●",
  submission_pending: "●", biz_pl_needed: "●", snapshot_needed: "●",
  vehicle_payment: "🚗",
};

function NotificationRow({ n, onComplete, completed }) {
  const color = NOTIF_COLOR[n.type] || C.textMid;
  return (
    <div style={{
      padding:"10px 12px", borderRadius:8,
      background: completed ? C.bg : C.surface,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${completed ? C.border : color}`,
      display:"flex", alignItems:"flex-start", gap:10,
      opacity: completed ? 0.5 : 1,
    }}>
      <span style={{ fontSize:10, color: completed ? C.textDim : color, marginTop:2, flexShrink:0 }}>
        {completed ? "✓" : (NOTIF_DOT[n.type] || "●")}
      </span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:600, color: completed ? C.textDim : C.text, marginBottom:1 }}>{n.title}</div>
        <div style={{ fontSize:11, color: C.textMid, marginBottom:1 }}>{n.description}</div>
        {n.detail && <div style={{ fontSize:10, color:C.textDim }}>{n.detail}</div>}
        <div style={{ fontSize:9, color:C.textDim, marginTop:3, letterSpacing:"0.07em", textTransform:"uppercase" }}>{n.category}</div>
      </div>
      {onComplete && !completed && (
        <button onClick={() => onComplete(n.id)}
          style={{ fontSize:10, padding:"3px 8px", borderRadius:5, background:"transparent", border:`1px solid ${C.border}`, color:C.textDim, cursor:"pointer", fontWeight:600, flexShrink:0, whiteSpace:"nowrap", marginTop:1 }}>
          Done
        </button>
      )}
    </div>
  );
}

function NotificationPanel({ notifications, completedIds, onComplete, onClose, isAdmin }) {
  const [activeTab, setActiveTab] = useState("overdue");
  const isMobile = useIsMobile();
  const completedMap = completedIds && !Array.isArray(completedIds) ? completedIds : {};

  const isCompleted = n => n.status === "completed" || !!completedMap[n.id];

  const overdue   = notifications.filter(n => !isCompleted(n) && n.status !== "upcoming")
                                 .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  const upcoming  = notifications.filter(n => !isCompleted(n) && n.status === "upcoming")
                                 .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  const completed = notifications.filter(n => isCompleted(n))
                                 .sort((a, b) => (b.dueDate || "").localeCompare(a.dueDate || ""));

  const TABS_NOTIF = [
    { id:"overdue",   label:"Overdue",   count:overdue.length,   color:"#EF4444", badgeBg:"#EF4444" },
    { id:"upcoming",  label:"Upcoming",  count:upcoming.length,  color:C.amber,   badgeBg:C.amber   },
    { id:"completed", label:"Completed", count:completed.length, color:C.green,   badgeBg:C.green   },
  ];

  const activeItems = activeTab === "overdue" ? overdue : activeTab === "upcoming" ? upcoming : completed;
  const canComplete = activeTab === "overdue" && isAdmin;

  const body = (
    <>
      {/* Tab bar */}
      <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        {TABS_NOTIF.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ flex:1, padding:"10px 6px 9px", fontSize:11, fontWeight:700, background:"none", border:"none",
              borderBottom: activeTab === t.id ? `2px solid ${t.color}` : "2px solid transparent",
              color: activeTab === t.id ? t.color : C.textDim, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ background: activeTab === t.id ? t.badgeBg : C.border, color: activeTab === t.id ? "#fff" : C.textDim,
                fontSize:9, fontWeight:700, borderRadius:10, padding:"1px 5px", minWidth:14, textAlign:"center" }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {/* Tab content */}
      <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:7 }}>
        {activeItems.length === 0
          ? <div style={{ fontSize:12, color:C.textDim, padding:"6px 0" }}>
              {activeTab === "overdue" ? "All clear ✓" : activeTab === "upcoming" ? "No upcoming tasks." : "Nothing completed yet."}
            </div>
          : activeItems.map(n => (
              <NotificationRow key={n.id} n={n}
                onComplete={canComplete ? onComplete : null}
                completed={activeTab === "completed"} />
            ))
        }
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:149, background:"rgba(0,0,0,0.4)" }} />
        <div style={{
          position:"fixed", bottom:0, left:0, right:0, zIndex:150,
          background:C.surface, borderRadius:"20px 20px 0 0",
          boxShadow:"0 -4px 32px rgba(0,0,0,0.22)",
          maxHeight:"85vh", display:"flex", flexDirection:"column",
          paddingBottom:"env(safe-area-inset-bottom)",
        }}>
          <div style={{ padding:"14px 16px 10px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <span style={{ fontSize:15, fontWeight:700, color:C.text }}>Notifications</span>
            <button onClick={onClose} style={{ background:"none", border:"none", color:C.textDim, fontSize:20, cursor:"pointer", padding:"0 4px", lineHeight:1 }}>✕</button>
          </div>
          <div style={{ overflowY:"auto", flex:1, WebkitOverflowScrolling:"touch" }}>
            {body}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:149 }} />
      <div style={{
        position:"absolute", top:"calc(100% + 8px)", right:0,
        width:360, maxWidth:"calc(100vw - 20px)",
        background:C.surface, border:`1px solid ${C.border}`,
        borderRadius:14, boxShadow:"0 8px 48px rgba(0,0,0,0.18)",
        zIndex:150, overflow:"hidden",
        maxHeight:"80vh", display:"flex", flexDirection:"column",
      }}>
        <div style={{ padding:"14px 16px 10px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <span style={{ fontSize:14, fontWeight:700, color:C.text }}>Notifications</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.textDim, fontSize:16, cursor:"pointer", padding:"0 4px", lineHeight:1 }}>✕</button>
        </div>
        <div style={{ overflowY:"auto", flex:1 }}>
          {body}
        </div>
      </div>
    </>
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
function MemberView({ user, data, onUpdate, onSaveIncome, onSaveAccountsLog, onLogout }) {
  const [saved, setSaved]               = useState(false);
  const [cashModal, setCashModal]       = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [currentSub, setCurrentSub]     = useState(undefined); // undefined=loading
  const [missingPeriod, setMissingPeriod] = useState(null);   // { period_date, label }
  const [memberTab, setMemberTab]       = useState("snapshot");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const isMobile = useIsMobile();
  const isSmall = useIsSmall();

  const individualId = user.profile?.individual_id;
  const isAhmed      = individualId === 1;
  const f = data.individuals.find(x => x.id === individualId);

  // All hooks run unconditionally before any early return
  useEffect(() => {
    async function checkPeriods() {
      const [periods, userSubs] = await Promise.all([
        fetchReportingPeriods(),
        getSubmissionsForUser(user.id),
      ]);

      const currentMonth = currentYM();
      const currentPeriodDate = periodDateForYM(currentMonth);
      const currentPeriod = periods.find(p => ymFromPeriodDate(p.period_date) === currentMonth)
        || { period_date: currentPeriodDate, label: monthLabel(currentMonth) };
      const currentMonthSubmissions = userSubs.filter(s => ymFromPeriodDate(s.period) === currentMonth);
      const validSubmission = currentMonthSubmissions.find(s => s.status !== "rejected") || null;
      const currentMonthSubmission = validSubmission
        || currentMonthSubmissions[0]
        || null;
      const hasLoggedSnapshot = !!(f?.accountsLog || []).some(e => e.month === currentMonth);
      const hasValidSubmission = !!validSubmission;

      if (hasValidSubmission) {
        setCurrentSub(validSubmission);
        setMissingPeriod(null);
        setShowSubModal(false);
        return;
      }
      if (hasLoggedSnapshot) {
        setCurrentSub(null);
        setMissingPeriod(null);
        setShowSubModal(false);
        return;
      }

      setCurrentSub(currentMonthSubmission);
      setMissingPeriod(currentPeriod);
      setShowSubModal(true);
    }
    checkPeriods();
  }, [user.id, f?.accountsLog]);

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
      setMissingPeriod(null);
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
      <div style={{ background: C.nav, borderBottom: `1px solid ${C.navBorder}`, padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:C.gold }} />
            <span style={{ fontSize: 15, fontWeight: 800, color: C.gold, letterSpacing:"0.08em" }}>JMF</span>
          </div>
          {!isSmall && <span style={{ fontSize: 11, color: C.navText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>}
          {saved && <span style={{ fontSize: 10, color: "#FFF", background: C.green, borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>✓</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {subStatusBadge()}
          {cashStale && !isSmall && (
            <button onClick={() => setCashModal(true)}
              style={{ fontSize: 10, color: C.amber, background: "rgba(183,119,13,0.15)", border: `1px solid rgba(183,119,13,0.3)`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontWeight: 600 }}>
              Cash stale
            </button>
          )}
          {/* Notification bell */}
          {(() => {
            const memberNotifs = computeNotifications(data, [], [], false, individualId);
            const meta = data.notificationsMeta || { completed: {}, lastSeenAt: "" };
            const completedMap = meta.completed || {};
            const pendingCount = memberNotifs.filter(n => n.status !== "upcoming" && n.status !== "completed" && !completedMap[n.id]).length;
            return (
              <div style={{ position:"relative" }}>
                <button onClick={() => setNotificationsOpen(o => !o)}
                  style={{ background:"transparent", border:`1px solid rgba(255,255,255,0.12)`, borderRadius:6, color:C.navText, fontSize:14, padding:"3px 8px", cursor:"pointer", lineHeight:1, position:"relative" }}>
                  🔔
                  {pendingCount > 0 && (
                    <span style={{ position:"absolute", top:-5, right:-5, background:"#EF4444", color:"#fff", fontSize:9, fontWeight:700, borderRadius:10, padding:"1px 4px", minWidth:14, textAlign:"center", lineHeight:"14px" }}>
                      {pendingCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <NotificationPanel
                    notifications={memberNotifs}
                    completedIds={meta.completed || {}}
                    onComplete={null}
                    onClose={() => setNotificationsOpen(false)}
                    isAdmin={false}
                  />
                )}
              </div>
            );
          })()}
          <button onClick={onLogout}
            style={{ background: "transparent", border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 6, color: C.navText, fontSize: 10, padding: "4px 10px", cursor: "pointer" }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Member tab bar */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display:"flex", padding:"0 16px" }}>
          {[["snapshot","My Snapshot"],["history","My History"]].map(([id, label]) => (
            <button key={id} onClick={() => setMemberTab(id)}
              style={{ padding:"11px 16px", fontSize:12, fontWeight:600, border:"none", cursor:"pointer", background:"transparent", fontFamily:C.sans,
                color: memberTab === id ? C.gold : C.textDim,
                borderBottom: memberTab === id ? `2px solid ${C.gold}` : "2px solid transparent" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* My History tab */}
      {memberTab === "history" && (
        <div style={{ padding: isMobile ? "14px" : 20, maxWidth: 540, margin: "0 auto" }}>
          {(() => {
            const myLog = [...(f.accountsLog || [])].reverse();
            const snapshots = [...(data.snapshots || [])].reverse();
            return (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Monthly History</div>
                <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>Your full financial position recorded each month.</div>
                {myLog.length === 0
                  ? <div style={{ fontSize: 12, color: C.textDim, fontStyle: "italic", marginBottom: 24 }}>No entries yet.</div>
                  : myLog.map((e, i) => {
                    const entryNet = e.net != null ? e.net : safe(e.value);
                    return (
                      <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: C.textMid, fontWeight: 600 }}>{monthLabel(e.month)}</span>
                          <span style={{ fontFamily: C.mono, fontSize: 15, color: entryNet >= 0 ? C.gold : C.red, fontWeight: 700 }}>{$F(entryNet)}</span>
                        </div>
                        {e.net != null && (
                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                            {[["Cash", e.cash], ["Accounts", e.accounts], ["Securities", e.securities], ["Crypto", e.crypto], ["Assets", e.physicalAssets]].map(([l, v]) => v != null && v !== 0 ? (
                              <span key={l} style={{ fontSize: 11, color: C.textDim }}>{l}: {$K(v)}</span>
                            ) : null)}
                          </div>
                        )}
                        {e.note && <div style={{ fontSize: 11, color: C.textDim, marginTop: 3 }}>{e.note}</div>}
                      </div>
                    );
                  })
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
      <div style={{ padding: isMobile ? "14px" : 20, maxWidth: 540, margin: "0 auto" }}>
        {(() => {
          const curYM = currentYM();
          const logEntries = [...(f.accountsLog || [])].sort((a, b) => (b.month || "").localeCompare(a.month || ""));
          const currentLog = logEntries.find(e => e.month === curYM) || null;
          const incomeEntry = (f.monthlyIncome || []).find(p => p.month === curYM);
          const reportedFields = [
            ["Accounts", safe(currentLog?.accounts ?? f.accounts)],
            ["Cash", safe(currentLog?.cash ?? f.cash)],
            ["Securities", safe(currentLog?.securities ?? f.securities)],
            ["Crypto", safe(currentLog?.crypto ?? f.crypto)],
            ["Physical Assets", safe(currentLog?.physicalAssets ?? f.physicalAssets)],
          ];
          const reportedNet = reportedFields.reduce((sum, [, value]) => sum + safe(value), 0);
          return (
            <>
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

        <Card style={{ marginBottom: 14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, marginBottom:16, flexWrap:"wrap" }}>
            <div>
              <Label>Current Reporting Snapshot</Label>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{monthLabel(curYM)}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>
                Your reporting view is scoped only to your account.
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>Current Month Status</div>
              <div style={{ fontSize:13, fontWeight:700, color: currentSub?.status === "approved" ? C.green : currentSub?.status === "pending" ? C.blue : currentLog ? C.gold : C.amber }}>
                {currentSub?.status === "approved" ? "Submitted and approved"
                  : currentSub?.status === "pending" ? "Submitted and awaiting review"
                  : currentLog ? "Snapshot logged for this month"
                  : "Submission needed"}
              </div>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:10 }}>
            {[
              { label: "Live Net Worth", value: $F(net), color: isPositive ? C.gold : C.red },
              { label: "Reported Net Worth", value: $F(reportedNet), color: reportedNet >= 0 ? C.gold : C.red },
              { label: "Income", value: $F(incomeEntry?.income), color: C.green },
            ].map(item => (
              <div key={item.label} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px" }}>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>{item.label}</div>
                <div style={{ fontSize:18, fontFamily:C.mono, fontWeight:700, color:item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
        </Card>

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

        {/* Monthly reporting */}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4, gap:12, flexWrap:"wrap" }}>
            <div style={{ fontSize:14, fontWeight:600, color:C.text }}>Monthly Reporting</div>
            <span style={{ fontSize:10, color:C.textDim }}>{monthLabel(currentYM())}</span>
          </div>
          <div style={{ fontSize:12, color:C.textDim, marginBottom:16 }}>
            Keep your current month values clean and record a proper monthly snapshot for your own account.
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontSize:13, color:C.text }}>Income this month</span>
            <EditNum value={safe(incomeEntry?.income)} onChange={v => {
              if (onSaveIncome) onSaveIncome(f.id, curYM, safe(v));
            }} />
          </div>
          <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:12, padding:14, marginTop:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:12 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase" }}>Monthly Snapshot Log</div>
                <div style={{ fontSize:12, color:C.textDim, marginTop:4 }}>
                  Save this month’s current values as your official snapshot.
                </div>
              </div>
              <button onClick={() => {
                if (!onSaveAccountsLog) return;
                onSaveAccountsLog(f.id, {
                  month: curYM,
                  cash: safe(f.cash),
                  accounts: safe(f.accounts),
                  securities: safe(f.securities),
                  crypto: safe(f.crypto),
                  physicalAssets: safe(f.physicalAssets),
                  net,
                  note: "Member snapshot",
                });
              }} style={{ padding:"8px 14px", background:C.gold, border:"none", borderRadius:8, color:"#FFF", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                {currentLog ? "Update This Month" : "Save This Month"}
              </button>
            </div>
            {currentLog ? (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))", gap:8 }}>
                {reportedFields.map(([label, value]) => (
                  <div key={label} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px" }}>
                    <div style={{ fontSize:9, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:5 }}>{label}</div>
                    <div style={{ fontSize:13, fontFamily:C.mono, fontWeight:700, color:C.text }}>{$F(value)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize:12, color:C.textDim }}>No saved snapshot for this month yet.</div>
            )}
          </div>
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:14, fontWeight:600, color:C.text }}>Monthly History</div>
            <span style={{ fontSize:10, color:C.textDim }}>{logEntries.length} entr{logEntries.length === 1 ? "y" : "ies"}</span>
          </div>
          {logEntries.length === 0
            ? <div style={{ fontSize:12, color:C.textDim, fontStyle:"italic" }}>No monthly snapshots saved yet.</div>
            : logEntries.slice(0, 6).map((e, i) => {
              const entryNet = e.net != null ? e.net : safe(e.value);
              return (
                <div key={`${e.month}-${i}`} style={{ padding:"10px 0", borderBottom: i < Math.min(logEntries.length, 6) - 1 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:C.textMid, fontWeight:600 }}>{monthLabel(e.month)}</span>
                    <span style={{ fontFamily:C.mono, fontSize:14, color:entryNet >= 0 ? C.gold : C.red, fontWeight:700 }}>{$F(entryNet)}</span>
                  </div>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                    {[["Cash", e.cash], ["Accounts", e.accounts], ["Securities", e.securities], ["Crypto", e.crypto], ["Assets", e.physicalAssets]].map(([label, value]) => (
                      value != null && value !== 0 ? <span key={label} style={{ fontSize:10, color:C.textDim }}>{label}: {$K(value)}</span> : null
                    ))}
                  </div>
                  {e.updatedAt && <div style={{ fontSize:10, color:C.amber, marginTop:3 }}>Updated {new Date(e.updatedAt).toLocaleDateString()}</div>}
                </div>
              );
            })}
        </Card>

        <Card>
          <Label>JMF Group — Summary</Label>
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>Contact Ahmed for full details.</div>
          <Row label="Properties"        last={false}><span style={{ color: C.text, fontFamily: C.mono }}>{data.properties.length} holdings</span></Row>
          <Row label="Business entities" last={true}><span style={{ color: C.text, fontFamily: C.mono }}>{data.businesses.length} companies</span></Row>
        </Card>
            </>
          );
        })()}
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

function PropCard({ prop, rentPayments, onUpdate, onPatch, onSaveRentPayment, isAdmin, periodLocked }) {
  const [open, setOpen] = useState(false);
  const [propTab, setPropTab] = useState("overview");
  const [taxNoteOpen, setTaxNoteOpen] = useState(false);
  const [valFormOpen, setValFormOpen] = useState(false);
  const [valForm, setValForm] = useState({ date:"", value:"", note:"" });
  const [editingUnit, setEditingUnit] = useState(null);
  const [loggingRent, setLoggingRent] = useState(null);
  const [scheduleRows, setScheduleRows] = useState(12);
  const isMobile = useIsMobile();

  const mortgage = calculateMortgageSnapshot(prop, currentYM());
  const market = getMarketValueCad(prop);
  const marketLocal = getNativeMarketValue(prop);
  const marketCurrency = prop.market_currency || "CAD";
  const hasForeignCurrency = marketCurrency !== "CAD";
  const fxRate = getFxRateToCad(prop);
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
  const nextExpected = propertyOutstandingForMonth(prop, rentPayments, currentYM());

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
    padding: isMobile ? "9px 12px" : "11px 18px", fontSize: isMobile ? 11 : 12, fontWeight: 600, border: "none", cursor: "pointer",
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
      <div onClick={() => { setOpen(o => { if (o) setPropTab("overview"); return !o; }); }} style={{ padding: isMobile ? "14px 16px" : "18px 22px", cursor:"pointer", display:"flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent:"space-between", gap: isMobile ? 12 : 14 }}>
        <div style={{ minWidth:0, flex: isMobile ? undefined : 1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:8 }}>
            <StatusPill status={prop.status} />
            <OccupancyBadge status={occupancyStatus} />
            {isPartial && <span style={{ background:C.purpleLight, color:C.purpleText, borderRadius:20, fontSize:10, fontWeight:700, padding:"3px 10px" }}>JMF {Math.round(ownership * 100)}%</span>}
            {prop.country && prop.country !== "Canada" && <span style={{ background:C.blueLight, color:C.blueText, borderRadius:20, fontSize:10, fontWeight:700, padding:"3px 10px" }}>{getCountryMeta(prop.country).flag} {prop.country}</span>}
          </div>
          <div style={{ fontSize:21, fontWeight:700, color:C.text, letterSpacing:-0.4 }}>{prop.name}</div>
          <div style={{ fontSize:12, color:C.textDim, marginTop:4 }}>
            {[prop.location, prop.lender, prop.rate, isPartial ? prop.co_owner : ""].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, minmax(84px, 1fr))", gap: isMobile ? 8 : 10, width: isMobile ? "100%" : undefined, minWidth: isMobile ? undefined : 360 }}>
          {[
            { label:"Market",                              value:hasForeignCurrency ? formatNativeMoney(marketLocal, marketCurrency) : $K(market), color:C.text },
            { label:"Debt",                                value:$K(balance),       color:C.red               },
            { label:isPartial ? "JMF Equity" : "Equity",  value:$K(displayEquity), color:displayEqColor      },
            { label:isPartial ? "JMF Liquid" : "Liquid",  value:$K(displayLiquid), color:displayLiquidColor  },
          ].map(item => (
            <div key={item.label} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:12, padding:"10px 12px", textAlign:"right" }}>
              <div style={{ fontSize:9, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>{item.label}</div>
              <div style={{ fontSize:16, fontFamily:C.mono, fontWeight:700, color:item.color }}>{item.value}</div>
              {item.label === "Market" && hasForeignCurrency && <div style={{ fontSize:10, color:C.textDim, marginTop:4 }}>≈ {$K(market)} CAD</div>}
            </div>
          ))}
        </div>
      </div>

      {open && (
        <div style={{ borderTop:`1px solid ${C.border}` }}>

          {/* Tab bar */}
          <div style={{ background:C.bg, borderBottom:`1px solid ${C.border}`, overflowX:"auto", WebkitOverflowScrolling:"touch", scrollbarWidth:"none", msOverflowStyle:"none" }}>
            <div style={{ display:"flex", minWidth:"max-content" }}>
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
                    { label:"Market Value", value:hasForeignCurrency ? formatNativeMoney(marketLocal, marketCurrency) : $F(market), color:C.text },
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
                    {hasForeignCurrency && <Row label="CAD Equivalent"><span style={{ fontFamily:C.mono, color:C.text }}>{$F(market)}</span></Row>}
                    <Row label="Est. net if sold" last><span style={{ fontFamily:C.mono, color:netEquity >= 0 ? C.green : C.red }}>{$F(netEquity)}</span></Row>
                  </div>
                  <div>
                    <Row label="LTV"><span style={{ color: ltv > 80 ? C.red : ltv > 65 ? C.amber : C.green, fontFamily:C.mono, fontWeight:700 }}>{ltv.toFixed(1)}%</span></Row>
                    {hasForeignCurrency && <Row label="FX Basis"><span style={{ fontSize:13, color:C.text }}>{`1 ${marketCurrency} = C$${fxRate.toFixed(2)}`}</span></Row>}
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
                  <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
                  <div style={{ minWidth:420 }}>
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
                  </div>
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
                <div style={{ marginBottom:14 }}>
                  <Label>Rent Ledger</Label>
                  <div style={{ fontSize:12, color:C.textDim }}>Lease-aware rent schedule with payment and prepaid coverage tracking.</div>
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
                          {(() => {
                            const totalPaid = ledger.totalPaid + ledger.totalCredited;
                            const chips = [
                              { label:"Lease Value",  value:$F(ledger.totalDue),        color:C.text  },
                              { label:"Total Paid",   value:$F(totalPaid),               color:C.green },
                              { label:"Outstanding",  value:$F(ledger.totalOutstanding), color:ledger.totalOutstanding > 0 ? C.red : C.green },
                            ];
                            return (
                              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                                {chips.map(item => (
                                  <div key={item.label} style={{ textAlign:"right" }}>
                                    <div style={{ fontSize:9, color:C.textDim, textTransform:"uppercase", letterSpacing:"0.08em" }}>{item.label}</div>
                                    <div style={{ fontSize:13, fontFamily:C.mono, fontWeight:700, color:item.color }}>{item.value}</div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                        {safe(ledger.lease.deposit_received) > 0 && (() => {
                          const cov = getLedgerCoverageSummary(ledger);
                          const monthsCovered = ledger.rows.filter(r => r.creditApplied > 0 && r.outstanding === 0).length;
                          return (
                            <div style={{ padding:"10px 16px", borderTop:`1px solid ${C.border}`, background:C.goldLight, fontSize:12, color:C.goldText }}>
                              Prepaid deposit: {$F(ledger.lease.deposit_received)} received {formatDate(ledger.lease.deposit_date)}.
                              {monthsCovered > 0 && ` Covers ${monthsCovered} month${monthsCovered > 1 ? "s" : ""}${cov.paidThroughMonth ? ` through ${monthLabel(cov.paidThroughMonth)}` : ""}.`}
                              {ledger.unusedCredit > 0 && ` ${$F(ledger.unusedCredit)} unused balance remaining.`}
                            </div>
                          );
                        })()}
                        {isMobile ? (
                          /* ── MOBILE: stacked card per month ── */
                          <div style={{ padding:"0 14px 14px", display:"flex", flexDirection:"column", gap:10, paddingTop:12 }}>
                            {ledger.rows.map((row) => {
                              const current = ledger.payments.find(entry => entry.month === row.month);
                              const isPaid  = row.outstanding === 0;
                              const displayPaid = row.paid + row.creditApplied;
                              return (
                                <div key={`${unit.id}-${row.month}`} style={{ border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
                                  {/* top row: month + status badge */}
                                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px 8px" }}>
                                    <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{monthLabel(row.month)}</span>
                                    <span style={{ fontSize:11, fontWeight:700, color: isPaid ? C.green : C.red, background: isPaid ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)", padding:"3px 10px", borderRadius:20 }}>
                                      {isPaid ? "Paid" : "Unpaid"}
                                    </span>
                                  </div>
                                  {/* amount row: Rent Due / Paid */}
                                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, padding:"0 14px 10px" }}>
                                    <div>
                                      <div style={{ fontSize:10, color:C.textDim, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:2 }}>Rent Due</div>
                                      <div style={{ fontFamily:C.mono, fontSize:15, fontWeight:700, color:C.text }}>{$F(row.amount)}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize:10, color:C.textDim, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:2 }}>Paid</div>
                                      <div style={{ fontFamily:C.mono, fontSize:15, fontWeight:700, color: displayPaid > 0 ? C.green : C.textDim }}>
                                        {displayPaid > 0 ? $F(displayPaid) : "—"}
                                        {row.creditApplied > 0 && row.paid === 0 && <span style={{ fontSize:10, color:C.textDim, marginLeft:4 }}>(deposit)</span>}
                                      </div>
                                      {current?.note && <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{current.note}</div>}
                                    </div>
                                  </div>
                                  {/* full-width Log/Edit button */}
                                  <button
                                    onClick={() => { if (!isPaid) setLoggingRent({ unit, ledger, row, month: row.month, current }); }}
                                    disabled={isPaid}
                                    style={{ display:"block", width:"100%", padding:"11px", fontSize:13, fontWeight:700, border:"none", borderTop:`1px solid ${C.border}`, background: isPaid ? C.bg : C.goldLight, color: isPaid ? C.textDim : C.goldText, cursor: isPaid ? "default" : "pointer", borderRadius:0 }}>
                                    {isPaid ? "Payment Complete" : current ? "Edit Payment" : "Log Payment"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          /* ── DESKTOP: original grid table ── */
                          <div style={{ padding:"0 16px 14px" }}>
                            <div style={{ display:"grid", gridTemplateColumns:"110px 110px 1fr 1fr 1fr 88px", gap:"8px", padding:"12px 0 8px", borderBottom:`1px solid ${C.borderDark}`, fontSize:9, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase" }}>
                              <span>Month</span>
                              <span>Due Date</span>
                              <span>Rent Due</span>
                              <span>Paid</span>
                              <span>Status</span>
                              <span></span>
                            </div>
                            {ledger.rows.map((row, idx) => {
                              const current = ledger.payments.find(entry => entry.month === row.month);
                              const displayPaid = row.paid + row.creditApplied;
                              return (
                                <div key={`${unit.id}-${row.month}`} style={{ display:"grid", gridTemplateColumns:"110px 110px 1fr 1fr 1fr 88px", gap:"8px", padding:"10px 0", borderBottom: idx < ledger.rows.length - 1 ? `1px solid ${C.border}` : "none", alignItems:"center" }}>
                                  <span style={{ fontSize:12, color:C.text }}>{monthLabel(row.month)}</span>
                                  <span style={{ fontSize:12, color:C.textMid }}>{formatDate(row.dueDate)}</span>
                                  <span style={{ fontFamily:C.mono, fontSize:13, color:C.text }}>{$F(row.amount)}</span>
                                  <div>
                                    <div style={{ fontFamily:C.mono, fontSize:13, color: displayPaid > 0 ? C.green : C.textDim }}>
                                      {displayPaid > 0 ? $F(displayPaid) : "—"}
                                      {row.creditApplied > 0 && row.paid === 0 && <span style={{ fontSize:10, color:C.textDim, marginLeft:4 }}>(deposit)</span>}
                                    </div>
                                    {current?.note && <div style={{ fontSize:10, color:C.textDim }}>{current.note}</div>}
                                  </div>
                                  <div>
                                    <div style={{ fontFamily:C.mono, fontSize:13, color: row.outstanding === 0 ? C.green : C.red }}>
                                      {row.outstanding === 0 ? "Paid" : "Unpaid"}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => { if (row.outstanding > 0) setLoggingRent({ unit, ledger, row, month: row.month, current }); }}
                                    disabled={row.outstanding === 0}
                                    style={{ fontSize:11, padding:"6px 10px", background: row.outstanding === 0 ? C.bg : C.surface, border:`1px solid ${C.border}`, borderRadius:8, color: row.outstanding === 0 ? C.textDim : C.textMid, cursor: row.outstanding === 0 ? "default" : "pointer", fontWeight:700 }}>
                                    {row.outstanding === 0 ? "Paid" : current ? "Edit" : "Log"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
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
              const entry = {
                date: valForm.date,
                market_value: v,
                market_currency: marketCurrency,
                fx_rate_to_cad: fxRate,
                value: marketCurrency === "CAD" ? v : v * fxRate,
                note: valForm.note,
              };
              const updated = [entry, ...(prop.valuations || [])].sort((a, b) => b.date.localeCompare(a.date));
              onPatch({
                market_value: updated[0].market_value,
                market_currency: updated[0].market_currency,
                fx_rate_to_cad: updated[0].fx_rate_to_cad,
                market: getMarketValueCad(updated[0]),
                valuations: updated,
              });
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
                        <div style={{ fontSize:11, color:C.muted, marginBottom:4, fontFamily:C.sans }}>{`Market Value (${marketCurrency})`}</div>
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
                              <div style={{ fontSize:20, fontFamily:C.mono, fontWeight:700, color:C.text }}>
                                {v.market_currency && v.market_currency !== "CAD" ? formatNativeMoney(v.market_value, v.market_currency) : $F(v.value)}
                              </div>
                              {v.market_currency && v.market_currency !== "CAD" && <div style={{ fontSize:11, color:C.textDim, marginTop:3 }}>{`≈ ${$F(v.value)} at 1 ${v.market_currency} = C$${getFxRateToCad(v).toFixed(2)}`}</div>}
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
// ─── HISTORICAL DATA INPUT (per business) ─────────────────────────────────────
function BizHistoricalTab({ biz, histStart, onSave }) {
  const allHistMonths = monthsBetween(histStart, shiftYM(currentYM(), -1)).reverse();
  const [selMonth, setSelMonth] = useState(allHistMonths[0] || "");
  const [form, setForm] = useState({ revenue:"", expenses:"", profit:"", cashBalance:"", liabilities:"", notes:"", events:"" });
  const [autoProfit, setAutoProfit] = useState(true);

  const existing = (biz.historicalData || []).find(e => e.month === selMonth);

  // When month changes, pre-fill from existing data
  const loadMonth = (m) => {
    setSelMonth(m);
    const e = (biz.historicalData || []).find(x => x.month === m);
    if (e) {
      setForm({
        revenue:      e.revenue     != null ? String(e.revenue)     : "",
        expenses:     e.expenses    != null ? String(e.expenses)    : "",
        profit:       e.profit      != null ? String(e.profit)      : "",
        cashBalance:  e.cashBalance != null ? String(e.cashBalance) : "",
        liabilities:  e.liabilities != null ? String(e.liabilities) : "",
        notes:        e.notes  || "",
        events:       e.events || "",
      });
    } else {
      setForm({ revenue:"", expenses:"", profit:"", cashBalance:"", liabilities:"", notes:"", events:"" });
    }
  };

  const computedProfit = autoProfit && form.revenue !== "" && form.expenses !== ""
    ? safe(form.revenue) - safe(form.expenses) : null;
  const displayProfit = autoProfit && computedProfit != null ? computedProfit : safe(form.profit);

  function handleSave() {
    if (!selMonth || !onSave) return;
    const entry = {
      month: selMonth,
      revenue:     form.revenue     !== "" ? safe(form.revenue)     : null,
      expenses:    form.expenses    !== "" ? safe(form.expenses)    : null,
      profit:      autoProfit && computedProfit != null ? computedProfit : (form.profit !== "" ? safe(form.profit) : null),
      cashBalance: form.cashBalance !== "" ? safe(form.cashBalance) : null,
      liabilities: form.liabilities !== "" ? safe(form.liabilities) : null,
      notes:       form.notes  || null,
      events:      form.events || null,
    };
    onSave(entry);
  }

  const inp = { padding:"7px 11px", border:`1px solid ${C.border}`, borderRadius:7, background:C.bg, color:C.text, fontSize:13, fontFamily:C.sans, outline:"none", width:"100%", boxSizing:"border-box" };
  const fieldSet = (label, key, type="number", hint="") => (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:4, fontWeight:600 }}>{label}{hint && <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0 }}> — {hint}</span>}</div>
      <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={type === "number" ? "0" : ""} style={inp} />
    </div>
  );

  const sortedHistory = [...(biz.historicalData || [])].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div>
      <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:14, fontWeight:700 }}>
        Historical Data Entry — {biz.name}
      </div>
      <div style={{ background:C.amberLight, border:`1px solid #F0D080`, borderRadius:8, padding:"10px 14px", marginBottom:18, fontSize:12, color:C.amber }}>
        Isolated from live reports. Data here does not affect consolidated snapshots, cash flow, or notifications.
      </div>

      {/* Month selector */}
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:6, fontWeight:600 }}>Select Month</div>
        <select value={selMonth} onChange={e => loadMonth(e.target.value)}
          style={{ padding:"8px 12px", border:`1px solid ${C.border}`, borderRadius:8, background:C.surface, color:C.text, fontSize:13, fontFamily:C.sans, cursor:"pointer", outline:"none", maxWidth:200 }}>
          {allHistMonths.map(m => (
            <option key={m} value={m}>
              {monthLabel(m)}{(biz.historicalData || []).find(e => e.month === m) ? " ✓" : ""}
            </option>
          ))}
        </select>
        {existing && <span style={{ marginLeft:10, fontSize:11, color:C.green, fontWeight:600 }}>✓ Data saved</span>}
      </div>

      {selMonth && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:"0 28px" }}>
          {/* Left column: P&L */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>P&L</div>
            {fieldSet("Revenue", "revenue")}
            {fieldSet("Expenses", "expenses")}
            <div style={{ marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.07em", textTransform:"uppercase", fontWeight:600 }}>Profit</div>
                <label style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", fontSize:11, color:C.textDim }}>
                  <input type="checkbox" checked={autoProfit} onChange={e => setAutoProfit(e.target.checked)} />
                  Auto (Rev − Exp)
                </label>
              </div>
              {autoProfit && computedProfit != null
                ? <div style={{ padding:"7px 11px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, fontFamily:C.mono, fontSize:13, fontWeight:700, color: computedProfit >= 0 ? C.green : C.red }}>{$F(computedProfit)}</div>
                : <input type="number" value={form.profit} onChange={e => setForm(f => ({ ...f, profit: e.target.value }))}
                    placeholder="0" style={inp} />
              }
            </div>
            <div style={{ marginBottom:12, padding:"10px 14px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8 }}>
              <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:6, fontWeight:600 }}>Margin</div>
              <div style={{ fontFamily:C.mono, fontSize:15, fontWeight:700, color: safe(form.revenue) > 0 ? (displayProfit / safe(form.revenue) >= 0.15 ? C.green : C.amber) : C.textDim }}>
                {safe(form.revenue) > 0 ? `${((displayProfit / safe(form.revenue)) * 100).toFixed(1)}%` : "—"}
              </div>
            </div>
          </div>

          {/* Right column: Balance + Meta */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>Balance Sheet (optional)</div>
            {fieldSet("Cash Balance (end of month)", "cashBalance")}
            {fieldSet("Liabilities (end of month)", "liabilities")}
            <div style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", margin:"14px 0 10px" }}>Notes</div>
            {fieldSet("Notes", "notes", "text")}
            {fieldSet("Key Events / Milestones", "events", "text", "e.g. new contract, staff change")}
          </div>
        </div>
      )}

      {selMonth && (
        <div style={{ display:"flex", gap:10, marginTop:8 }}>
          <button onClick={handleSave}
            style={{ fontSize:13, background:C.gold, color:"#1A1508", border:"none", borderRadius:8, padding:"9px 22px", cursor:"pointer", fontWeight:700 }}>
            Save {monthLabel(selMonth)}
          </button>
          <button onClick={() => loadMonth(selMonth)}
            style={{ fontSize:13, background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.textDim, padding:"9px 16px", cursor:"pointer" }}>
            Reset
          </button>
        </div>
      )}

      {/* Saved history table */}
      {sortedHistory.length > 0 && (
        <div style={{ marginTop:28 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>Saved History ({sortedHistory.length} months)</div>
          <div style={{ border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"110px 1fr 1fr 1fr", gap:8, padding:"8px 14px", background:C.bg, borderBottom:`1px solid ${C.borderDark}`, fontSize:9, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase" }}>
              <span>Month</span><span style={{ textAlign:"right" }}>Revenue</span><span style={{ textAlign:"right" }}>Expenses</span><span style={{ textAlign:"right" }}>Profit</span>
            </div>
            {sortedHistory.map((e, i) => (
              <div key={e.month} onClick={() => loadMonth(e.month)}
                style={{ display:"grid", gridTemplateColumns:"110px 1fr 1fr 1fr", gap:8, padding:"9px 14px", borderBottom: i < sortedHistory.length - 1 ? `1px solid ${C.border}` : "none", cursor:"pointer", transition:"background 0.12s" }}
                onMouseEnter={ev => ev.currentTarget.style.background = C.bg}
                onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                <span style={{ fontSize:12, color:C.textMid }}>{monthLabel(e.month)}</span>
                <span style={{ fontFamily:C.mono, fontSize:12, color:C.text, textAlign:"right" }}>{e.revenue != null ? $K(e.revenue) : "—"}</span>
                <span style={{ fontFamily:C.mono, fontSize:12, color:C.text, textAlign:"right" }}>{e.expenses != null ? $K(e.expenses) : "—"}</span>
                <span style={{ fontFamily:C.mono, fontSize:12, fontWeight:700, color: (e.profit ?? 0) >= 0 ? C.gold : C.red, textAlign:"right" }}>{e.profit != null ? $K(e.profit) : "—"}</span>
              </div>
            ))}
          </div>
          {sortedHistory.some(e => e.events || e.notes) && (
            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>Events & Notes</div>
              {sortedHistory.filter(e => e.events || e.notes).map(e => (
                <div key={e.month} style={{ padding:"8px 12px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, marginBottom:6 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.gold, marginBottom:3 }}>{monthLabel(e.month)}</div>
                  {e.events && <div style={{ fontSize:12, color:C.text, marginBottom:2 }}>📌 {e.events}</div>}
                  {e.notes  && <div style={{ fontSize:12, color:C.textMid }}>{e.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TRENDS ANALYTICS (per business) ──────────────────────────────────────────
function BizTrendsTab({ biz, histStart }) {
  const hist = [...(biz.historicalData || [])].sort((a, b) => a.month.localeCompare(b.month));
  const hasData = hist.length > 0;

  if (!hasData) {
    return (
      <div style={{ textAlign:"center", padding:"40px 20px", color:C.textDim }}>
        <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
        <div style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:6 }}>No historical data yet</div>
        <div style={{ fontSize:12 }}>Switch to the Historical tab to start entering monthly data from {histStart}.</div>
      </div>
    );
  }

  // Build month series covering hist range
  const firstM = hist[0].month;
  const lastM  = hist[hist.length - 1].month;
  const series = monthsBetween(firstM, lastM).map(m => {
    const e = hist.find(x => x.month === m);
    return {
      month: m,
      revenue:  e?.revenue  ?? null,
      expenses: e?.expenses ?? null,
      profit:   e?.profit   ?? null,
      cash:     e?.cashBalance ?? null,
    };
  });

  // ── Summary KPIs ──────────────────────────────────────────────────────────
  const withRev  = series.filter(s => s.revenue != null);
  const withProf = series.filter(s => s.profit  != null);
  const totalRev  = withRev.reduce((s, x) => s + safe(x.revenue), 0);
  const totalProf = withProf.reduce((s, x) => s + safe(x.profit), 0);
  const avgMonthlyRev = withRev.length ? totalRev / withRev.length : 0;
  const avgMonthlyProf = withProf.length ? totalProf / withProf.length : 0;
  const overallMargin = totalRev > 0 ? (totalProf / totalRev) * 100 : null;

  // CAGR by annual revenue
  const byYear = {};
  withRev.forEach(s => { const y = s.month.slice(0,4); byYear[y] = (byYear[y] || 0) + safe(s.revenue); });
  const years = Object.keys(byYear).sort();
  const cagrPct = years.length >= 2
    ? (Math.pow(byYear[years[years.length-1]] / Math.max(1, byYear[years[0]]), 1 / (years.length - 1)) - 1) * 100
    : null;

  // Best / worst months
  const profMonths = withProf.slice().sort((a, b) => safe(b.profit) - safe(a.profit));
  const best3  = profMonths.slice(0, 3);
  const worst3 = profMonths.slice(-3).reverse();

  // T12M (trailing 12 from last entry)
  const t12Series = series.slice(-12);
  const t12Rev  = t12Series.filter(s => s.revenue != null).reduce((s, x) => s + safe(x.revenue), 0);
  const t12Prof = t12Series.filter(s => s.profit  != null).reduce((s, x) => s + safe(x.profit),  0);

  // YoY table: rows = months Jan-Dec, columns = years
  const yoyMonths = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  const yoyMonthLabels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // SVG mini bar chart helper
  function MiniBarChart({ data: chartData, color, label, height = 80 }) {
    const vals = chartData.map(d => d.val);
    const maxV = Math.max(1, ...vals.map(Math.abs));
    const barW = Math.max(4, Math.floor(500 / Math.max(chartData.length, 1)) - 2);
    return (
      <div>
        <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8, fontWeight:600 }}>{label}</div>
        <div style={{ overflowX:"auto" }}>
          <svg width={Math.max(500, chartData.length * (barW + 2))} height={height + 28} style={{ display:"block" }}>
            <line x1={0} y1={height} x2={Math.max(500, chartData.length * (barW + 2))} y2={height} stroke={C.border} strokeWidth={1} />
            {chartData.map((d, i) => {
              const x = i * (barW + 2);
              const barH = Math.max(2, (Math.abs(safe(d.val)) / maxV) * (height - 4));
              const y = d.val >= 0 ? height - barH : height;
              const col = d.val == null ? C.border : (d.val >= 0 ? (color || C.gold) : C.red);
              return (
                <g key={i}>
                  <rect x={x} y={y} width={barW} height={barH} fill={col} opacity={0.85} rx={1} />
                  {chartData.length <= 24 && (
                    <text x={x + barW/2} y={height + 14} textAnchor="middle" fontSize={7} fill={C.textDim} fontFamily={C.sans}>
                      {d.month.slice(5)}
                    </text>
                  )}
                  {chartData.length > 24 && i % 3 === 0 && (
                    <text x={x + barW/2} y={height + 14} textAnchor="middle" fontSize={6} fill={C.textDim} fontFamily={C.sans}>
                      {d.month.slice(2,4)}/{d.month.slice(5)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:14, fontWeight:700 }}>
        Trends & Analytics — {biz.name} · {firstM} → {lastM}
      </div>

      {/* KPI summary strip */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))", gap:10, marginBottom:20 }}>
        {[
          { label:"Total Revenue",    val:$K(totalRev),                             color:C.gold },
          { label:"Total Profit",     val:$K(totalProf),                            color:totalProf >= 0 ? C.green : C.red },
          { label:"Avg Monthly Rev",  val:$K(avgMonthlyRev),                        color:C.text },
          { label:"Avg Monthly Prof", val:$K(avgMonthlyProf),                       color:avgMonthlyProf >= 0 ? C.green : C.red },
          { label:"Overall Margin",   val:overallMargin != null ? `${overallMargin.toFixed(1)}%` : "—", color:overallMargin != null && overallMargin >= 15 ? C.green : C.amber },
          { label:"T12M Revenue",     val:$K(t12Rev),                               color:C.gold },
          { label:"T12M Profit",      val:$K(t12Prof),                              color:t12Prof >= 0 ? C.green : C.red },
          cagrPct != null && { label:"Revenue CAGR", val:`${cagrPct >= 0 ? "+" : ""}${cagrPct.toFixed(1)}%/yr`, color:cagrPct >= 0 ? C.green : C.red },
        ].filter(Boolean).map((s, i) => (
          <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px" }}>
            <div style={{ fontSize:9, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:5 }}>{s.label}</div>
            <div style={{ fontFamily:C.mono, fontSize:16, fontWeight:700, color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 20px", marginBottom:14 }}>
        <MiniBarChart
          data={series.map(s => ({ month:s.month, val:s.revenue }))}
          color={C.gold} label="Monthly Revenue" height={90} />
      </div>

      {/* Profit chart */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 20px", marginBottom:14 }}>
        <MiniBarChart
          data={series.map(s => ({ month:s.month, val:s.profit }))}
          color={C.green} label="Monthly Profit" height={90} />
      </div>

      {/* Margin line */}
      {withRev.length > 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 20px", marginBottom:14 }}>
          <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8, fontWeight:600 }}>Profit Margin %</div>
          <div style={{ overflowX:"auto" }}>
            <svg width={Math.max(500, series.length * 18)} height={80} style={{ display:"block" }}>
              {series.map((s, i) => {
                if (s.revenue == null || s.profit == null || s.revenue === 0) return null;
                const margin = (s.profit / s.revenue) * 100;
                const x = i * (Math.max(500, series.length * 18) / series.length);
                const y = Math.max(4, Math.min(74, 40 - margin * 0.9));
                return <circle key={i} cx={x} cy={y} r={3} fill={margin >= 15 ? C.green : margin >= 0 ? C.amber : C.red} opacity={0.85} />;
              })}
              <line x1={0} y1={40} x2={Math.max(500, series.length * 18)} y2={40} stroke={C.border} strokeWidth={1} strokeDasharray="4 4" />
              <text x={4} y={38} fontSize={8} fill={C.textDim} fontFamily={C.sans}>0%</text>
            </svg>
          </div>
        </div>
      )}

      {/* Best / Worst months */}
      {(best3.length > 0 || worst3.length > 0) && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
          <div style={{ background:C.greenLight, border:`1px solid #A8D8B8`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:10, color:C.green, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>Top Profit Months</div>
            {best3.map(e => (
              <div key={e.month} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:12 }}>
                <span style={{ color:C.textMid }}>{monthLabel(e.month)}</span>
                <span style={{ fontFamily:C.mono, fontWeight:700, color:C.green }}>{$K(e.profit)}</span>
              </div>
            ))}
          </div>
          <div style={{ background:C.redLight, border:`1px solid #F5C6C3`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:10, color:C.red, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>Weakest Months</div>
            {worst3.map(e => (
              <div key={e.month} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:12 }}>
                <span style={{ color:C.textMid }}>{monthLabel(e.month)}</span>
                <span style={{ fontFamily:C.mono, fontWeight:700, color:C.red }}>{$K(e.profit)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* YoY table */}
      {years.length >= 2 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 20px", marginBottom:14, overflowX:"auto" }}>
          <div style={{ fontSize:10, color:C.textDim, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:12 }}>Year-over-Year Revenue</div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr>
                <th style={{ padding:"6px 10px", textAlign:"left", color:C.textDim, fontWeight:600, borderBottom:`1px solid ${C.border}` }}></th>
                {years.map(y => <th key={y} style={{ padding:"6px 10px", textAlign:"right", color:C.gold, fontWeight:700, borderBottom:`1px solid ${C.border}` }}>{y}</th>)}
              </tr>
            </thead>
            <tbody>
              {yoyMonthLabels.map((label, mi) => {
                const mm = yoyMonths[mi];
                return (
                  <tr key={mm}>
                    <td style={{ padding:"5px 10px", color:C.textMid }}>{label}</td>
                    {years.map(y => {
                      const m = `${y}-${mm}`;
                      const e = hist.find(x => x.month === m);
                      return (
                        <td key={y} style={{ padding:"5px 10px", textAlign:"right", fontFamily:C.mono, color: e?.revenue != null ? C.text : C.textDim }}>
                          {e?.revenue != null ? $K(e.revenue) : "·"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr style={{ borderTop:`2px solid ${C.border}` }}>
                <td style={{ padding:"7px 10px", fontWeight:700, color:C.text, fontSize:12 }}>Total</td>
                {years.map(y => (
                  <td key={y} style={{ padding:"7px 10px", textAlign:"right", fontFamily:C.mono, fontWeight:700, color:C.gold, fontSize:12 }}>
                    {$K(byYear[y] || 0)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Events timeline */}
      {hist.some(e => e.events || e.notes) && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 20px" }}>
          <div style={{ fontSize:10, color:C.textDim, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:12 }}>Key Events Timeline</div>
          {[...hist].filter(e => e.events || e.notes).reverse().map(e => (
            <div key={e.month} style={{ display:"flex", gap:12, paddingBottom:12, borderBottom:`1px solid ${C.border}`, marginBottom:12 }}>
              <div style={{ width:4, background:C.gold, borderRadius:2, flexShrink:0 }} />
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:C.gold, marginBottom:3 }}>{monthLabel(e.month)}</div>
                {e.events && <div style={{ fontSize:12, color:C.text, marginBottom:2 }}>📌 {e.events}</div>}
                {e.notes  && <div style={{ fontSize:12, color:C.textMid }}>{e.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BizCard({ biz, onUpdate, onUpdateProfit, onUpdateProfitField, onUpdateHistory, isAdmin, periodLockedMonth }) {
  const [open, setOpen] = useState(false);
  const [bizTab, setBizTab] = useState("overview");
  const isNonProfit    = biz.type === "nonprofit";
  const isTrackedOnly  = biz.type === "tracked_only";
  const canEditRow = (month) => isAdmin && month !== periodLockedMonth;
  const netEquity   = safe(biz.cashAccounts) - safe(biz.liabilities);

  // ── P&L rows (last 6 months from SYSTEM_START) ────────────────────────────
  const monthlyRows = monthsBetween(SYSTEM_START, currentYM()).slice(-6).reverse();
  const profitRows = monthlyRows.map(month => {
    const entry = (biz.monthlyProfits || []).find(p => p.month === month) || {};
    const revenue = entry.revenue != null ? safe(entry.revenue) : 0;
    const expenses = entry.expenses != null ? safe(entry.expenses) : 0;
    const profit = entry.profit != null ? safe(entry.profit) : (revenue - expenses);
    return { month, entry, revenue, expenses, profit };
  });
  const maxProfitMagnitude = Math.max(1, ...profitRows.map(row => Math.abs(row.profit)));

  // ── Balance sheet helpers ─────────────────────────────────────────────────
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

  const BIZ_HIST_STARTS = { 1: "2022-05" };
  const HIST_START = BIZ_HIST_STARTS[biz.id] || "2022-09";

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
              {isNonProfit ? "Non-profit · Excluded from consolidated NW" : isTrackedOnly ? `${biz.ownership != null ? Math.round(safe(biz.ownership) * 100) + "% owned · " : ""}Tracked operationally · Excluded from consolidated NW` : `Ontario corporation · ${biz.abbr}`}
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
                {[
                  ["overview","Overview"],
                  ["profits","P&L / Profits"],
                  ["balancesheet","Balance Sheet"],
                  ["historical","Historical"],
                  ["trends","Trends"],
                ].map(([id, label]) => (
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
                                {canEditRow(row.month)
                                  ? <EditNum value={row.revenue} onChange={v => onUpdateProfitField && onUpdateProfitField(row.month, "revenue", v)} />
                                  : <span style={{ fontFamily:C.mono, fontSize:13, color:row.entry.revenue != null ? C.text : C.textDim }}>{row.entry.revenue != null ? $F(row.revenue) : "—"}</span>}
                              </div>
                              <div style={{ textAlign:"right" }}>
                                {canEditRow(row.month)
                                  ? <EditNum value={row.expenses} onChange={v => onUpdateProfitField && onUpdateProfitField(row.month, "expenses", v)} />
                                  : <span style={{ fontFamily:C.mono, fontSize:13, color:row.entry.expenses != null ? C.text : C.textDim }}>{row.entry.expenses != null ? $F(row.expenses) : "—"}</span>}
                              </div>
                              <div style={{ textAlign:"right" }}>
                                {canEditRow(row.month)
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

                {bizTab === "historical" && isAdmin && (
                  <BizHistoricalTab
                    biz={biz}
                    histStart={HIST_START}
                    onSave={onUpdateHistory}
                  />
                )}

                {bizTab === "trends" && (
                  <BizTrendsTab biz={biz} histStart={HIST_START} />
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
// eslint-disable-next-line no-unused-vars
function AdminExpensesTab({ userId, isAdmin, allProfiles, individuals }) {
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

// ─── REPORT MODAL ─────────────────────────────────────────────────────────────
function ReportModal({ snapshot: s, data, onClose, onGenerated }) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const reportRef = useRef(null);
  const isMobile = useIsMobile();

  function buildPayload() {
    const cfRentIn   = data.properties.reduce((sum, p) => sum + propEffectiveRent(p), 0);
    const cfPropOut  = data.properties.reduce((sum, p) => sum + propMonthlyOut(p), 0);
    const cfOtherOut = data.cashflow.obligations.reduce((sum, o) => sum + safe(o.amount), 0);
    return {
      reportMonth: s.month,
      generatedAt: new Date().toISOString(),
      kpis: { netWorth: s.nw, liquidRE: s.reLiquid, reEquity: s.reEquity, individuals: s.individuals, businesses: s.businesses },
      cashFlow: { rentalIncome: cfRentIn, propertyObligations: cfPropOut, otherObligations: cfOtherOut, net: cfRentIn - cfPropOut - cfOtherOut },
      realEstate: (s.reBreakdown || []).map(p => ({ name: p.name, market: p.market, debt: p.debt, equity: p.equity, liquid: p.liquid })),
      individuals: (s.individualBreakdown || []).map(i => ({ name: i.name, net: i.net })),
      businesses: (s.businessBreakdown || []).map(b => ({ name: b.name, equity: b.eq, type: b.type })),
      notes: s.note || "",
    };
  }

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(buildPayload(), null, 2))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  async function handleDownloadPdf() {
    if (!reportRef.current || downloading) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const { jsPDF, html2canvas } = await loadPdfTools();
      await new Promise(resolve => setTimeout(resolve, 60));
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "pt", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageWidth = pageWidth;
      const imageHeight = (canvas.height * imageWidth) / canvas.width;
      let heightLeft = imageHeight;
      let position = 0;

      pdf.addImage(imageData, "PNG", 0, position, imageWidth, imageHeight, undefined, "FAST");
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imageHeight;
        pdf.addPage();
        pdf.addImage(imageData, "PNG", 0, position, imageWidth, imageHeight, undefined, "FAST");
        heightLeft -= pageHeight;
      }

      const generatedAt = new Date().toISOString();
      pdf.save(reportFileName(s.month));
      onGenerated?.({
        snapshotMonth: s.month,
        snapshotCapturedAt: s.capturedAt,
        generatedAt,
      });
    } catch (error) {
      console.error("Report PDF download failed", error);
      setDownloadError("PDF download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    const downloadKey = `${s.month}-${s.capturedAt || "snapshot"}`;
    if (!shouldAutoDownloadReport(downloadKey)) return;
    handleDownloadPdf();
    // Intentionally run once per modal open; StrictMode double-mount is guarded above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cfRentIn   = data.properties.reduce((sum, p) => sum + propEffectiveRent(p), 0);
  const cfPropOut  = data.properties.reduce((sum, p) => sum + propMonthlyOut(p), 0);
  const cfOtherOut = data.cashflow.obligations.reduce((sum, o) => sum + safe(o.amount), 0);
  const cfNet      = cfRentIn - cfPropOut - cfOtherOut;
  const rowSt = { display: "flex", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #e5e5e5", fontSize: 13 };
  const secHd = { fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#888", fontWeight: 700, marginBottom: 10, marginTop: 30 };
  const mono  = { fontFamily: "monospace", fontWeight: 700 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 9999, overflowY: "auto", padding: "24px 16px" }}>
      {/* Action bar */}
      <div style={{ position: "fixed", top: isMobile ? 10 : 16, right: isMobile ? 10 : 24, display: "flex", gap: isMobile ? 6 : 10, zIndex: 10000, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: isMobile ? "calc(100vw - 20px)" : "calc(100vw - 32px)" }}>
        {downloadError && <span style={{ fontSize: 11, color: "#FFD4D4", letterSpacing: "0.04em" }}>{downloadError}</span>}
        {!downloadError && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.72)", letterSpacing: "0.04em" }}>
            {downloading ? "Preparing PDF..." : "PDF download starts automatically"}
          </span>
        )}
        <button onClick={handleCopy}
          style={{ fontSize: 12, background: copied ? "#1A6B33" : C.surface, color: copied ? "#fff" : C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 16px", cursor: "pointer", fontWeight: 600 }}>
          {copied ? "✓ Copied" : "Copy JSON"}
        </button>
        <button onClick={handleDownloadPdf}
          disabled={downloading}
          style={{ fontSize: 12, background: C.gold, color: "#1A1508", border: "none", borderRadius: 7, padding: "8px 16px", cursor: "pointer", fontWeight: 700 }}>
          {downloading ? "Preparing..." : "Download PDF"}
        </button>
        <button onClick={onClose}
          style={{ fontSize: 12, background: "none", border: `1px solid ${C.border}`, borderRadius: 7, color: C.textDim, padding: "8px 14px", cursor: "pointer" }}>
          ✕ Close
        </button>
      </div>

      {/* Report content */}
      <div ref={reportRef} id="jmf-report-content" style={{ background: "#ffffff", color: "#111111", borderRadius: 12, padding: isMobile ? "28px 20px" : "48px 52px", maxWidth: 720, width: "100%", marginTop: isMobile ? 52 : 16, fontFamily: "Georgia, serif" }}>

        {/* 1. Cover */}
        <div style={{ textAlign: "center", marginBottom: 40, paddingBottom: 32, borderBottom: "2px solid #111" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "#999", marginBottom: 10, fontFamily: "sans-serif" }}>JMF Family Office</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#111", letterSpacing: "-0.5px", marginBottom: 6, fontFamily: "sans-serif" }}>Monthly Financial Report</div>
          <div style={{ fontSize: 20, color: "#444", fontWeight: 500 }}>{monthLabel(s.month)}</div>
          <div style={{ fontSize: 11, color: "#999", marginTop: 10, fontFamily: "sans-serif" }}>
            Captured {new Date(s.capturedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            {s.updatedAt && ` · Updated ${new Date(s.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`}
          </div>
        </div>

        {/* 2. KPIs */}
        <div style={{ ...secHd, fontFamily: "sans-serif" }}>Key Metrics</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#e5e5e5", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden", marginBottom: 4 }}>
          {[
            { label: "Net Worth",       val: $F(s.nw),        color: s.nw >= 0 ? "#1A6B33" : "#CC2222" },
            { label: "Liquid RE Value", val: $K(s.reLiquid),  color: "#7A6010" },
            { label: "RE Equity",       val: $K(s.reEquity),  color: "#7A6010" },
            { label: "Individuals",     val: $K(s.individuals), color: s.individuals >= 0 ? "#1A6B33" : "#CC2222" },
            { label: "Business Equity", val: $K(s.businesses), color: "#1A3F6B" },
          ].map((k, i) => (
            <div key={i} style={{ background: "#fff", padding: "16px 20px" }}>
              <div style={{ fontSize: 9, color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6, fontFamily: "sans-serif" }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: k.color }}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* 3. Consolidated Snapshot */}
        <div style={{ ...secHd, fontFamily: "sans-serif" }}>Consolidated Snapshot</div>
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden", marginBottom: 4 }}>
          {(s.individualBreakdown || []).map((x, i) => (
            <div key={i} style={{ ...rowSt, background: i % 2 === 0 ? "#fafafa" : "#fff" }}>
              <span style={{ color: "#555" }}>{x.name}</span>
              <span style={{ ...mono, color: x.net >= 0 ? "#1A6B33" : "#CC2222" }}>{$F(x.net)}</span>
            </div>
          ))}
          {(s.reBreakdown || []).map((x, i) => (
            <div key={`re-${i}`} style={{ ...rowSt, background: "#fff" }}>
              <span style={{ color: "#555" }}>{x.name} <span style={{ fontSize: 10, color: "#aaa" }}>Real Estate</span></span>
              <span style={{ ...mono, color: "#7A6010" }}>{$K(x.liquid)}</span>
            </div>
          ))}
          {(s.businessBreakdown || []).filter(b => b.type !== "nonprofit").map((x, i) => (
            <div key={`biz-${i}`} style={{ ...rowSt, background: "#fafafa" }}>
              <span style={{ color: "#555" }}>{x.name} <span style={{ fontSize: 10, color: "#aaa" }}>Business</span></span>
              <span style={{ ...mono, color: "#1A3F6B" }}>{$F(x.eq)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", background: "#111", color: "#fff" }}>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "sans-serif" }}>Total Net Worth</span>
            <span style={{ ...mono, fontSize: 15, color: s.nw >= 0 ? "#7EC896" : "#FF9999" }}>{$F(s.nw)}</span>
          </div>
        </div>

        {/* 4. Cash Flow */}
        <div style={{ ...secHd, fontFamily: "sans-serif" }}>Cash Flow (Live)</div>
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden", marginBottom: 4 }}>
          {[
            { label: "Rental Income",        val: cfRentIn    },
            { label: "Property Obligations", val: -cfPropOut  },
            { label: "Other Obligations",    val: -cfOtherOut },
          ].map((row, i) => (
            <div key={i} style={{ ...rowSt, background: i % 2 === 0 ? "#fafafa" : "#fff" }}>
              <span style={{ color: "#555" }}>{row.label}</span>
              <span style={{ ...mono, color: row.val >= 0 ? "#1A6B33" : "#CC2222" }}>{row.val >= 0 ? "+" : ""}{$F(row.val)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", background: "#111", color: "#fff" }}>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "sans-serif" }}>Net Cash Flow</span>
            <span style={{ ...mono, fontSize: 15, color: cfNet >= 0 ? "#7EC896" : "#FF9999" }}>{cfNet >= 0 ? "+" : ""}{$F(cfNet)}</span>
          </div>
        </div>

        {/* 5. Real Estate Portfolio */}
        <div style={{ ...secHd, fontFamily: "sans-serif" }}>Real Estate Portfolio</div>
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden", marginBottom: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", background: "#111", color: "#ccc", padding: "8px 16px", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "sans-serif" }}>
            {["Property", "Market", "Debt", "Liquid"].map(h => <div key={h}>{h}</div>)}
          </div>
          {(s.reBreakdown || []).map((x, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "9px 16px", borderBottom: "1px solid #e5e5e5", background: i % 2 === 0 ? "#fafafa" : "#fff", fontSize: 12 }}>
              <div style={{ fontWeight: 600, color: "#222" }}>{x.name}</div>
              <div style={{ fontFamily: "monospace", color: "#555" }}>{$K(x.market)}</div>
              <div style={{ fontFamily: "monospace", color: "#CC2222" }}>{$K(x.debt)}</div>
              <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#7A6010" }}>{$K(x.liquid)}</div>
            </div>
          ))}
        </div>

        {/* 6. Businesses */}
        <div style={{ ...secHd, fontFamily: "sans-serif" }}>Business Entities</div>
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden", marginBottom: 4 }}>
          {(s.businessBreakdown || []).map((x, i) => (
            <div key={i} style={{ ...rowSt, background: i % 2 === 0 ? "#fafafa" : "#fff" }}>
              <span style={{ color: "#555" }}>{x.name}{x.type === "nonprofit" ? " (Non-Profit)" : ""}</span>
              <span style={{ ...mono, color: x.eq >= 0 ? "#1A3F6B" : "#CC2222" }}>{$F(x.eq)}</span>
            </div>
          ))}
        </div>

        {/* 7. Notes & Risks */}
        <div style={{ ...secHd, fontFamily: "sans-serif" }}>Notes &amp; Risk Commentary</div>
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: "16px 20px", fontSize: 13, color: "#444", lineHeight: 1.8, background: "#fafafa", minHeight: 60 }}>
          {s.note ? s.note : <span style={{ color: "#bbb", fontStyle: "italic" }}>No notes recorded for this snapshot.</span>}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", fontSize: 10, color: "#bbb", fontFamily: "sans-serif" }}>
          <span>JMF Family Office — Confidential</span>
          <span>Generated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
      </div>
    </div>
  );
}

// ─── SNAPSHOT BREAKDOWN MODAL ─────────────────────────────────────────────────
// ─── VEHICLE CARD ──────────────────────────────────────────────────────────────
function VehicleCard({ vehicle: v, onUpdate, onAddValuation }) {
  const [open, setOpen] = useState(false);
  const [editField, setEditField] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [showValForm, setShowValForm] = useState(false);
  const [valDate, setValDate] = useState(currentYM() + "-01");
  const [valValue, setValValue] = useState("");
  const [valNote, setValNote] = useState("");
  const isMobile = useIsMobile();

  const marketValue = getVehicleMarketValue(v);
  const equity      = marketValue - safe(v.loanBalance);
  const hasLoan     = safe(v.loanBalance) > 0 || safe(v.monthlyPayment) > 0;

  function startEdit(field, current) {
    setEditField(field);
    setEditVal(String(current ?? ""));
  }
  function commitEdit() {
    if (!editField) return;
    const numFields = ["currentMarketValue","loanBalance","monthlyPayment","paymentDueDay","purchasePrice","mileage","insuranceMonthly"];
    const val = numFields.includes(editField) ? safe(editVal) : editVal;
    onUpdate({ [editField]: val });
    setEditField(null);
  }

  const inp = { padding:"6px 10px", border:`1px solid ${C.border}`, borderRadius:7, background:C.bg, color:C.text, fontSize:13, fontFamily:C.sans, outline:"none" };
  const fieldRow = (label, field, display, numeric) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:`1px solid ${C.border}`, gap:8 }}>
      <span style={{ fontSize:12, color:C.textMid, flexShrink:0 }}>{label}</span>
      {editField === field
        ? <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => { if(e.key==="Enter") commitEdit(); if(e.key==="Escape") setEditField(null); }}
              style={{ ...inp, width: numeric ? 120 : 180, textAlign: numeric ? "right" : "left" }} />
            <button onClick={commitEdit} style={{ fontSize:11, background:C.gold, color:"#1A1508", border:"none", borderRadius:5, padding:"4px 10px", cursor:"pointer", fontWeight:700 }}>✓</button>
            <button onClick={() => setEditField(null)} style={{ fontSize:11, background:"none", border:`1px solid ${C.border}`, borderRadius:5, padding:"4px 8px", cursor:"pointer", color:C.textDim }}>✕</button>
          </div>
        : <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontFamily: numeric ? C.mono : "inherit", fontSize:13, color:C.text, fontWeight: numeric ? 600 : 400 }}>{display}</span>
            <button onClick={() => startEdit(field, v[field])} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.textDim, fontSize:10, padding:"2px 7px", cursor:"pointer" }}>Edit</button>
          </div>
      }
    </div>
  );

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, marginBottom:14, overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding: isMobile ? "14px 16px" : "16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, cursor:"pointer" }}
        onClick={() => setOpen(o => !o)}>
        <div style={{ display:"flex", alignItems:"center", gap:12, minWidth:0 }}>
          <div style={{ fontSize:22, flexShrink:0 }}>🚗</div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{v.name}</div>
            <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{v.owner}{v.mileage > 0 ? ` · ${v.mileage.toLocaleString()} km` : ""}{v.condition ? ` · ${v.condition}` : ""}</div>
          </div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontFamily:C.mono, fontSize:18, fontWeight:800, color: equity >= 0 ? C.amber : C.red }}>{$K(equity)}</div>
          <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>Net equity</div>
        </div>
        <div style={{ fontSize:12, color:C.textDim, flexShrink:0 }}>{open ? "▲" : "▼"}</div>
      </div>

      {/* Collapsed summary strip */}
      {!open && (
        <div style={{ borderTop:`1px solid ${C.border}`, padding:"8px 20px", display:"flex", gap:20, flexWrap:"wrap" }}>
          {[
            { label:"Market value", val:$K(marketValue), color:C.amber },
            hasLoan && { label:"Loan balance",  val:$K(safe(v.loanBalance)), color:C.red },
            safe(v.monthlyPayment) > 0 && { label:"Monthly payment", val:$F(v.monthlyPayment), color:C.textMid },
          ].filter(Boolean).map((s, i) => (
            <div key={i}>
              <div style={{ fontSize:9, color:C.textDim, textTransform:"uppercase", letterSpacing:"0.08em" }}>{s.label}</div>
              <div style={{ fontFamily:C.mono, fontSize:13, fontWeight:700, color:s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Expanded detail */}
      {open && (
        <div style={{ borderTop:`1px solid ${C.border}`, padding: isMobile ? "14px 16px" : "16px 20px" }}>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:"0 32px", marginBottom:16 }}>
            <div>
              {fieldRow("Year",            "year",             v.year || "—",                                 false)}
              {fieldRow("Make",            "make",             v.make || "—",                                 false)}
              {fieldRow("Model",           "model",            v.model || "—",                                false)}
              {fieldRow("Owner",           "owner",            v.owner || "—",                                false)}
              {fieldRow("Purchase price",  "purchasePrice",    v.purchasePrice > 0 ? $F(v.purchasePrice) : "—", true)}
              {fieldRow("Purchase date",   "purchaseDate",     v.purchaseDate || "—",                         false)}
            </div>
            <div>
              {fieldRow("Market value",    "currentMarketValue", $F(marketValue),                              true)}
              {fieldRow("Loan balance",    "loanBalance",       $F(safe(v.loanBalance)),                       true)}
              {fieldRow("Monthly payment", "monthlyPayment",    $F(safe(v.monthlyPayment)),                    true)}
              {fieldRow("Payment due day", "paymentDueDay",     v.paymentDueDay || 1,                          true)}
              {fieldRow("Insurance/mo",    "insuranceMonthly",  $F(safe(v.insuranceMonthly)),                  true)}
              {fieldRow("Mileage (km)",    "mileage",           (v.mileage || 0).toLocaleString(),             true)}
            </div>
          </div>

          {/* Condition */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6, fontWeight:700 }}>Condition</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {["poor","fair","good","very good","excellent"].map(c => (
                <button key={c} onClick={() => onUpdate({ condition: c })}
                  style={{ fontSize:11, padding:"4px 10px", borderRadius:6, border:`1px solid ${v.condition === c ? C.amber : C.border}`, background: v.condition === c ? C.amberLight : "transparent", color: v.condition === c ? C.amber : C.textDim, cursor:"pointer", fontWeight: v.condition === c ? 700 : 400 }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6, fontWeight:700 }}>Notes</div>
            {editField === "notes"
              ? <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                  <textarea value={editVal} onChange={e => setEditVal(e.target.value)} rows={2}
                    style={{ ...inp, flex:1, resize:"vertical", fontSize:12 }} />
                  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    <button onClick={commitEdit} style={{ fontSize:11, background:C.gold, color:"#1A1508", border:"none", borderRadius:5, padding:"5px 10px", cursor:"pointer", fontWeight:700 }}>✓</button>
                    <button onClick={() => setEditField(null)} style={{ fontSize:11, background:"none", border:`1px solid ${C.border}`, borderRadius:5, padding:"5px 8px", cursor:"pointer", color:C.textDim }}>✕</button>
                  </div>
                </div>
              : <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                  <span style={{ fontSize:12, color: v.notes ? C.textMid : C.textDim, flex:1, fontStyle: v.notes ? "normal" : "italic" }}>{v.notes || "No notes."}</span>
                  <button onClick={() => startEdit("notes", v.notes || "")} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.textDim, fontSize:10, padding:"2px 7px", cursor:"pointer", flexShrink:0 }}>Edit</button>
                </div>
            }
          </div>

          {/* Valuation log */}
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:700 }}>Valuation Log</div>
              <button onClick={() => setShowValForm(s => !s)}
                style={{ fontSize:11, background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.textDim, padding:"3px 10px", cursor:"pointer" }}>
                {showValForm ? "Cancel" : "+ Add"}
              </button>
            </div>
            {showValForm && (
              <div style={{ background:C.bg, borderRadius:8, padding:"12px 14px", marginBottom:10, display:"flex", flexWrap:"wrap", gap:10, alignItems:"flex-end" }}>
                <div>
                  <div style={{ fontSize:10, color:C.textDim, marginBottom:4 }}>Date</div>
                  <input type="date" value={valDate} onChange={e => setValDate(e.target.value)} style={{ ...inp, fontSize:12 }} />
                </div>
                <div>
                  <div style={{ fontSize:10, color:C.textDim, marginBottom:4 }}>Value (CAD)</div>
                  <input type="number" value={valValue} onChange={e => setValValue(e.target.value)} placeholder="0" style={{ ...inp, width:120 }} />
                </div>
                <div>
                  <div style={{ fontSize:10, color:C.textDim, marginBottom:4 }}>Note (optional)</div>
                  <input value={valNote} onChange={e => setValNote(e.target.value)} placeholder="e.g. Black Book estimate" style={{ ...inp, width:180 }} />
                </div>
                <button onClick={() => {
                  if (!valValue) return;
                  onAddValuation({ date: valDate, value: safe(valValue), note: valNote });
                  setValValue(""); setValNote(""); setShowValForm(false);
                }} style={{ fontSize:12, background:C.gold, color:"#1A1508", border:"none", borderRadius:7, padding:"7px 14px", cursor:"pointer", fontWeight:700 }}>
                  Save
                </button>
              </div>
            )}
            {(v.valuations || []).length === 0
              ? <div style={{ fontSize:12, color:C.textDim, fontStyle:"italic" }}>No valuations logged.</div>
              : [...(v.valuations || [])].sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((val, i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"5px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
                    <span style={{ color:C.textDim }}>{val.date}</span>
                    <span style={{ fontFamily:C.mono, fontWeight:700, color:C.amber }}>{$F(val.value)}</span>
                    {val.note && <span style={{ fontSize:11, color:C.textDim, marginLeft:8 }}>{val.note}</span>}
                  </div>
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

function SnapshotBreakdownModal({ item, month, onClose }) {
  const isInd = item._type === "individual";
  const isVehicle = item._type === "vehicle";
  const hasDetail = isInd ? typeof item.cash !== "undefined" : isVehicle ? typeof item.marketValue !== "undefined" : typeof item.cashAccounts !== "undefined";
  const title = `${item.name} — ${monthLabel(month)} Snapshot`;

  let rows = [];
  let netLabel = "";
  let netVal = 0;
  let netColor = C.text;

  if (isInd) {
    if (hasDetail) {
      rows = [
        { label: "Cash",            val: item.cash },
        { label: "Accounts",        val: item.accounts },
        { label: "Securities",      val: item.securities },
        { label: "Crypto",          val: item.crypto },
        { label: "Physical assets", val: item.physicalAssets },
      ];
    }
    netLabel = "Net worth";
    netVal   = item.net;
    netColor = item.net >= 0 ? C.green : C.red;
  } else if (isVehicle) {
    if (hasDetail) {
      rows = [
        { label: "Market value",  val: item.marketValue, positive: true },
        { label: "Loan balance",  val: -item.loanBalance },
      ];
    }
    netLabel = "Net equity";
    netVal   = item.equity;
    netColor = item.equity >= 0 ? C.amber : C.red;
  } else {
    if (hasDetail) {
      const other = item.otherLiabilities || 0;
      rows = [
        { label: "Cash & accounts",  val: item.cashAccounts, positive: true },
        { label: "divider" },
        item.taxPayable  > 0 && { label: "CRA payable",       val: -item.taxPayable },
        item.creditCards > 0 && { label: "Credit cards",      val: -item.creditCards },
        other            > 0 && { label: "Other liabilities", val: -other },
        { label: "Total liabilities", val: -item.liabilities, bold: true },
      ].filter(Boolean);
      if (item.monthlyProfit != null) {
        rows.push({ label: "divider" });
        rows.push({ label: "Monthly profit (this month)", val: item.monthlyProfit, positive: item.monthlyProfit >= 0 });
      }
    }
    netLabel = "Net equity";
    netVal   = item.eq;
    netColor = item.eq >= 0 ? C.blue : C.red;
  }

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:299, background:"rgba(0,0,0,0.45)" }} />
      <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:300, width:380, maxWidth:"calc(100vw - 32px)", background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, boxShadow:"0 12px 60px rgba(0,0,0,0.28)", overflow:"hidden" }}>
        <div style={{ padding:"16px 20px 14px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:2 }}>{title}</div>
          <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase" }}>Point-in-time breakdown</div>
        </div>
        <div style={{ padding:"14px 20px 20px" }}>
          {!hasDetail ? (
            <div style={{ fontSize:12, color:C.textDim, fontStyle:"italic", padding:"8px 0" }}>
              Detailed breakdown not available for this snapshot.
            </div>
          ) : (
            <div>
              {rows.map((row, i) => {
                if (row.label === "divider") return <div key={i} style={{ borderTop:`1px solid ${C.border}`, margin:"8px 0" }} />;
                const valColor = row.bold ? C.text : (row.val >= 0 ? (row.positive !== false ? C.green : C.text) : C.red);
                return (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"5px 0", fontSize:13 }}>
                    <span style={{ color: row.bold ? C.text : C.textMid, fontWeight: row.bold ? 600 : 400 }}>{row.label}</span>
                    <span style={{ fontFamily:C.mono, fontWeight: row.bold ? 700 : 600, color: valColor }}>{$F(row.val)}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ borderTop:`2px solid ${C.border}`, marginTop: hasDetail ? 10 : 6, paddingTop:10, display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
            <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{netLabel}</span>
            <span style={{ fontFamily:C.mono, fontSize:18, fontWeight:700, color:netColor }}>{$F(netVal)}</span>
          </div>
        </div>
        <div style={{ borderTop:`1px solid ${C.border}`, padding:"10px 20px" }}>
          <button onClick={onClose} style={{ width:"100%", padding:"8px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.textMid, fontSize:12, fontWeight:600, cursor:"pointer" }}>Close</button>
        </div>
      </div>
    </>
  );
}

// ─── REPORTS TAB ──────────────────────────────────────────────────────────────
function HistoryTab({ data, onSaveSnapshot, onReportGenerated }) {
  const [drill, setDrill] = useState(null); // snapshot object
  const [breakdownItem, setBreakdownItem] = useState(null); // { ...row, _type, _month }
  const [snapNote, setSnapNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const isMobile = useIsMobile();
  const [confirmEdit, setConfirmEdit] = useState(false);
  const [reportSnap, setReportSnap] = useState(null);
  const snapshots = [...(data.snapshots || [])].reverse();
  const curYM = currentYM();
  const hasThisMonth = (data.snapshots || []).some(s => s.month === curYM);

  if (drill) {
    return (
      <div>
        {reportSnap && <ReportModal snapshot={reportSnap} data={data} onClose={() => setReportSnap(null)} onGenerated={onReportGenerated} />}
        {breakdownItem && <SnapshotBreakdownModal item={breakdownItem} month={drill.month} onClose={() => setBreakdownItem(null)} />}
        <button onClick={() => setDrill(null)} style={{ fontSize: 12, background: "none", border: `1px solid ${C.border}`, borderRadius: 6, color: C.textDim, padding: "6px 14px", cursor: "pointer", marginBottom: 20 }}>← Back</button>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Snapshot — {monthLabel(drill.month)}</div>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 2 }}>Captured {new Date(drill.capturedAt).toLocaleString()}</div>
          {drill.updatedAt && <div style={{ fontSize: 11, color: C.amber, marginBottom: 4 }}>Edited {new Date(drill.updatedAt).toLocaleString()}</div>}
          {drill.note && <div style={{ fontSize: 12, color: C.textMid, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", marginBottom: 8 }}>{drill.note}</div>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Net Worth",      val: $F(drill.nw),         color: drill.nw >= 0 ? C.gold : C.red },
            { label: "Liquid RE",      val: $K(drill.reLiquid),   color: C.gold },
            { label: "RE Equity",      val: $K(drill.reEquity),   color: C.amber },
            { label: "Individuals",    val: $K(drill.individuals),color: drill.individuals >= 0 ? C.green : C.red },
            { label: "Businesses",     val: $K(drill.businesses), color: C.blue },
            ...(drill.vehicles != null ? [{ label: "Vehicles", val: $K(drill.vehicles), color: C.amber }] : []),
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
              <div key={i} onClick={() => setBreakdownItem({ ...x, _type: "individual" })}
                style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13, cursor: "pointer", borderRadius: 4, transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = C.bg}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ color: C.textMid }}>{x.name}</span>
                <span style={{ fontFamily: C.mono, color: x.net >= 0 ? C.green : C.red, fontWeight: 700 }}>{$F(x.net)} ›</span>
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
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Businesses</div>
            {drill.businessBreakdown.map((x, i) => (
              <div key={i} onClick={() => setBreakdownItem({ ...x, _type: "business" })}
                style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13, cursor: "pointer", borderRadius: 4, transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = C.bg}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ color: C.textMid }}>{x.name}{x.type === "nonprofit" ? " (NP)" : ""}</span>
                <span style={{ fontFamily: C.mono, color: x.eq >= 0 ? C.blue : C.red, fontWeight: 700 }}>{$F(x.eq)} ›</span>
              </div>
            ))}
          </Card>
        )}
        {drill.vehicleBreakdown && drill.vehicleBreakdown.length > 0 && (
          <Card>
            <div style={{ fontSize: 11, color: C.textDim, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Vehicles</div>
            {drill.vehicleBreakdown.map((x, i) => (
              <div key={i} onClick={() => setBreakdownItem({ ...x, _type: "vehicle" })}
                style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13, cursor: "pointer", borderRadius: 4, transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = C.bg}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ color: C.textMid }}>{x.name}</span>
                <span style={{ fontFamily: C.mono, color: x.equity >= 0 ? C.amber : C.red, fontWeight: 700 }}>{$F(x.equity)} ›</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    );
  }

  return (
    <div>
      {reportSnap && <ReportModal snapshot={reportSnap} data={data} onClose={() => setReportSnap(null)} onGenerated={onReportGenerated} />}
      {/* Capture Snapshot */}
      <div style={{ background: hasThisMonth ? C.greenLight : C.amberLight, border: `1px solid ${hasThisMonth ? "#A8D8B8" : "#F0D080"}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: hasThisMonth ? C.green : C.amber }}>
              {hasThisMonth ? `✓ ${monthLabel(curYM)} locked` : `No snapshot yet for ${monthLabel(curYM)}`}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
              {hasThisMonth ? "One snapshot per month." : "Snapshots record the full NW breakdown at a point in time."}
            </div>
          </div>
          {!hasThisMonth ? (
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
          ) : (
            <button onClick={() => setConfirmEdit(true)}
              style={{ fontSize: 11, background: "none", border: `1px solid ${C.border}`, borderRadius: 7, color: C.textDim, padding: "6px 14px", cursor: "pointer" }}>
              Edit
            </button>
          )}
        </div>
        {confirmEdit && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: C.text }}>Overwrite the {monthLabel(curYM)} snapshot with current live values?</span>
            <input type="text" placeholder="Optional note" value={snapNote} onChange={e => setSnapNote(e.target.value)}
              style={{ padding: "6px 10px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg, color: C.text, fontSize: 12, fontFamily: C.sans, outline: "none", flex: 1, minWidth: 160 }} />
            <button onClick={() => { onSaveSnapshot(snapNote); setSnapNote(""); setConfirmEdit(false); }}
              style={{ fontSize: 12, background: C.amber, color: "#1A1508", border: "none", borderRadius: 6, padding: "7px 16px", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
              Confirm Overwrite
            </button>
            <button onClick={() => { setConfirmEdit(false); setSnapNote(""); }}
              style={{ fontSize: 12, background: "none", border: `1px solid ${C.border}`, borderRadius: 6, color: C.textDim, padding: "7px 12px", cursor: "pointer" }}>Cancel</button>
          </div>
        )}
      </div>

      {/* Snapshot list */}
      {snapshots.length === 0
        ? <div style={{ textAlign: "center", padding: "48px 0", color: C.textDim, fontSize: 13 }}>No snapshots captured yet.</div>
        : snapshots.map((s, i) => (
          <div key={i} onClick={() => setDrill(s)} style={{ padding: isMobile ? "14px 16px" : "14px 18px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 8, cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.boxShadow = C.shadowMd; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isMobile ? 10 : 0 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{monthLabel(s.month)}</div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{new Date(s.capturedAt).toLocaleDateString()}{s.note ? ` · ${s.note}` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: C.mono, fontSize: 18, fontWeight: 800, color: s.nw >= 0 ? C.gold : C.red }}>{$F(s.nw)}</div>
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>Net Worth</div>
              </div>
            </div>
            <button onClick={e => {
              e.stopPropagation();
              setReportSnap(s);
            }}
              style={{ fontSize: 11, background: C.goldLight, color: C.goldText, border: `1px solid rgba(184,150,46,0.3)`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", width: isMobile ? "100%" : undefined, textAlign: isMobile ? "center" : undefined }}>
              Generate Report
            </button>
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
  const [cfMonth, setCFMonth] = useState(currentYM());
  const [cfOpen, setCFOpen]   = useState({ biz:true, rent:true, payroll:true, otherInc:true, re:true, vehicle:true, otherObl:true });
  const [bizInfoOpen, setBizInfoOpen] = useState(false);
  const toggleCF = key => setCFOpen(s => ({ ...s, [key]: !s[key] }));
  const [accLogOpen, setAccLogOpen] = useState(null); // individual id whose log form is open
  const [accLogForm, setAccLogForm] = useState({ month: currentYM(), cash: 0, accounts: 0, securities: 0, crypto: 0, physicalAssets: 0, note: "" });
  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };
  const isMobile = useIsMobile();
  const isSmall = useIsSmall();
  const [periodStatus, setPeriodStatus]       = useState({ status: "open", is_locked: false, loading: true });
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason]   = useState("");
  const [periodLoading, setPeriodLoading]     = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    // Load pending submissions and all member profiles in parallel
    Promise.all([getPendingSubmissions(), fetchAllProfiles()]).then(([subs, profs]) => {
      setPendingSubs(subs);
      setProfiles(profs);
    });
  }, [tab]);

  function completeNotification(id) {
    const meta = data.notificationsMeta || { completed: {}, lastSeenAt: "" };
    const updated = {
      ...meta,
      completed: { ...(meta.completed || {}), [id]: { completedAt: new Date().toISOString(), completedBy: user.id } }
    };
    saveToDB("notificationsMeta", updated);
    setData(d => ({ ...d, notificationsMeta: updated }));
  }

  // ── One-time reminder check on mount ──
  useEffect(() => {
    const ym = currentYM();
    const prevYM = shiftYM(ym, -1);
    const dayOfMonth = new Date().getDate();
    const missingRent = data.properties
      .filter(p => propertyOutstandingForMonth(p, data.rentPayments || [], ym) > 0);
    // P&L for previous month is only due on/after the 5th (mirrors notification logic)
    const missingProfits = dayOfMonth >= 5
      ? data.businesses
          .filter(b => b.type !== "nonprofit")
          .filter(b => !(b.monthlyProfits || []).find(p => p.month === prevYM)
                    && !(b.historicalData  || []).find(e => e.month === prevYM))
      : [];
    if (missingRent.length > 0 || missingProfits.length > 0) {
      setReminderData({ missingRent, missingProfits });
      setShowReminder(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Period status ──
  useEffect(() => { refreshPeriodStatus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshPeriodStatus() {
    const { data: ps } = await supabase.rpc("get_period_status", { p_month_key: currentYM() });
    if (ps) setPeriodStatus({ ...ps, loading: false });
  }
  async function handleClosePeriod() {
    setPeriodLoading(true);
    setShowCloseConfirm(false);
    await supabase.rpc("close_monthly_period", { p_month_key: currentYM(), p_admin_id: user.id });
    await refreshPeriodStatus();
    setPeriodLoading(false);
  }
  async function handleOverridePeriod() {
    if (!overrideReason.trim()) return;
    setPeriodLoading(true);
    setShowOverrideModal(false);
    await supabase.rpc("admin_override_period", { p_month_key: currentYM(), p_admin_id: user.id, p_override_reason: overrideReason.trim() });
    await refreshPeriodStatus();
    setOverrideReason("");
    setPeriodLoading(false);
  }
  async function handleRelockPeriod() {
    setPeriodLoading(true);
    await supabase.rpc("relock_after_override", { p_month_key: currentYM(), p_admin_id: user.id });
    await refreshPeriodStatus();
    setPeriodLoading(false);
  }

  // ── Derived totals (ASWC excluded from business equity) ──
  const indNet        = f => safe(f.cash) + safe(f.accounts) + safe(f.securities) + safe(f.crypto) + safe(f.physicalAssets);
  const totalREEqGross = data.properties.reduce((s, p) => s + propGrossEquity(p), 0);
  const totalREEq      = data.properties.reduce((s, p) => s + propJMFEquity(p), 0); // JMF-attributable gross equity
  const totalRENetSale = data.properties.reduce((s, p) => {
    const mkt = getMarketValueCad(p);
    const fee = mkt * 0.035;
    const selling = fee + (fee * 0.13) + 5000;
    return s + ((mkt - propCurrentMortgageBalance(p) - selling) * propOwnership(p));
  }, 0); // JMF net proceeds if all RE sold
  const totalRELiquid = totalRENetSale; // alias — liquid = JMF net after selling costs, ownership-adjusted
  const totalREVal     = data.properties.reduce((s, p) => s + getMarketValueCad(p), 0);
  const totalREDbt     = data.properties.reduce((s, p) => s + propCurrentMortgageBalance(p), 0);
  const totalPers     = data.individuals.reduce((s, f) => s + indNet(f), 0);
  const totalBiz      = data.businesses.filter(b => b.type !== "nonprofit" && b.type !== "tracked_only").reduce((s, b) => s + (safe(b.cashAccounts) - safe(b.liabilities)), 0);
  const totalVehicles = (data.vehicles || []).reduce((s, v) => s + getVehicleMarketValue(v) - safe(v.loanBalance), 0);
  const totalNW       = totalRENetSale + totalPers + totalBiz + totalVehicles;
  const curYM      = currentYM();
  const totalMtg      = data.properties.reduce((s, p) => s + safe(p.monthlyPayment), 0);
  const totalREIncome = data.properties.reduce((s, p) => s + propEffectiveRent(p), 0);
  const totalREOut    = data.properties.reduce((s, p) => s + propMonthlyOut(p), 0);
  const totalRENCF    = totalREIncome - totalREOut;
  const aj         = data.individuals.find(f => f.id === 1);
  const cashStale  = safe(aj?.cash) === 0;
  const latestReportGeneratedAt = (data.reportHistory || [])
    .map(r => r.generatedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];
  const heroSubtitle = latestReportGeneratedAt
    ? `Last Report Generated: ${new Date(latestReportGeneratedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`
    : "No report generated yet";

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
  function updVehicle(id, patch) {
    const arr = (data.vehicles || []).map(v => v.id === id ? { ...v, ...patch } : v);
    saveToDB("vehicles", arr); setData(d => ({ ...d, vehicles: arr })); showSaved();
  }
  function addVehicleValuation(id, entry) {
    const arr = (data.vehicles || []).map(v => {
      if (v.id !== id) return v;
      const existing = v.valuations || [];
      return { ...v, valuations: [...existing, entry] };
    });
    saveToDB("vehicles", arr); setData(d => ({ ...d, vehicles: arr })); showSaved();
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
    ensurePeriodExists(month).then(() =>
      supabase.from("monthly_individual_logs").upsert(
        { month_key: month, individual_id: indId, monthly_income: safe(income), updated_at: new Date().toISOString() },
        { onConflict: "month_key,individual_id" }
      )
    ).catch(() => {});
  }
  function updIndAccountsLog(indId, entry) {
    const arr = data.individuals.map(x => {
      if (x.id !== indId) return x;
      const existing = x.accountsLog || [];
      const ts = new Date().toISOString();
      const newEntry = { ...entry, timestamp: ts };
      const alreadyExists = existing.some(e => e.month === entry.month);
      const log = alreadyExists
        ? existing.map(e => e.month === entry.month ? { ...newEntry, capturedAt: e.capturedAt || e.timestamp, updatedAt: ts } : e)
        : [...existing, { ...newEntry, capturedAt: ts }];
      return { ...x, accountsLog: log };
    });
    saveToDB("individuals", arr); setData(d => ({ ...d, individuals: arr })); showSaved();
    writeIndividualLog(indId, entry, user.id).catch(() => {});
  }
  function saveSnapshot(note) {
    const indNet = f => safe(f.cash) + safe(f.accounts) + safe(f.securities) + safe(f.crypto) + safe(f.physicalAssets);
    const snapVehicleTotal = (data.vehicles || []).reduce((s, v) => s + getVehicleMarketValue(v) - safe(v.loanBalance), 0);
    const snapNW = data.properties.reduce((s, p) => {
      const mkt = getMarketValueCad(p); const fee = mkt * 0.035; const sell = fee + fee * 0.13 + 5000;
      return s + (mkt - propCurrentMortgageBalance(p) - sell) * propOwnership(p);
    }, 0)
      + data.individuals.reduce((s, f) => s + indNet(f), 0)
      + data.businesses.filter(b => b.type !== "nonprofit" && b.type !== "tracked_only").reduce((s, b) => s + safe(b.cashAccounts) - safe(b.liabilities), 0)
      + snapVehicleTotal;
    const snapREEq  = data.properties.reduce((s, p) => s + propJMFEquity(p), 0);
    const snapRELiq = data.properties.reduce((s, p) => {
      const mkt = getMarketValueCad(p); const fee = mkt * 0.035; const sell = fee + fee * 0.13 + 5000;
      return s + (mkt - propCurrentMortgageBalance(p) - sell) * propOwnership(p);
    }, 0);
    const snap = {
      month: currentYM(), capturedAt: new Date().toISOString(), nw: snapNW, note: note || "",
      reEquity: snapREEq, reLiquid: snapRELiq,
      individuals: data.individuals.reduce((s, f) => s + indNet(f), 0),
      businesses: data.businesses.filter(b => b.type !== "nonprofit" && b.type !== "tracked_only").reduce((s, b) => s + safe(b.cashAccounts) - safe(b.liabilities), 0),
      vehicles: snapVehicleTotal,
      individualBreakdown: data.individuals.map(f => ({
        id: f.id, name: f.name,
        cash: safe(f.cash), accounts: safe(f.accounts),
        securities: safe(f.securities), crypto: safe(f.crypto),
        physicalAssets: safe(f.physicalAssets),
        net: indNet(f),
      })),
      businessBreakdown: data.businesses.map(b => {
        const mp = (b.monthlyProfits || []).find(p => p.month === currentYM());
        const other = Math.max(0, safe(b.liabilities) - safe(b.taxPayable) - safe(b.creditCards));
        return {
          id: b.id, name: b.name, type: b.type,
          cashAccounts: safe(b.cashAccounts),
          taxPayable: safe(b.taxPayable),
          creditCards: safe(b.creditCards),
          otherLiabilities: other,
          liabilities: safe(b.liabilities),
          revenue: safe(b.revenue), expenses: safe(b.expenses),
          monthlyProfit: mp != null ? safe(mp.profit) : null,
          eq: safe(b.cashAccounts) - safe(b.liabilities),
        };
      }),
      reBreakdown: data.properties.map(p => {
        const mkt = getMarketValueCad(p); const fee = mkt * 0.035; const sell = fee + fee * 0.13 + 5000;
        return { id: p.id, name: p.name, market: mkt, debt: propCurrentMortgageBalance(p), equity: propJMFEquity(p), liquid: (mkt - propCurrentMortgageBalance(p) - sell) * propOwnership(p) };
      }),
      vehicleBreakdown: (data.vehicles || []).map(v => ({
        id: v.id, name: v.name, year: v.year, make: v.make, model: v.model,
        marketValue: getVehicleMarketValue(v), loanBalance: safe(v.loanBalance),
        equity: getVehicleMarketValue(v) - safe(v.loanBalance),
      })),
    };
    const existing = data.snapshots || [];
    const alreadyExists = existing.some(s => s.month === snap.month);
    const updated = alreadyExists
      ? existing.map(s => s.month === snap.month
          ? { ...snap, capturedAt: s.capturedAt, updatedAt: snap.capturedAt }
          : s)
      : [...existing, snap];
    saveToDB("snapshots", updated);
    setData(d => ({ ...d, snapshots: updated }));
    showSaved();
    const cfIncome = data.cashflow?.income || [];
    const cfObl    = data.cashflow?.obligations || [];
    const cfNet    = cfIncome.reduce((s, x) => s + safe(x.amount), 0) - cfObl.reduce((s, x) => s + safe(x.amount), 0);
    ensurePeriodExists(snap.month).then(() =>
      supabase.from("monthly_snapshots").upsert({
        month_key:            snap.month,
        nw:                   snap.nw,
        re_equity:            snap.reEquity,
        re_liquid:            snap.reLiquid,
        individuals_total:    snap.individuals,
        businesses_total:     snap.businesses,
        individual_breakdown: snap.individualBreakdown,
        re_breakdown:         snap.reBreakdown,
        business_breakdown:   snap.businessBreakdown,
        cash_flow_snapshot:   { income: cfIncome, obligations: cfObl, net: cfNet },
        note:                 snap.note || null,
        updated_at:           new Date().toISOString(),
      }, { onConflict: "month_key" })
    ).catch(() => {});
    return snap;
  }
  function recordReportGeneration(entry) {
    const updated = [...(data.reportHistory || []), entry];
    saveToDB("reportHistory", updated);
    setData(d => ({ ...d, reportHistory: updated }));
    showSaved();
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
    ensurePeriodExists(month).then(() =>
      supabase.from("monthly_business_logs").upsert(
        { month_key: month, business_id: bizId, profit: safe(profit), updated_at: new Date().toISOString() },
        { onConflict: "month_key,business_id" }
      )
    ).catch(() => {});
  }
  function updBizProfitField(bizId, month, field, value) {
    let capturedEntry = null;
    const arr = data.businesses.map(b => {
      if (b.id !== bizId) return b;
      const existing = b.monthlyProfits || [];
      const has = existing.find(p => p.month === month);
      const current = has || { month };
      const nextEntry = { ...current, [field]: safe(value) };

      if (field !== "profit" && current.profit == null) {
        nextEntry.profit = safe(nextEntry.revenue) - safe(nextEntry.expenses);
      }

      capturedEntry = nextEntry;

      const updated = has
        ? existing.map(p => p.month === month ? nextEntry : p)
        : [...existing, nextEntry];

      return { ...b, monthlyProfits: updated };
    });
    saveToDB("businesses", arr); setData(d => ({ ...d, businesses: arr })); showSaved();
    if (capturedEntry) {
      ensurePeriodExists(month).then(() =>
        supabase.from("monthly_business_logs").upsert({
          month_key:   month,
          business_id: bizId,
          revenue:     safe(capturedEntry.revenue),
          expenses:    safe(capturedEntry.expenses),
          profit:      safe(capturedEntry.profit),
          updated_at:  new Date().toISOString(),
        }, { onConflict: "month_key,business_id" })
      ).catch(() => {});
    }
  }
  function updBizHistory(bizId, entry) {
    // entry: { month, revenue, expenses, profit, cashBalance, liabilities, notes, events }
    const arr = data.businesses.map(b => {
      if (b.id !== bizId) return b;
      const existing = b.historicalData || [];
      const has = existing.find(e => e.month === entry.month);
      const next = has ? existing.map(e => e.month === entry.month ? { ...e, ...entry } : e) : [...existing, entry];
      return { ...b, historicalData: next };
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
    (async () => {
      try {
        await ensurePeriodExists(payload.month);
        const { data: existing_row } = await supabase
          .from("monthly_rent_logs")
          .select("id")
          .eq("month_key",    payload.month)
          .eq("property_id",  payload.propertyId)
          .eq("unit_id",      String(payload.unitId || ""))
          .eq("payment_type", "payment")
          .maybeSingle();
        const dbRow = {
          month_key:    payload.month,
          property_id:  payload.propertyId,
          unit_id:      String(payload.unitId || ""),
          lease_id:     payload.leaseId || null,
          amount:       safe(payload.amount),
          payment_date: payload.date || `${payload.month}-01`,
          payment_type: "payment",
          note:         payload.note || null,
          updated_at:   new Date().toISOString(),
        };
        if (existing_row?.id) {
          await supabase.from("monthly_rent_logs").update(dbRow).eq("id", existing_row.id);
        } else {
          await supabase.from("monthly_rent_logs").insert(dbRow);
        }
      } catch {}
    })();
  }
  function writeCashflowLog(cf) {
    const mk  = currentYM();
    const inc = cf.income      || [];
    const obl = cf.obligations || [];
    ensurePeriodExists(mk).then(() =>
      supabase.from("monthly_cashflow_logs").upsert({
        month_key:         mk,
        income:            inc,
        obligations:       obl,
        total_income:      inc.reduce((s, x) => s + safe(x.amount), 0),
        total_obligations: obl.reduce((s, x) => s + safe(x.amount), 0),
        updated_at:        new Date().toISOString(),
      }, { onConflict: "month_key" })
    ).catch(() => {});
  }
  function updCF(type, idx, v) {
    const a = [...data.cashflow[type]];
    a[idx] = { ...a[idx], amount: safe(v) };
    const cf = { ...data.cashflow, [type]: a };
    saveToDB("cashflow", cf); setData(d => ({ ...d, cashflow: cf })); showSaved();
    writeCashflowLog(cf);
  }
  function delCF(type, idx) {
    const a = data.cashflow[type].filter((_, i) => i !== idx);
    const cf = { ...data.cashflow, [type]: a };
    saveToDB("cashflow", cf); setData(d => ({ ...d, cashflow: cf })); showSaved();
    writeCashflowLog(cf);
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
    if (sub.period) {
      const monthKey = sub.period.slice(0, 7);
      writeIndividualLog(individualId, { month: monthKey, ...sub.data }, user.id).catch(() => {});
    }
  }

  async function handleReject(subId, note) {
    const ok = await rejectSubmission(subId, user.id, note);
    if (ok) setPendingSubs(s => s.filter(x => x.id !== subId));
  }

  const TABS = ["Overview", "Real Estate", "Individuals", "Businesses", "Vehicles", "Cash Flow", "Reports"];
  const tabId = t => t.toLowerCase().replace(/ /g, "");

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: C.sans }}>
      {cashModal && <CashModal current={safe(aj?.cash)} onSave={v => updInd(1, "cash", v)} onClose={() => setCashModal(false)} />}

      {/* ── Close Month confirmation ── */}
      {showCloseConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:C.surface, borderRadius:14, padding:28, maxWidth:400, width:"100%", boxShadow:C.shadowMd }}>
            <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:12 }}>Close {monthLabel(currentYM())}?</div>
            <div style={{ fontSize:13, color:C.textMid, marginBottom:24, lineHeight:1.6 }}>
              This will lock all financial data for this month. No further edits will be possible without an admin override. This action is permanent unless manually overridden.
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={() => setShowCloseConfirm(false)} style={{ fontSize:13, background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 18px", cursor:"pointer", color:C.textMid }}>Cancel</button>
              <button onClick={handleClosePeriod} style={{ fontSize:13, background:C.red, color:"#FFF", border:"none", borderRadius:8, padding:"8px 18px", cursor:"pointer", fontWeight:700 }}>Yes, Close Month</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Override modal ── */}
      {showOverrideModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:C.surface, borderRadius:14, padding:28, maxWidth:440, width:"100%", boxShadow:C.shadowMd }}>
            <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:8 }}>Override Locked Period</div>
            <div style={{ fontSize:13, color:C.textMid, marginBottom:16, lineHeight:1.6 }}>
              You are unlocking <strong>{monthLabel(currentYM())}</strong>. A reason is required and will be saved to the audit trail.
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:6, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>Override reason *</div>
              <textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="e.g. Correcting rent entry for Unit 2B"
                style={{ width:"100%", padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:8, background:C.bg, color:C.text, fontSize:13, fontFamily:C.sans, outline:"none", resize:"vertical", minHeight:80, boxSizing:"border-box" }} />
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={() => { setShowOverrideModal(false); setOverrideReason(""); }} style={{ fontSize:13, background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 18px", cursor:"pointer", color:C.textMid }}>Cancel</button>
              <button onClick={handleOverridePeriod} disabled={!overrideReason.trim()} style={{ fontSize:13, background:C.amber, color:"#FFF", border:"none", borderRadius:8, padding:"8px 18px", cursor: overrideReason.trim() ? "pointer" : "not-allowed", fontWeight:700, opacity: overrideReason.trim() ? 1 : 0.5 }}>Unlock Period</button>
            </div>
          </div>
        </div>
      )}

      {showReminder && (
        <ReminderModal
          missingRent={reminderData.missingRent}
          missingProfits={reminderData.missingProfits}
          onSaveRent={(propertyId, received, note) => updRentPayment(propertyId, currentYM(), received, note)}
          onSaveProfit={(bizId, profit) => updBizProfit(bizId, shiftYM(currentYM(), -1), profit)}
          onDismiss={() => setShowReminder(false)}
        />
      )}
      {/* NAV */}
      <div style={{ background: C.nav, borderBottom: `1px solid ${C.navBorder}`, padding: isMobile ? "0 14px" : "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: isMobile ? 52 : 56, position: "sticky", top: 0, zIndex: 100, minHeight: isMobile ? 52 : 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, minWidth: 0, flexShrink: 1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink: 0 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:C.gold, boxShadow:`0 0 8px ${C.gold}` }} />
            <span style={{ fontSize: isMobile ? 15 : 17, fontWeight: 800, color: C.gold, letterSpacing: "0.1em" }}>JMF</span>
          </div>
          {!isSmall && <span style={{ fontSize: 11, color: C.navText, letterSpacing:"0.05em", whiteSpace:"nowrap" }}>Family Office</span>}
          {saved && <span style={{ fontSize: 10, color: "#FFF", background: C.green, borderRadius: 4, padding: "2px 8px", letterSpacing:"0.04em", flexShrink:0 }}>✓</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10, flexShrink: 0 }}>
          {pendingSubs.length > 0 && !isSmall && (
            <button onClick={() => setTab("overview")}
              style={{ fontSize: 10, color: C.amber, background: "rgba(183,119,13,0.15)", border: `1px solid rgba(183,119,13,0.3)`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontWeight: 600 }}>
              {pendingSubs.length} pending
            </button>
          )}
          {cashStale && !isSmall && (
            <button onClick={() => setCashModal(true)}
              style={{ fontSize: 10, color: C.amber, background: "rgba(183,119,13,0.15)", border: `1px solid rgba(183,119,13,0.3)`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontWeight: 600 }}>
              Cash stale
            </button>
          )}
          {/* Notification bell */}
          {(() => {
            const notifications = computeNotifications(data, profiles, pendingSubs, true, null);
            const meta = data.notificationsMeta || { completed: {}, lastSeenAt: "" };
            const completedMap = meta.completed || {};
            const pendingCount = notifications.filter(n => n.status !== "upcoming" && n.status !== "completed" && !completedMap[n.id]).length;
            return (
              <div style={{ position:"relative" }}>
                <button onClick={() => setNotificationsOpen(o => !o)}
                  style={{ background:"transparent", border:`1px solid rgba(255,255,255,0.12)`, borderRadius:6, color:C.navText, fontSize:14, padding:"3px 8px", cursor:"pointer", lineHeight:1, position:"relative", flexShrink:0 }}>
                  🔔
                  {pendingCount > 0 && (
                    <span style={{ position:"absolute", top:-5, right:-5, background:"#EF4444", color:"#fff", fontSize:9, fontWeight:700, borderRadius:10, padding:"1px 4px", minWidth:14, textAlign:"center", lineHeight:"14px" }}>
                      {pendingCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <NotificationPanel
                    notifications={notifications}
                    completedIds={meta.completed || {}}
                    onComplete={completeNotification}
                    onClose={() => setNotificationsOpen(false)}
                    isAdmin={true}
                  />
                )}
              </div>
            );
          })()}
          <span style={{ fontSize: 9, fontWeight: 700, color: C.gold, background: "rgba(184,150,46,0.15)", border:`1px solid rgba(184,150,46,0.25)`, borderRadius: 4, padding: "2px 6px", letterSpacing:"0.06em", flexShrink:0 }}>ADMIN</span>
          {!isMobile && <span style={{ fontSize: 12, color: C.navText, maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.profile?.display_name || user.email}</span>}
          <button onClick={onLogout} style={{ background: "transparent", border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 6, color: C.navText, fontSize: 10, padding: isMobile ? "4px 8px" : "5px 12px", cursor: "pointer", flexShrink:0, whiteSpace:"nowrap" }}>Sign out</button>
        </div>
      </div>

      {/* HERO */}
      <div style={{ background: `linear-gradient(160deg, ${C.nav} 0%, #152238 100%)`, padding: isMobile ? (isSmall ? "28px 16px 24px" : "36px 20px 30px") : "52px 28px 44px", textAlign: "center" }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: isMobile ? 10 : 16 }}>JMF Consolidated Net Worth</div>
        <div style={{ fontSize: isMobile ? (isSmall ? 36 : 44) : 62, fontWeight: 800, fontFamily: C.mono, color: totalNW < 0 ? "#FF6B6B" : C.gold, letterSpacing: isMobile ? -1 : -2, lineHeight: 1, textShadow: totalNW >= 0 ? `0 0 40px rgba(184,150,46,0.3)` : "none" }}>
          {$F(totalNW)}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: isMobile ? 10 : 16, letterSpacing: "0.06em" }}>
          {heroSubtitle}
        </div>
      </div>

      {/* KPI STRIP — 3 clean stats */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", maxWidth: 800, margin: "0 auto" }}>
          {[
            { label: "Liquid RE Value",     val: $K(totalRELiquid),   sub: `${((totalRELiquid / Math.max(1, Math.abs(totalNW))) * 100).toFixed(0)}% of NW`, color: C.gold },
            { label: "Net of Individuals",  val: $K(totalPers),       sub: totalPers < 0 ? "Deficit" : "All members",                                       color: totalPers < 0 ? C.red : C.green },
            { label: "Business Equity",     val: $K(totalBiz),        sub: "Operating corps only",                                                           color: C.blue  },
            { label: "Vehicles",            val: $K(totalVehicles),   sub: `${(data.vehicles || []).length} vehicles`,                                        color: C.amber },
          ].map((k, i, arr) => (
            <div key={i} style={{ flex:1, padding: isMobile ? "12px 10px" : "18px 24px", borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : "none", textAlign:"center" }}>
              <div style={{ fontSize: 8, color: C.textDim, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: isMobile ? 4 : 8 }}>{k.label}</div>
              <div style={{ fontSize: isMobile ? (isSmall ? 15 : 17) : 22, fontWeight: 800, fontFamily: C.mono, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 9, color: C.textDim, marginTop: isMobile ? 2 : 4 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PERIOD STATUS BAR */}
      {!periodStatus.loading && (() => {
        const isLocked   = periodStatus.is_locked;
        const isOverride = periodStatus.status === "admin_override";
        const barBg      = isLocked ? C.redLight   : isOverride ? C.amberLight  : C.greenLight;
        const barBorder  = isLocked ? "#F5C6C3"    : isOverride ? "#F0D080"     : "#A8D8B8";
        const labelColor = isLocked ? C.red         : isOverride ? C.amber       : C.green;
        const label      = isLocked ? "🔒 FINALIZED" : isOverride ? "⚠ ADMIN OVERRIDE" : "● OPEN";
        return (
          <div style={{ background:barBg, borderBottom:`1px solid ${barBorder}`, padding: isMobile ? "8px 14px" : "10px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, fontWeight:700, color:labelColor, letterSpacing:"0.06em" }}>{label}</span>
              <span style={{ fontSize:11, color:C.textMid }}>{monthLabel(currentYM())}</span>
              {isOverride && periodStatus.override_reason && (
                <span style={{ fontSize:10, color:C.amber, fontStyle:"italic" }}>"{periodStatus.override_reason}"</span>
              )}
            </div>
            <div style={{ display:"flex", gap:8, flexShrink:0 }}>
              {!isLocked && !isOverride && (
                <button onClick={() => setShowCloseConfirm(true)} disabled={periodLoading}
                  style={{ fontSize:11, background:C.red, color:"#FFF", border:"none", borderRadius:6, padding: isMobile ? "5px 10px" : "5px 14px", cursor:"pointer", fontWeight:700, opacity: periodLoading ? 0.6 : 1 }}>
                  Close Month
                </button>
              )}
              {isLocked && (
                <button onClick={() => setShowOverrideModal(true)} disabled={periodLoading}
                  style={{ fontSize:11, background:C.amber, color:"#FFF", border:"none", borderRadius:6, padding: isMobile ? "5px 10px" : "5px 14px", cursor:"pointer", fontWeight:700, opacity: periodLoading ? 0.6 : 1 }}>
                  Override
                </button>
              )}
              {isOverride && (
                <button onClick={handleRelockPeriod} disabled={periodLoading}
                  style={{ fontSize:11, background:C.red, color:"#FFF", border:"none", borderRadius:6, padding: isMobile ? "5px 10px" : "5px 14px", cursor:"pointer", fontWeight:700, opacity: periodLoading ? 0.6 : 1 }}>
                  Re-lock
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* TABS */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch", scrollbarWidth:"none", msOverflowStyle:"none" }}>
          <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "center", minWidth:"max-content", padding: isMobile ? "0 8px" : "0 28px" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(tabId(t))}
              style={{ padding: isMobile ? "10px 13px" : "12px 18px", fontSize: isMobile ? 11 : 12, fontWeight: 600, letterSpacing: "0.04em", border: "none", cursor: "pointer", background: "transparent", color: tab === tabId(t) ? C.gold : C.textDim, borderBottom: tab === tabId(t) ? `2px solid ${C.gold}` : "2px solid transparent", whiteSpace: "nowrap", fontFamily: C.sans, transition:"color 0.15s" }}>
              {t}
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* PAGE CONTENT */}
      <div style={{ padding: isMobile ? "16px 14px" : "24px 28px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div>
            <ApprovalQueue pendingSubs={pendingSubs} profiles={profiles} individuals={data.individuals} onApprove={handleApprove} onReject={handleReject} />

            {/* 3 summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Liquid RE Value",    val: $K(totalRELiquid),  color: C.gold,  accent: C.gold,  sub: `After selling costs · ${data.properties.length} properties`, bg: C.goldLight },
                { label: "Net of Individuals", val: $K(totalPers),      color: totalPers < 0 ? C.red : C.green, accent: totalPers < 0 ? C.red : C.green, sub: `${data.individuals.length} members`, bg: totalPers < 0 ? C.redLight : C.greenLight },
                { label: "Business Equity",    val: $K(totalBiz),       color: C.blue,  accent: C.blue,  sub: "Operating corps only", bg: C.blueLight },
                { label: "Vehicles",           val: $K(totalVehicles),  color: C.amber, accent: C.amber, sub: `${(data.vehicles || []).length} vehicles · net equity`, bg: C.amberLight },
              ].map((s, i) => (
                <div key={i} style={{ background: s.bg, borderRadius: 14, padding: "22px 24px", borderTop: `3px solid ${s.accent}`, boxShadow: C.shadow }}>
                  <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>{s.label}</div>
                  <div style={{ fontSize: 30, fontFamily: C.mono, fontWeight: 800, color: s.color, letterSpacing: -0.5 }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 8 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* NW Trajectory Chart */}
            <NWChart snapshots={data.snapshots} />

            {/* Asset Allocation + Liquidity */}
            <AllocationCard
              totalRELiquid={totalRELiquid}
              totalPers={totalPers}
              totalBiz={totalBiz}
              totalVehicles={totalVehicles}
              individuals={data.individuals}
            />

            {/* Maintenance alerts */}
            <MaintenanceAlertsWidget />

            {/* RE portfolio mini-cards */}
            <Card accent={C.gold} style={{ marginBottom: 16, paddingTop: 24 }}>
              <Label>Real Estate Portfolio</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                {data.properties.map(p => {
                  const eq = getMarketValueCad(p) - propCurrentMortgageBalance(p);
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
                  const isTO = b.type === "tracked_only";
                  return (
                    <div key={b.id} onClick={() => setTab("businesses")} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, cursor: "pointer", transition:"border-color 0.15s, box-shadow 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = isNP ? C.purple : isTO ? C.amber : C.blue; e.currentTarget.style.boxShadow = C.shadowMd; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}>
                      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
                        <div style={{ background: isNP ? C.purpleLight : C.blueLight, color: isNP ? C.purpleText : C.blueText, borderRadius:4, fontSize:9, fontWeight:700, padding:"2px 6px" }}>{isNP ? "NON-PROFIT" : "CORP"}</div>
                        <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{b.name}</div>
                      </div>
                      {isNP ? (
                        <div style={{ fontFamily:C.mono, fontWeight:700, color:C.purple, fontSize:16 }}>{$K(safe(b.cashAccounts))}</div>
                      ) : isTO ? (
                        <div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}><span style={{ color:C.textDim }}>Cash</span><span style={{ fontFamily:C.mono, color:C.green }}>{$K(safe(b.cashAccounts))}</span></div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:8 }}><span style={{ color:C.textDim }}>Liabilities</span><span style={{ fontFamily:C.mono, color:C.red }}>{$K(safe(b.liabilities))}</span></div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
                            <span style={{ color:C.textMid, fontWeight:600 }}>Tracked equity</span>
                            <span style={{ fontFamily:C.mono, fontWeight:700, color:C.amber }}>{$K(eq)}</span>
                          </div>
                          <div style={{ fontSize:9, color:C.textDim, marginTop:4, textAlign:"right" }}>excl. from consolidated NW</div>
                        </div>
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

            {/* Vehicles mini-cards */}
            {(data.vehicles || []).length > 0 && (
              <Card accent={C.amber} style={{ marginBottom: 16, paddingTop: 24 }}>
                <Label>Vehicles</Label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
                  {(data.vehicles || []).map(v => {
                    const mv  = getVehicleMarketValue(v);
                    const eq  = mv - safe(v.loanBalance);
                    return (
                      <div key={v.id} onClick={() => setTab("vehicles")} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, cursor: "pointer", transition:"border-color 0.15s, box-shadow 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.amber; e.currentTarget.style.boxShadow = C.shadowMd; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                          <span style={{ fontSize:18 }}>🚗</span>
                          <div style={{ fontSize:12, fontWeight:600, color:C.text, lineHeight:1.3 }}>{v.name}</div>
                        </div>
                        <div style={{ fontSize:17, fontFamily:C.mono, fontWeight:800, color: eq >= 0 ? C.amber : C.red }}>{$K(eq)}</div>
                        <div style={{ fontSize:10, color:C.textDim, marginTop:3 }}>Net equity{safe(v.monthlyPayment) > 0 ? ` · ${$K(v.monthlyPayment)}/mo` : ""}</div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Cash flow graph */}
            <CashFlowGraph data={data} />
          </div>
        )}

        {/* ── REAL ESTATE ── */}
        {tab === "realestate" && (() => {
          const pastMonths = monthsBetween(SYSTEM_START, currentYM()).slice(0, -1);
          const groupedProperties = [
            ["Canada", data.properties.filter(p => (p.country || "Canada") === "Canada")],
            ["Azerbaijan", data.properties.filter(p => p.country === "Azerbaijan")],
          ].filter(([, props]) => props.length > 0);
          const missedRents = data.properties
            .filter(p => pastMonths.some(m => propertyOutstandingForMonth(p, data.rentPayments || [], m) > 0))
            .flatMap(p => pastMonths.filter(m => {
              return propertyOutstandingForMonth(p, data.rentPayments || [], m) > 0;
            }).map(m => ({ prop: p, month: m })));
          return (
          <div>
            {missedRents.length > 0 && (
              <div style={{ background:`linear-gradient(135deg, ${C.red} 0%, #922B21 100%)`, borderRadius:12, padding: isMobile ? "12px 14px" : "14px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:14, boxShadow:`0 4px 16px rgba(192,57,43,0.3)` }}>
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
                { label: "Portfolio Value",    val: $K(totalREVal),    color: C.text,  sub: `Gross (${data.properties.length} properties)` },
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
            {/* RE Return Metrics table */}
            {(() => {
              const rentable = data.properties.filter(p => propEffectiveRent(p) > 0 && getMarketValueCad(p) > 0);
              if (!rentable.length) return null;
              const yc = v => v >= 6 ? C.green : v >= 3 ? C.amber : C.red;
              return (
                <Card style={{ marginBottom: 16 }}>
                  <Label>Return Metrics</Label>
                  <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 340 }}>
                      <thead>
                        <tr>
                          {["Property", "Gross Yield", "Cap Rate", "Monthly NCF"].map(h => (
                            <th key={h} style={{ textAlign: h === "Property" ? "left" : "right", padding: "6px 10px", fontSize: 9, color: C.textDim, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rentable.map(p => {
                          const mkt  = getMarketValueCad(p);
                          const rent = propEffectiveRent(p);
                          const opEx = safe(p.monthlyTax) + safe(p.monthly_insurance) +
                                       safe(p.maintenance_reserve_monthly) + safe(p.management_fee_monthly) +
                                       safe(p.utilities_monthly);
                          const grossYield = (rent * 12 / mkt) * 100;
                          const capRate    = ((rent - opEx) * 12 / mkt) * 100;
                          const ncf        = rent - propMonthlyOut(p);
                          return (
                            <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ padding: "9px 10px", color: C.text, fontWeight: 600, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</td>
                              <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: C.mono, fontWeight: 700, color: yc(grossYield) }}>{grossYield.toFixed(2)}%</td>
                              <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: C.mono, fontWeight: 700, color: yc(capRate) }}>{capRate.toFixed(2)}%</td>
                              <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: C.mono, fontWeight: 700, color: ncf >= 0 ? C.green : C.red }}>{ncf >= 0 ? "+" : ""}{$F(ncf)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 8, lineHeight: 1.6 }}>
                    Gross yield: annual rent ÷ market value. Cap rate: NOI (rent − operating expenses, excl. debt) ÷ market value. Monthly NCF: rent − all outflows incl. mortgage. ≥6% green · 3–6% amber · &lt;3% red.
                  </div>
                </Card>
              );
            })()}
            {groupedProperties.map(([country, props]) => {
              const meta = getCountryMeta(country);
              return (
                <div key={country} style={{ marginBottom: 24 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, padding:"10px 14px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:12 }}>
                    <span style={{ fontSize:18, lineHeight:1 }}>{meta.flag}</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:C.text, letterSpacing:"0.06em", textTransform:"uppercase" }}>{meta.label}</div>
                      <div style={{ fontSize:10, color:C.textDim }}>{props.length} propert{props.length === 1 ? "y" : "ies"}</div>
                    </div>
                  </div>
                  {props.map(p => (
                    <PropCard
                      key={p.id}
                      prop={p}
                      rentPayments={data.rentPayments || []}
                      onUpdate={(f, v) => updProp(p.id, f, v)}
                      onPatch={patch => updPropPatch(p.id, patch)}
                      onSaveRentPayment={updRentPayment}
                      isAdmin={true}
                      periodLocked={periodStatus.is_locked}
                    />
                  ))}
                </div>
              );
            })}
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

                  {/* Individual History Log */}
                  <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>Monthly History</span>
                      <button onClick={() => { setAccLogOpen(accLogOpen === f.id ? null : f.id); setAccLogForm({ month: currentYM(), cash: safe(f.cash), accounts: safe(f.accounts), securities: safe(f.securities), crypto: safe(f.crypto), physicalAssets: safe(f.physicalAssets), note: "" }); }}
                        style={{ fontSize: 10, background: C.goldLight, color: C.goldText, border: `1px solid rgba(184,150,46,0.3)`, borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontWeight: 600 }}>
                        {accLogOpen === f.id ? "Cancel" : "+ Log Month"}
                      </button>
                    </div>
                    {accLogOpen === f.id && (() => {
                      const formNet = safe(accLogForm.cash) + safe(accLogForm.accounts) + safe(accLogForm.securities) + safe(accLogForm.crypto) + safe(accLogForm.physicalAssets);
                      return (
                        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 8 }}>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 3 }}>Month</div>
                            <input type="month" value={accLogForm.month} onChange={e => setAccLogForm(p => ({ ...p, month: e.target.value }))}
                              style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg, color: C.text, fontSize: 12, fontFamily: C.sans, outline: "none" }} />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                            {[
                              { l: "Cash",            k: "cash"          },
                              { l: "Accounts",        k: "accounts"      },
                              { l: "Securities",      k: "securities"    },
                              { l: "Crypto",          k: "crypto"        },
                              { l: "Physical Assets", k: "physicalAssets"},
                            ].map(({ l, k }) => (
                              <div key={k}>
                                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 3 }}>{l}</div>
                                <input type="number" value={accLogForm[k]} onChange={e => setAccLogForm(p => ({ ...p, [k]: e.target.value }))}
                                  style={{ width: "100%", padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg, color: C.text, fontSize: 12, fontFamily: C.mono, outline: "none", boxSizing: "border-box" }} />
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", marginBottom: 8, borderTop: `1px solid ${C.border}` }}>
                            <span style={{ fontSize: 12, color: C.textMid, fontWeight: 600 }}>Net Worth</span>
                            <span style={{ fontFamily: C.mono, fontWeight: 800, fontSize: 14, color: formNet >= 0 ? C.gold : C.red }}>{$F(formNet)}</span>
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 3 }}>Note (optional)</div>
                            <input type="text" placeholder="Context for this snapshot" value={accLogForm.note} onChange={e => setAccLogForm(p => ({ ...p, note: e.target.value }))}
                              style={{ width: "100%", padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg, color: C.text, fontSize: 12, fontFamily: C.sans, outline: "none", boxSizing: "border-box" }} />
                          </div>
                          {periodStatus.is_locked && accLogForm.month === curYM && (
                            <div style={{ fontSize:11, color:C.red, marginBottom:8 }}>🔒 {monthLabel(curYM)} is locked. Choose a different month or use Override to unlock.</div>
                          )}
                          <button
                            disabled={periodStatus.is_locked && accLogForm.month === curYM}
                            onClick={() => {
                              const net = safe(accLogForm.cash) + safe(accLogForm.accounts) + safe(accLogForm.securities) + safe(accLogForm.crypto) + safe(accLogForm.physicalAssets);
                              updIndAccountsLog(f.id, { month: accLogForm.month, cash: safe(accLogForm.cash), accounts: safe(accLogForm.accounts), securities: safe(accLogForm.securities), crypto: safe(accLogForm.crypto), physicalAssets: safe(accLogForm.physicalAssets), net, note: accLogForm.note });
                              setAccLogOpen(null);
                            }}
                            style={{ fontSize: 12, background: C.gold, color: "#1A1508", border: "none", borderRadius: 6, padding: "7px 16px", cursor: periodStatus.is_locked && accLogForm.month === curYM ? "not-allowed" : "pointer", fontWeight: 700, opacity: periodStatus.is_locked && accLogForm.month === curYM ? 0.4 : 1 }}>
                            Save
                          </button>
                        </div>
                      );
                    })()}
                    {(f.accountsLog || []).length === 0
                      ? <div style={{ fontSize: 11, color: C.textDim, fontStyle: "italic" }}>No entries yet.</div>
                      : [...(f.accountsLog || [])].reverse().map((e, i) => {
                        const entryNet = e.net != null ? e.net : safe(e.value);
                        return (
                          <div key={i} style={{ padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 12, color: C.textMid, fontWeight: 600 }}>{monthLabel(e.month)}</span>
                              <span style={{ fontFamily: C.mono, fontSize: 13, color: entryNet >= 0 ? C.gold : C.red, fontWeight: 700 }}>{$F(entryNet)}</span>
                            </div>
                            {e.net != null && (
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 3 }}>
                                {[["Cash", e.cash], ["Acct", e.accounts], ["Sec", e.securities], ["Crypto", e.crypto], ["Assets", e.physicalAssets]].map(([l, v]) => v != null && v !== 0 ? (
                                  <span key={l} style={{ fontSize: 10, color: C.textDim }}>{l}: {$K(v)}</span>
                                ) : null)}
                              </div>
                            )}
                            {e.note && <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{e.note}</div>}
                            {e.updatedAt && <div style={{ fontSize: 10, color: C.amber, marginTop: 1 }}>Edited {new Date(e.updatedAt).toLocaleDateString()}</div>}
                          </div>
                        );
                      })
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
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => setBizInfoOpen(o => !o)}
                style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 11, color: C.textDim, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 13 }}>ⓘ</span> Exclusion notes {bizInfoOpen ? "▴" : "▾"}
              </button>
              {bizInfoOpen && (
                <div style={{ background: C.amberLight, border: `1px solid #F0D080`, borderRadius: 10, padding: "10px 14px", marginTop: 8, fontSize: 12, color: C.amber, lineHeight: 1.7 }}>
                  Operating corporations are legally separate from personal finances. ASWC is a non-profit tracked for reference only — excluded from all NW calculations. NES Bakery Inc. is 50% owned and tracked operationally only — excluded from consolidated net worth per current agreement structure.
                </div>
              )}
            </div>
            {data.businesses.map(b => <BizCard key={b.id} biz={b} onUpdate={(f, v) => updBiz(b.id, f, v)} onUpdateProfit={(month, profit) => updBizProfit(b.id, month, profit)} onUpdateProfitField={(month, field, value) => updBizProfitField(b.id, month, field, value)} onUpdateHistory={entry => updBizHistory(b.id, entry)} isAdmin={true} periodLockedMonth={null} />)}
          </div>
        )}

        {/* ── VEHICLES ── */}
        {tab === "vehicles" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Total Market Value", val: $K((data.vehicles || []).reduce((s, v) => s + getVehicleMarketValue(v), 0)), color: C.amber },
                { label: "Total Loan Balance", val: $K((data.vehicles || []).reduce((s, v) => s + safe(v.loanBalance), 0)),    color: C.red   },
                { label: "Net Vehicle Equity", val: $K(totalVehicles),                                                           color: totalVehicles >= 0 ? C.gold : C.red },
                { label: "Monthly Payments",   val: $K((data.vehicles || []).reduce((s, v) => s + safe(v.monthlyPayment), 0)),  color: C.textMid },
              ].map((s, i) => (
                <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontFamily: C.mono, fontWeight: 700, color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>
            {(data.vehicles || []).map(v => (
              <VehicleCard key={v.id} vehicle={v}
                onUpdate={(patch) => updVehicle(v.id, patch)}
                onAddValuation={(entry) => addVehicleValuation(v.id, entry)} />
            ))}
          </div>
        )}

        {/* ── CASH FLOW ── */}
        {tab === "cashflow" && (() => {
          // Computed income for selected month
          const cfBizIn  = data.businesses.filter(b => b.type !== "nonprofit").reduce((s, b) => {
            const e = (b.monthlyProfits || []).find(p => p.month === cfMonth);
            return s + safe(e?.profit);
          }, 0);
          const cfRentIn  = data.properties.reduce((s, p) => s + propEffectiveRent(p), 0);
          const cfPayroll = data.individuals.reduce((s, ind) => {
            const e = (ind.monthlyIncome || []).find(p => p.month === cfMonth);
            return s + safe(e?.income);
          }, 0);
          const cfOther    = data.cashflow.income.reduce((s, i) => s + safe(i.amount), 0);
          const cfTotalIn  = cfBizIn + cfRentIn + cfPayroll + cfOther;
          const cfPropOut    = data.properties.reduce((s, p) => s + propMonthlyOut(p), 0);
          const cfOtherOut   = data.cashflow.obligations.reduce((s, o) => s + safe(o.amount), 0);
          const cfVehicleOut = (data.vehicles || []).reduce((s, v) => s + safe(v.monthlyPayment) + safe(v.insuranceMonthly), 0);
          const cfTotalOut   = cfPropOut + cfOtherOut + cfVehicleOut;
          const cfGap        = cfTotalIn - cfTotalOut;
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

              {(() => {
                // ── per-group subtotals (derived, no new calculation) ──────────
                const bizRows     = data.businesses.filter(b => b.type !== "nonprofit");
                const vehicleRows = (data.vehicles || []).filter(v => safe(v.monthlyPayment) + safe(v.insuranceMonthly) > 0);

                // Section header component (inline)
                const SectionHeader = ({ label, subtotal, colorVal, openKey, positiveColor }) => (
                  <button onClick={() => toggleCF(openKey)} style={{ width:"100%", background:"none", border:"none", padding:"11px 0 10px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:11, fontWeight:700, color:C.text, letterSpacing:"0.09em", textTransform:"uppercase", fontFamily:C.sans }}>{label}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontFamily:C.mono, fontSize:13, fontWeight:700, color: subtotal > 0 ? (positiveColor || C.gold) : C.textDim }}>
                        {subtotal > 0 ? (colorVal === "red" ? $F(subtotal) : $F(subtotal)) : "—"}
                      </span>
                      <span style={{ fontSize:11, color:C.textDim, lineHeight:1 }}>{cfOpen[openKey] ? "▾" : "▸"}</span>
                    </div>
                  </button>
                );

                // Plain data row (no interactivity)
                const DataRow = ({ label, value, sub, valueColor }) => (
                  <div style={{ padding:"8px 0 7px", borderBottom:`1px solid ${C.border}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:13, color:C.text }}>{label}</span>
                      <span style={{ fontFamily:C.mono, fontSize:13, fontWeight:600, color: valueColor || C.text }}>{value}</span>
                    </div>
                    {sub && <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>{sub}</div>}
                  </div>
                );

                return (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:16 }}>

                    {/* ── INCOME CARD ── */}
                    <Card>
                      <div style={{ fontSize:11, color:C.green, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:12 }}>↑ Income — {monthLabel(cfMonth)}</div>

                      {/* 1. Businesses */}
                      <SectionHeader label="Businesses" subtotal={cfBizIn} openKey="biz" positiveColor={C.gold} />
                      {cfOpen.biz && (
                        <div style={{ paddingLeft:0 }}>
                          {bizRows.map(b => {
                            const entry  = (b.monthlyProfits || []).find(p => p.month === cfMonth);
                            const profit = safe(entry?.profit);
                            return (
                              <DataRow key={b.id} label={b.name}
                                value={entry ? $F(profit) : "—"}
                                valueColor={entry ? (profit >= 0 ? C.gold : C.red) : C.textDim}
                                sub="Net profit · log in Businesses tab" />
                            );
                          })}
                        </div>
                      )}

                      {/* 2. Rental Income */}
                      <SectionHeader label="Rental Income" subtotal={cfRentIn} openKey="rent" positiveColor={C.gold} />
                      {cfOpen.rent && (
                        <div>
                          {data.properties.map(p => {
                            const rent = propEffectiveRent(p);
                            return (
                              <DataRow key={p.id} label={p.name}
                                value={rent > 0 ? $F(rent) : "—"}
                                valueColor={rent > 0 ? C.gold : C.textDim}
                                sub="Expected rent · active leases" />
                            );
                          })}
                        </div>
                      )}

                      {/* 3. Monthly Income / Individuals */}
                      <SectionHeader label="Monthly Income" subtotal={cfPayroll} openKey="payroll" positiveColor={C.green} />
                      {cfOpen.payroll && (
                        <div>
                          {data.individuals.map(ind => {
                            const entry  = (ind.monthlyIncome || []).find(p => p.month === cfMonth);
                            const income = safe(entry?.income);
                            return (
                              <div key={ind.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:`1px solid ${C.border}` }}>
                                <span style={{ fontSize:13, color:C.text }}>{ind.name}</span>
                                <EditNum value={income} onChange={v => updIndIncome(ind.id, cfMonth, v)} />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 4. Other Income */}
                      <SectionHeader label="Other Income" subtotal={cfOther} openKey="otherInc" positiveColor={C.green} />
                      {cfOpen.otherInc && (
                        <div>
                          {data.cashflow.income.length === 0 && (
                            <div style={{ fontSize:12, color:C.textDim, padding:"8px 0 4px", fontStyle:"italic" }}>No other income rows.</div>
                          )}
                          {data.cashflow.income.map((item, i) => (
                            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, padding:"7px 0", borderBottom:`1px solid ${C.border}` }}>
                              <span style={{ fontSize:13, color:C.text, flex:1 }}>{item.label}</span>
                              <EditNum value={safe(item.amount)} onChange={v => updCF("income", i, v)} locked={false} />
                              <button onClick={() => delCF("income", i)} style={{ background:"none", border:"none", color:C.textDim, cursor:"pointer", fontSize:16, padding:"0 2px", lineHeight:1, flexShrink:0 }}>×</button>
                            </div>
                          ))}
                          <button onClick={() => {
                            const label = window.prompt("Income label (e.g. Dividend, Side income):");
                            if (!label) return;
                            const cf = { ...data.cashflow, income: [...data.cashflow.income, { label, amount: 0 }] };
                            saveToDB("cashflow", cf); setData(d => ({ ...d, cashflow: cf })); showSaved();
                          }} style={{ marginTop:8, fontSize:11, background:"none", border:`1px dashed ${C.border}`, borderRadius:6, color:C.textDim, padding:"5px 12px", cursor:"pointer", width:"100%" }}>
                            + Add income row
                          </button>
                        </div>
                      )}

                      <div style={{ display:"flex", justifyContent:"space-between", padding:"13px 0 0", borderTop:`2px solid ${C.border}`, marginTop:4, fontWeight:700 }}>
                        <span style={{ fontSize:13, color:C.textMid }}>Total in</span>
                        <span style={{ fontFamily:C.mono, fontSize:15, color:C.green }}>{$F(cfTotalIn)}</span>
                      </div>
                    </Card>

                    {/* ── OBLIGATIONS CARD ── */}
                    <Card>
                      <div style={{ fontSize:11, color:C.red, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:12 }}>↓ Monthly Obligations</div>

                      {/* 1. Real Estate */}
                      <SectionHeader label="Real Estate" subtotal={cfPropOut} openKey="re" positiveColor={C.red} />
                      {cfOpen.re && (
                        <div>
                          {data.properties.map(p => {
                            const total = propMonthlyOut(p);
                            const mtg   = getMortgageOperatingPayment(p);
                            const tax   = safe(p.monthlyTax);
                            const ins   = safe(p.monthly_insurance);
                            const maint = safe(p.maintenance_reserve_monthly);
                            const parts = [
                              mtg   > 0 && `Mortgage ${$K(mtg)}`,
                              tax   > 0 && `Tax ${$K(tax)}`,
                              ins   > 0 && `Insurance ${$K(ins)}`,
                              maint > 0 && `Maintenance ${$K(maint)}`,
                            ].filter(Boolean).join(" · ");
                            return (
                              <DataRow key={p.id} label={p.name}
                                value={total > 0 ? $F(total) : "—"}
                                valueColor={total > 0 ? C.red : C.textDim}
                                sub={parts || undefined} />
                            );
                          })}
                        </div>
                      )}

                      {/* 2. Vehicles */}
                      {cfVehicleOut > 0 && (
                        <>
                          <SectionHeader label="Vehicles" subtotal={cfVehicleOut} openKey="vehicle" positiveColor={C.red} />
                          {cfOpen.vehicle && (
                            <div>
                              {vehicleRows.map(v => {
                                const total = safe(v.monthlyPayment) + safe(v.insuranceMonthly);
                                const parts = [
                                  safe(v.monthlyPayment) > 0    && `Loan ${$K(v.monthlyPayment)}`,
                                  safe(v.insuranceMonthly) > 0  && `Insurance ${$K(v.insuranceMonthly)}`,
                                ].filter(Boolean).join(" · ");
                                return (
                                  <DataRow key={v.id} label={v.name}
                                    value={$F(total)} valueColor={C.red} sub={parts || undefined} />
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}

                      {/* 3. Other Obligations */}
                      <SectionHeader label="Other Obligations" subtotal={cfOtherOut} openKey="otherObl" positiveColor={C.red} />
                      {cfOpen.otherObl && (
                        <div>
                          {data.cashflow.obligations.length === 0 && (
                            <div style={{ fontSize:12, color:C.textDim, padding:"8px 0 4px", fontStyle:"italic" }}>No other obligations.</div>
                          )}
                          {data.cashflow.obligations.map((item, i) => (
                            <div key={i} style={{ padding:"7px 0", borderBottom:`1px solid ${C.border}` }}>
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                                <span style={{ fontSize:13, color:C.text, flex:1 }}>{item.label}</span>
                                <EditNum value={safe(item.amount)} onChange={v => updCF("obligations", i, v)} locked={false} />
                                <button onClick={() => delCF("obligations", i)} style={{ background:"none", border:"none", color:C.textDim, cursor:"pointer", fontSize:16, padding:"0 2px", lineHeight:1, flexShrink:0 }}>×</button>
                              </div>
                              {item.note && <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>{item.note}</div>}
                            </div>
                          ))}
                          <button onClick={() => {
                            const label = window.prompt("Obligation label (e.g. Phone bill, Subscription):");
                            if (!label) return;
                            const cf = { ...data.cashflow, obligations: [...data.cashflow.obligations, { label, amount: 0 }] };
                            saveToDB("cashflow", cf); setData(d => ({ ...d, cashflow: cf })); showSaved();
                          }} style={{ marginTop:8, fontSize:11, background:"none", border:`1px dashed ${C.border}`, borderRadius:6, color:C.textDim, padding:"5px 12px", cursor:"pointer", width:"100%" }}>
                            + Add obligation row
                          </button>
                        </div>
                      )}

                      <div style={{ display:"flex", justifyContent:"space-between", padding:"13px 0 0", borderTop:`2px solid ${C.border}`, marginTop:4, fontWeight:700 }}>
                        <span style={{ fontSize:13, color:C.textMid }}>Total out</span>
                        <span style={{ fontFamily:C.mono, fontSize:15, color:C.red }}>{$F(cfTotalOut)}</span>
                      </div>
                    </Card>

                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* ── REPORTS ── */}
        {tab === "reports" && (
          <HistoryTab
            data={data}
            onSaveSnapshot={note => saveSnapshot(note)}
            onReportGenerated={entry => recordReportGeneration(entry)}
          />
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
        const correctedProps = mergedProperties.map(p => {
          const balFix     = correctedBalances[p.id];
          const rateFix    = { 3: 5.79,                    4: 5.79                    }[p.id];
          const rateStrFix = { 3: "5.79%",                 4: "5.79%"                 }[p.id];
          const rateTypFix = { 3: "12 Month Fixed Closed", 4: "12 Month Fixed Closed" }[p.id];
          const matFix     = { 3: "Apr 1, 2027",           4: "Apr 1, 2027"           }[p.id];
          const pifix      = { 3: 11722.76,                4: 9107                    }[p.id];
          const taxfix     = { 3: 905.29,                  4: 1235.14                 }[p.id];
          const pmtfix     = { 3: 12628.05,                4: 10342.14                }[p.id];
          // Valuation log is the source of truth for market value.
          // Latest entry by date wins; fall back to p.market from mergeById if no log exists.
          const sortedVals = (p.valuations || []).slice().sort((a, b) => b.date.localeCompare(a.date));
          const latestVal = sortedVals[0];
          const activeMarketValue = latestVal ? getNativeMarketValue(latestVal) : getNativeMarketValue(p);
          const activeMarketCurrency = latestVal?.market_currency || latestVal?.currency || p.market_currency || "CAD";
          const activeFxRate = latestVal ? getFxRateToCad({ ...p, ...latestVal, market_currency: activeMarketCurrency }) : getFxRateToCad(p);
          return {
            ...p,
            ...(balFix     !== undefined && { mortgage:            balFix     }),
            ...(rateFix    !== undefined && { interest_rate:       rateFix    }),
            ...(rateStrFix !== undefined && { rate:                rateStrFix }),
            ...(rateTypFix !== undefined && { rateType:            rateTypFix }),
            ...(matFix     !== undefined && { maturity:            matFix     }),
            ...(pifix      !== undefined && { monthly_pi:          pifix      }),
            ...(taxfix     !== undefined && { monthly_payment_tax: taxfix     }),
            ...(pmtfix     !== undefined && { monthlyPayment:      pmtfix     }),
            market_value: activeMarketValue,
            market_currency: activeMarketCurrency,
            fx_rate_to_cad: activeFxRate,
            market: getMarketValueCad({ market_value: activeMarketValue, market_currency: activeMarketCurrency, fx_rate_to_cad: activeFxRate }),
          };
        });
        saveToDB("properties", correctedProps);
        // Migrate notificationsMeta: old format used completedIds[] array;
        // new format uses completed{} object keyed by notification ID.
        const rawMeta = dbData.notificationsMeta || DEFAULT.notificationsMeta;
        const migratedMeta = (() => {
          if (rawMeta.completed) return rawMeta; // already new format
          const completed = {};
          (rawMeta.completedIds || []).forEach(id => { completed[id] = { completedAt: "" }; });
          const migrated = { ...rawMeta, completed };
          delete migrated.completedIds;
          saveToDB("notificationsMeta", migrated);
          return migrated;
        })();
        setData({
          ...DEFAULT,
          individuals:       mergeById(DEFAULT.individuals, dbData.individuals),
          properties:        correctedProps,
          businesses:        mergeById(DEFAULT.businesses,  dbData.businesses),
          vehicles:          mergeById(DEFAULT.vehicles,    dbData.vehicles    || []),
          cashflow:          dbData.cashflow          || DEFAULT.cashflow,
          rentPayments:      mergedRentPayments,
          reportHistory:     dbData.reportHistory     || [],
          snapshots:         dbData.snapshots         || [],
          notificationsMeta: migratedMeta,
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

    // React to auth state changes (login, logout, token refresh, and initial session restore)
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
  }} onSaveAccountsLog={(indId, entry) => {
    const arr = data.individuals.map(x => {
      if (x.id !== indId) return x;
      const existing = x.accountsLog || [];
      const ts = new Date().toISOString();
      const newEntry = { ...entry, timestamp: ts };
      const alreadyExists = existing.some(e => e.month === entry.month);
      const log = alreadyExists
        ? existing.map(e => e.month === entry.month ? { ...newEntry, capturedAt: e.capturedAt || e.timestamp, updatedAt: ts } : e)
        : [...existing, { ...newEntry, capturedAt: ts }];
      return { ...x, accountsLog: log };
    });
    saveToDB("individuals", arr);
    setData(d => ({ ...d, individuals: arr }));
    writeIndividualLog(indId, entry, currentUser.id).catch(() => {});
  }} onLogout={logout} />;
}
