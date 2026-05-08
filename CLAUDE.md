# CLAUDE.md — JMF Family Office Dashboard

This file is the persistent context for Claude Code. Read
it fully at the start of every session before touching any
code. The conventions, architecture, and safety protocol
described here override any default Claude Code behavior.

---

## 1. Project Identity

**Name:** JMF Family Office Financial Command Center
**Owner / Admin:** Ahmed Jebrayilli (AJ)
**Purpose:** Consolidated financial dashboard for the Jamet
Group — operating businesses, real estate portfolio, and
individual family members. Source of truth for net worth,
cash flow, and monthly submissions.

This is a real production application used by family
members. Data integrity is non-negotiable.

---

## 2. Stack & Infrastructure

- **Frontend:** React (Create React App), single-file
  architecture in `src/App.js` (~8,133 lines)
- **Backend / DB:** Supabase
  - URL: https://bxxnjmottokudtjgigss.supabase.co
  - Tables: `submissions`, `reporting_periods`
- **Deployment:** Vercel (auto-deploy from `main` branch)
- **Repo:** github.com/ousmane-jebrayilli/jmf-dashboard
- **Live URL:** jmf-dashboard.vercel.app
- **Dev environment:** VS Code, Node.js, Git, GitHub Desktop
- **Charting:** recharts (verify import before adding charts)

---

## 3. Architecture & Data Model

The app has 5 tabs:
1. **Overview** — consolidated view, KPIs, allocation
2. **Real Estate** — per-property cards, mortgages, rent
3. **Individuals** — per-person liquid assets snapshot
4. **Businesses** — per-entity balance sheets, P&L logs
5. **Cash Flow** — monthly inflows vs obligations

All data persists through Supabase. State is hydrated on
mount via a `mergeById` pattern that merges DEFAULT seed
data with stored submissions. **Never break the mergeById
bootstrap or the seed data structure** — this is how the
app survives empty database states.

Three completely separate top-level data structures:
- `properties[]` — real estate
- `individuals[]` — family members
- `businesses[]` — corporate entities

These never share fields or merge. Treat them as siblings.

---

## 4. Family Members & Entities

**Family members tracked (4 active):**
- Nazila Isgandarova
- Yasin Majidov
- Maryam Majidova
- Akbar Majidov

**Business entities:**
- **Kratos Moving Inc.** — operating co, CEO: James Bond
- **JMF Logistics Inc.** — operating co
- **PRIMA Centre for Mental Health and Wellness Inc.**
  — Nazila's operating corp
- **ASWC** — non-profit collective fund. Tracked for
  visibility ONLY. **Explicitly excluded from all net
  worth math.** Never include ASWC in NW calculations.

---

## 5. Real Estate Portfolio (5 properties)

| Property | Lender | Notes |
|---|---|---|
| 27 Roytec Rd. | TD Bank | Variable, P+1.80% |
| 3705 Farr Ave. | None | Mortgage-free, vacant land, 50% co-owned with Jamal |
| 121 Milky Way | Equitable Bank | Owner-occupied, 5.79% Fixed, matures Apr 1 2027 |
| 51 Ahchie Crt. | Equitable Bank | 5.79% Fixed, matures Apr 1 2027 |
| 4 New Seabury Dr. | Equitable Bank | 5.94% Fixed, matures Dec 2029, 67% JMF / 33% Abassli family |

Plus tracked land: Saray Twin Land Parcels, Saray House.

---

## 6. Individual Cards — Six Fields Only

Every individual card displays exactly these six fields,
in this order:
1. Accounts (net) — already nets debts; debts are NOT a
   separate line
2. Cash / Vault
3. Securities
4. Crypto
5. Physical Assets
6. Net Worth

Do not add fields. Do not split debts back out.

---

## 7. Design System

- **Background:** #F7F7F5 (white institutional)
- **Gold accent:** #B8962E
- **Status pills:** Strong (green), Watch (amber),
  Risk (red)
