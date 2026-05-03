-- ============================================================
-- MIGRATION 009: Legacy data migration
-- Reads from dashboard_data (JSONB blobs) and populates the
-- new relational monthly log tables.
--
-- DESIGN DECISIONS APPLIED:
--   - Legacy JSONB data is NOT destroyed (dashboard_data rows kept)
--   - Clean entries are migrated automatically
--   - Ambiguous or messy entries are flagged in migration_flags table
--   - All migrated rows are left is_locked = false (open) until
--     admin explicitly closes each month via close_monthly_period()
--   - Individual IDs hardcoded per app DEFAULT data:
--       1=Ahmed, 2=Nazila, 3=Yasin, 4=Maryam, 5=Akbar, 6=Mustafa
--   - Business IDs hardcoded per app DEFAULT data:
--       1=Kratos Moving, 2=JMF Logistics, 3=PRIMA, 4=ASWC
-- ============================================================


-- ─── Migration flags table ───────────────────────────────────────────────────
-- Captures anything that couldn't be cleanly migrated.
-- Admin reviews this table after running migration.

CREATE TABLE IF NOT EXISTS public.migration_flags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source      TEXT        NOT NULL,   -- e.g. 'accountsLog', 'monthlyProfits', 'rentPayments'
  entity_id   TEXT,                   -- individual/business/property id
  month_key   TEXT,
  raw_entry   JSONB,                  -- the original JSONB entry that was flagged
  reason      TEXT        NOT NULL,   -- why it was flagged
  resolved    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.migration_flags IS
  'Entries from legacy JSONB that could not be cleanly migrated. Admin must review and resolve.';


-- ─── Step 1: Ensure monthly_periods rows exist for any month in legacy data ──
-- We scan the JSONB blobs and create period rows for each unique month found.
-- Months older than current are seeded as 'open' — admin can finalize them
-- via close_monthly_period() after reviewing migrated data.

DO $$
DECLARE
  v_dashboard JSONB;
  v_individuals JSONB;
  v_businesses  JSONB;
  v_ind         JSONB;
  v_biz         JSONB;
  v_log_entry   JSONB;
  v_month_key   TEXT;
  v_label       TEXT;
  v_month_num   INT;
  v_year_num    INT;
BEGIN
  -- Load dashboard_data JSONB
  SELECT value INTO v_individuals
  FROM public.dashboard_data WHERE key = 'individuals';

  SELECT value INTO v_businesses
  FROM public.dashboard_data WHERE key = 'businesses';

  -- Walk all accountsLog entries to collect unique months
  IF v_individuals IS NOT NULL THEN
    FOR v_ind IN SELECT * FROM jsonb_array_elements(v_individuals)
    LOOP
      FOR v_log_entry IN SELECT * FROM jsonb_array_elements(COALESCE(v_ind->'accountsLog', '[]'::jsonb))
      LOOP
        v_month_key := v_log_entry->>'month';
        IF v_month_key ~ '^\d{4}-\d{2}$' THEN
          v_year_num  := split_part(v_month_key, '-', 1)::INT;
          v_month_num := split_part(v_month_key, '-', 2)::INT;
          v_label := to_char(make_date(v_year_num, v_month_num, 1), 'Month YYYY');
          INSERT INTO public.monthly_periods (month_key, label, status)
          VALUES (v_month_key, trim(v_label), 'open')
          ON CONFLICT (month_key) DO NOTHING;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- Walk all monthlyProfits entries
  IF v_businesses IS NOT NULL THEN
    FOR v_biz IN SELECT * FROM jsonb_array_elements(v_businesses)
    LOOP
      FOR v_log_entry IN SELECT * FROM jsonb_array_elements(COALESCE(v_biz->'monthlyProfits', '[]'::jsonb))
      LOOP
        v_month_key := v_log_entry->>'month';
        IF v_month_key ~ '^\d{4}-\d{2}$' THEN
          v_year_num  := split_part(v_month_key, '-', 1)::INT;
          v_month_num := split_part(v_month_key, '-', 2)::INT;
          v_label := to_char(make_date(v_year_num, v_month_num, 1), 'Month YYYY');
          INSERT INTO public.monthly_periods (month_key, label, status)
          VALUES (v_month_key, trim(v_label), 'open')
          ON CONFLICT (month_key) DO NOTHING;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  RAISE NOTICE 'Step 1 complete: monthly_periods rows created for all legacy months.';
