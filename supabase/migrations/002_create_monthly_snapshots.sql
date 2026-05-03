-- ============================================================
-- MIGRATION 002: monthly_snapshots
-- Replaces the in-memory snapshots[] JSONB blob stored in
-- dashboard_data. One row per month. Once is_locked = true,
-- "Generate Report" reads ONLY this row — never live data.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monthly_snapshots (
  id                   UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key            TEXT     NOT NULL UNIQUE REFERENCES public.monthly_periods(month_key) ON DELETE RESTRICT,

  -- Consolidated numbers at time of capture
  nw                   NUMERIC  NOT NULL DEFAULT 0,
  re_equity            NUMERIC  NOT NULL DEFAULT 0,
  re_liquid            NUMERIC  NOT NULL DEFAULT 0,
  individuals_total    NUMERIC  NOT NULL DEFAULT 0,
  businesses_total     NUMERIC  NOT NULL DEFAULT 0,

  -- Per-entity breakdowns (JSONB arrays for flexibility)
  individual_breakdown JSONB    NOT NULL DEFAULT '[]'::jsonb,
  -- shape: [{ id, name, net, cash, accounts, securities, crypto, physicalAssets }]

  re_breakdown         JSONB    NOT NULL DEFAULT '[]'::jsonb,
  -- shape: [{ id, name, market, debt, equity, liquid, ownership }]

  business_breakdown   JSONB    NOT NULL DEFAULT '[]'::jsonb,
  -- shape: [{ id, name, eq, type, cashAccounts, liabilities }]

  cash_flow_snapshot   JSONB    NOT NULL DEFAULT '{}'::jsonb,
  -- shape: { income: [...], obligations: [...], net: number }

  note                 TEXT,

  -- Lock state
  is_locked            BOOLEAN  NOT NULL DEFAULT false,

  -- Audit trail
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
COMMENT ON COLUMN public.monthly_snapshots.is_locked IS 'Set to true by close_monthly_period(). Once true, cannot be overwritten except via admin_override_period().';
COMMENT ON COLUMN public.monthly_snapshots.nw        IS 'Total consolidated JMF net worth at time of snapshot capture.';