- **Font:** professional sans-serif, monospace for numbers
- **No dark mode.** Don't propose one.
- **Mobile-first:** must render correctly at 375px width.
  KPI strips and tab bars scroll horizontally — never
  overflow or clip.
- **Inline editing:** click any editable value to edit;
  green ✓ Saved badge fades after 2.5s.

---

## 8. Implementation Rules — Non-Negotiable

1. **Never display `NaN`.** All numbers pass through
   `safe(n)`: `if (isNaN(n) || n == null) return 0`.
2. **All DB writes go through `saveToDB(key, value)`.**
3. **All DB reads come from `loadFromDB()`.**
4. **Never mix individuals, businesses, and properties**
   into shared structures.
5. **ASWC is excluded from all NW math** — tracked only.
6. **The maturity field is a free-text input** editable by
   admin, not a dropdown.
7. **Real estate cards display BOTH** raw equity AND net
   realisable equity (after 3.5% realtor + 13% HST + $1,500
   legal). Do not collapse to one.
8. **No "vs purchase %" field anywhere.** Removed
   permanently.
9. **Format every dollar amount with commas** and
   appropriate decimal precision. `$4,509.00` not
   `$4509.00`.
10. **Baseline data point: April 1, 2026.** Don't seed
    earlier history into DEFAULTS.

---

## 9. Truncation Rules (Reports)

- **Income logs (individuals):** last 3 months only
- **P&L logs (businesses):** last 3 months only
- **Rent ledgers (per tenant):** last 3 months only
- **Mortgage schedules:** 3 past + current + 3 future
  = 7 months (current row highlighted)

