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
  bg:          "#F7F7F5",
  surface:     "#FFFFFF",
  card:        "#FFFFFF",
  border:      "#E8E8E4",
  borderDark:  "#D0D0CA",
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
  text:        "#1A1A1A",
  textMid:     "#555550",
  textDim:     "#999992",
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

// ─── DEFAULT DATA — April 1, 2026 ─────────────────────────────────────────────
const DEFAULT = {
  lastUpdated: "April 1, 2026",

  individuals: [
    { id:1, name:"Ahmed (AJ)",         initials:"AJ", cash:0,   accounts:1023,  debt:-143474, securities:46610, crypto:1466, physicalAssets:0 },
    { id:2, name:"Nazila Isgandarova", initials:"NI", cash:0,   accounts:15647, debt:0,       securities:39939, crypto:0,    physicalAssets:0 },
    { id:3, name:"Yasin Majidov",      initials:"YM", cash:500, accounts:0,     debt:0,       securities:0,     crypto:0,    physicalAssets:0 },
    { id:4, name:"Maryam Majidova",    initials:"MM", cash:0,   accounts:1305,  debt:0,       securities:0,     crypto:0,    physicalAssets:0 },
    { id:5, name:"Akbar Majidov",      initials:"AM", cash:0,   accounts:-1089, debt:-3014,   securities:0,     crypto:0,    physicalAssets:0 },
  ],

  businesses: [
    { id:1, name:"Kratos Moving Inc.", abbr:"KMI", type:"operating",  cashAccounts:152207, liabilities:133056, taxPayable:120000, creditCards:13056, revenue:0, expenses:0, notes:"CEO: James Bond. BMO + RBC + Wise accounts. CRA $120K payable included in liabilities." },
    { id:2, name:"JMF Logistics Inc.", abbr:"JMF", type:"operating",  cashAccounts:2621,   liabilities:0,      taxPayable:0,     creditCards:0,     revenue:0, expenses:0, notes:"RBC Chequing. Clean balance sheet. No outstanding liabilities." },
    { id:3, name:"PRIMA",              abbr:"PRIMA",type:"operating",  cashAccounts:10007,  liabilities:2349,   taxPayable:0,     creditCards:2349,  revenue:0, expenses:0, notes:"Nazila's operating corporation. TD Chequing $10,007. TD Business Travel Visa $2,349." },
    { id:4, name:"ASWC",               abbr:"ASWC", type:"nonprofit", cashAccounts:20643,  liabilities:0,      taxPayable:0,     creditCards:0,     revenue:0, expenses:0, notes:"Non-profit collective fund. TD Chequing $20,643. NOT included in JMF consolidated net worth." },
  ],

  properties: [
    { id:1, name:"27 Roytec Rd.",     status:"STRONG", purchase:750000,  market:2000000, mortgage:728135,  monthlyPayment:3200,  monthlyTax:0,    rentalIncome:0, tenant:"", lender:"TD Bank",        rate:"6.0%",   rateType:"Variable / Floating",   maturity:"TBC",      notes:"Crown jewel. $1.27M unrealized gain." },
    { id:2, name:"3705 Farr Ave.",    status:"STRONG", purchase:250000,  market:1200000, mortgage:0,       monthlyPayment:0,     monthlyTax:0,    rentalIncome:0, tenant:"", lender:"None",           rate:"N/A",    rateType:"Mortgage-free",          maturity:"N/A",      notes:"Fully mortgage-free. Pure equity." },
    { id:3, name:"121 Milky Way",     status:"WATCH",  purchase:3079729, market:2850000, mortgage:1824726, monthlyPayment:15013, monthlyTax:905,  rentalIncome:0, tenant:"", lender:"Equitable Bank", rate:"7.95%",  rateType:"12 Month Fixed Open",   maturity:"Dec 2026", notes:"Fixed Open — can refinance without penalty." },
    { id:4, name:"51 Ahchie Crt.",    status:"RISK",   purchase:2119105, market:1750000, mortgage:1523326, monthlyPayment:9339,  monthlyTax:1235, rentalIncome:0, tenant:"", lender:"Equitable Bank", rate:"P+0.14%",rateType:"36 Month ARM Closed",   maturity:"Mar 2029", notes:"Variable rate ARM. Market significantly below purchase." },
    { id:5, name:"4 New Seabury Dr.", status:"WATCH",  purchase:349000,  market:958800,  mortgage:894769,  monthlyPayment:5979,  monthlyTax:374,  rentalIncome:0, tenant:"", lender:"Equitable Bank", rate:"5.94%",  rateType:"60 Month Fixed Closed", maturity:"Dec 2029", notes:"Locked in at 5.94%. Thin equity margin." },
  ],

  cashflow: {
    income: [
      { label:"Kratos Moving Inc.", amount:0, note:"Add monthly net profit" },
      { label:"JMF Logistics Inc.", amount:0, note:"Add monthly net profit" },
      { label:"PRIMA",              amount:0, note:"Add monthly net profit" },
      { label:"Rental income",      amount:0, note:"Update when tenants confirmed" },
      { label:"Other income",       amount:0, note:"" },
    ],
    obligations: [
      { label:"121 Milky Way mortgage",  amount:15013, note:"7.95% · Equitable · Dec 2026" },
      { label:"51 Ahchie Crt. mortgage", amount:9339,  note:"P+0.14% · Equitable · Mar 2029" },
      { label:"4 New Seabury mortgage",  amount:5979,  note:"5.94% · Equitable · Dec 2029" },
      { label:"27 Roytec Rd. mortgage",  amount:3200,  note:"~6.0% · TD Bank" },
      { label:"TD Line of Credit",       amount:900,   note:"Interest on $91,793" },
      { label:"Student debt",            amount:350,   note:"Monthly est." },
      { label:"Family support",          amount:8000,  note:"Monthly avg" },
      { label:"Personal lifestyle",      amount:5000,  note:"Personal expenses excl. RE" },
    ],
  },
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
function Card({ children, style }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, ...style }}>{children}</div>;
}
function StatusPill({ status }) {
  const map = { STRONG: { bg: C.greenLight, color: C.greenText, label: "Strong" }, WATCH: { bg: C.amberLight, color: C.amber, label: "Watch" }, RISK: { bg: C.redLight, color: C.redText, label: "Risk" } };
  const s = map[status] || map.WATCH;
  return <span style={{ background: s.bg, color: s.color, borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "3px 10px", letterSpacing: "0.05em" }}>{s.label}</span>;
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
function Row({ label, children, last }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: last ? "none" : `1px solid ${C.border}` }}>
      <span style={{ fontSize: 13, color: C.textMid }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}
