import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://bxxnjmottokudtjgigss.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4eG5qbW90dG9rdWR0amdpZ3NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzAyMzgsImV4cCI6MjA5MDU0NjIzOH0.NoIADiNmtaSJd67lAWLbQ49tPHa7KcAu4VBLcAY5kgk"
);

// ─── THEME — Clean white/light professional ───────────────────────────────────
const C = {
  bg:         "#F7F7F5",
  surface:    "#FFFFFF",
  card:       "#FFFFFF",
  border:     "#E8E8E4",
  borderDark: "#D0D0CA",
  gold:       "#B8962E",
  goldLight:  "#F5F0E4",
  goldText:   "#8A6F1E",
  red:        "#C0392B",
  redLight:   "#FDECEA",
  redText:    "#922B21",
  green:      "#1E8449",
  greenLight: "#EAF7EE",
  greenText:  "#1A6E3C",
  amber:      "#B7770D",
  amberLight: "#FEF9EC",
  blue:       "#1A5276",
  blueLight:  "#EAF2F8",
  blueText:   "#154360",
  text:       "#1A1A1A",
  textMid:    "#555550",
  textDim:    "#999992",
  mono:       "'SF Mono', 'Courier New', monospace",
  sans:       "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const USERS = [
  { username:"ahmed",  password:"jmf-admin-2026",  role:"admin",      name:"Ahmed (AJ)",         initials:"AJ", individualId:1 },
  { username:"nazila", password:"nazila-2026",      role:"individual", name:"Nazila Isgandarova", initials:"NI", individualId:2 },
  { username:"yasin",  password:"yasin-2026",       role:"individual", name:"Yasin Majidov",      initials:"YM", individualId:3 },
  { username:"maryam", password:"maryam-2026",      role:"individual", name:"Maryam Majidova",    initials:"MM", individualId:4 },
  { username:"akbar",  password:"akbar-2026",       role:"individual", name:"Akbar Majidov",      initials:"AM", individualId:5 },
];

