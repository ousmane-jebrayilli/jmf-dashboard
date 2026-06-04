-- ============================================================
-- MIGRATION 013: Fix dashboard_data_history RLS
--
-- Problem: dashboard_data has a trigger that archives every UPDATE
-- into dashboard_data_history. The trigger runs with the calling
-- user's RLS context. dashboard_data_history has RLS enabled but
-- no INSERT policy, so the archive INSERT is blocked, which rolls
-- back the entire UPDATE on dashboard_data.
--
-- Result: every admin save silently fails ("new row violates
-- row-level security policy for table dashboard_data_history").
--
-- Fix: either disable RLS on the audit table (safe — it is an
-- internal archive, not user-facing data) OR recreate the trigger
-- function as SECURITY DEFINER so it bypasses RLS.
--
-- We use option 1 (disable RLS) as it is the simpler, less risky
-- change with no trigger re-creation needed.
-- ============================================================

-- Option 1 (RECOMMENDED): Disable RLS on the audit table.
-- dashboard_data_history is an internal append-only log.
-- Access is already controlled by application auth (only admins
-- see the Data History section), so row-level security adds no
-- meaningful protection and only blocks the trigger.
ALTER TABLE public.dashboard_data_history DISABLE ROW LEVEL SECURITY;


-- ── ALTERNATIVE (run instead of the ALTER above if you prefer) ──
-- Option 2: Keep RLS but add a permissive admin policy.
-- Uncomment these lines and comment out the ALTER above if you
-- want RLS to remain active for future non-admin access controls.

-- ALTER TABLE public.dashboard_data_history ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "admin_history_all" ON public.dashboard_data_history;
-- CREATE POLICY "admin_history_all" ON public.dashboard_data_history
--   FOR ALL
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = auth.uid() AND role = 'admin'
--     )
--   );
