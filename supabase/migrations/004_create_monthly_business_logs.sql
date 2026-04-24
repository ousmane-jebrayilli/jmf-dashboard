-- ============================================================
-- MIGRATION 004: monthly_business_logs
-- Replaces businesses[].monthlyProfits[] JSONB blob.
-- One row per (month_key, business_id). Admin-only entry.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monthly_business_logs (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key       TEXT    NOT NULL REFERENCES public.monthly_periods(month_key) ON DELETE RESTRICT,
  business_id     INT     NOT NULL,   -- matches businesses[].id (1=KMI, 2=JMF Logistics, 3=PRIMA, 4=ASWC)

  -- P&L fields
  revenue         NUMERIC NOT NULL DEFAULT 0,
  expenses        NUMERIC NOT NULL DEFAULT 0,
  profit          NUMERIC NOT NULL DEFAULT 0,
  -- Note: profit is stored explicitly (not a generated column) because
  -- admin can enter profit directly without revenue/expenses breakdown.

  -- Balance sheet snapshot (point-in-time, not computed)
  cash_accounts   NUMERIC,   -- nullable: only set if admin records a balance snapshot
  liabilities     NUMERIC,

  note            TEXT,

  -- Lock state
  is_locked       BOOLEAN  NOT NULL DEFAULT false,

  -- Audit trail
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

CREATE INDEX IF NOT EXISTS idx_mbl_month_key    ON public.monthly_business_logs (month_key);
CREATE INDEX IF NOT EXISTS idx_mbl_business_id  ON public.monthly_business_logs (business_id);

COMMENT ON TABLE  public.monthly_business_logs               IS 'Monthly P&L and balance sheet snapshot per business entity. Replaces monthlyProfits[] JSONB.';
COMMENT ON COLUMN public.monthly_business_logs.business_id   IS 'Integer ID matching businesses[].id (1=Kratos Moving, 2=JMF Logistics, 3=PRIMA, 4=ASWC).';
COMMENT ON COLUMN public.monthly_business_logs.profit        IS 'Stored explicitly. May be entered directly or derived from revenue - expenses by the application layer.';
COMMENT ON COLUMN public.monthly_business_logs.cash_accounts IS 'Optional point-in-time balance sheet snapshot. Null if not recorded for this month.';