// ─── SAFE HELPERS ─────────────────────────────────────────────────────────────
const safe = (n) => (isNaN(n) || n == null ? 0 : Number(n));
const $K = (n) => {
  const v = safe(n), a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1_000_000) return `${s}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000)     return `${s}$${(a / 1_000).toFixed(0)}K`;
  return `${s}$${a.toLocaleString("en-CA")}`;
};
const $F = (n, d = 0) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: d }).format(safe(n));

// ─── DEFAULT DATA — April 1, 2026 ─────────────────────────────────────────────
const DEFAULT = {
  lastUpdated: "April 1, 2026",

  individuals: [
    { id:1, name:"Ahmed (AJ)",         initials:"AJ", cash:0, accounts:1023,  debt:-143474, securities:46610, crypto:1466 },
    { id:2, name:"Nazila Isgandarova", initials:"NI", cash:0, accounts:47963, debt:-4383,   securities:0,     crypto:0    },
    { id:3, name:"Yasin Majidov",      initials:"YM", cash:0, accounts:750,   debt:0,       securities:0,     crypto:0    },
    { id:4, name:"Maryam Majidova",    initials:"MM", cash:0, accounts:671,   debt:0,       securities:0,     crypto:0    },
    { id:5, name:"Akbar Majidov",      initials:"AM", cash:0, accounts:-1575, debt:-1316,   securities:0,     crypto:0    },
  ],

  businesses: [
    {
      id:1, name:"Kratos Moving Inc.", abbr:"KMI",
      cashAccounts:152207, liabilities:133056, taxPayable:120000, creditCards:13056,
      revenue:0, expenses:0,
      notes:"BMO + RBC + Equitable accounts. CRA $120K payable included in liabilities.",
    },
    {
      id:2, name:"JMF Logistics Inc.", abbr:"JMF",
      cashAccounts:2621, liabilities:0, taxPayable:0, creditCards:0,
      revenue:0, expenses:0,
      notes:"RBC Chequing. No outstanding liabilities on file.",
    },
  ],

  properties: [
    { id:1, name:"27 Roytec Rd.",     status:"STRONG", purchase:750000,  market:2000000, mortgage:730000,  monthlyPayment:3200,  rentalIncome:0, lender:"TD Bank",        rate:"6.0%",   rateType:"Variable",        maturity:"TBC",      notes:"Crown jewel. $1.27M unrealized gain." },
    { id:2, name:"3705 Farr Ave.",    status:"STRONG", purchase:250000,  market:1200000, mortgage:0,       monthlyPayment:0,     rentalIncome:0, lender:"None",           rate:"N/A",    rateType:"Mortgage-free",   maturity:"N/A",      notes:"Fully mortgage-free. Pure equity." },
    { id:3, name:"121 Milky Way",     status:"WATCH",  purchase:3079729, market:2850000, mortgage:1826927, monthlyPayment:15013, rentalIncome:0, lender:"Equitable Bank", rate:"7.95%",  rateType:"Fixed Open 12mo", maturity:"Dec 2026", notes:"Market below purchase. Can refinance without penalty." },
    { id:4, name:"51 Ahchie Crt.",    status:"RISK",   purchase:2119105, market:1750000, mortgage:1533355, monthlyPayment:9339,  rentalIncome:0, lender:"Equitable Bank", rate:"P+0.14%",rateType:"ARM 36mo",        maturity:"Mar 2029", notes:"Variable rate ARM. Market significantly below purchase." },
    { id:5, name:"4 New Seabury Dr.", status:"WATCH",  purchase:349000,  market:958800,  mortgage:895992,  monthlyPayment:5979,  rentalIncome:0, lender:"Equitable Bank", rate:"5.94%",  rateType:"Fixed 60mo",      maturity:"Dec 2029", notes:"Locked in at 5.94%. Thin equity margin." },
  ],

  cashflow: {
    income: [
      { label:"Kratos Moving Inc.",  amount:0, note:"Add monthly net profit" },
      { label:"JMF Logistics Inc.",  amount:0, note:"Add monthly net profit" },
      { label:"Rental income",       amount:0, note:"Update when tenants confirmed" },
      { label:"Other income",        amount:0, note:"" },
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

// ─── DB HELPERS ───────────────────────────────────────────────────────────────
async function loadFromDB() {
  try {
    const { data, error } = await supabase.from("dashboard_data").select("*");
    if (error || !data || data.length === 0) return null;
    const result = {};
    data.forEach(row => { result[row.key] = row.value; });
    return result.individuals && result.individuals.length > 0 ? result : null;
  } catch { return null; }
}
async function saveToDB(key, value) {
  try { await supabase.from("dashboard_data").upsert({ key, value, updated_at: new Date().toISOString() }); }
  catch (e) { console.error("DB save failed", e); }
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textDim, marginBottom: 6, fontFamily: C.sans }}>
      {children}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, ...style }}>
      {children}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    STRONG: { bg: C.greenLight, color: C.greenText, label: "Strong" },
    WATCH:  { bg: C.amberLight, color: C.amber,     label: "Watch"  },
    RISK:   { bg: C.redLight,   color: C.redText,   label: "Risk"   },
  };
  const s = map[status] || map.WATCH;
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "3px 10px", letterSpacing: "0.05em", fontFamily: C.sans }}>
      {s.label}
    </span>
  );
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
  return (
    <span onClick={() => { setV(safe(value)); setEditing(true); }} title="Click to edit"
      style={{ cursor: "pointer", color: col, fontFamily: C.mono, fontSize: 14, borderBottom: `1.5px dashed ${C.borderDark}`, paddingBottom: 1 }}>
      {$F(num)}
    </span>
  );
}

function Row({ label, children, last }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: last ? "none" : `1px solid ${C.border}` }}>
      <span style={{ fontSize: 13, color: C.textMid, fontFamily: C.sans }}>{label}</span>
      <span style={{ fontSize: 14, fontFamily: C.mono }}>{children}</span>
    </div>
  );
}

// ─── CASH MODAL ───────────────────────────────────────────────────────────────
function CashModal({ current, onSave, onClose }) {
  const [val, setVal] = useState(safe(current));
  const handleSave = () => { onSave(safe(val)); onClose(); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 360, boxShadow: "0 8px 48px rgba(0,0,0,0.12)" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>Cash Vault</div>
        <div style={{ fontSize: 13, color: C.textDim, marginBottom: 20, lineHeight: 1.6 }}>
          Enter Ahmed's current physical cash. This updates net worth immediately and saves to the database.
        </div>
        <Label>Vault cash (CAD)</Label>
        <input
          type="number"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
          autoFocus
          style={{ width: "100%", padding: "12px 14px", background: C.bg, border: `1.5px solid ${C.gold}`, borderRadius: 8, color: C.text, fontSize: 18, fontFamily: C.mono, outline: "none", boxSizing: "border-box", marginBottom: 20 }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleSave}
            style={{ flex: 1, padding: "12px", background: C.gold, border: "none", borderRadius: 8, color: "#FFF", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: C.sans }}>
            Save
          </button>
          <button onClick={onClose}
            style={{ flex: 1, padding: "12px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.textMid, fontSize: 14, cursor: "pointer", fontFamily: C.sans }}>
            Cancel
          </button>
        </div>
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 14, textAlign: "center" }}>
          Last recorded: $34,770 (March 2026)
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleLogin = () => {
    setLoading(true); setError("");
    setTimeout(() => {
      const user = USERS.find(u => u.username === username.toLowerCase().trim() && u.password === password);
      if (user) { onLogin(user); } else { setError("Invalid username or password."); setLoading(false); }
    }, 500);
  };

  const inp = { width: "100%", padding: "11px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 14, fontFamily: C.sans, outline: "none", boxSizing: "border-box" };

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
          <Label>Username</Label>
          <input type="text" placeholder="e.g. ahmed" value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
            style={inp} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <Label>Password</Label>
          <input type="password" placeholder="••••••••" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
            style={inp} />
        </div>

        {error && (
          <div style={{ background: C.redLight, border: `1px solid #F5C6C3`, borderRadius: 7, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.redText }}>
            {error}
          </div>
        )}

        <button onClick={handleLogin} disabled={loading}
          style={{ width: "100%", padding: "12px", background: C.gold, border: "none", borderRadius: 8, color: "#FFF", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: C.sans, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.textDim, lineHeight: 1.8 }}>
          <div><strong style={{ color: C.textMid }}>admin (ahmed)</strong> — full access</div>
          <div><strong style={{ color: C.textMid }}>members</strong> — view & edit own data only</div>
        </div>
      </div>
    </div>
  );
}

