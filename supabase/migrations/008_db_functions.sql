-- ============================================================
-- MIGRATION 008: Database functions
-- close_monthly_period   → finalizes and locks all rows
-- admin_override_period  → unlocks with required reason
-- relock_after_override  → re-locks after admin edit
-- get_period_status      → returns status for a month_key
-- ============================================================

-- ─── close_monthly_period ────────────────────────────────────────────────────
-- Called by admin from the frontend "Close Month" button.
-- Sets period status to 'finalized' and is_locked = true on all child rows.
-- SECURITY DEFINER so it can bypass RLS for the locking operation,
-- but it verifies the caller is an admin before doing anything.

CREATE OR REPLACE FUNCTION public.close_monthly_period(
  p_month_key TEXT,
  p_admin_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_status TEXT;
  v_rows_locked   INT := 0;
BEGIN
  -- 1. Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'close_monthly_period: caller % is not an admin', p_admin_id;
  END IF;

  -- 2. Check period exists and is in a closable state
  SELECT status INTO v_period_status
  FROM public.monthly_periods
  WHERE month_key = p_month_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'close_monthly_period: period % does not exist', p_month_key;
  END IF;

  IF v_period_status = 'finalized' THEN
    RAISE EXCEPTION 'close_monthly_period: period % is already finalized', p_month_key;
  END IF;

  -- 3. Lock the period row
  UPDATE public.monthly_periods
  SET
    status       = 'finalized',
    finalized_at = now(),
    finalized_by = p_admin_id
  WHERE month_key = p_month_key;

  -- 4. Lock all child rows
  UPDATE public.monthly_snapshots
  SET is_locked = true, finalized_at = now(), finalized_by = p_admin_id
  WHERE month_key = p_month_key;
  GET DIAGNOSTICS v_rows_locked = ROW_COUNT;

  UPDATE public.monthly_individual_logs
  SET is_locked = true, finalized_at = now(), finalized_by = p_admin_id
  WHERE month_key = p_month_key;

  UPDATE public.monthly_business_logs
  SET is_locked = true, finalized_at = now(), finalized_by = p_admin_id
  WHERE month_key = p_month_key;

  UPDATE public.monthly_rent_logs
  SET is_locked = true
  WHERE month_key = p_month_key;

  UPDATE public.monthly_cashflow_logs
  SET is_locked = true, finalized_at = now(), finalized_by = p_admin_id
  WHERE month_key = p_month_key;

  RETURN jsonb_build_object(
    'success',      true,
    'month_key',    p_month_key,
    'finalized_at', now(),
    'finalized_by', p_admin_id
  );
END;
$$;

COMMENT ON FUNCTION public.close_monthly_period IS
  'Finalizes a monthly period. Sets status=finalized and is_locked=true on all child tables. Requires caller to be admin. Cannot be reversed except via admin_override_period().';


-- ─── admin_override_period ───────────────────────────────────────────────────
-- Called when admin explicitly unlocks a finalized period.
-- override_reason is REQUIRED and cannot be empty.

CREATE OR REPLACE FUNCTION public.admin_override_period(
  p_month_key      TEXT,
  p_admin_id       UUID,
  p_override_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_status TEXT;
BEGIN
  -- 1. Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin_override_period: caller % is not an admin', p_admin_id;
  END IF;

  -- 2. Require a non-empty reason
  IF p_override_reason IS NULL OR trim(p_override_reason) = '' THEN
    RAISE EXCEPTION 'admin_override_period: override_reason is required and cannot be empty';
  END IF;

  -- 3. Period must exist and be finalized (can only override finalized periods)
  SELECT status INTO v_period_status
  FROM public.monthly_periods
  WHERE month_key = p_month_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_override_period: period % does not exist', p_month_key;
  END IF;

  IF v_period_status = 'open' THEN
    RAISE EXCEPTION 'admin_override_period: period % is open, no override needed', p_month_key;
  END IF;

  -- 4. Unlock the period
  UPDATE public.monthly_periods
  SET
    status          = 'admin_override',
    override_reason = p_override_reason,
    overridden_at   = now(),
    overridden_by   = p_admin_id
  WHERE month_key = p_month_key;

  -- 5. Unlock all child rows for editing
  UPDATE public.monthly_snapshots        SET is_locked = false WHERE month_key = p_month_key;
  UPDATE public.monthly_individual_logs  SET is_locked = false WHERE month_key = p_month_key;
  UPDATE public.monthly_business_logs    SET is_locked = false WHERE month_key = p_month_key;
  UPDATE public.monthly_rent_logs        SET is_locked = false WHERE month_key = p_month_key;
  UPDATE public.monthly_cashflow_logs    SET is_locked = false WHERE month_key = p_month_key;

  RETURN jsonb_build_object(
    'success',          true,
    'month_key',        p_month_key,
    'status',           'admin_override',
    'override_reason',  p_override_reason,
    'overridden_at',    now(),
    'overridden_by',    p_admin_id
  );
END;
$$;

COMMENT ON FUNCTION public.admin_override_period IS
  'Unlocks a finalized period for admin editing. Requires non-empty override_reason. Sets status=admin_override. Call relock_after_override() after edits are complete.';


-- ─── relock_after_override ───────────────────────────────────────────────────
-- Call this after admin finishes editing an overridden period.
-- Re-locks all rows and sets status back to finalized.

CREATE OR REPLACE FUNCTION public.relock_after_override(
  p_month_key TEXT,
  p_admin_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'relock_after_override: caller % is not an admin', p_admin_id;
  END IF;

  UPDATE public.monthly_periods
  SET status = 'finalized'
  WHERE month_key = p_month_key AND status = 'admin_override';

  UPDATE public.monthly_snapshots
  SET is_locked = true, updated_at = now(), updated_by = p_admin_id
  WHERE month_key = p_month_key;

  UPDATE public.monthly_individual_logs
  SET is_locked = true, updated_at = now(), updated_by = p_admin_id
  WHERE month_key = p_month_key;

  UPDATE public.monthly_business_logs
  SET is_locked = true, updated_at = now(), updated_by = p_admin_id
  WHERE month_key = p_month_key;

  UPDATE public.monthly_rent_logs
  SET is_locked = true, updated_at = now(), updated_by = p_admin_id
  WHERE month_key = p_month_key;

  UPDATE public.monthly_cashflow_logs
  SET is_locked = true, updated_at = now(), updated_by = p_admin_id
  WHERE month_key = p_month_key;

  RETURN jsonb_build_object(
    'success',    true,
    'month_key',  p_month_key,
    'status',     'finalized',
    'relocked_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.relock_after_override IS
  'Re-locks all rows for a period after admin has finished making override edits. Sets status back to finalized.';


-- ─── get_period_status ───────────────────────────────────────────────────────
-- Lightweight status check. Frontend calls this to decide whether to
-- show edit controls or lock icons.

CREATE OR REPLACE FUNCTION public.get_period_status(p_month_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.monthly_periods%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.monthly_periods WHERE month_key = p_month_key;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false, 'status', 'open', 'is_locked', false);
  END IF;

  RETURN jsonb_build_object(
    'exists',           true,
    'month_key',        v_row.month_key,
    'label',            v_row.label,
    'status',           v_row.status,
    'is_locked',        v_row.status = 'finalized',
    'finalized_at',     v_row.finalized_at,
    'finalized_by',     v_row.finalized_by,
    'override_reason',  v_row.override_reason,
    'overridden_at',    v_row.overridden_at,
    'overridden_by',    v_row.overridden_by
  );
END;
$$;

COMMENT ON FUNCTION public.get_period_status IS
  'Returns period status object for a given month_key. Used by frontend to decide edit vs read-only mode.';
