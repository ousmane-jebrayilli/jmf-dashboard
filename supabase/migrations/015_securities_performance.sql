-- ============================================================
-- MIGRATION 015: securities_performance
-- Additive columns on securities_snapshots to support
-- return-over-time metrics (Modified Dietz), optional benchmark
-- overlay, and an explicit snapshot date.
--
-- ADDITIVE ONLY. No existing table, column, constraint, index,
-- or policy is altered or dropped. Safe to run multiple times.
-- ============================================================

ALTER TABLE public.securities_snapshots
  ADD COLUMN IF NOT EXISTS net_contributions NUMERIC DEFAULT 0;     -- deposits(+)/withdrawals(-) during the period

ALTER TABLE public.securities_snapshots
  ADD COLUMN IF NOT EXISTS benchmark_value NUMERIC;                 -- optional: VFV or S&P month-end level

ALTER TABLE public.securities_snapshots
  ADD COLUMN IF NOT EXISTS snapshot_date DATE DEFAULT CURRENT_DATE; -- exact capture date within the snapshot_month

COMMENT ON COLUMN public.securities_snapshots.net_contributions IS 'Net deposits(+)/withdrawals(-) during the period. Used by Modified Dietz so returns are not distorted by cash flows.';
COMMENT ON COLUMN public.securities_snapshots.benchmark_value   IS 'Optional benchmark level (e.g. VFV / S&P month-end). Normalized to the first snapshot for the chart overlay.';
COMMENT ON COLUMN public.securities_snapshots.snapshot_date     IS 'Exact date the snapshot was captured. snapshot_month remains the period bucket (first of month).';
