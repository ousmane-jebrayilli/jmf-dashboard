-- ============================================================
-- JMF DASHBOARD — PHASE 1 ROLLBACK
-- Run this ONLY if you need to completely undo phase1_up.sql.
--
-- WARNING: This permanently deletes all data in the new tables.
-- dashboard_data (legacy backup) is NOT touched.
-- ============================================================


-- ── Step 1: Drop RPC functions ───────────────────────────────
DROP FUNCTION IF EXISTS public.relock_after_override(TEXT, UUID);
DROP FUNCTION IF EXISTS public.admin_override_period(TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.close_monthly_period(TEXT, UUID);
DROP FUNCTION IF EXISTS public.get_period_status(TEXT);


-- ── Step 2: Drop RLS policies ────────────────────────────────

-- monthly_cashflow_logs
DROP POLICY IF EXISTS "monthly_cashflow_logs: authenticated read" ON public.monthly_cashflow_logs;
DROP POLICY IF EXISTS "monthly_cashflow_logs: admin write"        ON public.monthly_cashflow_logs;

-- monthly_rent_logs
DROP POLICY IF EXISTS "monthly_rent_logs: authenticated read" ON public.monthly_rent_logs;
DROP POLICY IF EXISTS "monthly_rent_logs: admin write"        ON public.monthly_rent_logs;

-- monthly_business_logs
DROP POLICY IF EXISTS "monthly_business_logs: authenticated read" ON public.monthly_business_logs;
DROP POLICY IF EXISTS "monthly_business_logs: admin write"        ON public.monthly_business_logs;

-- monthly_individual_logs
DROP POLICY IF EXISTS "monthly_individual_logs: authenticated read"              ON public.monthly_individual_logs;
DROP POLICY IF EXISTS "monthly_individual_logs: member insert own open period"   ON public.monthly_individual_logs;
DROP POLICY IF EXISTS "monthly_individual_logs: admin write"                     ON public.monthly_individual_logs;

-- monthly_snapshots
DROP POLICY IF EXISTS "monthly_snapshots: authenticated read" ON public.monthly_snapshots;
DROP POLICY IF EXISTS "monthly_snapshots: admin write"        ON public.monthly_snapshots;

-- monthly_periods
DROP POLICY IF EXISTS "monthly_periods: authenticated read" ON public.monthly_periods;
DROP POLICY IF EXISTS "monthly_periods: admin write"        ON public.monthly_periods;

-- dashboard_data (restore to pre-migration state — disable RLS)
DROP POLICY IF EXISTS "dashboard_data: authenticated read" ON public.dashboard_data;
DROP POLICY IF EXISTS "dashboard_data: admin write"        ON public.dashboard_data;
ALTER TABLE public.dashboard_data DISABLE ROW LEVEL SECURITY;


-- ── Step 3: Drop indexes ─────────────────────────────────────
DROP INDEX IF EXISTS public.idx_mrl_unit_id;
DROP INDEX IF EXISTS public.idx_mrl_property_id;
DROP INDEX IF EXISTS public.idx_mrl_month_key;
DROP INDEX IF EXISTS public.idx_mbl_business_id;
DROP INDEX IF EXISTS public.idx_mbl_month_key;
DROP INDEX IF EXISTS public.idx_mil_individual_id;
DROP INDEX IF EXISTS public.idx_mil_month_key;


-- ── Step 4: Drop tables (child tables first, then parent) ────
DROP TABLE IF EXISTS public.monthly_cashflow_logs;
DROP TABLE IF EXISTS public.monthly_rent_logs;
DROP TABLE IF EXISTS public.monthly_business_logs;
DROP TABLE IF EXISTS public.monthly_individual_logs;
DROP TABLE IF EXISTS public.monthly_snapshots;
DROP TABLE IF EXISTS public.monthly_periods;


-- ── Step 5: Verify rollback ──────────────────────────────────
-- Run this query to confirm everything is gone:
--
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name LIKE 'monthly_%';
--
-- Expected result: 0 rows.
--
--   SELECT routine_name FROM information_schema.routines
--   WHERE routine_schema = 'public'
--     AND routine_name IN (
--       'get_period_status','close_monthly_period',
--       'admin_override_period','relock_after_override'
--     );
--
-- Expected result: 0 rows.
-- ============================================================
