-- ============================================================
-- MIGRATION 010: Individual Personal P&L
-- Adds clean monthly personal expense categories to the
-- individual monthly log mirror. These fields are separate from
-- asset net worth and business expenses.
-- ============================================================

ALTER TABLE public.monthly_individual_logs
  ADD COLUMN IF NOT EXISTS personal_operating NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS family_transfers NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS personal_discretionary NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS personal_pl_notes TEXT;

COMMENT ON COLUMN public.monthly_individual_logs.personal_operating
  IS 'Monthly personal operating expenses for the individual. Not included in net worth.';
COMMENT ON COLUMN public.monthly_individual_logs.family_transfers
  IS 'Monthly family transfers for the individual. Kept separate from operating and discretionary expenses.';
COMMENT ON COLUMN public.monthly_individual_logs.personal_discretionary
  IS 'Monthly discretionary personal expenses for the individual. Not business expenses.';
COMMENT ON COLUMN public.monthly_individual_logs.personal_pl_notes
  IS 'Optional notes for the individual monthly personal P&L.';
