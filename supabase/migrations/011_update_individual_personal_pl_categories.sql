-- ============================================================
-- MIGRATION 011: Individual Personal P&L categories
-- Adds income source breakdown and replaces legacy personal
-- expense categories while preserving old columns for backward
-- compatibility.
-- ============================================================

ALTER TABLE public.monthly_individual_logs
  ADD COLUMN IF NOT EXISTS kratos_income NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_income NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS income_notes TEXT,
  ADD COLUMN IF NOT EXISTS jmf_expense NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS personal_expense NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profession_expense NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS education_expense NUMERIC NOT NULL DEFAULT 0;

UPDATE public.monthly_individual_logs
SET
  kratos_income = CASE
    WHEN kratos_income = 0 AND other_income = 0 THEN monthly_income
    ELSE kratos_income
  END,
  jmf_expense = CASE
    WHEN jmf_expense = 0 THEN family_transfers
    ELSE jmf_expense
  END,
  personal_expense = CASE
    WHEN personal_expense = 0 THEN personal_operating + personal_discretionary
    ELSE personal_expense
  END
WHERE
  monthly_income <> 0
  OR family_transfers <> 0
  OR personal_operating <> 0
  OR personal_discretionary <> 0;

COMMENT ON COLUMN public.monthly_individual_logs.kratos_income
  IS 'Monthly Kratos income for the individual. Feeds monthly_income total.';
COMMENT ON COLUMN public.monthly_individual_logs.other_income
  IS 'Monthly non-Kratos income for the individual. Feeds monthly_income total.';
COMMENT ON COLUMN public.monthly_individual_logs.income_notes
  IS 'Optional notes for individual monthly income.';
COMMENT ON COLUMN public.monthly_individual_logs.jmf_expense
  IS 'Family support / family-related personal spending.';
COMMENT ON COLUMN public.monthly_individual_logs.personal_expense
  IS 'Personal living and lifestyle spending. Includes migrated legacy operating and discretionary values.';
COMMENT ON COLUMN public.monthly_individual_logs.profession_expense
  IS 'Business, professional, or career-related personal spending.';
COMMENT ON COLUMN public.monthly_individual_logs.education_expense
  IS 'School, training, legal/bar, courses, books, and similar education spending.';