// ─── MEMBER VIEW ──────────────────────────────────────────────────────────────
function MemberView({ user, data, onUpdate, onLogout }) {
  const [saved, setSaved]         = useState(false);
  const [cashModal, setCashModal] = useState(false);
  const f = data.individuals.find(x => x.id === user.individualId);
  if (!f) return null;

  const net       = safe(f.cash) + safe(f.accounts) + safe(f.debt) + safe(f.securities) + safe(f.crypto);
  const isPositive = net >= 0;
  const cashStale  = safe(f.cash) === 0;

  const handleUpdate = (id, field, val) => {
    onUpdate(id, field, val);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: C.sans }}>
      {cashModal && (
        <CashModal
          current={safe(f.cash)}
          onSave={v => handleUpdate(f.id, "cash", v)}
          onClose={() => setCashModal(false)}
        />
      )}

      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.gold }}>JMF</span>
          <span style={{ width: 1, height: 16, background: C.border, display: "inline-block" }} />
          <span style={{ fontSize: 12, color: C.textMid }}>My Snapshot</span>
          {saved && <span style={{ fontSize: 11, color: C.green, background: C.greenLight, borderRadius: 4, padding: "2px 8px" }}>✓ Saved</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {cashStale && user.individualId === 1 && (
            <button onClick={() => setCashModal(true)}
              style={{ fontSize: 11, color: C.amber, background: C.amberLight, border: `1px solid #F0D080`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: C.sans, fontWeight: 600 }}>
              Cash not updated
            </button>
          )}
          <span style={{ fontSize: 12, color: C.textMid }}>{f.name}</span>
          <button onClick={onLogout} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, color: C.textMid, fontSize: 11, padding: "4px 12px", cursor: "pointer" }}>Sign out</button>
        </div>
      </div>

      <div style={{ padding: 20, maxWidth: 540, margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
          <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8 }}>Net Worth</div>
          <div style={{ fontSize: 48, fontWeight: 800, fontFamily: C.mono, color: isPositive ? C.gold : C.red, letterSpacing: -1 }}>{$F(net)}</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 6 }}>{data.lastUpdated}</div>
        </div>

        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{f.name}</div>
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>Click any value to update — saves automatically</div>
          {[
            { l: "Cash (vault)",   fi: "cash",       desc: "Physical cash" },
            { l: "Bank accounts",  fi: "accounts",   desc: "Total accounts (net)" },
            { l: "Debt owed",      fi: "debt",       desc: "Cards, loans — enter as negative" },
            { l: "Securities",     fi: "securities", desc: "TFSA, investments" },
            { l: "Crypto",         fi: "crypto",     desc: "Crypto market value" },
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
          <Label>JMF Group — Overview</Label>
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>Contact Ahmed for full group details.</div>
          <Row label="Properties"        last={false}><span style={{ color: C.text }}>{data.properties.length} holdings</span></Row>
          <Row label="Business entities" last={true}><span style={{ color: C.text }}>{data.businesses.length} companies</span></Row>
        </Card>
      </div>
    </div>
  );
}

