import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

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
const pnlOf  = h => safe(h.market_value_cad) - safe(h.book_value_cad);
const pnlPctOf = h => safe(h.book_value_cad) > 0 ? (pnlOf(h) / safe(h.book_value_cad)) * 100 : 0;
const acctLabel = a => a ? `${a.broker} — ${a.account_type} (${a.account_number_masked || "—"})` : "—";

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
export default function SecuritiesView({ onBack, individualId, onDerivedUpdate }) {
  const [accounts,  setAccounts]  = useState([]);
  const [holdings,  setHoldings]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

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
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting,      setDeleting]      = useState(false);
  const [csvStep,    setCsvStep]    = useState(null);
  const [csvTarget,  setCsvTarget]  = useState("all");
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvSaving,  setCsvSaving]  = useState(false);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

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

      if (onDerivedUpdate) {
        const sec = (hlds || []).filter(h => !["crypto","cash"].includes(h.asset_class)).reduce((s,h) => s + safe(h.market_value_cad), 0);
        const cry = (hlds || []).filter(h => h.asset_class === "crypto").reduce((s,h) => s + safe(h.market_value_cad), 0);
        onDerivedUpdate(Math.round(sec), Math.round(cry));
      }
    } catch (e) {
      showToast("Load failed: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [individualId, onDerivedUpdate]);

  useEffect(() => { loadData(); }, [loadData]);

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
    filtered.sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
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

    return { marketTotal, bookTotal, pnl, pnlPct, byClass, nonCashTotal, flags, filtered, perAccount };
  }, [holdings, accounts, filterAccount, filterClass, filterCurrency, filterGainers, sortField, sortDir]);

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
    setHoldings(prev => prev.map(h => {
      if (priceEdits[h.id] === undefined) return h;
      const p = safe(priceEdits[h.id]);
      return { ...h, market_price: p, market_value_cad: safe(h.quantity) * p * safe(h.fx_rate || 1) };
    }));
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
      await loadData();
      setPriceMode(false);
      setPriceEdits({});
      showToast(`${Object.keys(priceEdits).length} price${Object.keys(priceEdits).length > 1 ? "s" : ""} saved`);
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

  // ── Delete ──
  async function handleDelete(id) {
    setDeleting(true);
    const rollback = [...holdings];
    const sym = holdings.find(h => h.id === id)?.symbol || "Position";
    setHoldings(prev => prev.filter(h => h.id !== id));
    try {
      const { error } = await sb.from("securities_holdings").delete().eq("id", id);
      if (error) throw new Error(error.message);
      const { data: check } = await sb.from("securities_holdings").select("id").eq("id", id).maybeSingle();
      if (check) throw new Error("Row still present after delete — write did not commit");
      await loadData();
      setDeleteConfirm(null);
      showToast(`${sym} deleted`);
    } catch (e) {
      setHoldings(rollback);
      showToast("Delete failed: " + e.message, "error");
    } finally {
      setDeleting(false);
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
  const { marketTotal, bookTotal, pnl, pnlPct, byClass, nonCashTotal, flags, filtered, perAccount } = derived;

  const SortTh = ({ field, children, right }) => (
    <th onClick={() => toggleSort(field)} style={{ padding:"10px 12px", fontSize:9, fontWeight:700, color:sortField===field?C.gold:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer", whiteSpace:"nowrap", textAlign:right?"right":"left", userSelect:"none" }}>
      {children}{sortIcon(field)}
    </th>
  );

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, fontFamily:C.sans }}>

      {/* ── NAV ── */}
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
        </div>
      </div>

      {loading && (
        <div style={{ padding:48, textAlign:"center", color:C.textDim, fontSize:13 }}>Loading portfolio…</div>
      )}

      {!loading && (
        <div style={{ padding:isMobile?"16px 14px":"24px 28px", maxWidth:1300, margin:"0 auto" }}>

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

          {/* ── PER-ACCOUNT SUBTOTALS ── */}
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
            {accounts.map(a => (
              <div key={a.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 14px" }}>
                <div style={{ fontSize:9, color:C.textDim, letterSpacing:"0.07em", marginBottom:2 }}>{a.broker} · {a.account_type}</div>
                <div style={{ fontFamily:C.mono, fontSize:13, fontWeight:700, color:C.gold }}>{$F(perAccount[a.id] || 0)}</div>
              </div>
            ))}
          </div>

          {/* ── FILTERS ── */}
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

          {/* ── HOLDINGS TABLE ── */}
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
                    <SortTh field="market_value_cad" right>Unreal. P&L</SortTh>
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
                        <td style={{ padding:"9px 12px", textAlign:"right" }}>
                          {isCash ? <span style={{ color:C.textDim }}>—</span> : (
                            <>
                              <div style={{ fontFamily:C.mono, fontSize:12, color:pl>=0?C.green:C.red, fontWeight:600 }}>{pl>=0?"+":""}{$F(pl)}</div>
                              <div style={{ fontSize:9, color:pl>=0?C.green:C.red }}>{pl>=0?"+":""}{plPct.toFixed(1)}%</div>
                            </>
                          )}
                        </td>
                        <td style={{ padding:"9px 12px", fontFamily:C.mono, textAlign:"right", color:C.textDim, fontSize:11 }}>
                          {portPct.toFixed(1)}%
                        </td>
                        <td style={{ padding:"9px 12px", textAlign:"right" }}>
                          <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
                            <button onClick={() => setEditModal(h)}
                              style={{ fontSize:10, background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.textDim, padding:"3px 7px", cursor:"pointer" }}>Edit</button>
                            <button onClick={() => setDeleteConfirm(h.id)}
                              style={{ fontSize:10, background:"none", border:`1px solid rgba(224,85,85,0.3)`, borderRadius:5, color:C.red, padding:"3px 7px", cursor:"pointer" }}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={10} style={{ padding:"32px 20px", textAlign:"center", color:C.textDim, fontSize:12, fontStyle:"italic" }}>No positions match the current filters.</td></tr>
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
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

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

      {/* Delete confirm */}
      {deleteConfirm && (
        <Modal title="Delete position" onClose={() => setDeleteConfirm(null)} width={380}>
          <div style={{ color:C.textMid, fontSize:13, marginBottom:20, lineHeight:1.6 }}>
            Delete <strong style={{ color:C.text }}>{holdings.find(h=>h.id===deleteConfirm)?.symbol}</strong>?
            This cannot be undone.
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting}
              style={{ flex:1, padding:"10px 0", background:deleting?C.border:C.red, color:"#fff", border:"none", borderRadius:8, fontWeight:700, fontSize:13, cursor:deleting?"not-allowed":"pointer", opacity:deleting?0.7:1 }}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button onClick={() => setDeleteConfirm(null)}
              style={{ padding:"10px 20px", background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.textDim, fontSize:13, cursor:"pointer" }}>
              Cancel
            </button>
          </div>
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
