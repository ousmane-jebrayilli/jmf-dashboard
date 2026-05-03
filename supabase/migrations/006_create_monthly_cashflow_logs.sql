-- ============================================================
-- MIGRATION 006: monthly_cashflow_logs
-- Brand-new table — cash flow has no monthly log today.
-- One row per month capturing the income/obligation state
-- at the time of recording or period close.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monthly_cashflow_logs (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key       TEXT    NOT NULL UNIQUE REFERENCES public.monthly_periods(month_key) ON DELETE RESTRICT,

  -- Income items: [{ description: string, amount: number, category?: string }]
  income          JSONB   NOT NULL DEFAULT '[]'::jsonb,

  -- Fixed obligation items: [{ description: string, amount: number }]
  obligations     JSONB   NOT NULL DEFAULT '[]'::jsonb,

  -- Computed totals (stored for report consistency after lock)
  total_income     NUMERIC NOT NULL DEFAULT 0,
  total_obligations NUMERIC NOT NULL DEFAULT 0,
  net              NUMERIC GENERATED ALWAYS AS (total_income - total_obligations) STORED,

  -- Source breakdown for audit (what was included in the net calculation)
  rental_income    NUMERIC NOT NULL DEFAULT 0,   -- from rent logs
  business_income  NUMERIC NOT NULL DEFAULT 0,   -- from business profit logs
  other_income     NUMERIC NOT NULL DEFAULT 0,   -- manual entries
  property_costs   NUMERIC NOT NULL DEFAULT 0,   -- mortgage + tax + insurance
  other_costs      NUMERIC NOT NULL DEFAULT 0,   -- manual obligations

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
  overridden_by   UUID        REFERENCES auth.users(id)
);

COMMENT ON TABLE  public.monthly_cashflow_logs              IS 'Monthly cash flow snapshot. New table — cash flow had no historical log before. One row per month.';
COMMENT ON COLUMN public.monthly_cashflow_logs.income       IS 'JSONB array of income line items at time of recording.';
COMMENT ON COLUMN public.monthly_cashflow_logs.obligations  IS 'JSONB array of obligation line items at time of recording.';
COMMENT ON COLUMN public.monthly_cashflow_logs.net          IS 'Generated column: total_income - total_obligations.';
COMMENT ON COLUMN public.monthly_cashflow_logs.rental_income IS 'Rental income pulled from monthly_rent_logs at close time. Stored for report immutability.';
