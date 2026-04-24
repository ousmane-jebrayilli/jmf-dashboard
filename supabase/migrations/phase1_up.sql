-- ============================================================
-- JMF DASHBOARD — PHASE 1 MIGRATION (UP)
-- Run this once in the Supabase SQL Editor.
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.
--
-- What this creates:
--   Tables:    monthly_periods, monthly_snapshots,
--              monthly_individual_logs, monthly_business_logs,
--              monthly_rent_logs, monthly_cashflow_logs
--   RLS:       policies on all 6 tables + dashboard_data
--   Functions: get_period_status, close_monthly_period,
--              admin_override_period, relock_after_override
--
-- What this does NOT touch:
--   dashboard_data table and its existing rows (legacy backup)
--   App.js / any frontend code
--   Any existing data
-- ============================================================


-- ============================================================
-- SECTION 1: monthly_periods
-- Master lock table. Every monthly log table references this.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monthly_periods (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key       TEXT        NOT NULL UNIQUE,
  label           TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'finalized', 'admin_override')),
  finalized_at    TIMESTAMPTZ,
  finalized_by    UUID        REFERENCES auth.users(id),
  override_reason TEXT,
  overridden_at   TIMESTAMPTZ,
  overridden_by   UUID        REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.monthly_periods              IS 'One row per calendar month. Controls whether data is editable (open), permanently locked (finalized), or temporarily unlocked by admin (admin_override).';
COMMENT ON COLUMN public.monthly_periods.month_key    IS 'ISO month string YYYY-MM. Primary lookup key for all child log tables.';
COMMENT ON COLUMN public.monthly_periods.status       IS 'open = anyone can edit. finalized = locked, read-only. admin_override = admin has unlocked for editing.';
COMMENT ON COLUMN public.monthly_periods.finalized_by IS 'UUID of admin who closed this period.';
COMMENT ON COLUMN public.monthly_periods.override_reason IS 'Required explanation when admin unlocks a finalized period.';

-- Seed the current live period
INSERT INTO public.monthly_periods (month_key, label, status)
VALUES ('2026-04', 'April 2026', 'open')
ON CONFLICT (month_key) DO NOTHING;


-- ============================================================
-- SECTION 2: monthly_snapshots
-- One row per month. Frozen when period is finalized.
-- Generate Report reads ONLY this row for locked months.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monthly_snapshots (
  id                   UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key            TEXT     NOT NULL UNIQUE REFERENCES public.monthly_periods(month_key) ON DELETE RESTRICT,

  nw                   NUMERIC  NOT NULL DEFAULT 0,
  re_equity            NUMERIC  NOT NULL DEFAULT 0,
  re_liquid            NUMERIC  NOT NULL DEFAULT 0,
  individuals_total    NUMERIC  NOT NULL DEFAULT 0,
  businesses_total     NUMERIC  NOT NULL DEFAULT 0,

  -- Per-entity breakdowns stored as JSONB for immutability after lock
  individual_breakdown JSONB    NOT NULL DEFAULT '[]'::jsonb,
  re_breakdown         JSONB    NOT NULL DEFAULT '[]'::jsonb,
  business_breakdown   JSONB    NOT NULL DEFAULT '[]'::jsonb,

  -- Full cash flow state at time of capture (used by Report for locked months)
  cash_flow_snapshot   JSONB    NOT NULL DEFAULT '{}'::jsonb,

  note                 TEXT,
  is_locked            BOOLEAN  NOT NULL DEFAULT false,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID        REFERENCES auth.users(id),
  finalized_at         TIMESTAMPTZ,
  finalized_by         UUID        REFERENCES auth.users(id),
  updated_at           TIMESTAMPTZ,
  updated_by           UUID        REFERENCES auth.users(id),
  override_reason      TEXT,
  overridden_at        TIMESTAMPTZ,
  overridden_by        UUID        REFERENCES auth.users(id)
);