END;
$$;


-- ─── Step 2: Migrate individuals accountsLog ─────────────────────────────────

DO $$
DECLARE
  v_individuals JSONB;
  v_ind         JSONB;
  v_log_entry   JSONB;
  v_ind_id      INT;
  v_month_key   TEXT;
  v_cash        NUMERIC;
  v_accounts    NUMERIC;
  v_securities  NUMERIC;
  v_crypto      NUMERIC;
  v_physical    NUMERIC;
  v_income      NUMERIC;
  v_note        TEXT;
  v_migrated    INT := 0;
  v_flagged     INT := 0;
BEGIN
  SELECT value INTO v_individuals
  FROM public.dashboard_data WHERE key = 'individuals';

  IF v_individuals IS NULL THEN
    RAISE NOTICE 'Step 2: No individuals data found in dashboard_data. Skipping.';
    RETURN;
  END IF;

  FOR v_ind IN SELECT * FROM jsonb_array_elements(v_individuals)
  LOOP
    v_ind_id := (v_ind->>'id')::INT;

    FOR v_log_entry IN SELECT * FROM jsonb_array_elements(COALESCE(v_ind->'accountsLog', '[]'::jsonb))
    LOOP
      v_month_key := v_log_entry->>'month';

      -- FLAG: missing or malformed month key
      IF v_month_key IS NULL OR v_month_key !~ '^\d{4}-\d{2}$' THEN
        INSERT INTO public.migration_flags (source, entity_id, month_key, raw_entry, reason)
        VALUES ('accountsLog', v_ind_id::TEXT, v_month_key, v_log_entry,
                'Invalid or missing month key — cannot determine which period this belongs to');
        v_flagged := v_flagged + 1;
        CONTINUE;
      END IF;

      -- FLAG: no period row (shouldn't happen after Step 1, but defensive)
      IF NOT EXISTS (SELECT 1 FROM public.monthly_periods WHERE month_key = v_month_key) THEN
        INSERT INTO public.migration_flags (source, entity_id, month_key, raw_entry, reason)
        VALUES ('accountsLog', v_ind_id::TEXT, v_month_key, v_log_entry,
                'No monthly_periods row found for this month_key');
        v_flagged := v_flagged + 1;
        CONTINUE;
      END IF;

      -- Extract fields (all nullable in source — default to 0)
      v_cash       := COALESCE((v_log_entry->>'cash')::NUMERIC, 0);
      v_accounts   := COALESCE((v_log_entry->>'accounts')::NUMERIC, 0);
      v_securities := COALESCE((v_log_entry->>'securities')::NUMERIC, 0);
      v_crypto     := COALESCE((v_log_entry->>'crypto')::NUMERIC, 0);
      v_physical   := COALESCE((v_log_entry->>'physicalAssets')::NUMERIC, 0);
      v_note       := v_log_entry->>'note';

      -- Income: look in monthlyIncome array for same month
      SELECT COALESCE((elem->>'income')::NUMERIC, 0) INTO v_income
      FROM jsonb_array_elements(COALESCE(v_ind->'monthlyIncome', '[]'::jsonb)) elem
      WHERE elem->>'month' = v_month_key
      LIMIT 1;
      v_income := COALESCE(v_income, 0);

      -- Upsert into monthly_individual_logs
      INSERT INTO public.monthly_individual_logs
        (month_key, individual_id, cash, accounts, securities, crypto, physical_assets, monthly_income, note)
      VALUES
        (v_month_key, v_ind_id, v_cash, v_accounts, v_securities, v_crypto, v_physical, v_income, v_note)
      ON CONFLICT (month_key, individual_id) DO UPDATE SET
        cash            = EXCLUDED.cash,
        accounts        = EXCLUDED.accounts,
        securities      = EXCLUDED.securities,
        crypto          = EXCLUDED.crypto,
        physical_assets = EXCLUDED.physical_assets,
        monthly_income  = EXCLUDED.monthly_income,
        note            = EXCLUDED.note;

      v_migrated := v_migrated + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Step 2 complete: % individual log rows migrated, % flagged.', v_migrated, v_flagged;
END;
$$;


-- ─── Step 3: Migrate businesses monthlyProfits ───────────────────────────────

DO $$
DECLARE
  v_businesses  JSONB;
  v_biz         JSONB;
  v_profit_entry JSONB;
  v_biz_id      INT;
  v_month_key   TEXT;
  v_revenue     NUMERIC;
  v_expenses    NUMERIC;
  v_profit      NUMERIC;
  v_migrated    INT := 0;
  v_flagged     INT := 0;
BEGIN
  SELECT value INTO v_businesses
  FROM public.dashboard_data WHERE key = 'businesses';

  IF v_businesses IS NULL THEN
    RAISE NOTICE 'Step 3: No businesses data found. Skipping.';
    RETURN;
  END IF;

  FOR v_biz IN SELECT * FROM jsonb_array_elements(v_businesses)
  LOOP
    v_biz_id := (v_biz->>'id')::INT;

    FOR v_profit_entry IN SELECT * FROM jsonb_array_elements(COALESCE(v_biz->'monthlyProfits', '[]'::jsonb))
    LOOP
      v_month_key := v_profit_entry->>'month';

      IF v_month_key IS NULL OR v_month_key !~ '^\d{4}-\d{2}$' THEN
        INSERT INTO public.migration_flags (source, entity_id, month_key, raw_entry, reason)
        VALUES ('monthlyProfits', v_biz_id::TEXT, v_month_key, v_profit_entry,
                'Invalid or missing month key');
        v_flagged := v_flagged + 1;
        CONTINUE;
      END IF;

      v_revenue  := COALESCE((v_profit_entry->>'revenue')::NUMERIC, 0);
      v_expenses := COALESCE((v_profit_entry->>'expenses')::NUMERIC, 0);
      v_profit   := COALESCE(
                      (v_profit_entry->>'profit')::NUMERIC,
                      v_revenue - v_expenses
                    );

      -- FLAG: all zeros (likely a placeholder entry)
      IF v_revenue = 0 AND v_expenses = 0 AND v_profit = 0 THEN
        INSERT INTO public.migration_flags (source, entity_id, month_key, raw_entry, reason)
        VALUES ('monthlyProfits', v_biz_id::TEXT, v_month_key, v_profit_entry,
                'All-zero entry — may be a placeholder. Review before treating as canonical data.');
        v_flagged := v_flagged + 1;
        -- Still migrate it but flag it
      END IF;

      INSERT INTO public.monthly_business_logs
        (month_key, business_id, revenue, expenses, profit)
      VALUES
        (v_month_key, v_biz_id, v_revenue, v_expenses, v_profit)
      ON CONFLICT (month_key, business_id) DO UPDATE SET
        revenue  = EXCLUDED.revenue,
        expenses = EXCLUDED.expenses,
        profit   = EXCLUDED.profit;

      v_migrated := v_migrated + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Step 3 complete: % business profit rows migrated, % flagged.', v_migrated, v_flagged;
END;
$$;


-- ─── Step 4: Migrate rentPayments ────────────────────────────────────────────

DO $$
DECLARE
  v_rent_payments JSONB;
  v_payment       JSONB;
  v_month_key     TEXT;
  v_property_id   INT;
  v_unit_id       TEXT;
  v_lease_id      TEXT;
  v_amount        NUMERIC;
  v_date          DATE;
  v_note          TEXT;
  v_year_num      INT;
  v_month_num     INT;
  v_label         TEXT;
  v_migrated      INT := 0;
  v_flagged       INT := 0;
BEGIN
  SELECT value INTO v_rent_payments
  FROM public.dashboard_data WHERE key = 'rentPayments';

  IF v_rent_payments IS NULL OR jsonb_array_length(v_rent_payments) = 0 THEN
    RAISE NOTICE 'Step 4: No rentPayments data found. Skipping.';
    RETURN;
  END IF;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_rent_payments)
  LOOP
    v_month_key   := v_payment->>'month';
    v_property_id := (v_payment->>'propertyId')::INT;
    v_unit_id     := COALESCE(v_payment->>'unitId', '');
    v_lease_id    := v_payment->>'leaseId';
    v_amount      := COALESCE((v_payment->>'amount')::NUMERIC, 0);
    v_note        := v_payment->>'note';

    -- Parse payment date
    BEGIN
      v_date := (v_payment->>'date')::DATE;
    EXCEPTION WHEN OTHERS THEN
      v_date := NULL;
    END;

    -- FLAG: missing month key
    IF v_month_key IS NULL OR v_month_key !~ '^\d{4}-\d{2}$' THEN
      INSERT INTO public.migration_flags (source, entity_id, month_key, raw_entry, reason)
      VALUES ('rentPayments', v_property_id::TEXT, v_month_key, v_payment,
              'Invalid or missing month key — cannot assign to a period');
      v_flagged := v_flagged + 1;
      CONTINUE;
    END IF;

    -- FLAG: zero amount
    IF v_amount = 0 THEN
      INSERT INTO public.migration_flags (source, entity_id, month_key, raw_entry, reason)
      VALUES ('rentPayments', v_property_id::TEXT, v_month_key, v_payment,
              'Zero amount rent payment — may be a placeholder or error. Review before finalizing.');
      v_flagged := v_flagged + 1;
      -- Still migrate, but flagged
    END IF;

    -- Ensure period row exists (rent payments may reference months not in accountsLog)
    IF NOT EXISTS (SELECT 1 FROM public.monthly_periods WHERE month_key = v_month_key) THEN
      v_year_num  := split_part(v_month_key, '-', 1)::INT;
      v_month_num := split_part(v_month_key, '-', 2)::INT;
      v_label := to_char(make_date(v_year_num, v_month_num, 1), 'Month YYYY');
      INSERT INTO public.monthly_periods (month_key, label, status)
      VALUES (v_month_key, trim(v_label), 'open')
      ON CONFLICT (month_key) DO NOTHING;
    END IF;

    INSERT INTO public.monthly_rent_logs
      (month_key, property_id, unit_id, lease_id, amount, payment_date, payment_type, note)
    VALUES
      (v_month_key, v_property_id, v_unit_id, v_lease_id, v_amount, v_date, 'payment', v_note);

    v_migrated := v_migrated + 1;
  END LOOP;

  RAISE NOTICE 'Step 4 complete: % rent payment rows migrated, % flagged.', v_migrated, v_flagged;
