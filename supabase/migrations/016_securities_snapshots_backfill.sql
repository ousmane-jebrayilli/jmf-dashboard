-- ============================================================
-- MIGRATION 016: securities_snapshots historical backfill (AJ, individual_id=1)
-- Source: "AJ x MM NETWORTH" Google Sheet → SECURITIES tab + CRYPTO tab.
--
-- Each month combines SECURITIES + CRYPTO so the series is on the SAME basis
-- as the live app (which sums all holdings, crypto included) when a month is
-- logged going forward:
--   total_market_cad  = SECURITIES MARKET VALUE (G) + CRYPTO MARKET VALUE
--   total_book_cad    = SECURITIES "SUM OF INVESTED" + CRYPTO "SUM OF INVESTED"  [cost basis]
--   net_contributions = month-over-month change in combined invested (deposits +/withdrawals −)
--   benchmark_value   = left NULL (no benchmark column in source)
--   allocation_json   = left NULL (per-class split unknown for historical months)
--
-- One row per calendar month. Where a month had two entries the later (closer
-- to month-end) one was used. April 2025 had no row in the source and is omitted.
-- Crypto did not exist before Jan 2025, so 2024 months are securities-only.
--
-- REQUIRES migration 015 first (net_contributions / snapshot_date columns).
-- Idempotent: ON CONFLICT updates in place, so it is safe to re-run.
-- No existing table/column is altered or dropped.
-- ============================================================

INSERT INTO public.securities_snapshots
  (individual_id, snapshot_month, snapshot_date, total_market_cad, total_book_cad, net_contributions)
VALUES
  --  month         capture date   market(sec+cry)  book(sec+cry)   net contrib.
  (1, '2024-09-01', '2024-09-13', 13315.19,  8894.80,      0.00),
  (1, '2024-10-01', '2024-10-04', 15537.70, 10670.81,   1776.01),
  (1, '2024-11-01', '2024-11-01', 15382.45, 10670.81,      0.00),
  (1, '2024-12-01', '2024-12-02', 28951.22, 23170.81,  12500.00),
  (1, '2025-01-01', '2025-01-21', 41004.67, 34685.64,  11514.83),
  (1, '2025-02-01', '2025-02-28', 41358.14, 34516.02,   -169.62),
  (1, '2025-03-01', '2025-03-31', 39775.05, 34516.02,      0.00),
  (1, '2025-05-01', '2025-05-09', 39317.68, 34516.02,      0.00),
  (1, '2025-06-01', '2025-06-07', 40030.19, 34516.02,      0.00),
  (1, '2025-07-01', '2025-07-11', 41543.73, 34516.02,      0.00),
  (1, '2025-08-01', '2025-08-13', 42683.96, 34516.02,      0.00),
  (1, '2025-09-01', '2025-09-09', 43252.29, 34516.02,      0.00),
  (1, '2025-10-01', '2025-10-01', 44442.68, 34516.02,      0.00),
  (1, '2025-11-01', '2025-11-06', 45415.00, 34516.02,      0.00),
  (1, '2025-12-01', '2025-12-06', 46865.30, 34516.02,      0.00),
  (1, '2026-01-01', '2026-01-01', 46040.97, 34516.02,      0.00),
  (1, '2026-02-01', '2026-02-05', 45175.07, 34590.57,     74.55),
  (1, '2026-03-01', '2026-03-01', 47689.33, 34590.57,      0.00),
  (1, '2026-04-01', '2026-04-01', 48076.34, 34590.57,      0.00),
  (1, '2026-05-01', '2026-05-01', 49068.09, 34590.57,      0.00),
  (1, '2026-06-01', '2026-06-01', 50485.14, 34590.57,      0.00)
ON CONFLICT (individual_id, snapshot_month) DO UPDATE SET
  snapshot_date     = EXCLUDED.snapshot_date,
  total_market_cad  = EXCLUDED.total_market_cad,
  total_book_cad    = EXCLUDED.total_book_cad,
  net_contributions = EXCLUDED.net_contributions;