// ─── PROPERTY CARD ────────────────────────────────────────────────────────────
function PropCard({ prop, onUpdate, isAdmin }) {
  const [open, setOpen] = useState(false);
  const equity  = safe(prop.market) - safe(prop.mortgage);
  const ltv     = safe(prop.mortgage) > 0 ? ((safe(prop.mortgage) / safe(prop.market)) * 100).toFixed(1) : "0";
  const gainAmt = safe(prop.market) - safe(prop.purchase);
  const gainPct = ((gainAmt / safe(prop.purchase)) * 100).toFixed(1);
  const cf      = safe(prop.rentalIncome) - safe(prop.monthlyPayment);
  const eqColor = equity > 500000 ? C.gold : equity > 0 ? C.amber : C.red;

  return (
    <div style={{ background: C.card, border: `1px solid ${open ? C.gold : C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 10, transition: "border-color 0.15s" }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
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
            <div style={{ fontSize: 18, fontFamily: C.mono, fontWeight: 700, color: eqColor }}>{$K(equity)}</div>
          </div>
          <span style={{ color: open ? C.gold : C.textDim, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 20 }}>
          <div style={{ fontSize: 12, color: C.textMid, fontStyle: "italic", marginBottom: 16, lineHeight: 1.6 }}>{prop.notes}</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20 }}>
            <div>
              <Label>Valuation</Label>
              {[
                { label: "Purchase price",   val: <span style={{ color: C.textMid, fontFamily: C.mono }}>{$F(prop.purchase)}</span> },
                { label: "Market value",     val: <EditNum value={safe(prop.market)}      onChange={v => onUpdate("market", v)}      locked={!isAdmin} /> },
                { label: "Mortgage balance", val: <span style={{ color: C.red, fontFamily: C.mono }}>{$F(prop.mortgage)}</span> },
                { label: "Equity",           val: <span style={{ color: eqColor, fontWeight: 700, fontFamily: C.mono }}>{$F(equity)}</span> },
                { label: "Gain vs purchase", val: <span style={{ color: gainAmt >= 0 ? C.green : C.red, fontFamily: C.mono }}>{gainAmt >= 0 ? "+" : ""}{gainPct}%</span> },
                { label: "LTV ratio",        val: <span style={{ color: parseFloat(ltv) > 80 ? C.red : parseFloat(ltv) > 65 ? C.amber : C.green, fontFamily: C.mono, fontWeight: 600 }}>{ltv}%</span> },
              ].map((r, i, arr) => (
                <Row key={i} label={r.label} last={i === arr.length - 1}>{r.val}</Row>
              ))}
            </div>

            <div>
              <Label>Mortgage</Label>
              {[
                { label: "Lender",      val: <span style={{ color: C.text, fontFamily: C.sans, fontSize: 13 }}>{prop.lender}</span> },
                { label: "Rate",        val: <span style={{ color: C.amber, fontFamily: C.mono }}>{prop.rate}</span> },
                { label: "Type",        val: <span style={{ color: C.text, fontFamily: C.sans, fontSize: 12 }}>{prop.rateType}</span> },
                { label: "Maturity",    val: <span style={{ color: C.text, fontFamily: C.mono, fontSize: 13 }}>{prop.maturity}</span> },
                { label: "Monthly P+I", val: <EditNum value={safe(prop.monthlyPayment)} onChange={v => onUpdate("monthlyPayment", v)} locked={!isAdmin} /> },
              ].map((r, i) => <Row key={i} label={r.label} last={i === 4}>{r.val}</Row>)}

              <div style={{ marginTop: 16 }}>
                <Label>Rental Income</Label>
                <Row label="Monthly rent" last>
                  <EditNum value={safe(prop.rentalIncome)} onChange={v => onUpdate("rentalIncome", v)} locked={!isAdmin} />
                </Row>
              </div>
            </div>
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
  const netEquity = safe(biz.cashAccounts) - safe(biz.liabilities);
  const netProfit = safe(biz.revenue) - safe(biz.expenses);

  return (
    <div style={{ background: C.card, border: `1px solid ${open ? C.gold : C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: C.blueLight, color: C.blueText, borderRadius: 6, fontSize: 10, fontWeight: 700, padding: "4px 8px", letterSpacing: "0.06em", flexShrink: 0 }}>CORP</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{biz.name}</div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Ontario corporation · {biz.abbr}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 2 }}>Corp. equity</div>
            <div style={{ fontSize: 18, fontFamily: C.mono, fontWeight: 700, color: netEquity >= 0 ? C.gold : C.red }}>{$K(netEquity)}</div>
          </div>
          <span style={{ color: open ? C.gold : C.textDim, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 20 }}>
          <div style={{ fontSize: 12, color: C.textMid, fontStyle: "italic", marginBottom: 16, lineHeight: 1.6 }}>{biz.notes}</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20 }}>
            <div>
              <Label>Assets</Label>
              <Row label="Cash & accounts"><EditNum value={safe(biz.cashAccounts)} onChange={v => onUpdate("cashAccounts", v)} locked={!isAdmin} /></Row>
              <Row label="Monthly revenue"><EditNum value={safe(biz.revenue)} onChange={v => onUpdate("revenue", v)} locked={!isAdmin} /></Row>
              <Row label="Monthly expenses"><EditNum value={safe(biz.expenses)} onChange={v => onUpdate("expenses", v)} locked={!isAdmin} /></Row>
              <Row label="Net profit / mo" last>
                <span style={{ color: netProfit >= 0 ? C.gold : C.red, fontFamily: C.mono, fontWeight: 700 }}>{$F(netProfit)}</span>
              </Row>
            </div>
            <div>
              <Label>Liabilities</Label>
              <Row label="Total liabilities"><span style={{ color: C.red, fontFamily: C.mono }}>{$F(safe(biz.liabilities))}</span></Row>
              <Row label="CRA tax payable"><EditNum value={safe(biz.taxPayable)} onChange={v => onUpdate("taxPayable", v)} locked={!isAdmin} /></Row>
              <Row label="Credit cards"><span style={{ color: C.red, fontFamily: C.mono }}>{$F(safe(biz.creditCards))}</span></Row>
              <Row label="Net equity" last>
                <span style={{ color: netEquity >= 0 ? C.gold : C.red, fontFamily: C.mono, fontWeight: 700 }}>{$F(netEquity)}</span>
              </Row>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
