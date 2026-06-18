import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// Supabase client — same project, deduped by supabase-js internals
const sb = createClient(
  "https://bxxnjmottokudtjgigss.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4eG5qbW90dG9rdWR0amdpZ3NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzAyMzgsImV4cCI6MjA5MDU0NjIzOH0.NoIADiNmtaSJd67lAWLbQ49tPHa7KcAu4VBLcAY5kgk"
);

// ─── THEME (mirrors App.js C tokens) ─────────────────────────────────────────
const C = {
  bg:         "#0C1520", surface:    "#111B2C", card:    "#141F2E",
  border:     "#1D2E42", nav:        "#080D18", navBorder:"rgba(255,255,255,0.08)",
  navText:    "rgba(255,255,255,0.50)",
  gold:       "#C9A84C", goldLight:  "rgba(201,168,76,0.15)", goldText: "#D4B46A",
  red:        "#E05555", redLight:   "rgba(224,85,85,0.16)",  redText:  "#F09090",
  green:      "#27AE60", greenLight: "rgba(39,174,96,0.16)",  greenText:"#52C98A",
  amber:      "#E6A817", amberLight: "rgba(230,168,23,0.16)", amberText:"#F5C842",
  blue:       "#3B82F6", blueLight:  "rgba(59,130,246,0.14)", blueText: "#7EC4E6",
  purple:     "#A855F7", purpleLight:"rgba(168,85,247,0.14)", purpleText:"#C4A7F7",
  text:       "#E8EDF5", textMid: "#8FA8C4", textDim: "#6B8BA8",
  shadow:     "0 1px 4px rgba(0,0,0,0.40), 0 4px 16px rgba(0,0,0,0.25)",
  shadowMd:   "0 4px 16px rgba(0,0,0,0.50), 0 8px 32px rgba(0,0,0,0.35)",
  mono:       "'SF Mono','Courier New',monospace",
  sans:       "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ASSET_CLASSES = ["us_tech","defensive","real_asset","crypto","cyclical","cash"];
const ASSET_CLASS_LABEL = { us_tech:"US Tech", defensive:"Defensive", real_asset:"Real Assets", crypto:"Crypto", cyclical:"Cyclical", cash:"Cash" };
const ASSET_CLASS_COLOR = { us_tech:C.blue, defensive:C.green, real_asset:C.gold, crypto:C.purple, cyclical:C.amber, cash:C.textDim };
const SECURITY_TYPES    = ["EQUITY","ETF","MUTUAL_FUND","CRYPTO","CASH"];
const FX_USD_DEFAULT    = 1.3780;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const safe  = n => (isNaN(n) || n == null) ? 0 : Number(n);
const $F    = n => new Intl.NumberFormat("en-CA", { style:"currency", currency:"CAD", maximumFractionDigits:2 }).format(safe(n));
const $Pct  = n => `${safe(n).toFixed(2)}%`;
const $RPct = r => r == null || !isFinite(r) ? "—" : `${r >= 0 ? "+" : ""}${(r * 100).toFixed(2)}%`; // fraction → signed %
const pnlOf  = h => safe(h.market_value_cad) - safe(h.book_value_cad);
const pnlPctOf = h => safe(h.book_value_cad) > 0 ? (pnlOf(h) / safe(h.book_value_cad)) * 100 : 0;
const acctLabel = a => a ? `${a.broker} — ${a.account_type} (${a.account_number_masked || "—"})` : "—";

// ─── PERFORMANCE / RETURN MATH ────────────────────────────────────────────────
// All guarded against NaN/Infinity. Callers render "—" when a figure is null.
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function monthShort(monthKey) {
  if (!monthKey) return "—";
  const d = new Date(monthKey);
  if (isNaN(d.getTime())) return "—";
  return `${MONTHS_SHORT[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
}
function monthLong(monthKey) {
  if (!monthKey) return "—";
  const d = new Date(monthKey);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });
}
function daysBetween(a, b) {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return isNaN(ms) ? 0 : Math.round(ms / 86400000);
}
function sortSnaps(arr) {
  return [...(arr || [])].sort((a, b) => new Date(a.snapshot_month) - new Date(b.snapshot_month));
}
// Modified Dietz period return: (EMV - BMV - F) / (BMV + 0.5*F). Returns null if denom ~0.
function periodReturn(bmv, emv, f) {
  const denom = safe(bmv) + 0.5 * safe(f);
  if (!isFinite(denom) || Math.abs(denom) < 1e-9) return null;
  const r = (safe(emv) - safe(bmv) - safe(f)) / denom;
  return isFinite(r) ? r : null;
}
// Chain-link an array of period returns: Π(1+r) - 1. Ignores nulls.
function chainLink(returns) {
  const clean = returns.filter(r => r != null && isFinite(r));
  if (!clean.length) return null;
  return clean.reduce((acc, r) => acc * (1 + r), 1) - 1;
}
// Window boundary for a period selector. Returns a Date; "all" → epoch.
function periodBoundary(period, lastMonthKey) {
  const last = new Date(lastMonthKey);
  if (isNaN(last.getTime())) return new Date(0);
  const y = last.getUTCFullYear(), m = last.getUTCMonth();
  switch (period) {
    case "1m":  return new Date(Date.UTC(y, m - 1, 1));
    case "3m":  return new Date(Date.UTC(y, m - 3, 1));
    case "ytd": return new Date(Date.UTC(y, 0, 1));
    case "1y":  return new Date(Date.UTC(y - 1, m, 1));
    default:    return new Date(0);
  }
}
// Largest peak-to-trough drop (as a fraction, negative) across a market-value series.
function maxDrawdown(values) {
  if (!values || values.length < 3) return null;
  let peak = values[0], worst = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = (v - peak) / peak;
      if (dd < worst) worst = dd;
    }
  }
  return worst; // <= 0
}
// Core metrics for the snapshot series + selected period window.
function computeSnapshotMetrics(allSnaps, period) {
  const s = sortSnaps(allSnaps);
  const firstDate = s[0]?.snapshot_month || null;
  const lastDate  = s[s.length - 1]?.snapshot_month || null;
  if (s.length < 2) {
    return { enough: false, count: s.length, firstDate, lastDate, chartData: [], hasBenchmark: false };
  }

  // ── Selected-period window (include the anchor just before the boundary) ──
  let win = s;
  if (period && period !== "all") {
    const boundary = periodBoundary(period, lastDate);
    const after  = s.filter(x => new Date(x.snapshot_month) >= boundary);
    const before = s.filter(x => new Date(x.snapshot_month) <  boundary);
    win = before.length ? [before[before.length - 1], ...after] : after;
  }

  // ── Period (window) return — chain-linked Modified Dietz ──
  const winReturns = [];
  for (let i = 1; i < win.length; i++) {
    winReturns.push(periodReturn(win[i - 1].total_market_cad, win[i].total_market_cad, win[i].net_contributions));
  }
  const periodRet = win.length >= 2 ? chainLink(winReturns) : null;

  // ── Cumulative since first snapshot (whole series) ──
  const allReturns = [];
  for (let i = 1; i < s.length; i++) {
    allReturns.push(periodReturn(s[i - 1].total_market_cad, s[i].total_market_cad, s[i].net_contributions));
  }
  const cumulativeRet = chainLink(allReturns);

  // ── Annualized (lifetime; only meaningful past 90 days) ──
  const lifeDays = daysBetween(firstDate, lastDate);
  let annualized = null;
  if (lifeDays >= 90 && cumulativeRet != null && (1 + cumulativeRet) > 0) {
    const a = Math.pow(1 + cumulativeRet, 365 / lifeDays) - 1;
    annualized = isFinite(a) ? a : null;
  }

  // ── Max drawdown (window) ──
  const dd = maxDrawdown(win.map(x => safe(x.total_market_cad)));

  // ── Chart data (window) with optional normalized benchmark overlay ──
  const benchBaseRow = win.find(x => x.benchmark_value != null && safe(x.benchmark_value) > 0);
  const hasBenchmark = !!benchBaseRow;
  const baseBench  = benchBaseRow ? safe(benchBaseRow.benchmark_value) : 0;
  const baseMarket = benchBaseRow ? safe(benchBaseRow.total_market_cad) : 0;
  const chartData = win.map(x => ({
    label:   monthShort(x.snapshot_month),
    month:   x.snapshot_month,
    market:  Math.round(safe(x.total_market_cad)),
    benchmark: hasBenchmark && x.benchmark_value != null && baseBench > 0
      ? Math.round(safe(x.benchmark_value) / baseBench * baseMarket)
      : null,
  }));

  return {
    enough: true, count: s.length, firstDate, lastDate, lifeDays,
    periodRet, cumulativeRet, annualized, maxDrawdown: dd,
    chartData, hasBenchmark,
  };
}

// ─── VERIFIED UPSERT ─────────────────────────────────────────────────────────
// Write → select back → spot-check → throw on mismatch. Never leaves UI showing uncommitted data.
async function verifiedUpsert(table, record, conflictCols) {
  const { data, error } = await sb
    .from(table)
    .upsert(record, { onConflict: conflictCols })
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No row returned after upsert — write may not have committed");
  // Spot-check numeric fields
  for (const [k, v] of Object.entries(record)) {
    if (typeof v === "number" && k !== "updated_at") {
      if (data[k] == null || Math.abs(safe(data[k]) - v) > 0.01) {
        throw new Error(`Verification mismatch on ${k}: sent ${v}, got ${data[k]}`);
      }
    }
  }
  return data;
}

// ─── CSV PARSERS ─────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === "," && !inQ) { result.push(cur.trim()); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}
function parseWealthsimpleCSV(text, accountId) {
  const lines = text.split("\n").filter(l => l.trim());
  const header = parseCSVLine(lines[0]).map(h => h.replace(/"/g,"").trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length < 5) continue;
    const row = {};
    header.forEach((h, idx) => { row[h] = (vals[idx] || "").replace(/"/g,"").trim(); });
    const qty   = parseFloat(row["Quantity"]    || "0");
    const price = parseFloat(row["Market Price"] || "0");
    const book  = parseFloat((row["Book Value (CAD)"] || "0").replace(/,/g,""));
    const mkv   = parseFloat((row["Market Value"] || "0").replace(/,/g,""));
    const cur   = (row["Market Price Currency"] || "CAD").toUpperCase();
    const sym   = (row["Symbol"] || "").toUpperCase();
    if (!sym || !qty) continue;
    const isCAD = cur === "CAD";
    const fx    = isCAD ? 1 : FX_USD_DEFAULT;
    const acType = (row["Account Type"] || "").toLowerCase();
    const assetClass = acType === "crypto" ? "crypto" : "us_tech"; // default; user can edit after import
    rows.push({
      account_id:      accountId,
      symbol:          sym,
      name:            row["Name"] || sym,
      security_type:   (row["Security Type"] || "EQUITY").toUpperCase(),
      asset_class:     assetClass,
      quantity:        qty,
      avg_cost:        null,
      price_currency:  cur,
      market_price:    price,
      fx_rate:         fx,
      book_value_cad:  book,
      market_value_cad: isCAD ? qty * price : mkv,
    });
  }
  return rows;
}
function parseTDDirectCSV(text, accountId) {
  const lines = text.split("\n").filter(l => l.trim());
  const header = parseCSVLine(lines[0]).map(h => h.replace(/"/g,"").trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length < 4) continue;
    const row = {};
    header.forEach((h, idx) => { row[h] = (vals[idx] || "").replace(/"/g,"").trim(); });
    const sym   = (row["Symbol"] || "").toUpperCase();
    const qty   = parseFloat(row["Quantity"] || "0");
    const avgC  = parseFloat(row["Average Cost"] || "0");
    const price = parseFloat(row["Price"] || "0");
    const book  = parseFloat((row["Book Cost"] || "0").replace(/,/g,""));
    const mkv   = parseFloat((row["Market Value"] || "0").replace(/,/g,""));
    if (!sym || !qty) continue;
    rows.push({
      account_id:       accountId,
      symbol:           sym,
      name:             row["Description"] || sym,
      security_type:    "MUTUAL_FUND",
      asset_class:      "us_tech",
      quantity:         qty,
      avg_cost:         avgC || null,
      price_currency:   "CAD",
      market_price:     price,
      fx_rate:          1,
      book_value_cad:   book,
      market_value_cad: mkv || qty * price,
    });
  }
  return rows;
}

// ─── POSITION FORM (shared by Add + Edit) ────────────────────────────────────
const EMPTY_FORM = {
  account_id:"", symbol:"", name:"", security_type:"EQUITY", asset_class:"us_tech",
  quantity:"", avg_cost:"", price_currency:"CAD", market_price:"", fx_rate:"1",
  book_value_cad:"",
};
function PositionForm({ accounts, initial, onSave, onCancel, saving }) {
  const [f, setF] = useState({ ...EMPTY_FORM, ...initial });
  const set = (k, v) => setF(prev => {
    const next = { ...prev, [k]: v };
    if (k === "price_currency") next.fx_rate = v === "USD" ? String(FX_USD_DEFAULT) : "1";
    return next;
  });
  const mktCadCalc = safe(f.quantity) * safe(f.market_price) * safe(f.fx_rate || 1);
  const inp = (k, opts = {}) => (
    <input value={f[k] ?? ""} onChange={e => set(k, e.target.value)}
      style={{ width:"100%", padding:"8px 10px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, fontSize:13, fontFamily:C.sans, outline:"none", ...opts.style }}
      {...opts} />
  );
  const sel = (k, options) => (
    <select value={f[k] ?? ""} onChange={e => set(k, e.target.value)}
      style={{ width:"100%", padding:"8px 10px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, fontSize:13, fontFamily:C.sans, outline:"none", cursor:"pointer" }}>
      {options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  const row = (label, children) => (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4, fontWeight:600 }}>{label}</div>
      {children}
    </div>
  );
  return (
    <div>
      {row("Account", sel("account_id", accounts.map(a => [a.id, acctLabel(a)])))}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:10 }}>
        <div>{row("Symbol", inp("symbol", { placeholder:"e.g. VFV" }))}</div>
        <div>{row("Name",   inp("name",   { placeholder:"Display name" }))}</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div>{row("Type",       sel("security_type", SECURITY_TYPES.map(t => [t,t])))}</div>
        <div>{row("Asset class", sel("asset_class", ASSET_CLASSES.map(c => [c, ASSET_CLASS_LABEL[c]])))}</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div>{row("Currency", sel("price_currency", [["CAD","CAD"],["USD","USD"]]))}</div>
        <div>{row("FX rate (→ CAD)", inp("fx_rate", { type:"number", step:"0.0001" }))}</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div>{row("Quantity", inp("quantity", { type:"number", step:"any" }))}</div>
        <div>{row("Avg cost (per unit)", inp("avg_cost", { type:"number", step:"any", placeholder:"Optional" }))}</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div>{row("Market price (native cur.)", inp("market_price", { type:"number", step:"any" }))}</div>
        <div>{row("Book value (CAD)", inp("book_value_cad", { type:"number", step:"any" }))}</div>
      </div>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", marginBottom:16 }}>
        <span style={{ fontSize:11, color:C.textDim }}>Market value (CAD) — computed: </span>
        <span style={{ fontFamily:C.mono, fontWeight:700, color:C.gold }}>{$F(mktCadCalc)}</span>
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={() => onSave(f, mktCadCalc)} disabled={saving || !f.account_id || !f.symbol || !f.quantity}
          style={{ flex:1, padding:"10px 0", background:saving ? C.border : C.gold, color:"#0C1520", border:"none", borderRadius:8, fontWeight:700, fontSize:13, cursor:saving?"not-allowed":"pointer", opacity:saving?0.7:1 }}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel}
          style={{ padding:"10px 20px", background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.textDim, fontSize:13, cursor:"pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── SNAPSHOT FORM (historical backfill + edit contributions/benchmark) ───────
function SnapshotForm({ initial, isEdit, onSave, onCancel, saving }) {
  const [f, setF] = useState({
    month:             initial?.snapshot_month ? String(initial.snapshot_month).slice(0, 7) : new Date().toISOString().slice(0, 7),
    total_market_cad:  initial?.total_market_cad != null ? String(initial.total_market_cad) : "",
    net_contributions: initial?.net_contributions != null ? String(initial.net_contributions) : "0",
    benchmark_value:   initial?.benchmark_value != null ? String(initial.benchmark_value) : "",
  });
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const lbl = t => <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4, fontWeight:600 }}>{t}</div>;
  const inpStyle = { width:"100%", minHeight:44, padding:"8px 10px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, fontSize:13, fontFamily:C.sans, outline:"none", boxSizing:"border-box" };
  return (
    <div>
      <div style={{ marginBottom:12 }}>
        {lbl("Month")}
        <input type="month" value={f.month} disabled={isEdit} onChange={e => set("month", e.target.value)}
          style={{ ...inpStyle, opacity:isEdit?0.6:1, cursor:isEdit?"not-allowed":"text" }} />
      </div>
      <div style={{ marginBottom:12 }}>
        {lbl("Total market value (CAD)")}
        <input type="number" step="any" value={f.total_market_cad} onChange={e => set("total_market_cad", e.target.value)} placeholder="e.g. 42500" style={inpStyle} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div style={{ marginBottom:12 }}>
          {lbl("Net contributions")}
          <input type="number" step="any" value={f.net_contributions} onChange={e => set("net_contributions", e.target.value)} style={inpStyle} />
        </div>
        <div style={{ marginBottom:12 }}>
          {lbl("Benchmark (optional)")}
          <input type="number" step="any" value={f.benchmark_value} onChange={e => set("benchmark_value", e.target.value)} placeholder="VFV / S&P level" style={inpStyle} />
        </div>
      </div>
      <div style={{ fontSize:10, color:C.textDim, lineHeight:1.6, marginBottom:16 }}>
        Net contributions = deposits (+) / withdrawals (−) during the month. Keeping it accurate stops returns from being distorted by cash flows.
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={() => onSave(f)} disabled={saving || !f.total_market_cad}
          style={{ flex:1, minHeight:44, background:saving?C.border:C.gold, color:"#0C1520", border:"none", borderRadius:8, fontWeight:700, fontSize:13, cursor:saving?"not-allowed":"pointer", opacity:saving?0.7:1 }}>
          {saving ? "Saving…" : "Save snapshot"}
        </button>
        <button onClick={onCancel}
          style={{ minHeight:44, padding:"0 20px", background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.textDim, fontSize:13, cursor:"pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── MODAL SHELL ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"24px 28px", width:"100%", maxWidth:width, maxHeight:"90vh", overflowY:"auto", boxShadow:C.shadowMd }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <span style={{ fontSize:15, fontWeight:700, color:C.text }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.textDim, cursor:"pointer", fontSize:20, lineHeight:1, padding:"0 2px" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── SECURITIES VIEW ─────────────────────────────────────────────────────────
export default function SecuritiesView({ onBack, individualId, onDerivedUpdate, onMonthLogged }) {
  const [accounts,  setAccounts]  = useState([]);
  const [holdings,  setHoldings]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Monthly snapshot state
  const CURRENT_YM        = new Date().toISOString().slice(0, 7);
  const CURRENT_MONTH_KEY = CURRENT_YM + "-01";
  const CURRENT_MONTH_LABEL = new Date().toLocaleString("en-CA", { month: "long", year: "numeric" });
  const [currentMonthSnap, setCurrentMonthSnap] = useState(null);
  const [snapLoading,      setSnapLoading]       = useState(false);

  // Filters + sort
  const [filterAccount,  setFilterAccount]  = useState("all");
  const [filterClass,    setFilterClass]    = useState("all");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [filterGainers,  setFilterGainers]  = useState("all");
  const [sortField, setSortField] = useState("market_value_cad");
  const [sortDir,   setSortDir]   = useState(-1);

  // Interaction modes
  const [priceMode,   setPriceMode]   = useState(false);
  const [priceEdits,  setPriceEdits]  = useState({});
  const [priceSaving, setPriceSaving] = useState(false);
  const [addModal,    setAddModal]    = useState(false);
  const [addSaving,   setAddSaving]   = useState(false);
  const [editModal,   setEditModal]   = useState(null);
  const [editSaving,  setEditSaving]  = useState(false);
  const [csvStep,    setCsvStep]    = useState(null);
  const [csvTarget,  setCsvTarget]  = useState("all");
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvSaving,  setCsvSaving]  = useState(false);

  // Performance / snapshots
  const [snapshots,  setSnapshots]  = useState([]);   // full history (asc by month)
  const [perfPeriod, setPerfPeriod] = useState("all"); // 1m · 3m · ytd · 1y · all
  const [backfill,   setBackfill]   = useState(null);  // null | {} (new) | snapshotRow (edit)
  const [backfillSaving, setBackfillSaving] = useState(false);

  // Mobile UI state
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [mobileMenu,  setMobileMenu]  = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isMobile = vw <= 640;

  // Keep a ref so loadData doesn't re-create every time the inline callback changes
  const onDerivedUpdateRef = useRef(onDerivedUpdate);
  useEffect(() => { onDerivedUpdateRef.current = onDerivedUpdate; });

  // ── Toast ──
  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  }

  // ── Load ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: accts, error: e1 } = await sb
        .from("investment_accounts").select("*")
        .eq("individual_id", individualId).order("created_at");
      if (e1) throw new Error(e1.message);

      const ids = (accts || []).map(a => a.id);
      const { data: hlds, error: e2 } = ids.length
        ? await sb.from("securities_holdings").select("*").in("account_id", ids).order("market_value_cad", { ascending: false })
        : { data: [], error: null };
      if (e2) throw new Error(e2.message);

      setAccounts(accts || []);
      setHoldings(hlds  || []);
      setLastUpdated(new Date());

      if (onDerivedUpdateRef.current) {
        const sec = (hlds || []).filter(h => !["crypto","cash"].includes(h.asset_class)).reduce((s,h) => s + safe(h.market_value_cad), 0);
        const cry = (hlds || []).filter(h => h.asset_class === "crypto").reduce((s,h) => s + safe(h.market_value_cad), 0);
        onDerivedUpdateRef.current(Math.round(sec), Math.round(cry));
      }

      // Load full snapshot history (asc); derive current-month flag from it
      const { data: snaps } = await sb
        .from("securities_snapshots")
        .select("*")
        .eq("individual_id", individualId)
        .order("snapshot_month", { ascending: true });
      const history = sortSnaps(snaps || []);
      setSnapshots(history);
      setCurrentMonthSnap(history.find(x => x.snapshot_month === CURRENT_MONTH_KEY) || null);
      return { accts: accts || [], hlds: hlds || [], history };
    } catch (e) {
      showToast("Load failed: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [individualId, CURRENT_MONTH_KEY]); // onDerivedUpdate intentionally excluded — accessed via ref

  useEffect(() => { loadData(); }, [loadData]);

  // ── Snapshot capture (verified write; preserves existing net_contributions/benchmark) ──
  // Used by both the manual "Log month" button and the auto-capture on price save.
  async function captureSnapshot({ holdingsList, snapshotsList } = {}) {
    const hl = holdingsList || holdings;
    const sn = snapshotsList || snapshots;
    if (!hl.length) return null;
    const total   = hl.reduce((s,h) => s + safe(h.market_value_cad), 0);
    const book    = hl.reduce((s,h) => s + safe(h.book_value_cad),   0);
    const byClass = {};
    hl.forEach(h => { byClass[h.asset_class] = (byClass[h.asset_class] || 0) + safe(h.market_value_cad); });
    const existing = sn.find(x => x.snapshot_month === CURRENT_MONTH_KEY);
    const record = {
      ...(existing ? { id: existing.id } : {}),
      individual_id:     individualId,
      snapshot_month:    CURRENT_MONTH_KEY,
      total_market_cad:  Math.round(total * 100) / 100,
      total_book_cad:    Math.round(book  * 100) / 100,
      allocation_json:   byClass,
      net_contributions: safe(existing?.net_contributions), // preserved; AJ edits separately
      snapshot_date:     new Date().toISOString().split("T")[0],
    };
    // benchmark_value intentionally omitted so an existing value is preserved on update
    const saved = await verifiedUpsert("securities_snapshots", record, existing ? "id" : "individual_id,snapshot_month");
    return { saved, total };
  }

  // ── Log month (manual) ──
  async function handleLogMonth() {
    setSnapLoading(true);
    try {
      const res = await captureSnapshot();
      if (!res) { showToast("Nothing to log — no positions yet", "error"); return; }
      await loadData();
      showToast(`${CURRENT_MONTH_LABEL} logged — ${$F(res.total)}`);
      if (onMonthLogged) onMonthLogged(CURRENT_YM);
    } catch (e) {
      showToast("Log failed: " + e.message, "error");
    } finally {
      setSnapLoading(false);
    }
  }

  // ── Historical backfill / edit a snapshot's contributions + benchmark ──
  async function handleBackfillSave(form) {
    setBackfillSaving(true);
    try {
      const monthKey = form.month && form.month.length === 7 ? form.month + "-01" : form.month;
      if (!monthKey || isNaN(new Date(monthKey).getTime())) throw new Error("Pick a valid month");
      const existing = snapshots.find(x => x.snapshot_month === monthKey);
      const record = {
        ...(existing ? { id: existing.id } : {}),
        individual_id:     individualId,
        snapshot_month:    monthKey,
        total_market_cad:  Math.round(safe(form.total_market_cad) * 100) / 100,
        total_book_cad:    existing ? safe(existing.total_book_cad) : Math.round(safe(form.total_market_cad) * 100) / 100,
        net_contributions: Math.round(safe(form.net_contributions) * 100) / 100,
        benchmark_value:   form.benchmark_value === "" || form.benchmark_value == null ? null : safe(form.benchmark_value),
        snapshot_date:     monthKey,
      };
      if (existing && existing.allocation_json) record.allocation_json = existing.allocation_json;
      await verifiedUpsert("securities_snapshots", record, existing ? "id" : "individual_id,snapshot_month");
      await loadData();
      setBackfill(null);
      showToast(`${monthLong(monthKey)} snapshot saved`);
    } catch (e) {
      showToast("Snapshot save failed: " + e.message, "error");
    } finally {
      setBackfillSaving(false);
    }
  }

  // ── Derived / Memoised ──
  const derived = useMemo(() => {
    const marketTotal = holdings.reduce((s,h) => s + safe(h.market_value_cad), 0);
    const bookTotal   = holdings.reduce((s,h) => s + safe(h.book_value_cad),   0);
    const pnl         = marketTotal - bookTotal;
    const pnlPct      = bookTotal > 0 ? (pnl / bookTotal) * 100 : 0;

    // Allocation (non-cash)
    const byClass = {};
    holdings.filter(h => h.asset_class !== "cash").forEach(h => {
      byClass[h.asset_class] = (byClass[h.asset_class] || 0) + safe(h.market_value_cad);
    });
    const nonCashTotal = Object.values(byClass).reduce((s,v) => s + v, 0);

    // Concentration flags
    const flags = [];
    holdings.filter(h => h.asset_class !== "cash").forEach(h => {
      const pct = marketTotal > 0 ? safe(h.market_value_cad) / marketTotal * 100 : 0;
      if (pct > 10) flags.push({ level:"WATCH", symbol:h.symbol, pct, msg:`${h.symbol} = ${pct.toFixed(1)}% of total — single-position concentration` });
    });
    Object.entries(byClass).forEach(([cls, val]) => {
      const pct = marketTotal > 0 ? val / marketTotal * 100 : 0;
      if (pct > 50) flags.push({ level:"RISK", cls, pct, msg:`${ASSET_CLASS_LABEL[cls] || cls} sleeve = ${pct.toFixed(1)}% of total — sleeve concentration` });
    });

    // Filtered + sorted
    let filtered = [...holdings];
    if (filterAccount  !== "all") filtered = filtered.filter(h => h.account_id === filterAccount);
    if (filterClass    !== "all") filtered = filtered.filter(h => h.asset_class === filterClass);
    if (filterCurrency !== "all") filtered = filtered.filter(h => h.price_currency === filterCurrency);
    if (filterGainers  === "gainers") filtered = filtered.filter(h => pnlOf(h) > 0);
    if (filterGainers  === "losers")  filtered = filtered.filter(h => pnlOf(h) < 0);
    const sortVal = h => sortField === "pnl" ? pnlOf(h) : sortField === "pnlPct" ? pnlPctOf(h) : h[sortField];
    filtered.sort((a, b) => {
      const av = sortVal(a), bv = sortVal(b);
      if (typeof av === "string") return sortDir * av.localeCompare(bv ?? "");
      return sortDir * (safe(av) - safe(bv));
    });

    // Per-account market totals (non-cash)
    const perAccount = {};
    accounts.forEach(acc => {
      perAccount[acc.id] = holdings
        .filter(h => h.account_id === acc.id && h.asset_class !== "cash")
        .reduce((s,h) => s + safe(h.market_value_cad), 0);
    });

    // Movers (per-position return %, excluding cash & positions with no book basis)
    const ranked = holdings
      .filter(h => h.asset_class !== "cash" && safe(h.book_value_cad) > 0)
      .map(h => ({ symbol: h.symbol, name: h.name, pct: pnlPctOf(h), pnl: pnlOf(h) }))
      .sort((a, b) => b.pct - a.pct);
    const bestPosition  = ranked[0] || null;
    const worstPosition = ranked.length ? ranked[ranked.length - 1] : null;
    const topMovers     = ranked.slice(0, 3);
    const bottomMovers  = ranked.length > 3 ? ranked.slice(-3).reverse() : [];

    return { marketTotal, bookTotal, pnl, pnlPct, byClass, nonCashTotal, flags, filtered, perAccount,
             bestPosition, worstPosition, topMovers, bottomMovers };
  }, [holdings, accounts, filterAccount, filterClass, filterCurrency, filterGainers, sortField, sortDir]);

  // ── Performance metrics (recompute on snapshots / period change) ──
  const perf = useMemo(() => computeSnapshotMetrics(snapshots, perfPeriod), [snapshots, perfPeriod]);

  // ── Sort toggle ──
  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d * -1);
    else { setSortField(field); setSortDir(-1); }
  }
  const sortIcon = field => sortField === field ? (sortDir === -1 ? " ▾" : " ▴") : "";

  // ── Price update ──
  async function handlePriceSave() {
    if (!Object.keys(priceEdits).length) { setPriceMode(false); return; }
    setPriceSaving(true);
    const rollback = [...holdings];
    const freshHoldings = holdings.map(h => {
      if (priceEdits[h.id] === undefined) return h;
      const p = safe(priceEdits[h.id]);
      return { ...h, market_price: p, market_value_cad: safe(h.quantity) * p * safe(h.fx_rate || 1) };
    });
    setHoldings(freshHoldings);
    try {
      for (const [id, rawPrice] of Object.entries(priceEdits)) {
        const h = holdings.find(x => x.id === id);
        if (!h) continue;
        const newPrice   = safe(rawPrice);
        const newMktCad  = safe(h.quantity) * newPrice * safe(h.fx_rate || 1);
        await verifiedUpsert("securities_holdings", {
          id, market_price: newPrice, market_value_cad: newMktCad,
          updated_at: new Date().toISOString(),
        }, "id");
      }
      // Auto-capture: refresh the current month's snapshot in place with the new prices.
      try { await captureSnapshot({ holdingsList: freshHoldings, snapshotsList: snapshots }); }
      catch (snapErr) { /* prices already saved; snapshot refresh is best-effort */ }
      await loadData();
      setPriceMode(false);
      setPriceEdits({});
      const n = Object.keys(priceEdits).length;
      showToast(`${n} price${n > 1 ? "s" : ""} saved · ${CURRENT_MONTH_LABEL} snapshot updated`);
    } catch (e) {
      setHoldings(rollback);
      showToast("Price save failed: " + e.message, "error");
    } finally {
      setPriceSaving(false);
    }
  }

  // ── Add position ──
  async function handleAdd(form, mktCadCalc) {
    setAddSaving(true);
    try {
      await verifiedUpsert("securities_holdings", {
        account_id:       form.account_id,
        symbol:           form.symbol.toUpperCase().trim(),
        name:             form.name || form.symbol.toUpperCase().trim(),
        security_type:    form.security_type,
        asset_class:      form.asset_class,
        quantity:         safe(form.quantity),
        avg_cost:         form.avg_cost ? safe(form.avg_cost) : null,
        price_currency:   form.price_currency || "CAD",
        market_price:     safe(form.market_price),
        fx_rate:          safe(form.fx_rate || 1),
        book_value_cad:   safe(form.book_value_cad),
        market_value_cad: mktCadCalc,
        as_of_date:       new Date().toISOString().split("T")[0],
        updated_at:       new Date().toISOString(),
      }, "account_id,symbol");
      await loadData();
      setAddModal(false);
      showToast(`${form.symbol.toUpperCase()} added`);
    } catch (e) {
      showToast("Add failed: " + e.message, "error");
    } finally {
      setAddSaving(false);
    }
  }

  // ── Edit position ──
  async function handleEdit(id, form, mktCadCalc) {
    setEditSaving(true);
    const rollback = [...holdings];
    setHoldings(prev => prev.map(h => h.id === id ? { ...h, ...form, market_value_cad: mktCadCalc } : h));
    try {
      await verifiedUpsert("securities_holdings", {
        id,
        symbol:           form.symbol.toUpperCase().trim(),
        name:             form.name,
        security_type:    form.security_type,
        asset_class:      form.asset_class,
        quantity:         safe(form.quantity),
        avg_cost:         form.avg_cost ? safe(form.avg_cost) : null,
        price_currency:   form.price_currency,
        market_price:     safe(form.market_price),
        fx_rate:          safe(form.fx_rate || 1),
        book_value_cad:   safe(form.book_value_cad),
        market_value_cad: mktCadCalc,
        updated_at:       new Date().toISOString(),
      }, "id");
      await loadData();
      setEditModal(null);
      showToast("Position updated");
    } catch (e) {
      setHoldings(rollback);
      showToast("Update failed: " + e.message, "error");
    } finally {
      setEditSaving(false);
    }
  }

  // ── CSV import ──
  function handleCSVFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result || "";
      try {
        const targetAccount = accounts.find(a => a.id === csvTarget) || accounts[0];
        if (!targetAccount) throw new Error("Select an account first");
        let rows;
        if (text.includes("Market Price Currency") || text.includes("Account Type")) {
          rows = parseWealthsimpleCSV(text, targetAccount.id);
        } else {
          rows = parseTDDirectCSV(text, targetAccount.id);
        }
        // Diff against existing holdings for this account
        const existing = holdings.filter(h => h.account_id === targetAccount.id);
        const preview = rows.map(r => {
          const ex = existing.find(h => h.symbol === r.symbol);
          if (!ex) return { ...r, _status:"new", _existingId: null };
          const changed =
            Math.abs(safe(ex.quantity)     - safe(r.quantity))     > 0.00001 ||
            Math.abs(safe(ex.market_price) - safe(r.market_price)) > 0.001;
          return { ...r, _status: changed ? "changed" : "unchanged", _existingId: ex.id };
        });
        setCsvPreview(preview);
        setCsvStep("preview");
      } catch (err) {
        showToast("CSV parse error: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  }

  async function handleCSVConfirm() {
    const toImport = csvPreview.filter(r => r._status !== "unchanged");
    if (!toImport.length) { showToast("Nothing to import (all unchanged)"); setCsvStep(null); return; }
    setCsvSaving(true);
    try {
      for (const row of toImport) {
        const mktCadVal = safe(row.quantity) * safe(row.market_price) * safe(row.fx_rate || 1);
        const record = {
          ...(row._existingId ? { id: row._existingId } : {}),
          account_id:       row.account_id,
          symbol:           row.symbol,
          name:             row.name,
          security_type:    row.security_type || "EQUITY",
          asset_class:      row.asset_class   || "us_tech",
          quantity:         safe(row.quantity),
          avg_cost:         row.avg_cost ? safe(row.avg_cost) : null,
          price_currency:   row.price_currency || "CAD",
          market_price:     safe(row.market_price),
          fx_rate:          safe(row.fx_rate || 1),
          book_value_cad:   safe(row.book_value_cad),
          market_value_cad: mktCadVal,
          updated_at:       new Date().toISOString(),
        };
        await verifiedUpsert("securities_holdings", record, row._existingId ? "id" : "account_id,symbol");
      }
      await loadData();
      setCsvStep(null);
      setCsvPreview([]);
      showToast(`Imported ${toImport.length} position${toImport.length > 1 ? "s" : ""}`);
    } catch (e) {
      showToast("Import failed: " + e.message, "error");
    } finally {
      setCsvSaving(false);
    }
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  const { marketTotal, bookTotal, pnl, pnlPct, byClass, nonCashTotal, flags, filtered, perAccount,
          bestPosition, worstPosition, topMovers, bottomMovers } = derived;
  const PERIODS = [["1m","1M"],["3m","3M"],["ytd","YTD"],["1y","1Y"],["all","All"]];
  const activeFilterCount = [filterAccount, filterClass, filterCurrency, filterGainers].filter(v => v !== "all").length;

  const SortTh = ({ field, children, right }) => (
    <th onClick={() => toggleSort(field)} style={{ padding:"10px 12px", fontSize:9, fontWeight:700, color:sortField===field?C.gold:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer", whiteSpace:"nowrap", textAlign:right?"right":"left", userSelect:"none" }}>
      {children}{sortIcon(field)}
    </th>
  );

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, fontFamily:C.sans }}>

      {/* ── NAV (desktop) ── */}
      {!isMobile && (
      <div style={{ background:C.nav, borderBottom:`1px solid ${C.navBorder}`, padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", height:56, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <button onClick={onBack} style={{ background:"transparent", border:`1px solid rgba(255,255,255,0.12)`, borderRadius:6, color:C.navText, fontSize:11, padding:"5px 12px", cursor:"pointer", whiteSpace:"nowrap" }}>
            ← Individuals
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:13, fontWeight:700, color:C.text }}>AJ</span>
            <span style={{ fontSize:11, color:C.textDim }}>· Portfolio</span>
          </div>
          {lastUpdated && (
            <span style={{ fontSize:9, color:C.textDim }}>
              updated {lastUpdated.toLocaleTimeString("en-CA", { hour:"2-digit", minute:"2-digit" })}
            </span>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={() => { setCsvTarget(accounts[0]?.id || "all"); setCsvStep("upload"); }}
            style={{ fontSize:10, background:"transparent", border:`1px solid rgba(255,255,255,0.12)`, borderRadius:6, color:C.navText, padding:"4px 10px", cursor:"pointer" }}>
            Import CSV
          </button>
          {!priceMode
            ? <button onClick={() => { setPriceMode(true); setPriceEdits({}); }}
                style={{ fontSize:10, background:C.goldLight, border:`1px solid rgba(201,168,76,0.3)`, borderRadius:6, color:C.goldText, padding:"4px 10px", cursor:"pointer", fontWeight:600 }}>
                Update prices
              </button>
            : <>
                <button onClick={handlePriceSave} disabled={priceSaving}
                  style={{ fontSize:10, background:C.green, border:"none", borderRadius:6, color:"#fff", padding:"4px 12px", cursor:priceSaving?"not-allowed":"pointer", fontWeight:700, opacity:priceSaving?0.6:1 }}>
                  {priceSaving ? "Saving…" : "Save prices"}
                </button>
                <button onClick={() => { setPriceMode(false); setPriceEdits({}); }}
                  style={{ fontSize:10, background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.textDim, padding:"4px 10px", cursor:"pointer" }}>
                  Cancel
                </button>
              </>
          }
          <button onClick={() => setAddModal(true)}
            style={{ fontSize:10, background:C.goldLight, border:`1px solid rgba(201,168,76,0.3)`, borderRadius:6, color:C.goldText, padding:"4px 10px", cursor:"pointer", fontWeight:600 }}>
            + Position
          </button>
          {/* Monthly log button */}
          {currentMonthSnap
            ? <span style={{ fontSize:10, color:C.greenText, fontWeight:700, whiteSpace:"nowrap" }}>✓ {CURRENT_MONTH_LABEL}</span>
            : <button onClick={handleLogMonth} disabled={snapLoading || loading || !holdings.length}
                style={{ fontSize:10, background:C.gold, border:"none", borderRadius:6, color:"#0C1520", padding:"4px 12px", cursor:snapLoading?"not-allowed":"pointer", fontWeight:700, opacity:snapLoading?0.7:1, whiteSpace:"nowrap" }}>
                {snapLoading ? "Logging…" : `Log ${CURRENT_MONTH_LABEL}`}
              </button>
          }
        </div>
      </div>
      )}

      {/* ── NAV (mobile): sticky, total always visible, actions in ⋯ menu ── */}
      {isMobile && (
      <div style={{ background:C.nav, borderBottom:`1px solid ${C.navBorder}`, padding:"8px 12px", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
            <button onClick={onBack} aria-label="Back to individuals"
              style={{ width:44, height:44, flexShrink:0, background:"transparent", border:`1px solid rgba(255,255,255,0.12)`, borderRadius:8, color:C.navText, fontSize:18, cursor:"pointer" }}>←</button>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.text, whiteSpace:"nowrap" }}>AJ · Portfolio</div>
              <div style={{ fontSize:14, fontFamily:C.mono, fontWeight:800, color:C.gold, lineHeight:1.2 }}>{$F(marketTotal)}</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            {priceMode ? (
              <>
                <button onClick={handlePriceSave} disabled={priceSaving}
                  style={{ minWidth:64, height:44, background:C.green, border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, cursor:priceSaving?"not-allowed":"pointer", opacity:priceSaving?0.6:1 }}>
                  {priceSaving ? "…" : "Save"}
                </button>
                <button onClick={() => { setPriceMode(false); setPriceEdits({}); }} aria-label="Cancel"
                  style={{ width:44, height:44, background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, color:C.textDim, fontSize:16, cursor:"pointer" }}>✕</button>
              </>
            ) : (
              <>
                <button onClick={() => setAddModal(true)} aria-label="Add position"
                  style={{ width:44, height:44, background:C.goldLight, border:`1px solid rgba(201,168,76,0.3)`, borderRadius:8, color:C.goldText, fontSize:22, fontWeight:700, lineHeight:1, cursor:"pointer" }}>+</button>
                <button onClick={() => setMobileMenu(m => !m)} aria-label="More actions"
                  style={{ width:44, height:44, background:"transparent", border:`1px solid rgba(255,255,255,0.12)`, borderRadius:8, color:C.navText, fontSize:20, cursor:"pointer" }}>⋯</button>
              </>
            )}
          </div>
        </div>
        {mobileMenu && !priceMode && (
          <>
            <div onClick={() => setMobileMenu(false)} style={{ position:"fixed", inset:0, zIndex:115 }} />
            <div style={{ position:"absolute", right:12, top:64, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, boxShadow:C.shadowMd, zIndex:120, minWidth:210, overflow:"hidden" }}>
              {[
                { label:"Update prices", onClick:() => { setPriceMode(true); setPriceEdits({}); setMobileMenu(false); } },
                { label:"Import CSV",    onClick:() => { setCsvTarget(accounts[0]?.id || "all"); setCsvStep("upload"); setMobileMenu(false); } },
                currentMonthSnap
                  ? { label:`✓ ${CURRENT_MONTH_LABEL} logged`, onClick:() => setMobileMenu(false), done:true }
                  : { label:`Log ${CURRENT_MONTH_LABEL}`, onClick:() => { setMobileMenu(false); handleLogMonth(); }, disabled:!holdings.length },
                { label:"+ Add historical snapshot", onClick:() => { setBackfill({}); setMobileMenu(false); } },
              ].map((it,i,arr) => (
                <button key={i} onClick={it.onClick} disabled={it.disabled}
                  style={{ display:"block", width:"100%", minHeight:48, textAlign:"left", padding:"0 16px", background:"none",
                    border:"none", borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none",
                    color:it.done?C.greenText:it.disabled?C.textDim:C.text, fontSize:13, fontWeight:600,
                    cursor:it.disabled?"not-allowed":"pointer", opacity:it.disabled?0.5:1 }}>
                  {it.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      )}

      {loading && (
        <div style={{ padding:48, textAlign:"center", color:C.textDim, fontSize:13 }}>Loading portfolio…</div>
      )}

      {!loading && (
        <div style={{ padding:isMobile?"16px 14px":"24px 28px", paddingBottom:`calc(${isMobile?32:40}px + env(safe-area-inset-bottom))`, maxWidth:1300, margin:"0 auto" }}>

          {/* ── NOT-LOGGED BANNER ── */}
          {!currentMonthSnap && holdings.length > 0 && (
            <div style={{ background:C.amberLight, border:`1px solid rgba(230,168,23,0.35)`, borderLeft:`4px solid ${C.amber}`, borderRadius:8, padding:"10px 16px", marginBottom:16, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:C.amberText }}>📅 {CURRENT_MONTH_LABEL} not logged yet</div>
                <div style={{ fontSize:11, color:C.amberText, opacity:0.85, marginTop:2 }}>Update prices if needed, then click "Log {CURRENT_MONTH_LABEL}" to commit the snapshot.</div>
              </div>
              <button onClick={handleLogMonth} disabled={snapLoading}
                style={{ fontSize:11, background:C.amber, border:"none", borderRadius:6, color:"#0C1520", padding:"7px 16px", cursor:snapLoading?"not-allowed":"pointer", fontWeight:700, flexShrink:0, opacity:snapLoading?0.7:1 }}>
                {snapLoading ? "Logging…" : `Log ${CURRENT_MONTH_LABEL}`}
              </button>
            </div>
          )}

          {/* ── METRIC CARDS ── */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))", gap:12, marginBottom:20 }}>
            {[
              { label:"Market Value",     val:$F(marketTotal), color:C.gold,                    sub:`${accounts.length} account${accounts.length!==1?"s":""}` },
              { label:"Book Value",       val:$F(bookTotal),   color:C.text,                    sub:"Total cost basis" },
              { label:"Unrealized P&L",   val:$F(pnl),         color:pnl>=0?C.green:C.red,      sub:$Pct(pnlPct) + (pnl>=0?" gain":" loss") },
              { label:"Positions",        val:String(holdings.filter(h=>h.asset_class!=="cash").length), color:C.text, sub:`incl. ${Object.keys(byClass).length} asset classes` },
              { label:"Accounts",         val:String(accounts.length), color:C.text,            sub:"Across brokers" },
            ].map((k,i) => (
              <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 18px", boxShadow:C.shadow }}>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:"0.10em", textTransform:"uppercase", marginBottom:8, fontWeight:600 }}>{k.label}</div>
                <div style={{ fontFamily:C.mono, fontSize:20, fontWeight:800, color:k.color, letterSpacing:-0.5 }}>{k.val}</div>
                <div style={{ fontSize:10, color:C.textDim, marginTop:4 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* ── CONCENTRATION FLAGS ── */}
          {flags.length > 0 && (
            <div style={{ marginBottom:20 }}>
              {flags.map((f,i) => (
                <div key={i} style={{ background:f.level==="RISK"?C.redLight:C.amberLight, border:`1px solid ${f.level==="RISK"?"rgba(224,85,85,0.35)":"rgba(230,168,23,0.35)"}`, borderLeft:`4px solid ${f.level==="RISK"?C.red:C.amber}`, borderRadius:8, padding:"10px 16px", marginBottom:6, display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:13 }}>{f.level==="RISK"?"⚠":"◈"}</span>
                  <span style={{ fontSize:12, color:f.level==="RISK"?C.redText:C.amberText, fontWeight:600 }}>{f.msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── ALLOCATION PANEL ── */}
          {Object.keys(byClass).length > 0 && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"18px 20px", marginBottom:20, boxShadow:C.shadow }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.10em", textTransform:"uppercase", marginBottom:14 }}>Allocation by asset class</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12 }}>
                {Object.entries(byClass).sort(([,a],[,b]) => b-a).map(([cls,val]) => {
                  const pct = nonCashTotal > 0 ? val / nonCashTotal * 100 : 0;
                  const totalPct = marketTotal > 0 ? val / marketTotal * 100 : 0;
                  const color = ASSET_CLASS_COLOR[cls] || C.textDim;
                  return (
                    <div key={cls}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontSize:11, color:C.text, fontWeight:600 }}>{ASSET_CLASS_LABEL[cls] || cls}</span>
                        <span style={{ fontFamily:C.mono, fontSize:11, color }}>
                          {$F(val)} <span style={{ color:C.textDim }}>({totalPct.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div style={{ height:6, background:C.border, borderRadius:3, overflow:"hidden" }}>
                        <div style={{ width:`${Math.min(100,pct)}%`, height:"100%", background:color, borderRadius:3, transition:"width 0.4s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── PERFORMANCE ── */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:isMobile?"16px 14px":"18px 20px", marginBottom:20, boxShadow:C.shadow }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:"0.10em", textTransform:"uppercase" }}>Performance</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {PERIODS.map(([v,l]) => (
                  <button key={v} onClick={() => setPerfPeriod(v)}
                    style={{ minHeight:isMobile?36:28, padding:isMobile?"0 14px":"4px 11px", fontSize:11, fontWeight:700, borderRadius:6, cursor:"pointer",
                      background:perfPeriod===v?C.goldLight:"transparent", color:perfPeriod===v?C.goldText:C.textDim,
                      border:`1px solid ${perfPeriod===v?"rgba(201,168,76,0.4)":C.border}` }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {!perf.enough ? (
              <div style={{ background:C.surface, border:`1px dashed ${C.border}`, borderRadius:10, padding:"28px 20px", textAlign:"center" }}>
                <div style={{ fontSize:13, color:C.textMid, fontWeight:600, marginBottom:6 }}>📈 Log a few months to unlock return-over-time</div>
                <div style={{ fontSize:11, color:C.textDim, lineHeight:1.6, maxWidth:440, margin:"0 auto" }}>
                  Return-over-time needs at least two monthly snapshots. Per-position <strong style={{ color:C.textMid }}>Return %</strong> in the holdings table works right now and doesn't depend on snapshots.
                </div>
                <button onClick={() => setBackfill({})}
                  style={{ marginTop:14, minHeight:40, padding:"0 18px", fontSize:12, fontWeight:700, background:C.goldLight, color:C.goldText, border:`1px solid rgba(201,168,76,0.4)`, borderRadius:8, cursor:"pointer" }}>
                  + Add historical snapshot
                </button>
              </div>
            ) : (
              <>
                {/* Metric cards */}
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(auto-fill,minmax(150px,1fr))", gap:10, marginBottom:16 }}>
                  {[
                    { label:"Cumulative return", val:$RPct(perf.cumulativeRet), color:safe(perf.cumulativeRet)>=0?C.green:C.red, sub:`since ${monthShort(perf.firstDate)}` },
                    { label:`${(PERIODS.find(p=>p[0]===perfPeriod)||["","All"])[1]} return`, val:$RPct(perf.periodRet), color:perf.periodRet==null?C.textDim:(perf.periodRet>=0?C.green:C.red), sub:"selected period" },
                    { label:"Annualized", val:$RPct(perf.annualized), color:perf.annualized==null?C.textDim:(perf.annualized>=0?C.green:C.red), sub:perf.annualized==null?"≥90 days needed":"per year" },
                    { label:"Unrealized P&L", val:$F(pnl), color:pnl>=0?C.green:C.red, sub:$Pct(pnlPct) },
                    { label:"Max drawdown", val:perf.maxDrawdown==null?"—":$RPct(perf.maxDrawdown), color:perf.maxDrawdown==null?C.textDim:C.red, sub:"peak → trough" },
                    { label:"Best position", val:bestPosition?bestPosition.symbol:"—", color:C.green, sub:bestPosition?$RPct(bestPosition.pct/100):"—", mono:false },
                    { label:"Worst position", val:worstPosition?worstPosition.symbol:"—", color:C.red, sub:worstPosition?$RPct(worstPosition.pct/100):"—", mono:false },
                  ].map((k,i) => (
                    <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px" }}>
                      <div style={{ fontSize:9, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6, fontWeight:600 }}>{k.label}</div>
                      <div style={{ fontFamily:k.mono===false?C.sans:C.mono, fontSize:k.mono===false?16:17, fontWeight:800, color:k.color }}>{k.val}</div>
                      <div style={{ fontSize:9, color:C.textDim, marginTop:3 }}>{k.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div style={{ marginBottom:6 }}>
                  <div style={{ fontSize:9, color:C.textDim, marginBottom:6 }}>
                    Market value (CAD) · since {monthLong(perf.chartData[0]?.month || perf.firstDate)}{perf.hasBenchmark ? " · dashed = benchmark (normalized)" : ""}
                  </div>
                  <div style={{ width:"100%", height:isMobile?200:260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={perf.chartData} margin={{ top:8, right:12, bottom:4, left:isMobile?-8:8 }}>
                        <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fill:C.textDim, fontSize:10 }} axisLine={{ stroke:C.border }} tickLine={false} />
                        <YAxis tick={{ fill:C.textDim, fontSize:10 }} axisLine={false} tickLine={false}
                          width={isMobile?44:64}
                          tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : String(v)} />
                        <Tooltip
                          contentStyle={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, fontSize:11 }}
                          labelStyle={{ color:C.textMid }}
                          formatter={(val, name) => [$F(val), name === "benchmark" ? "Benchmark" : "Market value"]} />
                        <Line type="monotone" dataKey="market" stroke={C.gold} strokeWidth={2} dot={{ r:2, fill:C.gold }} activeDot={{ r:4 }} name="market" />
                        {perf.hasBenchmark && (
                          <Line type="monotone" dataKey="benchmark" stroke={C.blueText} strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls name="benchmark" />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top movers */}
                {(topMovers.length > 0) && (
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12, marginTop:12 }}>
                    {[["Top movers", topMovers, C.green], ["Bottom movers", bottomMovers, C.red]].filter(([,arr]) => arr.length).map(([title, arr, clr]) => (
                      <div key={title} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px" }}>
                        <div style={{ fontSize:9, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8, fontWeight:600 }}>{title}</div>
                        {arr.map((m,i) => (
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"3px 0" }}>
                            <span style={{ fontFamily:C.mono, fontSize:12, fontWeight:700, color:C.text }}>{m.symbol}</span>
                            <span style={{ fontFamily:C.mono, fontSize:12, fontWeight:700, color:m.pct>=0?C.green:C.red }}>{$RPct(m.pct/100)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Snapshot history (always shown when any exist) */}
            {snapshots.length > 0 && (
              <div style={{ marginTop:16, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:8 }}>
                  <span style={{ fontSize:9, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:600 }}>Snapshot history</span>
                  <button onClick={() => setBackfill({})}
                    style={{ minHeight:34, padding:"0 12px", fontSize:11, fontWeight:700, background:"transparent", color:C.goldText, border:`1px solid rgba(201,168,76,0.4)`, borderRadius:6, cursor:"pointer" }}>
                    + Historical
                  </button>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                    <thead>
                      <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                        {["Month","Market value","Net contrib.","Benchmark","Period ret.",""].map((h,i) => (
                          <th key={i} style={{ padding:"7px 10px", fontSize:9, fontWeight:700, color:C.textDim, letterSpacing:"0.06em", textTransform:"uppercase", textAlign:i===0||i===5?"left":"right", whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortSnaps(snapshots).map((s, idx, arr) => {
                        const prev = idx > 0 ? arr[idx-1] : null;
                        const r = prev ? periodReturn(prev.total_market_cad, s.total_market_cad, s.net_contributions) : null;
                        return (
                          <tr key={s.id} style={{ borderBottom:`1px solid ${C.border}` }}>
                            <td style={{ padding:"7px 10px", color:C.text, whiteSpace:"nowrap" }}>{monthLong(s.snapshot_month)}</td>
                            <td style={{ padding:"7px 10px", fontFamily:C.mono, textAlign:"right", color:C.gold, fontWeight:700 }}>{$F(s.total_market_cad)}</td>
                            <td style={{ padding:"7px 10px", fontFamily:C.mono, textAlign:"right", color:safe(s.net_contributions)===0?C.textDim:C.text }}>
                              {safe(s.net_contributions)===0 ? "—" : `${safe(s.net_contributions)>0?"+":""}${$F(s.net_contributions)}`}
                            </td>
                            <td style={{ padding:"7px 10px", fontFamily:C.mono, textAlign:"right", color:C.textDim }}>{s.benchmark_value==null?"—":safe(s.benchmark_value).toLocaleString("en-CA")}</td>
                            <td style={{ padding:"7px 10px", fontFamily:C.mono, textAlign:"right", color:r==null?C.textDim:(r>=0?C.green:C.red), fontWeight:600 }}>{$RPct(r)}</td>
                            <td style={{ padding:"7px 10px", textAlign:"left" }}>
                              <button onClick={() => setBackfill(s)}
                                style={{ minHeight:30, fontSize:10, background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.textDim, padding:"3px 9px", cursor:"pointer" }}>Edit</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── PER-ACCOUNT SUBTOTALS ── */}
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
            {accounts.map(a => (
              <div key={a.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 14px" }}>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:"0.07em", marginBottom:2 }}>{a.broker} · {a.account_type}</div>
                <div style={{ fontFamily:C.mono, fontSize:13, fontWeight:700, color:C.gold }}>{$F(perAccount[a.id] || 0)}</div>
              </div>
            ))}
          </div>

          {/* ── FILTERS (desktop inline) ── */}
          {!isMobile && (
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14, alignItems:"center" }}>
            <span style={{ fontSize:10, color:C.textDim, fontWeight:600 }}>Filter:</span>
            {[
              { label:"Account", value:filterAccount, set:setFilterAccount,
                options:[["all","All accounts"], ...accounts.map(a=>[a.id,`${a.broker} ${a.account_type}`])] },
              { label:"Class",   value:filterClass,   set:setFilterClass,
                options:[["all","All classes"], ...ASSET_CLASSES.map(c=>[c,ASSET_CLASS_LABEL[c]])] },
              { label:"Cur.",    value:filterCurrency, set:setFilterCurrency,
                options:[["all","CAD+USD"],["CAD","CAD"],["USD","USD"]] },
              { label:"Perf.",   value:filterGainers,  set:setFilterGainers,
                options:[["all","All"],["gainers","Gainers"],["losers","Losers"]] },
            ].map(({ label, value, set, options }) => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ fontSize:9, color:C.textDim }}>{label}</span>
                <select value={value} onChange={e => set(e.target.value)}
                  style={{ padding:"5px 8px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, fontSize:11, outline:"none", cursor:"pointer" }}>
                  {options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
            {(filterAccount!=="all"||filterClass!=="all"||filterCurrency!=="all"||filterGainers!=="all") && (
              <button onClick={() => { setFilterAccount("all"); setFilterClass("all"); setFilterCurrency("all"); setFilterGainers("all"); }}
                style={{ fontSize:10, background:"none", border:`1px solid ${C.border}`, borderRadius:6, color:C.textDim, padding:"4px 8px", cursor:"pointer" }}>
                Clear
              </button>
            )}
            <span style={{ fontSize:10, color:C.textDim, marginLeft:"auto" }}>{filtered.length} position{filtered.length!==1?"s":""}</span>
          </div>
          )}

          {/* ── FILTERS (mobile button) ── */}
          {isMobile && (
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:14 }}>
              <button onClick={() => setFilterSheet(true)}
                style={{ flex:1, minHeight:44, background:C.surface, border:`1px solid ${activeFilterCount?C.gold:C.border}`, borderRadius:8, color:activeFilterCount?C.goldText:C.text, fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                ⚙ Filters{activeFilterCount ? ` · ${activeFilterCount}` : ""}
              </button>
              <span style={{ fontSize:11, color:C.textDim, whiteSpace:"nowrap" }}>{filtered.length} pos.</span>
            </div>
          )}

          {/* ── HOLDINGS (desktop table) ── */}
          {!isMobile && (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden", boxShadow:C.shadow }}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:C.surface, borderBottom:`1px solid ${C.border}` }}>
                    <SortTh field="symbol">Symbol</SortTh>
                    <th style={{ padding:"10px 12px", fontSize:9, fontWeight:700, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", textAlign:"left" }}>Name / Account</th>
                    <SortTh field="asset_class">Class</SortTh>
                    <SortTh field="quantity" right>Qty</SortTh>
                    <SortTh field="market_price" right>Price</SortTh>
                    <SortTh field="book_value_cad" right>Book CAD</SortTh>
                    <SortTh field="market_value_cad" right>Mkt CAD</SortTh>
                    <SortTh field="pnl" right>Unreal. $</SortTh>
                    <SortTh field="pnlPct" right>Return %</SortTh>
                    <th style={{ padding:"10px 12px", fontSize:9, fontWeight:700, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", textAlign:"right" }}>% Port.</th>
                    <th style={{ padding:"10px 12px", width:80 }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(h => {
                    const pl     = pnlOf(h);
                    const plPct  = pnlPctOf(h);
                    const portPct = marketTotal > 0 ? safe(h.market_value_cad) / marketTotal * 100 : 0;
                    const acct   = accounts.find(a => a.id === h.account_id);
                    const clrCls = ASSET_CLASS_COLOR[h.asset_class] || C.textDim;
                    const isCash = h.asset_class === "cash";
                    return (
                      <tr key={h.id} style={{ borderBottom:`1px solid ${C.border}`, opacity:isCash?0.55:1 }}>
                        <td style={{ padding:"9px 12px", fontFamily:C.mono, fontWeight:700, color:C.text, whiteSpace:"nowrap" }}>{h.symbol}</td>
                        <td style={{ padding:"9px 12px", maxWidth:180 }}>
                          <div style={{ fontSize:12, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.name}</div>
                          <div style={{ fontSize:9, color:C.textDim, marginTop:1 }}>{acct ? `${acct.broker} · ${acct.account_type}` : "—"}</div>
                        </td>
                        <td style={{ padding:"9px 12px", whiteSpace:"nowrap" }}>
                          <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.05em", color:clrCls, background:`${clrCls}20`, border:`1px solid ${clrCls}40`, borderRadius:4, padding:"2px 6px" }}>
                            {ASSET_CLASS_LABEL[h.asset_class] || h.asset_class}
                          </span>
                        </td>
                        <td style={{ padding:"9px 12px", fontFamily:C.mono, textAlign:"right", color:C.text }}>
                          {safe(h.quantity).toFixed(safe(h.quantity) % 1 === 0 ? 0 : 4)}
                          {h.price_currency === "USD" && <div style={{ fontSize:9, color:C.textDim }}>USD</div>}
                        </td>
                        <td style={{ padding:"9px 12px", fontFamily:C.mono, textAlign:"right" }}>
                          {priceMode
                            ? <input type="number" step="any"
                                value={priceEdits[h.id] ?? h.market_price}
                                onChange={e => setPriceEdits(prev => ({ ...prev, [h.id]: e.target.value }))}
                                style={{ width:80, padding:"4px 6px", background:C.surface, border:`1px solid ${C.gold}`, borderRadius:4, color:C.gold, fontSize:12, fontFamily:C.mono, textAlign:"right", outline:"none" }} />
                            : <span style={{ color:C.text }}>{safe(h.market_price).toFixed(2)}</span>
                          }
                        </td>
                        <td style={{ padding:"9px 12px", fontFamily:C.mono, textAlign:"right", color:C.textMid }}>{isCash?"—":$F(h.book_value_cad)}</td>
                        <td style={{ padding:"9px 12px", fontFamily:C.mono, textAlign:"right", fontWeight:700, color:C.gold }}>{$F(h.market_value_cad)}</td>
                        <td style={{ padding:"9px 12px", fontFamily:C.mono, textAlign:"right", fontWeight:600 }}>
                          {isCash ? <span style={{ color:C.textDim }}>—</span> : <span style={{ color:pl>=0?C.green:C.red }}>{pl>=0?"+":""}{$F(pl)}</span>}
                        </td>
                        <td style={{ padding:"9px 12px", fontFamily:C.mono, textAlign:"right", fontWeight:600 }}>
                          {isCash ? <span style={{ color:C.textDim }}>—</span> : <span style={{ color:pl>=0?C.green:C.red }}>{pl>=0?"+":""}{plPct.toFixed(1)}%</span>}
                        </td>
                        <td style={{ padding:"9px 12px", fontFamily:C.mono, textAlign:"right", color:C.textDim, fontSize:11 }}>
                          {portPct.toFixed(1)}%
                        </td>
                        <td style={{ padding:"9px 12px", textAlign:"right" }}>
                          <button onClick={() => setEditModal(h)}
                            style={{ fontSize:10, background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.textDim, padding:"3px 7px", cursor:"pointer" }}>Edit</button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={11} style={{ padding:"32px 20px", textAlign:"center", color:C.textDim, fontSize:12, fontStyle:"italic" }}>No positions match the current filters.</td></tr>
                  )}
                </tbody>
                {/* Totals footer */}
                {filtered.length > 0 && (
                  <tfoot>
                    <tr style={{ background:C.surface, borderTop:`2px solid ${C.border}` }}>
                      <td colSpan={5} style={{ padding:"10px 12px", fontSize:11, fontWeight:700, color:C.textDim }}>Totals (filtered)</td>
                      <td style={{ padding:"10px 12px", fontFamily:C.mono, fontWeight:700, textAlign:"right", color:C.textMid }}>{$F(filtered.reduce((s,h)=>s+safe(h.book_value_cad),0))}</td>
                      <td style={{ padding:"10px 12px", fontFamily:C.mono, fontWeight:800, textAlign:"right", color:C.gold }}>{$F(filtered.reduce((s,h)=>s+safe(h.market_value_cad),0))}</td>
                      <td style={{ padding:"10px 12px", fontFamily:C.mono, fontWeight:700, textAlign:"right" }}>
                        {(() => { const fp = filtered.reduce((s,h)=>s+pnlOf(h),0); return <span style={{ color:fp>=0?C.green:C.red }}>{fp>=0?"+":""}{$F(fp)}</span>; })()}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
          )}

          {/* ── HOLDINGS (mobile cards) ── */}
          {isMobile && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {filtered.length === 0 && (
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"28px 16px", textAlign:"center", color:C.textDim, fontSize:12, fontStyle:"italic" }}>
                  No positions match the current filters.
                </div>
              )}
              {filtered.map(h => {
                const pl     = pnlOf(h);
                const plPct  = pnlPctOf(h);
                const portPct = marketTotal > 0 ? safe(h.market_value_cad) / marketTotal * 100 : 0;
                const acct   = accounts.find(a => a.id === h.account_id);
                const clrCls = ASSET_CLASS_COLOR[h.asset_class] || C.textDim;
                const isCash = h.asset_class === "cash";
                const Field = ({ label, children, right }) => (
                  <div style={{ textAlign:right?"right":"left" }}>
                    <div style={{ fontSize:8, color:C.textDim, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:2, fontWeight:600 }}>{label}</div>
                    <div style={{ fontFamily:C.mono, fontSize:12, color:C.text }}>{children}</div>
                  </div>
                );
                return (
                  <div key={h.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px", opacity:isCash?0.6:1 }}>
                    {/* Top row: symbol + class · market value */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                          <span style={{ fontFamily:C.mono, fontWeight:700, fontSize:14, color:C.text }}>{h.symbol}</span>
                          <span style={{ fontSize:8, fontWeight:700, letterSpacing:"0.05em", color:clrCls, background:`${clrCls}20`, border:`1px solid ${clrCls}40`, borderRadius:4, padding:"2px 6px" }}>
                            {ASSET_CLASS_LABEL[h.asset_class] || h.asset_class}
                          </span>
                          {h.price_currency === "USD" && <span style={{ fontSize:8, color:C.textDim }}>USD</span>}
                        </div>
                        <div style={{ fontSize:11, color:C.textMid, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.name}</div>
                        <div style={{ fontSize:9, color:C.textDim, marginTop:1 }}>{acct ? `${acct.broker} · ${acct.account_type}` : "—"}</div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontFamily:C.mono, fontWeight:800, fontSize:14, color:C.gold }}>{$F(h.market_value_cad)}</div>
                        <div style={{ fontSize:9, color:C.textDim, marginTop:2 }}>{portPct.toFixed(1)}% of port.</div>
                      </div>
                    </div>
                    {/* Metrics */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
                      <Field label="Quantity">{safe(h.quantity).toFixed(safe(h.quantity) % 1 === 0 ? 0 : 4)}</Field>
                      <Field label="Price" right>
                        {priceMode
                          ? <input type="number" step="any" inputMode="decimal"
                              value={priceEdits[h.id] ?? h.market_price}
                              onChange={e => setPriceEdits(prev => ({ ...prev, [h.id]: e.target.value }))}
                              style={{ width:100, minHeight:40, padding:"4px 8px", background:C.surface, border:`1px solid ${C.gold}`, borderRadius:6, color:C.gold, fontSize:13, fontFamily:C.mono, textAlign:"right", outline:"none", boxSizing:"border-box" }} />
                          : safe(h.market_price).toFixed(2)}
                      </Field>
                      <Field label="Return $">
                        {isCash ? <span style={{ color:C.textDim }}>—</span> : <span style={{ color:pl>=0?C.green:C.red, fontWeight:600 }}>{pl>=0?"+":""}{$F(pl)}</span>}
                      </Field>
                      <Field label="Return %" right>
                        {isCash ? <span style={{ color:C.textDim }}>—</span> : <span style={{ color:pl>=0?C.green:C.red, fontWeight:600 }}>{pl>=0?"+":""}{plPct.toFixed(1)}%</span>}
                      </Field>
                    </div>
                    {!priceMode && (
                      <button onClick={() => setEditModal(h)}
                        style={{ marginTop:10, width:"100%", minHeight:40, background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.textMid, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                        Edit position
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── FILTERS bottom sheet (mobile) ── */}
          {isMobile && filterSheet && (
            <>
              <div onClick={() => setFilterSheet(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300 }} />
              <div style={{ position:"fixed", left:0, right:0, bottom:0, zIndex:310, background:C.card, borderTop:`1px solid ${C.border}`, borderRadius:"16px 16px 0 0", padding:"18px 18px", paddingBottom:`calc(18px + env(safe-area-inset-bottom))`, boxShadow:C.shadowMd, maxHeight:"80vh", overflowY:"auto" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:C.text }}>Filters</span>
                  <button onClick={() => setFilterSheet(false)} style={{ width:40, height:40, background:"none", border:"none", color:C.textDim, fontSize:20, cursor:"pointer" }}>✕</button>
                </div>
                {[
                  { label:"Account", value:filterAccount, set:setFilterAccount,
                    options:[["all","All accounts"], ...accounts.map(a=>[a.id,`${a.broker} ${a.account_type}`])] },
                  { label:"Asset class", value:filterClass, set:setFilterClass,
                    options:[["all","All classes"], ...ASSET_CLASSES.map(c=>[c,ASSET_CLASS_LABEL[c]])] },
                  { label:"Currency", value:filterCurrency, set:setFilterCurrency,
                    options:[["all","CAD + USD"],["CAD","CAD"],["USD","USD"]] },
                  { label:"Performance", value:filterGainers, set:setFilterGainers,
                    options:[["all","All"],["gainers","Gainers"],["losers","Losers"]] },
                ].map(({ label, value, set, options }) => (
                  <div key={label} style={{ marginBottom:14 }}>
                    <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6, fontWeight:600 }}>{label}</div>
                    <select value={value} onChange={e => set(e.target.value)}
                      style={{ width:"100%", minHeight:44, padding:"8px 10px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:14, outline:"none", cursor:"pointer", boxSizing:"border-box" }}>
                      {options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                ))}
                <div style={{ display:"flex", gap:10, marginTop:8 }}>
                  <button onClick={() => { setFilterAccount("all"); setFilterClass("all"); setFilterCurrency("all"); setFilterGainers("all"); }}
                    style={{ flex:1, minHeight:46, background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.textMid, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                    Clear all
                  </button>
                  <button onClick={() => setFilterSheet(false)}
                    style={{ flex:1, minHeight:46, background:C.gold, border:"none", borderRadius:8, color:"#0C1520", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                    Show {filtered.length} position{filtered.length!==1?"s":""}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div style={{ marginTop:24, textAlign:"center" }}>
            <span style={{ fontSize:10, color:C.textDim, fontStyle:"italic" }}>
              Values in CAD · Prices manually entered · Cash positions excluded from P&L · Not financial advice
            </span>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Add position */}
      {addModal && (
        <Modal title="Add position" onClose={() => setAddModal(false)}>
          <PositionForm accounts={accounts} initial={{ account_id: accounts[0]?.id || "" }}
            saving={addSaving} onCancel={() => setAddModal(false)} onSave={handleAdd} />
        </Modal>
      )}

      {/* Edit position */}
      {editModal && (
        <Modal title={`Edit — ${editModal.symbol}`} onClose={() => setEditModal(null)}>
          <PositionForm accounts={accounts} initial={{
            account_id:     editModal.account_id,
            symbol:         editModal.symbol,
            name:           editModal.name || "",
            security_type:  editModal.security_type || "EQUITY",
            asset_class:    editModal.asset_class  || "us_tech",
            quantity:       String(editModal.quantity ?? ""),
            avg_cost:       editModal.avg_cost != null ? String(editModal.avg_cost) : "",
            price_currency: editModal.price_currency || "CAD",
            market_price:   String(editModal.market_price ?? ""),
            fx_rate:        String(editModal.fx_rate ?? 1),
            book_value_cad: String(editModal.book_value_cad ?? ""),
          }}
          saving={editSaving} onCancel={() => setEditModal(null)}
          onSave={(form, mktCadCalc) => handleEdit(editModal.id, form, mktCadCalc)} />
        </Modal>
      )}

      {/* Historical snapshot / edit */}
      {backfill && (
        <Modal title={backfill.snapshot_month ? `Edit snapshot — ${monthLong(backfill.snapshot_month)}` : "Add historical snapshot"} onClose={() => setBackfill(null)}>
          <SnapshotForm initial={backfill} isEdit={!!backfill.snapshot_month}
            saving={backfillSaving} onCancel={() => setBackfill(null)} onSave={handleBackfillSave} />
        </Modal>
      )}

      {/* CSV Import */}
      {(csvStep === "upload" || csvStep === "preview") && (
        <Modal title="Import CSV" onClose={() => { setCsvStep(null); setCsvPreview([]); }} width={700}>
          {csvStep === "upload" && (
            <div>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:10, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6, fontWeight:600 }}>Target account</div>
                <select value={csvTarget} onChange={e => setCsvTarget(e.target.value)}
                  style={{ width:"100%", padding:"8px 10px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, fontSize:13, outline:"none", cursor:"pointer" }}>
                  {accounts.map(a => <option key={a.id} value={a.id}>{acctLabel(a)}</option>)}
                </select>
              </div>
              <div style={{ background:C.surface, border:`2px dashed ${C.border}`, borderRadius:10, padding:"32px 24px", textAlign:"center", marginBottom:14 }}>
                <div style={{ fontSize:12, color:C.textMid, marginBottom:8 }}>Drop your Wealthsimple or TD Direct CSV here, or:</div>
                <input type="file" accept=".csv,.txt"
                  onChange={e => handleCSVFile(e.target.files?.[0])}
                  style={{ fontSize:12, color:C.textDim }} />
              </div>
              <div style={{ background:C.amberLight, border:`1px solid rgba(230,168,23,0.35)`, borderRadius:8, padding:"10px 14px", fontSize:11, color:C.amberText, lineHeight:1.7 }}>
                <strong>Wealthsimple:</strong> Account Type · Symbol · Name · Security Type · Quantity · Market Price · Market Price Currency · Book Value (CAD) · Market Value · Market Value Currency<br/>
                <strong>TD Direct:</strong> Symbol · Description · Quantity · Average Cost · Price · Book Cost · Market Value
              </div>
            </div>
          )}
          {csvStep === "preview" && (
            <div>
              <div style={{ fontSize:12, color:C.textMid, marginBottom:12 }}>
                Review changes before importing. Only <strong style={{ color:C.text }}>new</strong> and <strong style={{ color:C.amber }}>changed</strong> rows will be written.
              </div>
              <div style={{ overflowX:"auto", maxHeight:360, overflowY:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead style={{ position:"sticky", top:0, background:C.surface }}>
                    <tr>
                      {["Status","Symbol","Name","Qty","Price","Book CAD","Mkt CAD"].map(h => (
                        <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:9, fontWeight:700, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", borderBottom:`1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((r,i) => {
                      const statusColor = r._status==="new"?C.greenText:r._status==="changed"?C.amberText:C.textDim;
                      return (
                        <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, opacity:r._status==="unchanged"?0.45:1 }}>
                          <td style={{ padding:"7px 10px" }}><span style={{ fontSize:9, fontWeight:700, color:statusColor, textTransform:"uppercase" }}>{r._status}</span></td>
                          <td style={{ padding:"7px 10px", fontFamily:C.mono, fontWeight:700, color:C.text }}>{r.symbol}</td>
                          <td style={{ padding:"7px 10px", color:C.textMid, maxWidth:150, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</td>
                          <td style={{ padding:"7px 10px", fontFamily:C.mono, textAlign:"right" }}>{safe(r.quantity).toFixed(4)}</td>
                          <td style={{ padding:"7px 10px", fontFamily:C.mono, textAlign:"right" }}>{safe(r.market_price).toFixed(2)} {r.price_currency}</td>
                          <td style={{ padding:"7px 10px", fontFamily:C.mono, textAlign:"right" }}>{$F(r.book_value_cad)}</td>
                          <td style={{ padding:"7px 10px", fontFamily:C.mono, textAlign:"right", color:C.gold }}>{$F(r.market_value_cad)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display:"flex", gap:10, marginTop:16 }}>
                <button onClick={handleCSVConfirm} disabled={csvSaving || !csvPreview.some(r=>r._status!=="unchanged")}
                  style={{ flex:1, padding:"10px 0", background:csvSaving?C.border:C.gold, color:"#0C1520", border:"none", borderRadius:8, fontWeight:700, fontSize:13, cursor:csvSaving?"not-allowed":"pointer", opacity:csvSaving?0.7:1 }}>
                  {csvSaving ? "Importing…" : `Confirm import (${csvPreview.filter(r=>r._status!=="unchanged").length} rows)`}
                </button>
                <button onClick={() => setCsvStep("upload")}
                  style={{ padding:"10px 16px", background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.textDim, fontSize:13, cursor:"pointer" }}>
                  ← Back
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", zIndex:400, background:toast.type==="error"?C.redLight:C.greenLight, border:`1px solid ${toast.type==="error"?"rgba(224,85,85,0.45)":"rgba(39,174,96,0.45)"}`, borderRadius:10, padding:"10px 18px", color:toast.type==="error"?C.redText:C.greenText, fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:10, maxWidth:"90vw", boxShadow:C.shadowMd, whiteSpace:"nowrap" }}>
          <span>{toast.type==="error"?"⚠":"✓"}</span>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} style={{ background:"none", border:"none", color:"inherit", cursor:"pointer", fontSize:16, lineHeight:1, padding:"0 2px", marginLeft:4 }}>✕</button>
        </div>
      )}
    </div>
  );
}
