import { useState } from "react";
import {
  PERSONAL_PROFILE,
  BODY_COMP,
  BLOODWORK,
  HEALTH_METRICS,
} from "./data/personalHealth";

// ─── THEME (mirrors App.js C tokens — kept local so App.js is not modified) ──
const C = {
  bg:         "#0C1520",
  surface:    "#111B2C",
  card:       "#141F2E",
  border:     "#1D2E42",
  nav:        "#080D18",
  navBorder:  "rgba(255,255,255,0.08)",
  navText:    "rgba(255,255,255,0.50)",
  gold:       "#C9A84C",
  goldLight:  "rgba(201,168,76,0.15)",
  goldText:   "#D4B46A",
  red:        "#E05555",
  redLight:   "rgba(224,85,85,0.16)",
  redText:    "#F09090",
  green:      "#27AE60",
  greenLight: "rgba(39,174,96,0.16)",
  greenText:  "#52C98A",
  amber:      "#E6A817",
  amberLight: "rgba(230,168,23,0.16)",
  amberText:  "#F5C842",
  blue:       "#3B82F6",
  blueLight:  "rgba(59,130,246,0.14)",
  blueText:   "#7EC4E6",
  text:       "#E8EDF5",
  textMid:    "#8FA8C4",
  textDim:    "#6B8BA8",
  shadow:     "0 1px 4px rgba(0,0,0,0.40), 0 4px 16px rgba(0,0,0,0.25)",
  shadowMd:   "0 4px 16px rgba(0,0,0,0.50), 0 8px 32px rgba(0,0,0,0.35)",
  mono:       "'SF Mono', 'Courier New', monospace",
  sans:       "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const STATUS_COLORS = {
  HIGH:    { bg: C.redLight,   text: C.redText,   border: "rgba(224,85,85,0.35)"   },
  NORMAL:  { bg: C.greenLight, text: C.greenText,  border: "rgba(39,174,96,0.35)"  },
  OPTIMAL: { bg: C.greenLight, text: C.greenText,  border: "rgba(39,174,96,0.35)"  },
  CUTTING: { bg: C.amberLight, text: C.amberText,  border: "rgba(230,168,23,0.35)" },
  LOW:     { bg: C.redLight,   text: C.redText,   border: "rgba(224,85,85,0.35)"   },
};

function computeAge(dob) {
  const birth = new Date(dob);
  const now   = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  ) age--;
  return age;
}

