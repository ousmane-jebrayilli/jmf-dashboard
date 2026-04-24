-- ============================================================
-- MIGRATION 007: Row Level Security policies
-- Enables RLS on all new tables and on dashboard_data.
-- Rules:
--   monthly_periods       → read: all auth | write: admin only
--   monthly_snapshots     → read: all auth | write: admin only
--   monthly_individual_logs → read: all auth | insert: own record (open period) | update: admin only
--   monthly_business_logs   → read: all auth | write: admin only
--   monthly_rent_logs       → read: all auth | write: admin only
--   monthly_cashflow_logs   → read: all auth | write: admin only
--   dashboard_data          → read: all auth | write: admin only
-- ============================================================

-- Helper: inline admin check used in all policies
-- (avoids creating a separate function that could be dropped accidentally)

-- ─── dashboard_data ──────────────────────────────────────────────────────────
ALTER TABLE public.dashboard_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_data: authenticated read"
  ON public.dashboard_data FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "dashboard_data: admin write"
  ON public.dashboard_data FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── monthly_periods ─────────────────────────────────────────────────────────
ALTER TABLE public.monthly_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_periods: authenticated read"
  ON public.monthly_periods FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "monthly_periods: admin write"
  ON public.monthly_periods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── monthly_snapshots ───────────────────────────────────────────────────────
ALTER TABLE public.monthly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_snapshots: authenticated read"
  ON public.monthly_snapshots FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "monthly_snapshots: admin write"
  ON public.monthly_snapshots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── monthly_individual_logs ─────────────────────────────────────────────────
ALTER TABLE public.monthly_individual_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_individual_logs: authenticated read"
  ON public.monthly_individual_logs FOR SELECT
  USING (auth.role() = 'authenticated');

-- Members can insert their OWN record for an OPEN period only
CREATE POLICY "monthly_individual_logs: member insert own open period"
  ON public.monthly_individual_logs FOR INSERT
  WITH CHECK (
    -- Period must be open
    EXISTS (
      SELECT 1 FROM public.monthly_periods
      WHERE month_key = monthly_individual_logs.month_key
        AND status = 'open'
    )
    AND
    -- individual_id must match the caller's profile
    individual_id = (
      SELECT individual_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Only admins can update (locking, overrides, corrections)
CREATE POLICY "monthly_individual_logs: admin write"
  ON public.monthly_individual_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── monthly_business_logs ───────────────────────────────────────────────────
ALTER TABLE public.monthly_business_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_business_logs: authenticated read"
  ON public.monthly_business_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "monthly_business_logs: admin write"
  ON public.monthly_business_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── monthly_rent_logs ───────────────────────────────────────────────────────
ALTER TABLE public.monthly_rent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_rent_logs: authenticated read"
  ON public.monthly_rent_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "monthly_rent_logs: admin write"
  ON public.monthly_rent_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── monthly_cashflow_logs ───────────────────────────────────────────────────
ALTER TABLE public.monthly_cashflow_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_cashflow_logs: authenticated read"
  ON public.monthly_cashflow_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "monthly_cashflow_logs: admin write"
  ON public.monthly_cashflow_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