function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: C.sans }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: C.gold, letterSpacing: "0.08em", marginBottom: 10 }}>JMF</div>
      <div style={{ fontSize: 12, color: C.textDim }}>Loading…</div>
    </div>
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
        <div style={{ fontSize: 11, color: C.textDim, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 10 }}>The Jamet Group</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: C.gold, letterSpacing: "0.08em" }}>JMF</div>
        <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Family Office · Private & Confidential</div>
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
function MemberView({ user, data, onUpdate, onLogout }) {
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

  const net        = safe(f.cash) + safe(f.accounts) + safe(f.debt) + safe(f.securities) + safe(f.crypto) + safe(f.physicalAssets);
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
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.gold, flexShrink: 0 }}>JMF</span>
          <span style={{ fontSize: 12, color: C.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
          {saved && <span style={{ fontSize: 11, color: C.green, background: C.greenLight, borderRadius: 4, padding: "2px 8px", flexShrink: 0 }}>✓ Saved</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {subStatusBadge()}
          {cashStale && (
            <button onClick={() => setCashModal(true)}
              style={{ fontSize: 11, color: C.amber, background: C.amberLight, border: `1px solid #F0D080`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>
              Cash not updated
            </button>
          )}
          <button onClick={onLogout}
            style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, color: C.textMid, fontSize: 11, padding: "4px 12px", cursor: "pointer" }}>
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
  const market       = safe(prop.market);
  const mortgage     = safe(prop.mortgage);
  const rawEquity    = market - mortgage;
  const sellingCosts = (market * 0.035 * 1.13) + 1500;
  const netEquity    = rawEquity - sellingCosts;
  const ltv          = mortgage > 0 ? ((mortgage / market) * 100).toFixed(1) : "0";
  const cf           = safe(prop.rentalIncome) - safe(prop.monthlyPayment) - safe(prop.monthlyTax);
  const eqColor      = rawEquity > 500000 ? C.gold : rawEquity > 0 ? C.amber : C.red;

  return (
    <div style={{ background: C.card, border: `1px solid ${open ? C.gold : C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 10, transition: "border-color 0.15s" }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <StatusPill status={prop.status} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{prop.name}</div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{prop.lender} · {prop.rate}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 2 }}>Equity</div>
            <div style={{ fontSize: 18, fontFamily: C.mono, fontWeight: 700, color: eqColor }}>{$K(rawEquity)}</div>
          </div>
          <span style={{ color: open ? C.gold : C.textDim, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 20 }}>
          {prop.notes && <div style={{ fontSize: 12, color: C.textMid, fontStyle: "italic", marginBottom: 16, lineHeight: 1.6 }}>{prop.notes}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 20 }}>
            <div>
              <Label>Valuation</Label>
              <Row label="Purchase price"><span style={{ color: C.textMid, fontFamily: C.mono, fontSize: 14 }}>{$F(prop.purchase)}</span></Row>
              <Row label="Market value"><EditNum value={market} onChange={v => onUpdate("market", v)} locked={!isAdmin} /></Row>
              <Row label="Mortgage balance"><EditNum value={mortgage} onChange={v => onUpdate("mortgage", v)} locked={!isAdmin} /></Row>
              <Row label="Raw equity"><span style={{ color: eqColor, fontWeight: 700, fontFamily: C.mono, fontSize: 14 }}>{$F(rawEquity)}</span></Row>
              <Row label="Est. net if sold today" last={false}>
                <span style={{ color: netEquity > 0 ? C.green : C.red, fontFamily: C.mono, fontSize: 13 }} title="3.5% realtor + HST + $1,500 legal">{$F(netEquity)}</span>
              </Row>
              <Row label="LTV ratio" last>
                <span style={{ color: parseFloat(ltv) > 80 ? C.red : parseFloat(ltv) > 65 ? C.amber : C.green, fontFamily: C.mono, fontWeight: 600, fontSize: 14 }}>{ltv}%</span>
              </Row>
            </div>
            <div>
              <Label>Mortgage</Label>
              <Row label="Lender"><span style={{ color: C.text, fontSize: 13 }}>{prop.lender}</span></Row>
              <Row label="Rate"><span style={{ color: C.amber, fontFamily: C.mono }}>{prop.rate}</span></Row>
              <Row label="Type"><span style={{ color: C.text, fontSize: 12 }}>{prop.rateType}</span></Row>
              <Row label="Maturity">
                {isAdmin
                  ? <EditText value={prop.maturity} onChange={v => onUpdate("maturity", v)} placeholder="e.g. Dec 2026" />
                  : <span style={{ color: C.text, fontFamily: C.mono, fontSize: 13 }}>{prop.maturity}</span>}
              </Row>
              <Row label="Monthly P+I"><EditNum value={safe(prop.monthlyPayment)} onChange={v => onUpdate("monthlyPayment", v)} locked={!isAdmin} /></Row>
              <Row label="Monthly tax" last><EditNum value={safe(prop.monthlyTax)} onChange={v => onUpdate("monthlyTax", v)} locked={!isAdmin} /></Row>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <Label>Rental</Label>
            <Row label="Monthly rent"><EditNum value={safe(prop.rentalIncome)} onChange={v => onUpdate("rentalIncome", v)} locked={!isAdmin} /></Row>
            <Row label="Tenant" last>
              {isAdmin
                ? <EditText value={prop.tenant} onChange={v => onUpdate("tenant", v)} placeholder="Tenant name" />
                : <span style={{ color: C.text, fontSize: 13 }}>{prop.tenant || "—"}</span>}
            </Row>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10, marginTop: 16 }}>
            {[
              { label: "Annual mortgage", val: $F(safe(prop.monthlyPayment) * 12), color: C.red,   bg: C.redLight   },
              { label: "Annual rental",   val: $F(safe(prop.rentalIncome) * 12),   color: C.green, bg: C.greenLight },
              { label: "Annual net",      val: $F(cf * 12), color: cf >= 0 ? C.green : C.red, bg: cf >= 0 ? C.greenLight : C.redLight },
            ].map((chip, i) => (
              <div key={i} style={{ background: chip.bg, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{chip.label}</div>
                <div style={{ fontSize: 14, fontFamily: C.mono, fontWeight: 700, color: chip.color }}>{chip.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BUSINESS CARD ────────────────────────────────────────────────────────────
function BizCard({ biz, onUpdate, isAdmin }) {
  const [open, setOpen] = useState(false);
  const isNonProfit = biz.type === "nonprofit";
  const netEquity   = safe(biz.cashAccounts) - safe(biz.liabilities);
  const netProfit   = safe(biz.revenue) - safe(biz.expenses);

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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20 }}>
              <div>
                <Label>Assets</Label>
                <Row label="Cash & accounts"><EditNum value={safe(biz.cashAccounts)} onChange={v => onUpdate("cashAccounts", v)} locked={!isAdmin} /></Row>
                <Row label="Monthly revenue"><EditNum value={safe(biz.revenue)} onChange={v => onUpdate("revenue", v)} locked={!isAdmin} /></Row>
                <Row label="Monthly expenses"><EditNum value={safe(biz.expenses)} onChange={v => onUpdate("expenses", v)} locked={!isAdmin} /></Row>
                <Row label="Net profit / mo" last><span style={{ color: netProfit >= 0 ? C.gold : C.red, fontFamily: C.mono, fontWeight: 700, fontSize: 14 }}>{$F(netProfit)}</span></Row>
              </div>
              <div>
                <Label>Liabilities</Label>
                <Row label="Total liabilities"><span style={{ color: C.red, fontFamily: C.mono, fontSize: 14 }}>{$F(safe(biz.liabilities))}</span></Row>
                <Row label="CRA tax payable"><EditNum value={safe(biz.taxPayable)} onChange={v => onUpdate("taxPayable", v)} locked={!isAdmin} /></Row>
                <Row label="Credit cards"><span style={{ color: C.red, fontFamily: C.mono, fontSize: 14 }}>{$F(safe(biz.creditCards))}</span></Row>
                <Row label="Net equity" last><span style={{ color: netEquity >= 0 ? C.gold : C.red, fontFamily: C.mono, fontWeight: 700, fontSize: 14 }}>{$F(netEquity)}</span></Row>
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
  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  useEffect(() => {
    // Load pending submissions and all member profiles in parallel
    Promise.all([getPendingSubmissions(), fetchAllProfiles()]).then(([subs, profs]) => {
      setPendingSubs(subs);
      setProfiles(profs);
    });
  }, [tab]);

  // ── Derived totals (ASWC excluded from business equity) ──
  const indNet     = f => safe(f.cash) + safe(f.accounts) + safe(f.debt) + safe(f.securities) + safe(f.crypto) + safe(f.physicalAssets);
  const totalREEq  = data.properties.reduce((s, p) => s + (safe(p.market) - safe(p.mortgage)), 0);
  const totalREVal = data.properties.reduce((s, p) => s + safe(p.market), 0);
  const totalREDbt = data.properties.reduce((s, p) => s + safe(p.mortgage), 0);
  const totalPers  = data.individuals.reduce((s, f) => s + indNet(f), 0);
  const totalBiz   = data.businesses.filter(b => b.type !== "nonprofit").reduce((s, b) => s + (safe(b.cashAccounts) - safe(b.liabilities)), 0);
  const totalNW    = totalREEq + totalPers + totalBiz;
  const totalIn    = data.cashflow.income.reduce((s, i) => s + safe(i.amount), 0);
  const totalOut   = data.cashflow.obligations.reduce((s, o) => s + safe(o.amount), 0);
  const gap        = totalIn - totalOut;
  const totalMtg   = data.properties.reduce((s, p) => s + safe(p.monthlyPayment), 0);
  const aj         = data.individuals.find(f => f.id === 1);
  const cashStale  = safe(aj?.cash) === 0;

  // ── Update helpers ──
  function updProp(id, f, v) {
    const isText = f === "maturity" || f === "tenant";
    const arr = data.properties.map(p => p.id === id ? { ...p, [f]: isText ? v : safe(v) } : p);
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
  function updCF(type, idx, v) {
    const a = [...data.cashflow[type]];
    a[idx] = { ...a[idx], amount: safe(v) };
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

      {/* NAV */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.gold, letterSpacing: "0.06em" }}>JMF</span>
          <span style={{ fontSize: 11, color: C.textDim }}>Family Office</span>
          {saved && <span style={{ fontSize: 11, color: C.green, background: C.greenLight, borderRadius: 4, padding: "2px 8px" }}>✓ Saved</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {pendingSubs.length > 0 && (
            <button onClick={() => setTab("overview")}
              style={{ fontSize: 11, color: C.amber, background: C.amberLight, border: `1px solid #F0D080`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}>
              {pendingSubs.length} pending review
            </button>
          )}
          {cashStale && (
            <button onClick={() => setCashModal(true)}
              style={{ fontSize: 11, color: C.amber, background: C.amberLight, border: `1px solid #F0D080`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}>
              Cash not updated
            </button>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, color: C.goldText, background: C.goldLight, borderRadius: 4, padding: "3px 8px" }}>ADMIN</span>
          <span style={{ fontSize: 12, color: C.textMid }}>{user.profile?.display_name || user.email}</span>
          <button onClick={onLogout} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, color: C.textMid, fontSize: 11, padding: "5px 12px", cursor: "pointer" }}>Sign out</button>
        </div>
      </div>

      {/* HERO */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "36px 20px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}>JMF Consolidated Net Worth</div>
        <div style={{ fontSize: 52, fontWeight: 800, fontFamily: C.mono, color: totalNW < 0 ? C.red : C.gold, letterSpacing: -1, lineHeight: 1 }}>
          {$F(totalNW)}
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginTop: 10 }}>
          RE equity + personal + operating corps (ASWC excluded) · {data.lastUpdated}
        </div>
      </div>

      {/* KPI STRIP — scrollable on mobile */}
      <div style={{ overflowX: "auto", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", minWidth: "max-content" }}>
          {[
            { label: "RE Equity",         val: $K(totalREEq),  sub: `${((totalREEq / Math.max(1, Math.abs(totalNW))) * 100).toFixed(0)}% of NW`,  color: C.gold  },
            { label: "Personal Net",      val: $K(totalPers),  sub: totalPers < 0 ? "Deficit" : "All members",                                     color: totalPers < 0 ? C.red : C.green },
            { label: "Business Equity",   val: $K(totalBiz),   sub: "Kratos + JMF + PRIMA",                                                        color: C.blue  },
            { label: "Monthly Mortgages", val: $K(totalMtg),   sub: `${$K(totalMtg * 12)}/yr`,                                                     color: C.red   },
            { label: "Monthly Gap",       val: totalIn === 0 ? "—" : $K(gap), sub: totalIn === 0 ? "Add income first" : gap < 0 ? "Deficit" : "Surplus", color: totalIn === 0 ? C.textDim : gap < 0 ? C.red : C.green },
          ].map((k, i, arr) => (
            <div key={i} style={{ padding: "14px 20px", borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : "none", minWidth: 140 }}>
              <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: C.mono, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 10, color: C.textDim, marginTop: 3 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TABS — scrollable on mobile */}
      <div style={{ overflowX: "auto", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", minWidth: "max-content", padding: "0 20px" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(tabId(t))}
              style={{ padding: "10px 16px 12px", fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", border: "none", cursor: "pointer", background: "transparent", color: tab === tabId(t) ? C.gold : C.textMid, borderBottom: tab === tabId(t) ? `2px solid ${C.gold}` : "2px solid transparent", whiteSpace: "nowrap", fontFamily: C.sans }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* PAGE CONTENT */}
      <div style={{ padding: 20, maxWidth: 1080, margin: "0 auto" }}>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div>
            <ApprovalQueue
              pendingSubs={pendingSubs}
              profiles={profiles}
              individuals={data.individuals}
              onApprove={handleApprove}
              onReject={handleReject}
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
              {[
                { label: "Real Estate Equity",     val: $K(totalREEq),  color: C.gold,  bg: C.goldLight,  sub: `${data.properties.length} properties` },
                { label: "Personal (all members)", val: $K(totalPers),  color: totalPers < 0 ? C.red : C.green, bg: totalPers < 0 ? C.redLight : C.greenLight, sub: `${data.individuals.length} individuals` },
                { label: "Business Equity",        val: $K(totalBiz),   color: C.blue,  bg: C.blueLight,  sub: "Operating corps only" },
                { label: "Total RE Debt",          val: $K(totalREDbt), color: C.red,   bg: C.redLight,   sub: "Combined mortgages" },
              ].map((s, i) => (
                <div key={i} style={{ background: s.bg, borderRadius: 12, padding: 18 }}>
                  <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontFamily: C.mono, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            <Card style={{ marginBottom: 14 }}>
              <Label>Real Estate Portfolio</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 10 }}>
                {data.properties.map(p => {
                  const eq = safe(p.market) - safe(p.mortgage);
                  return (
                    <div key={p.id} onClick={() => setTab("realestate")}
                      style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
                      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>{p.name}</div>
                      <StatusPill status={p.status} />
                      <div style={{ fontSize: 18, fontFamily: C.mono, fontWeight: 700, marginTop: 10, color: eq > 500000 ? C.gold : eq > 0 ? C.amber : C.red }}>{$K(eq)}</div>
                      <div style={{ fontSize: 10, color: C.textDim, marginTop: 3 }}>{p.rate}</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <Label>Business Entities</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(195px, 1fr))", gap: 10 }}>
                {data.businesses.map(b => {
                  const eq   = safe(b.cashAccounts) - safe(b.liabilities);
                  const isNP = b.type === "nonprofit";
                  return (
                    <div key={b.id} onClick={() => setTab("businesses")}
                      style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = isNP ? "#9B59B6" : C.gold}
                      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ background: isNP ? C.purpleLight : C.blueLight, color: isNP ? C.purpleText : C.blueText, borderRadius: 4, fontSize: 9, fontWeight: 700, padding: "2px 6px" }}>{isNP ? "NON-PROFIT" : "CORP"}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{b.name}</div>
                      </div>
                      {isNP ? (
                        <div>
                          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 5 }}>Not in consolidated NW</div>
                          <div style={{ fontFamily: C.mono, fontWeight: 700, color: C.purple, fontSize: 16 }}>{$K(safe(b.cashAccounts))}</div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: C.textDim }}>Cash</span><span style={{ fontFamily: C.mono, color: C.green }}>{$K(safe(b.cashAccounts))}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}><span style={{ color: C.textDim }}>Liabilities</span><span style={{ fontFamily: C.mono, color: C.red }}>{$K(safe(b.liabilities))}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                            <span style={{ color: C.textMid, fontWeight: 600 }}>Net equity</span>
                            <span style={{ fontFamily: C.mono, fontWeight: 700, color: eq >= 0 ? C.gold : C.red }}>{$K(eq)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* ── REAL ESTATE ── */}
        {tab === "realestate" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Portfolio Value",  val: $K(totalREVal), color: C.text },
                { label: "Total Debt",       val: $K(totalREDbt), color: C.red  },
                { label: "Total Equity",     val: $K(totalREEq),  color: C.gold },
                { label: "Monthly Payments", val: $K(totalMtg),   color: C.red  },
              ].map((s, i) => (
                <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontFamily: C.mono, fontWeight: 700, color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>
              Click any property to expand · "Est. net if sold" deducts 3.5% realtor (HST incl.) + $1,500 legal
            </div>
            {data.properties.map(p => <PropCard key={p.id} prop={p} onUpdate={(f, v) => updProp(p.id, f, v)} isAdmin={true} />)}
          </div>
        )}

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
            {data.businesses.map(b => <BizCard key={b.id} biz={b} onUpdate={(f, v) => updBiz(b.id, f, v)} isAdmin={true} />)}
          </div>
        )}

        {/* ── CASH FLOW ── */}
        {tab === "cashflow" && (
          <div>
            <div style={{ borderRadius: 12, padding: "24px 20px", marginBottom: 20, textAlign: "center", background: gap >= 0 ? C.greenLight : C.redLight, border: `1px solid ${gap >= 0 ? "#A8D8B8" : "#F5C6C3"}` }}>
              <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Monthly Cash Flow Position</div>
              <div style={{ fontSize: 48, fontFamily: C.mono, fontWeight: 800, color: gap >= 0 ? C.green : C.red }}>{gap >= 0 ? "+" : ""}{$F(gap)}</div>
              <div style={{ fontSize: 13, color: C.textMid, marginTop: 10 }}>
                {totalIn === 0
                  ? "Add business income to see your true monthly position."
                  : gap < 0
                    ? `Need ${$F(Math.abs(gap))} more per month to break even.`
                    : `${$F(gap)}/month surplus.`}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              <Card>
                <div style={{ fontSize: 11, color: C.green, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>↑ Monthly Income</div>
                {data.cashflow.income.map((item, i) => (
                  <div key={i} style={{ padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: C.text }}>{item.label}</span>
                      <EditNum value={safe(item.amount)} onChange={v => updCF("income", i, v)} />
                    </div>
                    {item.note && <div style={{ fontSize: 10, color: C.amber, marginTop: 2 }}>{item.note}</div>}
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", fontWeight: 700 }}>
                  <span style={{ color: C.textMid }}>Total in</span>
                  <span style={{ fontFamily: C.mono, fontSize: 15, color: C.green }}>{$F(totalIn)}</span>
                </div>
              </Card>

              <Card>
                <div style={{ fontSize: 11, color: C.red, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>↓ Monthly Obligations</div>
                {data.cashflow.obligations.map((item, i) => (
                  <div key={i} style={{ padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: C.text }}>{item.label}</span>
                      <EditNum value={safe(item.amount)} onChange={v => updCF("obligations", i, v)} />
                    </div>
                    {item.note && <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{item.note}</div>}
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", fontWeight: 700 }}>
                  <span style={{ color: C.textMid }}>Total out</span>
                  <span style={{ fontFamily: C.mono, fontSize: 15, color: C.red }}>{$F(totalOut)}</span>
                </div>
              </Card>
            </div>
          </div>
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
        setData({
          ...DEFAULT,
          individuals: mergeById(DEFAULT.individuals, dbData.individuals),
          properties:  mergeById(DEFAULT.properties,  dbData.properties),
          businesses:  mergeById(DEFAULT.businesses,  dbData.businesses),
          cashflow:    dbData.cashflow || DEFAULT.cashflow,
        });
      } else {
        // First run — seed the database with defaults
        saveToDB("individuals", DEFAULT.individuals);
        saveToDB("properties",  DEFAULT.properties);
        saveToDB("businesses",  DEFAULT.businesses);
        saveToDB("cashflow",    DEFAULT.cashflow);
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
  return <MemberView user={currentUser} data={data} onUpdate={updInd} onLogout={logout} />;
}