function dateLabel(d) {
  // "2026-05" → "May 2026"  |  "2026-05-17" → "May 17, 2026"
  const [yr, mo, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const m = months[parseInt(mo, 10) - 1];
  return day ? `${m} ${parseInt(day, 10)}, ${yr}` : `${m} ${yr}`;
}

// ─── MINI TREND LINE (SVG polyline) ──────────────────────────────────────────
function MiniTrendLine({ series, color, w = 120, h = 40 }) {
  if (!series || series.length < 2) return null;
  const vals = series.map(s => s.val);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const span = Math.max(0.01, maxV - minV);
  const toX  = i => (i / (series.length - 1)) * (w - 4) + 2;
  const toY  = v => h - 4 - ((v - minV) / span) * (h - 8);
  const pts  = series.map((s, i) => `${toX(i)},${toY(s.val)}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      {series.map((s, i) => (
        <circle key={i} cx={toX(i)} cy={toY(s.val)} r={i === series.length - 1 ? 3.5 : 2} fill={color} />
      ))}
    </svg>
  );
}

// ─── HEALTH TAB ──────────────────────────────────────────────────────────────
function HealthTab() {
  const isMobile = window.innerWidth < 768;
  return (
    <div>
      {/* LDL Alert Banner */}
      <div style={{
        background: C.redLight,
        border: `1px solid rgba(224,85,85,0.45)`,
        borderLeft: `4px solid ${C.red}`,
        borderRadius: 10,
        padding: "16px 20px",
        marginBottom: 24,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}>
        <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>⚠</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.redText, marginBottom: 4 }}>
            LDL Cholesterol — Action Required
          </div>
          <div style={{ fontSize: 12, color: C.redText, lineHeight: 1.7 }}>
            LDL climbed from 2.53 mmol/L (2021) to{" "}
            <strong>4.76 mmol/L</strong> (May 2026), past the 3.5 mmol/L treatment threshold.
            Pattern is consistent with familial hypercholesterolaemia.{" "}
            <strong>Book a physician follow-up.</strong>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 16,
      }}>
        {HEALTH_METRICS.map(m => {
          const sc    = STATUS_COLORS[m.status] || STATUS_COLORS.NORMAL;
          const bwKey = m.key === "bodyFat" ? null : m.key;
          const series = bwKey ? (BLOODWORK[bwKey]?.series || []) : [];
          const trendColor = m.color === "red" ? C.red : m.color === "green" ? C.green : C.amber;
          return (
            <div key={m.key} style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderTop: `3px solid ${trendColor}`,
              borderRadius: 12,
              padding: "18px 20px",
              boxShadow: C.shadow,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600 }}>
                  {m.label}
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                  background: sc.bg, color: sc.text,
                  border: `1px solid ${sc.border}`,
                  borderRadius: 4, padding: "2px 7px",
                }}>
                  {m.status}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontFamily: C.mono, fontSize: 26, fontWeight: 800, color: trendColor, letterSpacing: -0.5, lineHeight: 1.1 }}>
                    {m.latest}
                  </div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{m.unit}</div>
                  <div style={{ fontSize: 10, color: C.textMid, marginTop: 6 }}>{m.note}</div>
                </div>
                {series.length >= 2 && (
                  <MiniTrendLine series={series} color={trendColor} w={110} h={44} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── BODY TAB ────────────────────────────────────────────────────────────────
function BodyTab() {
  const isMobile  = window.innerWidth < 768;
  const data      = BODY_COMP;
  const actuals   = data.filter(d => d.source !== "TARGET");
  const target    = data.find(d => d.source === "TARGET");

  // SVG chart — BF% arc
  const W = isMobile ? 340 : 620;
  const H = 220;
  const PL = 42; const PR = 12; const PT = 14; const PB = 32;
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;

  const bfVals = actuals.map(d => d.bf);
  const minBF = Math.max(0, Math.min(...bfVals, target?.bf ?? 99) - 1);
  const maxBF = Math.max(...bfVals) + 1;

  // Normalise date string to sortable
  const toMs = d => {
    const parts = d.split("-");
    if (parts.length === 3) return new Date(d).getTime();
    return new Date(`${d}-01`).getTime();
  };
  const allDates = data.map(d => toMs(d.date));
  const minMs = Math.min(...allDates);
  const maxMs = Math.max(...allDates);

  const toX = ms => PL + ((ms - minMs) / (maxMs - minMs)) * plotW;
  const toY = bf => PT + plotH - ((bf - minBF) / (maxBF - minBF)) * plotH;

  const actualPts = actuals.map(d => `${toX(toMs(d.date))},${toY(d.bf)}`).join(" ");
  const targetX   = target ? toX(toMs(target.date)) : null;
  const targetY   = target ? toY(target.bf) : null;

  // Y-axis grid lines
  const gridVals = [];
  const step = (maxBF - minBF) > 10 ? 5 : 2;
  for (let v = Math.ceil(minBF / step) * step; v <= maxBF; v += step) gridVals.push(v);

  return (
    <div>
      {/* Body Composition Chart */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: isMobile ? "16px 12px" : "20px 24px", marginBottom: 20, boxShadow: C.shadow }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 16 }}>
          Body Fat % — 7-Year Arc
        </div>
        <div style={{ overflowX: "auto" }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", fontFamily: C.sans }}>
            {/* Grid lines */}
            {gridVals.map(v => (
              <g key={v}>
                <line x1={PL} y1={toY(v)} x2={W - PR} y2={toY(v)} stroke={C.border} strokeWidth={0.7} strokeDasharray="3,3" />
                <text x={PL - 5} y={toY(v) + 3.5} textAnchor="end" fontSize={8} fill={C.textDim} fontFamily={C.mono}>{v}%</text>
              </g>
            ))}

            {/* Target dashed line */}
            {target && (
              <line x1={targetX} y1={PT} x2={targetX} y2={H - PB} stroke={C.gold} strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
            )}

            {/* Fill area under line */}
            {actuals.length >= 2 && (
              <polygon
                points={`${toX(toMs(actuals[0].date))},${H - PB} ${actualPts} ${toX(toMs(actuals[actuals.length - 1].date))},${H - PB}`}
                fill="rgba(59,130,246,0.07)"
              />
            )}

            {/* Main BF% line */}
            <polyline points={actualPts} fill="none" stroke={C.blue} strokeWidth={2} strokeLinejoin="round" />

            {/* Data points */}
            {actuals.map((d, i) => (
              <circle key={i} cx={toX(toMs(d.date))} cy={toY(d.bf)} r={3.5} fill={C.blue} stroke={C.card} strokeWidth={1.5} />
            ))}

            {/* Target point */}
            {target && (
              <g>
                <circle cx={targetX} cy={targetY} r={5} fill={C.gold} stroke={C.card} strokeWidth={2} />
                <text x={targetX} y={targetY - 9} textAnchor="middle" fontSize={8} fill={C.goldText} fontWeight="700">TARGET</text>
              </g>
            )}

            {/* X-axis date labels */}
            {actuals.filter((_, i) => {
              if (actuals.length <= 6) return true;
              return i === 0 || i === actuals.length - 1 || i % 2 === 0;
            }).map((d, i) => {
              const parts = d.date.split("-");
              const lbl = parts.length === 3 ? `${parts[0].slice(2)}/${parts[1]}` : `${parts[0].slice(2)}/${parts[1]}`;
              return (
                <text key={i} x={toX(toMs(d.date))} y={H - PB + 14} textAnchor="middle" fontSize={8} fill={C.textDim} fontFamily={C.sans}>{lbl}</text>
              );
            })}
            {target && (
              <text x={targetX} y={H - PB + 14} textAnchor="middle" fontSize={8} fill={C.goldText}>Aug '26</text>
            )}
          </svg>
        </div>
        {/* Legend */}
        <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 20, height: 2, background: C.blue }} />
            <span style={{ fontSize: 10, color: C.textDim }}>Body Fat %</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: C.gold }} />
            <span style={{ fontSize: 10, color: C.textDim }}>Target (12%)</span>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: C.shadow }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: "0.10em", textTransform: "uppercase" }}>
          Body Composition Log
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.surface }}>
                {["Date", "Weight (lb)", "Body Fat %", "SMM (lb)", "Source"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => {
                const isTarget = d.source === "TARGET";
                const isLatest = !isTarget && i === data.filter(x => x.source !== "TARGET").length - 1;
                return (
                  <tr key={i} style={{
                    borderTop: `1px solid ${C.border}`,
                    background: isLatest ? "rgba(201,168,76,0.06)" : isTarget ? "rgba(201,168,76,0.10)" : "transparent",
                  }}>
                    <td style={{ padding: "10px 16px", fontFamily: C.mono, color: isTarget ? C.goldText : C.text, whiteSpace: "nowrap" }}>{dateLabel(d.date)}</td>
                    <td style={{ padding: "10px 16px", fontFamily: C.mono, color: C.text }}>{d.weight}</td>
                    <td style={{ padding: "10px 16px", fontFamily: C.mono, color: isTarget ? C.gold : d.bf >= 20 ? C.red : d.bf >= 15 ? C.amber : C.green, fontWeight: 700 }}>{d.bf}%</td>
                    <td style={{ padding: "10px 16px", fontFamily: C.mono, color: C.text }}>{d.smm}</td>
                    <td style={{ padding: "10px 16px", color: isTarget ? C.goldText : C.textDim, fontSize: 11, fontStyle: isTarget ? "normal" : "italic", fontWeight: isTarget ? 700 : 400 }}>{d.source}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── BLOODWORK TAB ───────────────────────────────────────────────────────────
function BloodworkTab() {
  const isMobile = window.innerWidth < 768;
  const metrics  = Object.values(BLOODWORK);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))",
      gap: 16,
    }}>
      {metrics.map(m => {
        const latest   = m.series[m.series.length - 1];
        const prev     = m.series.length >= 2 ? m.series[m.series.length - 2] : null;
        const delta    = prev ? (latest.val - prev.val) : null;
        const isHigh   = m.warning && latest.val > m.warning;
        const accentColor = isHigh ? C.red : C.green;
        return (
          <div key={m.label} style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderTop: `3px solid ${accentColor}`,
            borderRadius: 12,
            padding: "18px 20px",
            boxShadow: C.shadow,
          }}>
            <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
              {m.label}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
              <div>
                <span style={{ fontFamily: C.mono, fontSize: 28, fontWeight: 800, color: accentColor, letterSpacing: -0.5 }}>
                  {latest.val}
                </span>
                <span style={{ fontSize: 12, color: C.textDim, marginLeft: 6 }}>{m.unit}</span>
                {delta !== null && (
                  <div style={{ fontSize: 11, color: delta > 0 ? (isHigh ? C.red : C.green) : C.green, marginTop: 2 }}>
                    {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)} from {dateLabel(prev.date)}
                  </div>
                )}
              </div>
              {m.series.length >= 2 && (
                <MiniTrendLine series={m.series} color={accentColor} w={100} h={44} />
              )}
            </div>
            {/* History */}
            {m.series.length > 0 && (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                {m.series.map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: i < m.series.length - 1 ? 6 : 0 }}>
                    <span style={{ fontSize: 11, color: C.textDim }}>{dateLabel(s.date)}</span>
                    <span style={{ fontFamily: C.mono, fontSize: 12, color: i === m.series.length - 1 ? accentColor : C.textMid, fontWeight: i === m.series.length - 1 ? 700 : 400 }}>
                      {s.val} {m.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 10, fontSize: 10, color: C.textDim, fontStyle: "italic" }}>
              Ref: {m.refRange}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── PROFILE TAB ─────────────────────────────────────────────────────────────
function ProfileTab() {
  const p        = PERSONAL_PROFILE;
  const latest   = BODY_COMP.filter(d => d.source !== "TARGET").slice(-1)[0];
  const age      = computeAge(p.dob);
  const rows = [
    { label: "Full Name",       val: p.name },
    { label: "Date of Birth",   val: `${dateLabel(p.dob)} (age ${age})` },
    { label: "Height",          val: `5'9" / ${p.heightCm} cm` },
    { label: "Current Weight",  val: `${latest.weight} lb`, mono: true },
    { label: "Body Fat",        val: `${latest.bf}%`, mono: true },
    { label: "Lean Mass (SMM)", val: `${latest.smm} lb`, mono: true },
    { label: "Access",          val: p.email },
    { label: "Data as of",      val: dateLabel(latest.date) },
  ];
  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: C.shadow }}>
        {/* Monogram hero */}
        <div style={{ background: `linear-gradient(135deg, #0E1E30 0%, #152238 100%)`, padding: "32px 28px", display: "flex", alignItems: "center", gap: 20, borderBottom: `1px solid ${C.border}` }}>
          <div style={{
            width: 64, height: 64, borderRadius: 14,
            background: "#000", border: `2px solid rgba(201,168,76,0.5)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, overflow: "hidden",
          }}>
            <img src={process.env.PUBLIC_URL + "/oj-logo.png"} alt="OJ" style={{ width: 52, height: 52, objectFit: "contain", mixBlendMode: "screen" }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{p.name}</div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 4, letterSpacing: "0.05em" }}>Operative File — Private</div>
          </div>
        </div>
        {/* Fields */}
        {rows.map((r, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "13px 24px",
            borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none",
            gap: 16,
          }}>
            <span style={{ fontSize: 11, color: C.textDim, letterSpacing: "0.04em", flexShrink: 0 }}>{r.label}</span>
            <span style={{ fontSize: 13, color: C.text, fontFamily: r.mono ? C.mono : C.sans, fontWeight: r.mono ? 600 : 400, textAlign: "right" }}>{r.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PERSONAL PAGE (root export) ─────────────────────────────────────────────
const TABS = ["Health", "Body", "Bloodwork", "Profile"];

export default function PersonalPage({ onBack }) {
  const [tab, setTab] = useState("Health");

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: C.sans }}>

      {/* NAV */}
      <div style={{
        background: C.nav,
        borderBottom: `1px solid ${C.navBorder}`,
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        {/* Left: back + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={onBack}
            style={{
              background: "transparent",
              border: `1px solid rgba(255,255,255,0.12)`,
              borderRadius: 6,
              color: C.navText,
              fontSize: 11,
              padding: "5px 12px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            ← JMF Family Office
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "#000", border: `1px solid rgba(201,168,76,0.4)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, overflow: "hidden",
            }}>
              <img src={process.env.PUBLIC_URL + "/oj-logo.png"} alt="OJ" style={{ width: 24, height: 24, objectFit: "contain", mixBlendMode: "screen" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Ousmane Jebrayilli</span>
            <span style={{ fontSize: 11, color: C.textDim }}>· Personal</span>
          </div>
        </div>
        {/* Right: private badge */}
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
          background: "rgba(59,130,246,0.12)", color: C.blueText,
          border: "1px solid rgba(59,130,246,0.3)",
          borderRadius: 4, padding: "2px 8px", flexShrink: 0,
        }}>PRIVATE</span>
      </div>

      {/* TABS */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", padding: "0 24px" }}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "12px 18px",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.04em",
                border: "none",
                cursor: "pointer",
                background: "transparent",
                color: tab === t ? C.gold : C.textDim,
                borderBottom: tab === t ? `2px solid ${C.gold}` : "2px solid transparent",
                whiteSpace: "nowrap",
                fontFamily: C.sans,
                transition: "color 0.15s",
              }}
            >{t}</button>
          ))}
        </div>
      </div>

      {/* PAGE CONTENT */}
      <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
        {tab === "Health"    && <HealthTab />}
        {tab === "Body"      && <BodyTab />}
        {tab === "Bloodwork" && <BloodworkTab />}
        {tab === "Profile"   && <ProfileTab />}
      </div>

      {/* Footer */}
      <div style={{ padding: "24px 24px 40px", textAlign: "center" }}>
        <span style={{ fontSize: 10, color: C.textDim, fontStyle: "italic" }}>
          This is a private reference view. Not medical advice.
        </span>
      </div>
    </div>
  );
}
