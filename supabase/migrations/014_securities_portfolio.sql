-- ============================================================
-- MIGRATION 014: securities_portfolio
-- Adds investment_accounts, securities_holdings, securities_snapshots
-- for the JMF Portfolio module (AJ individual_id=1 initially;
-- expandable to other members via individual_id).
--
-- individual_id INT matches the existing convention used across
-- monthly_individual_logs, monthly_business_logs, etc.
-- No existing table or column is altered or dropped.
-- ============================================================

-- ─── TABLES ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.investment_accounts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  individual_id         INT         NOT NULL,
  broker                TEXT        NOT NULL,
  account_type          TEXT        NOT NULL,
  account_number_masked TEXT,
  base_currency         TEXT        NOT NULL DEFAULT 'CAD',
  is_registered         BOOLEAN     DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE  public.investment_accounts                    IS 'One row per brokerage account. individual_id=1 is AJ.';
COMMENT ON COLUMN public.investment_accounts.individual_id      IS 'Integer ID matching individuals[].id in the dashboard blob (1=AJ, 2=Nazila …).';
COMMENT ON COLUMN public.investment_accounts.account_type       IS 'TFSA | Crypto | RRSP | Margin | Non-registered';

CREATE TABLE IF NOT EXISTS public.securities_holdings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       UUID        NOT NULL REFERENCES public.investment_accounts(id) ON DELETE CASCADE,
  symbol           TEXT        NOT NULL,
  name             TEXT,
  security_type    TEXT,
  asset_class      TEXT,
  quantity         NUMERIC     NOT NULL DEFAULT 0,
  avg_cost         NUMERIC,
  price_currency   TEXT        NOT NULL DEFAULT 'CAD',
  market_price     NUMERIC     NOT NULL DEFAULT 0,
  fx_rate          NUMERIC     NOT NULL DEFAULT 1,
  book_value_cad   NUMERIC     NOT NULL DEFAULT 0,
  market_value_cad NUMERIC     NOT NULL DEFAULT 0,
  as_of_date       DATE        DEFAULT CURRENT_DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT securities_holdings_account_symbol_unique UNIQUE (account_id, symbol)
);

COMMENT ON TABLE  public.securities_holdings                    IS 'One row per position per account. market_value_cad = quantity * market_price * fx_rate.';
COMMENT ON COLUMN public.securities_holdings.asset_class        IS 'us_tech | defensive | real_asset | crypto | cyclical | cash';
COMMENT ON COLUMN public.securities_holdings.fx_rate            IS 'price_currency → CAD. 1.3780 for USD; 1 for CAD.';
COMMENT ON COLUMN public.securities_holdings.market_value_cad   IS 'Computed on write: quantity * market_price * fx_rate. Authoritative value.';

CREATE TABLE IF NOT EXISTS public.securities_snapshots (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  individual_id    INT         NOT NULL,
  snapshot_month   DATE        NOT NULL,
  total_market_cad NUMERIC     NOT NULL DEFAULT 0,
  total_book_cad   NUMERIC     NOT NULL DEFAULT 0,
  allocation_json  JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT securities_snapshots_member_month_unique UNIQUE (individual_id, snapshot_month)
);

COMMENT ON TABLE  public.securities_snapshots                   IS 'Monthly point-in-time snapshot, mirrors the accountsLog pattern on the individual card.';

-- ─── INDEXES ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_investment_accounts_individual_id
  ON public.investment_accounts (individual_id);

CREATE INDEX IF NOT EXISTS idx_securities_holdings_account_id
  ON public.securities_holdings (account_id);

CREATE INDEX IF NOT EXISTS idx_securities_snapshots_member_month
  ON public.securities_snapshots (individual_id, snapshot_month);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.investment_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.securities_holdings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.securities_snapshots ENABLE ROW LEVEL SECURITY;

-- Admin: full access to all three tables
CREATE POLICY "investment_accounts: admin all"
  ON public.investment_accounts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "securities_holdings: admin all"
  ON public.securities_holdings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "securities_snapshots: admin all"
  ON public.securities_snapshots FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- ─── SEED DATA ────────────────────────────────────────────────────────────────
