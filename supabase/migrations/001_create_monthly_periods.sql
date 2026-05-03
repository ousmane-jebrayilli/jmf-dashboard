-- ============================================================
-- MIGRATION 001: monthly_periods
-- The master lock table. Every monthly record in every section
-- references a row here. Admin controls open/finalize/override.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.monthly_periods (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key       TEXT        NOT NULL UNIQUE,   -- e.g. "2026-04"
  label           TEXT        NOT NULL,          -- e.g. "April 2026"
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'finalized', 'admin_override')),
  finalized_at    TIMESTAMPTZ,
  finalized_by    UUID        REFERENCES auth.users(id),
  override_reason TEXT,
  overridden_at   TIMESTAMPTZ,
  overridden_by   UUID        REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the first live period: April 2026
INSERT INTO public.monthly_periods (month_key, label, status)
VALUES ('2026-04', 'April 2026', 'open')
ON CONFLICT (month_key) DO NOTHING;

COMMENT ON TABLE  public.monthly_periods              IS 'One row per calendar month. Controls whether data is editable (open), permanently locked (finalized), or temporarily unlocked by admin (admin_override).';
COMMENT ON COLUMN public.monthly_periods.month_key    IS 'ISO month string YYYY-MM. Primary lookup key for all child log tables.';
COMMENT ON COLUMN public.monthly_periods.status       IS 'open = anyone can edit. finalized = locked, read-only for non-admins. admin_override = admin has unlocked for editing.';
COMMENT ON COLUMN public.monthly_periods.finalized_by IS 'UUID of admin who closed this period.';
COMMENT ON COLUMN public.monthly_periods.override_reason IS 'Required explanation when admin unlocks a finalized period.';
