-- ============================================================
-- MIGRATION 017: add cash balance to the Wealthsimple Crypto account
-- The Wealthsimple Crypto account (id …0003) holds $805.00 CAD cash
-- alongside BTC/ETH. That cash was not represented in securities_holdings,
-- so the app under-counted the account by $805 vs the live balance
-- (coins ~$622 + cash $805 = $1,427.19 total as of 2026-06-18).
--
-- Adds one CASH position, mirroring the cash rows seeded in migration 014
-- (quantity = dollar amount, price = 1.00, asset_class = 'cash').
-- Cash is excluded from P&L but counts toward total market value, so this
-- aligns the live holdings with the backfilled snapshot series (016).
--
-- Additive. Idempotent via the (account_id, symbol) unique constraint.
-- No existing row is altered except this CASH line on re-run.
-- ============================================================

INSERT INTO public.securities_holdings
  (account_id, symbol, name, security_type, asset_class, quantity, avg_cost, price_currency, market_price, fx_rate, book_value_cad, market_value_cad, as_of_date)
VALUES
  ('a0000001-0000-0000-0000-000000000003', 'CASH', 'Cash', 'CASH', 'cash', 805.00, 1.00, 'CAD', 1.00, 1.0000, 805.00, 805.00, '2026-06-18')
ON CONFLICT (account_id, symbol) DO UPDATE SET
  quantity         = EXCLUDED.quantity,
  market_price     = EXCLUDED.market_price,
  fx_rate          = EXCLUDED.fx_rate,
  book_value_cad   = EXCLUDED.book_value_cad,
  market_value_cad = EXCLUDED.market_value_cad,
  as_of_date       = EXCLUDED.as_of_date,
  updated_at       = NOW();