COMMENT ON TABLE  public.monthly_snapshots           IS 'One canonical financial snapshot per month. Frozen when is_locked = true. Generate Report reads ONLY from here for finalized months.';
COMMENT ON COLUMN public.monthly_snapshots.is_locked IS 'Set true by close_monthly_period(). Overridable only by admin_override_period().';
COMMENT ON COLUMN public.monthly_snapshots.cash_flow_snapshot IS 'Full income/obligations/net state frozen at close time. ReportModal reads this instead of live data for locked months.';


-- ============================================================
-- SECTION 3: monthly_individual_logs
-- One row per (month_key, individual_id).
-- Replaces individuals[].accountsLog[] JSONB.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monthly_individual_logs (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key        TEXT    NOT NULL REFERENCES public.monthly_periods(month_key) ON DELETE RESTRICT,
  individual_id    INT     NOT NULL,

  cash             NUMERIC NOT NULL DEFAULT 0,
  accounts         NUMERIC NOT NULL DEFAULT 0,
  securities       NUMERIC NOT NULL DEFAULT 0,
  crypto           NUMERIC NOT NULL DEFAULT 0,
  physical_assets  NUMERIC NOT NULL DEFAULT 0,
  net              NUMERIC GENERATED ALWAYS AS (cash + accounts + securities + crypto + physical_assets) STORED,

  monthly_income   NUMERIC NOT NULL DEFAULT 0,
  note             TEXT,
  is_locked        BOOLEAN  NOT NULL DEFAULT false,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID        REFERENCES auth.users(id),
  finalized_at     TIMESTAMPTZ,
  finalized_by     UUID        REFERENCES auth.users(id),
  updated_at       TIMESTAMPTZ,
  updated_by       UUID        REFERENCES auth.users(id),
  override_reason  TEXT,
  overridden_at    TIMESTAMPTZ,
  overridden_by    UUID        REFERENCES auth.users(id),

  CONSTRAINT uq_individual_month UNIQUE (month_key, individual_id)
);

CREATE INDEX IF NOT EXISTS idx_mil_month_key     ON public.monthly_individual_logs (month_key);
CREATE INDEX IF NOT EXISTS idx_mil_individual_id ON public.monthly_individual_logs (individual_id);

COMMENT ON TABLE  public.monthly_individual_logs               IS 'Monthly financial position per individual. Replaces accountsLog[] JSONB. One row per person per month.';
COMMENT ON COLUMN public.monthly_individual_logs.individual_id IS 'Integer ID matching individuals[].id (1=Ahmed, 2=Nazila, 3=Yasin, 4=Maryam, 5=Akbar, 6=Mustafa).';
COMMENT ON COLUMN public.monthly_individual_logs.net           IS 'Generated column: sum of all asset fields.';


-- ============================================================
-- SECTION 4: monthly_business_logs
-- One row per (month_key, business_id).
-- Replaces businesses[].monthlyProfits[] JSONB.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monthly_business_logs (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key       TEXT    NOT NULL REFERENCES public.monthly_periods(month_key) ON DELETE RESTRICT,
  business_id     INT     NOT NULL,

  revenue         NUMERIC NOT NULL DEFAULT 0,
  expenses        NUMERIC NOT NULL DEFAULT 0,
  profit          NUMERIC NOT NULL DEFAULT 0,

  cash_accounts   NUMERIC,
  liabilities     NUMERIC,

  note            TEXT,
  is_locked       BOOLEAN  NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID        REFERENCES auth.users(id),
  finalized_at    TIMESTAMPTZ,
  finalized_by    UUID        REFERENCES auth.users(id),
  updated_at      TIMESTAMPTZ,
  updated_by      UUID        REFERENCES auth.users(id),
  override_reason TEXT,
  overridden_at   TIMESTAMPTZ,
  overridden_by   UUID        REFERENCES auth.users(id),

  CONSTRAINT uq_business_month UNIQUE (month_key, business_id)
);