-- Deterministic UUIDs so holdings can reference accounts directly.
-- All market_value_cad = quantity * market_price * fx_rate (USD positions: fx 1.3780).
-- Seed date: 2026-06-12. Run is idempotent (ON CONFLICT DO NOTHING / DO UPDATE).

-- ── Accounts ──────────────────────────────────────────────────────────────────

INSERT INTO public.investment_accounts
  (id, individual_id, broker, account_type, account_number_masked, base_currency, is_registered)
VALUES
  ('a0000001-0000-0000-0000-000000000001', 1, 'TD Easy Trade',       'TFSA',            '6881B9-J',     'CAD', TRUE),
  ('a0000001-0000-0000-0000-000000000002', 1, 'Wealthsimple',        'TFSA',            'HQ33F3FK4CAD', 'CAD', TRUE),
  ('a0000001-0000-0000-0000-000000000003', 1, 'Wealthsimple',        'Crypto',          'HQ792B714CAD', 'CAD', FALSE),
  ('a0000001-0000-0000-0000-000000000004', 1, 'TD Direct Investing',  'Non-registered',  '35Y6M0J',      'CAD', FALSE)
ON CONFLICT (id) DO NOTHING;

-- ── Holdings: Account 1 — TD Easy Trade TFSA ─────────────────────────────────

INSERT INTO public.securities_holdings
  (account_id, symbol, name, security_type, asset_class, quantity, avg_cost, price_currency, market_price, fx_rate, book_value_cad, market_value_cad, as_of_date)
VALUES
  -- CASH
  ('a0000001-0000-0000-0000-000000000001','CASH','Cash',                   'CASH',  'cash',      162.69,   1.00,    'CAD',  1.00,   1.0000, 162.69,   162.69,   '2026-06-12'),
  -- Equities CAD
  ('a0000001-0000-0000-0000-000000000001','AC',  'Air Canada',             'EQUITY','cyclical',  9,        20.42,   'CAD',  22.07,  1.0000, 183.81,   198.63,   '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000001','ABX', 'Barrick Mining',         'EQUITY','real_asset',10,       36.96,   'CAD',  58.90,  1.0000, 369.63,   589.00,   '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000001','IFC', 'Intact Financial',       'EQUITY','defensive', 5,        158.07,  'CAD',  270.87, 1.0000, 790.34,   1354.35,  '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000001','FLT', 'Volatus Aerospace',      'EQUITY','cyclical',  27,       1.09,    'CAD',  0.66,   1.0000, 29.43,    17.82,    '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000001','TLRY','Tilray Brands',          'EQUITY','cyclical',  1,        21.76,   'CAD',  7.58,   1.0000, 21.76,    7.58,     '2026-06-12'),
  -- Equities USD
  ('a0000001-0000-0000-0000-000000000001','BA',  'Boeing',                 'EQUITY','cyclical',  1,        165.36,  'USD',  231.15, 1.3780, 227.87,   318.64,   '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000001','COKE','Coca-Cola Consolidated', 'EQUITY','defensive', 30,       25.07,   'USD',  173.26, 1.3780, 1035.98,  7165.16,  '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000001','PFE', 'Pfizer',                 'EQUITY','defensive', 11,       39.35,   'USD',  26.18,  1.3780, 596.66,   396.98,   '2026-06-12')
ON CONFLICT (account_id, symbol) DO NOTHING;

-- ── Holdings: Account 2 — Wealthsimple TFSA ──────────────────────────────────

INSERT INTO public.securities_holdings
  (account_id, symbol, name, security_type, asset_class, quantity, avg_cost, price_currency, market_price, fx_rate, book_value_cad, market_value_cad, as_of_date)