function AdminDashboard({ user, data, setData, onLogout }) {
  const [tab, setTab]         = useState("overview");
  const [saved, setSaved]     = useState(false);
  const [cashModal, setCashModal] = useState(false);
  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  // ── Derived numbers (all NaN-safe) ──
  const indNet     = f => safe(f.cash) + safe(f.accounts) + safe(f.debt) + safe(f.securities) + safe(f.crypto);
  const totalREEq  = data.properties.reduce((s, p) => s + (safe(p.market) - safe(p.mortgage)), 0);
  const totalREVal = data.properties.reduce((s, p) => s + safe(p.market), 0);
  const totalREDbt = data.properties.reduce((s, p) => s + safe(p.mortgage), 0);
  const totalPers  = data.individuals.reduce((s, f) => s + indNet(f), 0);
  const totalBiz   = data.businesses.reduce((s, b) => s + (safe(b.cashAccounts) - safe(b.liabilities)), 0);
  const totalNW    = totalREEq + totalPers + totalBiz;
  const totalIn    = data.cashflow.income.reduce((s, i) => s + safe(i.amount), 0);
  const totalOut   = data.cashflow.obligations.reduce((s, o) => s + safe(o.amount), 0);
  const gap        = totalIn - totalOut;
  const totalMtg   = data.properties.reduce((s, p) => s + safe(p.monthlyPayment), 0);
  const aj         = data.individuals.find(f => f.id === 1);
  const cashStale  = safe(aj?.cash) === 0;

  function updProp(id, f, v) { const arr = data.properties.map(p => p.id === id ? { ...p, [f]: safe(v) } : p); saveToDB("properties", arr); setData(d => ({ ...d, properties: arr })); showSaved(); }
  function updInd(id, f, v)  { const arr = data.individuals.map(x => x.id === id ? { ...x, [f]: safe(v) } : x); saveToDB("individuals", arr); setData(d => ({ ...d, individuals: arr })); showSaved(); }
  function updBiz(id, f, v)  { const arr = data.businesses.map(b => b.id === id ? { ...b, [f]: safe(v) } : b); saveToDB("businesses", arr); setData(d => ({ ...d, businesses: arr })); showSaved(); }
  function updCF(type, idx, v) { const a = [...data.cashflow[type]]; a[idx] = { ...a[idx], amount: safe(v) }; const cf = { ...data.cashflow, [type]: a }; saveToDB("cashflow", cf); setData(d => ({ ...d, cashflow: cf })); showSaved(); }
  function saveCash(v) { updInd(1, "cash", v); }

  const TABS = ["Overview", "Real Estate", "Individuals", "Businesses", "Cash Flow"];
  const tabId = t => t.toLowerCase().replace(" ", "");

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: C.sans }}>

      {cashModal && (
        <CashModal
          current={safe(aj?.cash)}
          onSave={v => { saveCash(v); showSaved(); }}
          onClose={() => setCashModal(false)}
        />
      )}

      {/* NAV */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.gold, letterSpacing: "0.06em" }}>JMF</span>
          <span style={{ fontSize: 11, color: C.textDim }}>Family Office</span>
          {saved && <span style={{ fontSize: 11, color: C.green, background: C.greenLight, borderRadius: 4, padding: "2px 8px" }}>✓ Saved</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {cashStale && (
            <button onClick={() => setCashModal(true)}
              style={{ fontSize: 11, color: C.amber, background: C.amberLight, border: `1px solid #F0D080`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: C.sans, fontWeight: 600 }}>
              Cash not updated
            </button>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, color: C.goldText, background: C.goldLight, borderRadius: 4, padding: "3px 8px", letterSpacing: "0.06em" }}>ADMIN</span>
          <span style={{ fontSize: 12, color: C.textMid }}>{user.name}</span>
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
          Real estate equity + personal + business equity · {data.lastUpdated}
        </div>
      </div>

      {/* KPI ROW — scrollable on mobile */}
      <div style={{ overflowX: "auto", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", minWidth: "max-content" }}>
          {[
            { label: "RE Equity",      val: $K(totalREEq),  sub: `${((totalREEq / Math.max(1, Math.abs(totalNW))) * 100).toFixed(0)}% of net worth`, color: C.gold  },
            { label: "Personal Net",   val: $K(totalPers),  sub: totalPers < 0 ? "Deficit" : "All individuals",                                       color: totalPers < 0 ? C.red : C.green },
            { label: "Business Equity",val: $K(totalBiz),   sub: "Kratos + JMF Logistics",                                                            color: C.blue  },
            { label: "RE Mortgages",   val: $K(totalMtg),   sub: `${$K(totalMtg * 12)}/yr across 4 properties`,                                       color: C.red   },
            { label: "Monthly Gap",    val: totalIn === 0 ? "—" : $K(gap), sub: totalIn === 0 ? "Add income to calculate" : gap < 0 ? "Monthly deficit" : "Monthly surplus", color: totalIn === 0 ? C.textDim : gap < 0 ? C.red : C.green },
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
            {/* Summary stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
              {[
                { label: "Real Estate Equity",       val: $K(totalREEq),  color: C.gold,  bg: C.goldLight,  sub: `${data.properties.length} properties` },
                { label: "Personal (all members)",   val: $K(totalPers),  color: totalPers < 0 ? C.red : C.green, bg: totalPers < 0 ? C.redLight : C.greenLight, sub: `${data.individuals.length} individuals` },
                { label: "Business Equity",          val: $K(totalBiz),   color: C.blue,  bg: C.blueLight,  sub: `${data.businesses.length} entities` },
                { label: "Total RE Debt",            val: $K(totalREDbt), color: C.red,   bg: C.redLight,   sub: "Combined mortgage balance" },
              ].map((s, i) => (
                <div key={i} style={{ background: s.bg, borderRadius: 12, padding: 18 }}>
                  <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontFamily: C.mono, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Property mini grid */}
            <Card style={{ marginBottom: 14 }}>
              <Label>Real Estate Portfolio</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
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

            {/* Business entity mini grid */}
            <Card>
              <Label>Business Entities</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {data.businesses.map(b => {
                  const eq = safe(b.cashAccounts) - safe(b.liabilities);
                  return (
                    <div key={b.id} onClick={() => setTab("businesses")}
                      style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
                      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={{ background: C.blueLight, color: C.blueText, borderRadius: 4, fontSize: 9, fontWeight: 700, padding: "2px 6px" }}>CORP</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{b.name}</div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: C.textDim }}>Cash</span>
                        <span style={{ fontFamily: C.mono, color: C.green }}>{$K(safe(b.cashAccounts))}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                        <span style={{ color: C.textDim }}>Liabilities</span>
                        <span style={{ fontFamily: C.mono, color: C.red }}>{$K(safe(b.liabilities))}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                        <span style={{ color: C.textMid, fontWeight: 600 }}>Net equity</span>
                        <span style={{ fontFamily: C.mono, fontWeight: 700, color: eq >= 0 ? C.gold : C.red }}>{$K(eq)}</span>
                      </div>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
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
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>Click any property to expand · Editable values update in real time</div>
            {data.properties.map(p => <PropCard key={p.id} prop={p} onUpdate={(f, v) => updProp(p.id, f, v)} isAdmin={true} />)}
          </div>
        )}

        {/* ── INDIVIDUALS ── */}
        {tab === "individuals" && (
          <div>
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
                      { l: "Cash / Vault",   fi: "cash"       },
                      { l: "Bank accounts",  fi: "accounts"   },
                      { l: "Debt owed",      fi: "debt"       },
                      { l: "Securities",     fi: "securities" },
                      { l: "Crypto",         fi: "crypto"     },
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
          </div>
        )}

        {/* ── BUSINESSES ── */}
        {tab === "businesses" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Total Corp Cash",   val: $K(data.businesses.reduce((s, b) => s + safe(b.cashAccounts), 0)), color: C.green },
                { label: "Total Liabilities", val: $K(data.businesses.reduce((s, b) => s + safe(b.liabilities), 0)),  color: C.red   },
                { label: "CRA Payable",       val: $K(data.businesses.reduce((s, b) => s + safe(b.taxPayable), 0)),   color: C.amber },
                { label: "Net Corp Equity",   val: $K(totalBiz),                                                       color: C.gold  },
              ].map((s, i) => (
                <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontFamily: C.mono, fontWeight: 700, color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>

            <div style={{ background: C.amberLight, border: `1px solid #F0D080`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: C.amber, lineHeight: 1.7 }}>
              These are separate legal entities. Business accounts and liabilities are independent of personal finances. CRA tax payable of $120K is reflected in Kratos liabilities.
            </div>

            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 10 }}>Entity 1 of 2</div>
            <BizCard biz={data.businesses[0]} onUpdate={(f, v) => updBiz(data.businesses[0].id, f, v)} isAdmin={true} />

            <div style={{ fontSize: 12, color: C.textDim, marginTop: 4, marginBottom: 10 }}>Entity 2 of 2</div>
            <BizCard biz={data.businesses[1]} onUpdate={(f, v) => updBiz(data.businesses[1].id, f, v)} isAdmin={true} />
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
  const [currentUser, setCurrentUser] = useState(null);
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    loadFromDB().then(dbData => {
      if (dbData) {
        setData({
          ...DEFAULT,
          individuals: dbData.individuals || DEFAULT.individuals,
          properties:  dbData.properties  || DEFAULT.properties,
          businesses:  dbData.businesses  || DEFAULT.businesses,
          cashflow:    dbData.cashflow    || DEFAULT.cashflow,
        });
      } else {
        saveToDB("individuals", DEFAULT.individuals);
        saveToDB("properties",  DEFAULT.properties);
        saveToDB("businesses",  DEFAULT.businesses);
        saveToDB("cashflow",    DEFAULT.cashflow);
        setData(DEFAULT);
      }
      setLoading(false);
    });
  }, []);

  function updInd(id, f, v) {
    const arr = data.individuals.map(x => x.id === id ? { ...x, [f]: safe(v) } : x);
    saveToDB("individuals", arr);
    setData(d => ({ ...d, individuals: arr }));
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: C.sans }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: C.gold, letterSpacing: "0.08em", marginBottom: 10 }}>JMF</div>
      <div style={{ fontSize: 12, color: C.textDim }}>Loading financial data…</div>
    </div>
  );

  if (!currentUser) return <LoginScreen onLogin={setCurrentUser} />;
  if (currentUser.role === "individual") return <MemberView user={currentUser} data={data} onUpdate={updInd} onLogout={() => setCurrentUser(null)} />;
  return <AdminDashboard user={currentUser} data={data} setData={setData} onLogout={() => setCurrentUser(null)} />;
}