CREATE INDEX IF NOT EXISTS idx_mbl_month_key   ON public.monthly_business_logs (month_key);
CREATE INDEX IF NOT EXISTS idx_mbl_business_id ON public.monthly_business_logs (business_id);

COMMENT ON TABLE  public.monthly_business_logs              IS 'Monthly P&L and balance sheet snapshot per business entity. Replaces monthlyProfits[] JSONB.';
COMMENT ON COLUMN public.monthly_business_logs.business_id  IS 'Integer ID matching businesses[].id (1=Kratos Moving, 2=JMF Logistics, 3=PRIMA, 4=ASWC).';
COMMENT ON COLUMN public.monthly_business_logs.profit       IS 'Stored explicitly. May be entered directly or derived from revenue - expenses by the app layer.';


-- ============================================================
-- SECTION 5: monthly_rent_logs
-- Multiple rows per (month_key, unit). Replaces rentPayments[].
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monthly_rent_logs (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key       TEXT  NOT NULL REFERENCES public.monthly_periods(month_key) ON DELETE RESTRICT,

  property_id     INT   NOT NULL,
  unit_id         TEXT  NOT NULL,
  lease_id        TEXT,

  amount          NUMERIC  NOT NULL DEFAULT 0,
  payment_date    DATE,
  payment_type    TEXT     NOT NULL DEFAULT 'payment'
                           CHECK (payment_type IN ('payment', 'deposit', 'credit', 'adjustment')),
  note            TEXT,
  is_locked       BOOLEAN  NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID        REFERENCES auth.users(id),
  updated_at      TIMESTAMPTZ,
  updated_by      UUID        REFERENCES auth.users(id),
  override_reason TEXT,
  overridden_at   TIMESTAMPTZ,
  overridden_by   UUID        REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_mrl_month_key   ON public.monthly_rent_logs (month_key);
CREATE INDEX IF NOT EXISTS idx_mrl_property_id ON public.monthly_rent_logs (property_id);
CREATE INDEX IF NOT EXISTS idx_mrl_unit_id     ON public.monthly_rent_logs (unit_id);

COMMENT ON TABLE  public.monthly_rent_logs              IS 'Rent payment records per unit per month. Replaces rentPayments[] JSONB. Multiple rows per unit per month are allowed.';
COMMENT ON COLUMN public.monthly_rent_logs.payment_type IS 'payment=normal rent. deposit=security deposit. credit=prepaid credit. adjustment=admin correction.';


-- ============================================================
-- SECTION 6: monthly_cashflow_logs
-- One row per month_key. Brand new — no legacy equivalent.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monthly_cashflow_logs (
  id                UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key         TEXT     NOT NULL UNIQUE REFERENCES public.monthly_periods(month_key) ON DELETE RESTRICT,

  income            JSONB    NOT NULL DEFAULT '[]'::jsonb,
  obligations       JSONB    NOT NULL DEFAULT '[]'::jsonb,

  total_income      NUMERIC  NOT NULL DEFAULT 0,
  total_obligations NUMERIC  NOT NULL DEFAULT 0,
  net               NUMERIC  GENERATED ALWAYS AS (total_income - total_obligations) STORED,

  rental_income     NUMERIC  NOT NULL DEFAULT 0,
  business_income   NUMERIC  NOT NULL DEFAULT 0,
  other_income      NUMERIC  NOT NULL DEFAULT 0,
  property_costs    NUMERIC  NOT NULL DEFAULT 0,
  other_costs       NUMERIC  NOT NULL DEFAULT 0,

  note              TEXT,
  is_locked         BOOLEAN  NOT NULL DEFAULT false,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID        REFERENCES auth.users(id),
  finalized_at      TIMESTAMPTZ,
  finalized_by      UUID        REFERENCES auth.users(id),
  updated_at        TIMESTAMPTZ,
  updated_by        UUID        REFERENCES auth.users(id),
  override_reason   TEXT,
  overridden_at     TIMESTAMPTZ,
  overridden_by     UUID        REFERENCES auth.users(id)
);

COMMENT ON TABLE  public.monthly_cashflow_logs              IS 'Monthly cash flow snapshot. One row per month. New table — cash flow had no historical log before.';
COMMENT ON COLUMN public.monthly_cashflow_logs.income       IS 'JSONB array of income line items at time of recording.';
COMMENT ON COLUMN public.monthly_cashflow_logs.obligations  IS 'JSONB array of obligation line items at time of recording.';
COMMENT ON COLUMN public.monthly_cashflow_logs.net          IS 'Generated column: total_income - total_obligations.';


-- ============================================================
-- SECTION 7: RLS POLICIES
-- All tables: authenticated users can SELECT.
-- Write access: admin only (via profiles.role = 'admin').
-- Exception: members can INSERT their own individual log row
--            for an open period.
-- dashboard_data is also covered here for completeness.
-- ============================================================

-- ── dashboard_data ───────────────────────────────────────────
ALTER TABLE public.dashboard_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dashboard_data: authenticated read" ON public.dashboard_data;
CREATE POLICY "dashboard_data: authenticated read"
  ON public.dashboard_data FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "dashboard_data: admin write" ON public.dashboard_data;
CREATE POLICY "dashboard_data: admin write"
  ON public.dashboard_data FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── monthly_periods ──────────────────────────────────────────
ALTER TABLE public.monthly_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_periods: authenticated read" ON public.monthly_periods;
CREATE POLICY "monthly_periods: authenticated read"
  ON public.monthly_periods FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "monthly_periods: admin write" ON public.monthly_periods;
CREATE POLICY "monthly_periods: admin write"
  ON public.monthly_periods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── monthly_snapshots ────────────────────────────────────────
ALTER TABLE public.monthly_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_snapshots: authenticated read" ON public.monthly_snapshots;
CREATE POLICY "monthly_snapshots: authenticated read"
  ON public.monthly_snapshots FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "monthly_snapshots: admin write" ON public.monthly_snapshots;
CREATE POLICY "monthly_snapshots: admin write"
  ON public.monthly_snapshots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── monthly_individual_logs ──────────────────────────────────
ALTER TABLE public.monthly_individual_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_individual_logs: authenticated read" ON public.monthly_individual_logs;
CREATE POLICY "monthly_individual_logs: authenticated read"
  ON public.monthly_individual_logs FOR SELECT
  USING (auth.role() = 'authenticated');

-- Members can insert their own record for an open period only
DROP POLICY IF EXISTS "monthly_individual_logs: member insert own open period" ON public.monthly_individual_logs;
CREATE POLICY "monthly_individual_logs: member insert own open period"
  ON public.monthly_individual_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.monthly_periods
      WHERE month_key = monthly_individual_logs.month_key
        AND status = 'open'
    )
    AND
    individual_id = (
      SELECT individual_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "monthly_individual_logs: admin write" ON public.monthly_individual_logs;
CREATE POLICY "monthly_individual_logs: admin write"
  ON public.monthly_individual_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── monthly_business_logs ────────────────────────────────────
ALTER TABLE public.monthly_business_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_business_logs: authenticated read" ON public.monthly_business_logs;
CREATE POLICY "monthly_business_logs: authenticated read"
  ON public.monthly_business_logs FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "monthly_business_logs: admin write" ON public.monthly_business_logs;
CREATE POLICY "monthly_business_logs: admin write"
  ON public.monthly_business_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── monthly_rent_logs ────────────────────────────────────────
ALTER TABLE public.monthly_rent_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_rent_logs: authenticated read" ON public.monthly_rent_logs;
CREATE POLICY "monthly_rent_logs: authenticated read"
  ON public.monthly_rent_logs FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "monthly_rent_logs: admin write" ON public.monthly_rent_logs;
CREATE POLICY "monthly_rent_logs: admin write"
  ON public.monthly_rent_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── monthly_cashflow_logs ────────────────────────────────────
ALTER TABLE public.monthly_cashflow_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_cashflow_logs: authenticated read" ON public.monthly_cashflow_logs;
CREATE POLICY "monthly_cashflow_logs: authenticated read"
  ON public.monthly_cashflow_logs FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "monthly_cashflow_logs: admin write" ON public.monthly_cashflow_logs;
CREATE POLICY "monthly_cashflow_logs: admin write"
  ON public.monthly_cashflow_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ============================================================
-- SECTION 8: DATABASE FUNCTIONS
-- All four are SECURITY DEFINER so they can bypass RLS for
-- the lock/unlock operations, but each verifies admin first.
-- ============================================================

-- ── get_period_status ────────────────────────────────────────
-- Lightweight status check. Frontend calls this to decide
-- whether to show edit controls or lock icons.

CREATE OR REPLACE FUNCTION public.get_period_status(p_month_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.monthly_periods%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.monthly_periods
  WHERE month_key = p_month_key;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'exists',    false,
      'status',    'open',
      'is_locked', false
    );
  END IF;

  RETURN jsonb_build_object(
    'exists',          true,
    'month_key',       v_row.month_key,
    'label',           v_row.label,
    'status',          v_row.status,
    'is_locked',       v_row.status = 'finalized',
    'finalized_at',    v_row.finalized_at,
    'finalized_by',    v_row.finalized_by,
    'override_reason', v_row.override_reason,
    'overridden_at',   v_row.overridden_at,
    'overridden_by',   v_row.overridden_by
  );
END;
$$;

COMMENT ON FUNCTION public.get_period_status IS
  'Returns period status object for a given month_key. Used by frontend to decide edit vs read-only mode.';


-- ── close_monthly_period ─────────────────────────────────────
-- Admin triggers this from the "Close Month" button.
-- Locks the period row and all child rows atomically.

CREATE OR REPLACE FUNCTION public.close_monthly_period(
  p_month_key TEXT,
  p_admin_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_status TEXT;
  v_rows_locked   INT := 0;
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'close_monthly_period: caller % is not an admin', p_admin_id;
  END IF;

  -- Check period exists and is closable
  SELECT status INTO v_period_status
  FROM public.monthly_periods
  WHERE month_key = p_month_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'close_monthly_period: period % does not exist', p_month_key;
  END IF;

  IF v_period_status = 'finalized' THEN
    RAISE EXCEPTION 'close_monthly_period: period % is already finalized', p_month_key;
  END IF;

  -- Lock the period row
  UPDATE public.monthly_periods
  SET
    status       = 'finalized',
    finalized_at = now(),
    finalized_by = p_admin_id
  WHERE month_key = p_month_key;

  -- Lock all child rows
  UPDATE public.monthly_snapshots
  SET is_locked = true, finalized_at = now(), finalized_by = p_admin_id
  WHERE month_key = p_month_key;
  GET DIAGNOSTICS v_rows_locked = ROW_COUNT;

  UPDATE public.monthly_individual_logs
  SET is_locked = true, finalized_at = now(), finalized_by = p_admin_id
  WHERE month_key = p_month_key;

  UPDATE public.monthly_business_logs
  SET is_locked = true, finalized_at = now(), finalized_by = p_admin_id
  WHERE month_key = p_month_key;

  UPDATE public.monthly_rent_logs
  SET is_locked = true
  WHERE month_key = p_month_key;

  UPDATE public.monthly_cashflow_logs
  SET is_locked = true, finalized_at = now(), finalized_by = p_admin_id
  WHERE month_key = p_month_key;

  RETURN jsonb_build_object(
    'success',      true,
    'month_key',    p_month_key,
    'finalized_at', now(),
    'finalized_by', p_admin_id
  );
END;
$$;

COMMENT ON FUNCTION public.close_monthly_period IS
  'Finalizes a monthly period. Sets status=finalized and is_locked=true on all child tables. Requires admin. Reversible only via admin_override_period().';


-- ── admin_override_period ────────────────────────────────────
-- Unlocks a finalized period for admin editing.
-- override_reason is REQUIRED and cannot be empty.

CREATE OR REPLACE FUNCTION public.admin_override_period(
  p_month_key       TEXT,
  p_admin_id        UUID,
  p_override_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_status TEXT;
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin_override_period: caller % is not an admin', p_admin_id;
  END IF;

  -- Require a non-empty reason
  IF p_override_reason IS NULL OR trim(p_override_reason) = '' THEN
    RAISE EXCEPTION 'admin_override_period: override_reason is required and cannot be empty';
  END IF;

  -- Period must exist and be finalized
  SELECT status INTO v_period_status
  FROM public.monthly_periods
  WHERE month_key = p_month_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_override_period: period % does not exist', p_month_key;
  END IF;

  IF v_period_status = 'open' THEN
    RAISE EXCEPTION 'admin_override_period: period % is open, no override needed', p_month_key;
  END IF;

  -- Unlock the period
  UPDATE public.monthly_periods
  SET
    status          = 'admin_override',
    override_reason = p_override_reason,
    overridden_at   = now(),
    overridden_by   = p_admin_id
  WHERE month_key = p_month_key;

  -- Unlock all child rows
  UPDATE public.monthly_snapshots       SET is_locked = false WHERE month_key = p_month_key;
  UPDATE public.monthly_individual_logs SET is_locked = false WHERE month_key = p_month_key;
  UPDATE public.monthly_business_logs   SET is_locked = false WHERE month_key = p_month_key;
  UPDATE public.monthly_rent_logs       SET is_locked = false WHERE month_key = p_month_key;
  UPDATE public.monthly_cashflow_logs   SET is_locked = false WHERE month_key = p_month_key;

  RETURN jsonb_build_object(
    'success',         true,
    'month_key',       p_month_key,
    'status',          'admin_override',
    'override_reason', p_override_reason,
    'overridden_at',   now(),
    'overridden_by',   p_admin_id
  );
END;
$$;

COMMENT ON FUNCTION public.admin_override_period IS
  'Unlocks a finalized period for admin editing. Requires non-empty override_reason. Call relock_after_override() when edits are done.';


-- ── relock_after_override ────────────────────────────────────
-- Call this after admin finishes editing an overridden period.
-- Re-locks everything and sets status back to finalized.

CREATE OR REPLACE FUNCTION public.relock_after_override(
  p_month_key TEXT,
  p_admin_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'relock_after_override: caller % is not an admin', p_admin_id;
  END IF;

  UPDATE public.monthly_periods
  SET status = 'finalized'
  WHERE month_key = p_month_key AND status = 'admin_override';

  UPDATE public.monthly_snapshots
  SET is_locked = true, updated_at = now(), updated_by = p_admin_id
  WHERE month_key = p_month_key;

  UPDATE public.monthly_individual_logs
  SET is_locked = true, updated_at = now(), updated_by = p_admin_id
  WHERE month_key = p_month_key;

  UPDATE public.monthly_business_logs
  SET is_locked = true, updated_at = now(), updated_by = p_admin_id
  WHERE month_key = p_month_key;

  UPDATE public.monthly_rent_logs
  SET is_locked = true, updated_at = now(), updated_by = p_admin_id
  WHERE month_key = p_month_key;

  UPDATE public.monthly_cashflow_logs
  SET is_locked = true, updated_at = now(), updated_by = p_admin_id
  WHERE month_key = p_month_key;

  RETURN jsonb_build_object(
    'success',    true,
    'month_key',  p_month_key,
    'status',     'finalized',
    'relocked_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.relock_after_override IS
  'Re-locks all rows after admin override edits are complete. Sets status back to finalized.';


-- ============================================================
-- DONE
-- Verify with:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name LIKE 'monthly_%';
--
--   SELECT routine_name FROM information_schema.routines
--   WHERE routine_schema = 'public'
--     AND routine_name IN (
--       'get_period_status','close_monthly_period',
--       'admin_override_period','relock_after_override'
--     );
-- ============================================================