VALUES
  -- Equities USD
  ('a0000001-0000-0000-0000-000000000002','BABA', 'Alibaba Group',            'EQUITY','us_tech',   3.3079,   109.43, 'USD', 113.30,  1.3780, 498.74,   516.46,   '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000002','GOOGL','Alphabet (Class A)',        'EQUITY','us_tech',   1.2337,   171.81, 'USD', 360.87,  1.3780, 292.52,   613.50,   '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000002','META', 'Meta Platforms',           'EQUITY','us_tech',   0.4954,   636.70, 'USD', 569.30,  1.3780, 434.64,   388.64,   '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000002','NVDA', 'NVIDIA',                   'EQUITY','us_tech',   0.3491,   125.52, 'USD', 205.42,  1.3780, 60.44,    98.82,    '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000002','SCHD', 'Schwab US Dividend ETF',   'ETF',   'defensive', 10.1034,  28.62,  'USD', 32.865,  1.3780, 398.84,   457.56,   '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000002','XNTK', 'SPDR NYSE Technology ETF', 'ETF',   'us_tech',   1.4927,   152.65, 'USD', 369.05,  1.3780, 314.54,   759.11,   '2026-06-12'),
  -- Equities / ETFs CAD
  ('a0000001-0000-0000-0000-000000000002','DOL',  'Dollarama',                'EQUITY','defensive', 4.0227,   145.81, 'CAD', 190.94,  1.0000, 586.52,   768.09,   '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000002','QQC',  'Invesco NASDAQ 100 ETF',   'ETF',   'us_tech',   13.4009,  33.58,  'CAD', 49.27,   1.0000, 450.00,   660.26,   '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000002','VFV',  'Vanguard S&P 500 ETF',     'ETF',   'us_tech',   143.5552, 153.08, 'CAD', 184.57,  1.0000, 21973.07, 26495.98, '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000002','XEG',  'iShares TSX Energy ETF',   'ETF',   'real_asset',11.8483,  16.88,  'CAD', 26.46,   1.0000, 200.00,   313.51,   '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000002','ZLB',  'BMO Low Vol Canadian ETF', 'ETF',   'defensive', 10.2986,  48.55,  'CAD', 60.94,   1.0000, 500.00,   627.60,   '2026-06-12')
ON CONFLICT (account_id, symbol) DO NOTHING;

-- ── Holdings: Account 3 — Wealthsimple Crypto ────────────────────────────────

INSERT INTO public.securities_holdings
  (account_id, symbol, name, security_type, asset_class, quantity, avg_cost, price_currency, market_price, fx_rate, book_value_cad, market_value_cad, as_of_date)
VALUES
  ('a0000001-0000-0000-0000-000000000003','BTC','Bitcoin',  'CRYPTO','crypto', 0.0051578,   126020.00, 'CAD', 88858.81, 1.0000, 650.00, 458.82, '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000003','ETH','Ethereum', 'CRYPTO','crypto', 0.06348253,  4647.00,   'CAD', 2329.15,  1.0000, 295.00, 148.03, '2026-06-12')
ON CONFLICT (account_id, symbol) DO NOTHING;

-- ── Holdings: Account 4 — TD Direct Investing ─────────────────────────────────

INSERT INTO public.securities_holdings
  (account_id, symbol, name, security_type, asset_class, quantity, avg_cost, price_currency, market_price, fx_rate, book_value_cad, market_value_cad, as_of_date)
VALUES
  ('a0000001-0000-0000-0000-000000000004','TDB908', 'TD NASDAQ Index-e',               'MUTUAL_FUND','us_tech', 30.114, 33.1876, 'CAD', 64.32, 1.0000, 999.41,  1936.93, '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000004','TDB903', 'TD DJIA Index C$-e',              'MUTUAL_FUND','us_tech', 16.502, 29.5334, 'CAD', 47.93, 1.0000, 487.36,  790.94,  '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000004','TDB3098','TD Science & Technology-D',        'MUTUAL_FUND','us_tech', 29.433, 32.2811, 'CAD', 56.69, 1.0000, 950.13,  1668.56, '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000004','TDB3055','TD Global Entertainment & Comm.-D','MUTUAL_FUND','us_tech', 8.52,   30.2829, 'CAD', 36.16, 1.0000, 258.01,  308.08,  '2026-06-12'),
  ('a0000001-0000-0000-0000-000000000004','CASH',   'Cash',                             'CASH',       'cash',    1.72,   1.00,    'CAD', 1.00,  1.0000, 1.72,    1.72,    '2026-06-12')
ON CONFLICT (account_id, symbol) DO NOTHING;

-- ─── EXPECTED RECONCILIATION ─────────────────────────────────────────────────
-- Securities (asset_class NOT IN ('crypto','cash')): ≈ $46,452 CAD
-- Crypto (asset_class = 'crypto'):                  ≈ $607 CAD
-- Cash (asset_class = 'cash'):                      ≈ $164 CAD (excluded from card)
-- Total market:                                     ≈ $47,223 CAD