END;
$$;


-- ─── Step 5: Migrate consolidated snapshots ──────────────────────────────────

DO $$
DECLARE
  v_snapshots   JSONB;
  v_snap        JSONB;
  v_month_key   TEXT;
  v_year_num    INT;
  v_month_num   INT;
  v_label       TEXT;
  v_migrated    INT := 0;
  v_flagged     INT := 0;
BEGIN
  SELECT value INTO v_snapshots
  FROM public.dashboard_data WHERE key = 'snapshots';

  IF v_snapshots IS NULL OR jsonb_array_length(v_snapshots) = 0 THEN
    RAISE NOTICE 'Step 5: No snapshots data found. Skipping.';
    RETURN;
  END IF;

  FOR v_snap IN SELECT * FROM jsonb_array_elements(v_snapshots)
  LOOP
    v_month_key := v_snap->>'month';

    IF v_month_key IS NULL OR v_month_key !~ '^\d{4}-\d{2}$' THEN
      INSERT INTO public.migration_flags (source, entity_id, month_key, raw_entry, reason)
      VALUES ('snapshots', NULL, v_month_key, v_snap,
              'Invalid or missing month key on snapshot');
      v_flagged := v_flagged + 1;
      CONTINUE;
    END IF;

    -- Ensure period row exists
    IF NOT EXISTS (SELECT 1 FROM public.monthly_periods WHERE month_key = v_month_key) THEN
      v_year_num  := split_part(v_month_key, '-', 1)::INT;
      v_month_num := split_part(v_month_key, '-', 2)::INT;
      v_label := to_char(make_date(v_year_num, v_month_num, 1), 'Month YYYY');
      INSERT INTO public.monthly_periods (month_key, label, status)
      VALUES (v_month_key, trim(v_label), 'open')
      ON CONFLICT (month_key) DO NOTHING;
    END IF;

    INSERT INTO public.monthly_snapshots (
      month_key, nw, re_equity, re_liquid, individuals_total, businesses_total,
      individual_breakdown, re_breakdown, business_breakdown,
      cash_flow_snapshot, note
    ) VALUES (
      v_month_key,
      COALESCE((v_snap->>'nw')::NUMERIC, 0),
      COALESCE((v_snap->>'reEquity')::NUMERIC, 0),
      COALESCE((v_snap->>'reLiquid')::NUMERIC, 0),
      COALESCE((v_snap->>'individuals')::NUMERIC, 0),
      COALESCE((v_snap->>'businesses')::NUMERIC, 0),
      COALESCE(v_snap->'individualBreakdown', '[]'::jsonb),
      COALESCE(v_snap->'reBreakdown',         '[]'::jsonb),
      COALESCE(v_snap->'businessBreakdown',   '[]'::jsonb),
      '{}'::jsonb,  -- legacy snapshots had no cash flow snapshot
      v_snap->>'note'
    )
    ON CONFLICT (month_key) DO UPDATE SET
      nw                   = EXCLUDED.nw,
      re_equity            = EXCLUDED.re_equity,
      re_liquid            = EXCLUDED.re_liquid,
      individuals_total    = EXCLUDED.individuals_total,
      businesses_total     = EXCLUDED.businesses_total,
      individual_breakdown = EXCLUDED.individual_breakdown,
      re_breakdown         = EXCLUDED.re_breakdown,
      business_breakdown   = EXCLUDED.business_breakdown,
      note                 = EXCLUDED.note;

    v_migrated := v_migrated + 1;
  END LOOP;

  RAISE NOTICE 'Step 5 complete: % snapshot rows migrated, % flagged.', v_migrated, v_flagged;
END;
$$;


-- ─── Final: Migration summary ─────────────────────────────────────────────────
-- After running, check these queries in Supabase SQL editor:

-- SELECT * FROM public.migration_flags WHERE resolved = false ORDER BY created_at;
-- SELECT * FROM public.monthly_periods ORDER BY month_key;
-- SELECT * FROM public.monthly_individual_logs ORDER BY month_key, individual_id;
-- SELECT * FROM public.monthly_business_logs ORDER BY month_key, business_id;
-- SELECT * FROM public.monthly_rent_logs ORDER BY month_key, property_id;
-- SELECT * FROM public.monthly_snapshots ORDER BY month_key;

-- After reviewing migration_flags and confirming data looks correct,
-- admin can close past periods one by one using:
--   SELECT close_monthly_period('2026-04', '<admin-uuid>');
