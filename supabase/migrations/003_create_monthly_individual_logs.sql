-- ============================================================
-- MIGRATION 003: monthly_individual_logs
-- Replaces individuals[].accountsLog[] JSONB blob.
-- One row per (month_key, individual_id). Members submit via
-- the existing submission workflow; admin can write directly.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monthly_individual_logs (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key        TEXT    NOT NULL REFERENCES public.monthly_periods(month_key) ON DELETE RESTRICT,
  individual_id    INT     NOT NULL,   -- matches individuals[].id in DEFAULT data (1–6)

  -- Asset fields (mirrors existing accountsLog shape)
  cash             NUMERIC NOT NULL DEFAULT 0,
  accounts         NUMERIC NOT NULL DEFAULT 0,
  securities       NUMERIC NOT NULL DEFAULT 0,
  crypto           NUMERIC NOT NULL DEFAULT 0,
  physical_assets  NUMERIC NOT NULL DEFAULT 0,
  net              NUMERIC GENERATED ALWAYS AS (cash + accounts + securities + crypto + physical_assets) STORED,

  -- Income (mirrors individuals[].monthlyIncome[])
  monthly_income   NUMERIC NOT NULL DEFAULT 0,

  note             TEXT,

  -- Lock state
  is_locked        BOOLEAN  NOT NULL DEFAULT false,

  -- Audit trail
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

CREATE INDEX IF NOT EXISTS idx_mil_month_key      ON public.monthly_individual_logs (month_key);
CREATE INDEX IF NOT EXISTS idx_mil_individual_id  ON public.monthly_individual_logs (individual_id);

COMMENT ON TABLE  public.monthly_individual_logs                IS 'Monthly financial position per individual. Replaces accountsLog[] JSONB. One row per person per month.';
COMMENT ON COLUMN public.monthly_individual_logs.individual_id  IS 'Integer ID matching individuals[].id in the app (1=Ahmed, 2=Nazila, 3=Yasin, 4=Maryam, 5=Akbar, 6=Mustafa).';
COMMENT ON COLUMN public.monthly_individual_logs.net            IS 'Computed column: sum of all asset fields. Cannot be set directly.';
COMMENT ON COLUMN public.monthly_individual_logs.monthly_income IS 'Reported income for this month (separate from asset net worth).';