After every truncated table, render this caption (8pt
italic, #8A96A8): "Showing last 3 months. Full history
in the live dashboard."

---

## 10. Status Pill Logic (Properties)

Evaluated top-down, first match wins:
- IF mortgage-free AND vacant_land → STRONG
- IF mortgage-free → STRONG
- IF LTV > 90% → RISK
- IF LTV > 80% OR DSCR < 0.5x → WATCH
- IF monthly NCF < -2000 → WATCH
- IF monthly NCF < 0 → WATCH
- ELSE → STRONG

Owner-occupied: skip DSCR/NCF rules; use only LTV ladder.
DSCR and rental yield are NOT computed for owner-occupied
properties — display "N/A — owner-occupied" instead.

Portfolio-level KPIs (DSCR, Gross Yield) **exclude**
owner-occupied and vacant land properties from both
numerator and denominator.

---

## 11. Safety Contract Protocol — DEFAULT BEHAVIOR

Every session, every task, follow this protocol unless AJ
explicitly says otherwise:

**Phase 1 — Read-only analysis**
- Read `App.js` fully before any change
- Confirm understanding of current data
- State explicitly: "I have read the full file. I will
  not delete or rewrite any existing DEFAULT data. I will
  only ADD new fields with safe defaults and modify only
  the specific lines required for the task."

**Phase 2 — Wait for approval**
- Stop. Show analysis. Wait for "go" or "stop".

**Phase 3 — Surgical changes only**

Hard rules:
- ❌ Never delete existing DEFAULT data
- ❌ Never rewrite an existing property, individual, or
  business entry
- ❌ Never remove an existing function or component
- ❌ Never "clean up" or "refactor" anything not asked for
- ❌ Never rename existing field names
- ❌ Never replace existing logic with "improved" logic
  unless the task literally says to
- ❌ Never modify Supabase URL, anon key, or auth setup

- ✅ Add new fields with safe defaults (0, "", null, false)
- ✅ Add new functions alongside old ones
- ✅ Use minimum-viable edits — change the smallest possible
  number of lines
- ✅ Preserve every existing useEffect, useState, and
  calculation
- ✅ Leave the bootstrap useEffect and mergeById pattern
  untouched unless explicitly modified

**Phase 4 — Verify before committing**
1. Confirm in writing: "I did not delete any existing data."
2. Confirm in writing: "I did not rewrite any existing
   property, individual, or business entry."
3. List every line range you changed.
4. List every NEW field you added and its default value.
5. Show diff/summary before committing.

If unsure whether to delete or modify something: STOP and
ask. Never guess.

---

## 12. Common Pitfalls (Things That Have Gone Wrong)

- **App.js full rewrites.** Earlier sessions rewrote the
  file from scratch and lost DEFAULT data and field
  references. Always work surgically.
- **NaN cascades.** Forgetting `safe(n)` on a single field
  breaks every downstream calculation.
- **TOC formatting regressions.** Page numbers stack at
  bottom instead of aligning. Use flex row + dot leaders.
- **P+I = $0 fallback.** When `getMortgagePI(prop)` returns
  0, fall back to `safe(prop.monthlyPayment)`.
- **Vacant land flagged as "vacancy problem".** Filter
  by `property_type !== "vacant_land"` before any vacancy
  observation.
- **Owner-occupied 121 Milky Way distorting yield/DSCR.**
  Always exclude owner-occupied from portfolio KPI
  calculations.
- **Hobby plan limits.** Vercel collaboration features are
  restricted; don't propose changes that require Pro tier.

---

## 13. Code Map

Generated from App.js (8,133 lines) on 2026-05-07.

- **Number helpers** (`safe`, `$K`, `$F`): lines 115–124
- **DEFAULT seed data** (full object): lines 321–578
  - DEFAULT individuals: lines 326–333
  - DEFAULT businesses: lines 335–341
  - DEFAULT properties: lines 343–554
  - DEFAULT cashflow: lines 556–561
  - DEFAULT vehicles: lines 568–578
- **Supabase load wrapper** (`loadFromDB`): lines 585–597
- **Supabase save wrapper** (`saveToDB` + write guard): lines 599–635
- **Supabase seed wrapper** (`seedToDB`): lines 637–646
- **`mergeById`** function: lines 701–712
- **Auth helpers** (`fetchProfile`, `fetchAllProfiles`): lines 1208–1221
- **`LoginScreen`** component: lines 2474–2557
- **`MemberView`** (non-admin dashboard): lines 2561–3001
- **`PropCard`** (real estate card component): lines 3119–3921
- **`BizCard`** (business card component): lines 4376–4853
- **`ReportModal`** (PDF report generation): lines 5208–5778
  - `handleDownloadPdf` (jsPDF/html2canvas core): lines 5276–5311
- **`HistoryTab`** (Reports tab component): lines 6061–6244
- **`AdminDashboard`** function: lines 6248–7807
  - Tab bar + page scaffold: lines 6965–6981
  - Overview tab: lines 6983–7137
  - Real Estate tab: lines 7140–7283
  - Individuals tab: lines 7286–7473
  - Businesses tab: lines 7476–7504
  - Vehicles tab: lines 7507–7528
  - Cash Flow tab: lines 7531–7793
  - Reports tab (renders `HistoryTab`): lines 7796–7802
- **`App`** root (auth bootstrap, `onAuthStateChange`): lines 7810–8133

---

## 14. Commit Conventions

Commit messages start with `JMF —` followed by a concise
scope description.

Examples:
- `JMF — report cleanup: TOC, overdue tax, status ladder`
- `JMF — individuals: add securities breakdown field`

One commit per logical task. Never bundle unrelated changes.

---

## 15. Pre-Session Protocol

Before any code-modifying session, the admin clicks
"Snapshot now" from the Overview tab. This creates
a recovery point in dashboard_data_history that can
be restored from the Data History UI if anything
goes wrong. Mandatory for any session that may
touch saveToDB or DEFAULT data.

---

## 16. Recovery Procedure

1. Open the Overview tab as admin.
2. Expand the "Data History" section at the bottom.
3. Find the row for the affected key + timestamp
   just before the data loss.
4. Click "Preview" to verify the archived value
   contains what you expect.
5. Click "Restore", type RESTORE in the confirmation
   box, click Confirm.
6. The restored data appears immediately. The
   pre-restore state is also archived in case the
   restore itself was a mistake.
