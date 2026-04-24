-- ============================================================
-- MIGRATION 005: monthly_rent_logs
-- Replaces the global rentPayments[] JSONB blob.
-- One row per payment event. Multiple rows per (month, unit)
-- are allowed (e.g. partial payments).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monthly_rent_logs (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key       TEXT  NOT NULL REFERENCES public.monthly_periods(month_key) ON DELETE RESTRICT,

  -- Property / unit identifiers (match app data IDs)
  property_id     INT   NOT NULL,
  unit_id         TEXT  NOT NULL,
  lease_id        TEXT,           -- nullable: may not have a formal lease record

  -- Payment details
  amount          NUMERIC  NOT NULL DEFAULT 0,
  payment_date    DATE,           -- actual date money was received
  payment_type    TEXT     NOT NULL DEFAULT 'payment'
                           CHECK (payment_type IN ('payment', 'deposit', 'credit', 'adjustment')),
  note            TEXT,

  -- Lock state (inherits from parent period, but stored here for query efficiency)
  is_locked       BOOLEAN  NOT NULL DEFAULT false,

  -- Audit trail
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID        REFERENCES auth.users(id),
  updated_at      TIMESTAMPTZ,
  updated_by      UUID        REFERENCES auth.users(id),
  override_reason TEXT,
  overridden_at   TIMESTAMPTZ,
  overridden_by   UUID        REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_mrl_month_key    ON public.monthly_rent_logs (month_key);
CREATE INDEX IF NOT EXISTS idx_mrl_property_id  ON public.monthly_rent_logs (property_id);
CREATE INDEX IF NOT EXISTS idx_mrl_unit_id      ON public.monthly_rent_logs (unit_id);

COMMENT ON TABLE  public.monthly_rent_logs              IS 'Rent payment records per unit per month. Replaces rentPayments[] JSONB blob. Multiple rows per unit per month are allowed.';
COMMENT ON COLUMN public.monthly_rent_logs.payment_type IS 'payment=normal rent. deposit=security deposit. credit=prepaid credit applied. adjustment=admin correction.';
COMMENT ON COLUMN public.monthly_rent_logs.is_locked    IS 'Mirrors the parent monthly_period status for efficient querying. Set by close_monthly_period().';
