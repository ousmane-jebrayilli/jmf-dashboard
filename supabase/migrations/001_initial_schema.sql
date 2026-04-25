-- JMF Health App – Initial Schema
-- Run this in your Supabase SQL editor or via `supabase db push`

-- ─────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- 1. family_members  (no FK deps — created first)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS family_members (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name      text        NOT NULL,
  date_of_birth  date,
  sex            text,
  height_cm      numeric,
  weight_kg      numeric,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 2. profiles  (refs auth.users + family_members)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text        NOT NULL,
  role        text        NOT NULL CHECK (role IN ('admin', 'member')),
  member_id   uuid        REFERENCES family_members(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 3. health_documents
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_documents (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id      uuid        NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  uploaded_by    uuid        REFERENCES auth.users(id),
  document_type  text        NOT NULL,
  title          text        NOT NULL,
  file_path      text        NOT NULL,
  document_date  date,
  summary        text,
  created_at     timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 4. lab_results
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_results (
  id              uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id       uuid    NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  document_id     uuid    REFERENCES health_documents(id) ON DELETE SET NULL,
  test_name       text    NOT NULL,
  test_category   text    NOT NULL,
  result_value    numeric NOT NULL,
  unit            text    NOT NULL,
  reference_low   numeric,
  reference_high  numeric,
  result_date     date    NOT NULL,
  status          text    NOT NULL CHECK (status IN ('low', 'normal', 'high', 'critical', 'unknown')),
  notes           text,
  created_at      timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 5. reminders
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminders (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id        uuid NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  reminder_type    text NOT NULL,
  due_date         date NOT NULL,
  interval_months  int,
  status           text NOT NULL CHECK (status IN ('pending', 'completed', 'snoozed')),
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 6. risk_flags
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_flags (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id      uuid NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  lab_result_id  uuid REFERENCES lab_results(id) ON DELETE SET NULL,
  severity       text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  category       text NOT NULL,
  message        text NOT NULL,
  recommendation text NOT NULL,
  status         text NOT NULL CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at     timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 7. audit_logs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id           uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid    REFERENCES auth.users(id),
  action       text    NOT NULL,
  entity_type  text    NOT NULL,
  entity_id    uuid,
  details      jsonb,
  created_at   timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- Enable RLS on all tables
-- ─────────────────────────────────────────────
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_flags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- Helper functions (SECURITY DEFINER = bypass RLS for the check itself)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION get_my_member_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT member_id FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- ─────────────────────────────────────────────
-- RLS Policies: profiles
-- ─────────────────────────────────────────────
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (user_id = auth.uid() OR is_admin());

-- ─────────────────────────────────────────────
-- RLS Policies: family_members
-- ─────────────────────────────────────────────
CREATE POLICY "family_members_select_admin" ON family_members
  FOR SELECT USING (is_admin());

CREATE POLICY "family_members_select_member" ON family_members
  FOR SELECT USING (id = get_my_member_id());

CREATE POLICY "family_members_insert" ON family_members
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "family_members_update" ON family_members
  FOR UPDATE USING (is_admin());

CREATE POLICY "family_members_delete" ON family_members
  FOR DELETE USING (is_admin());

-- ─────────────────────────────────────────────
-- RLS Policies: health_documents
-- ─────────────────────────────────────────────
CREATE POLICY "documents_all_admin" ON health_documents
  FOR ALL USING (is_admin());

CREATE POLICY "documents_select_member" ON health_documents
  FOR SELECT USING (member_id = get_my_member_id());

CREATE POLICY "documents_insert_member" ON health_documents
  FOR INSERT WITH CHECK (
    member_id = get_my_member_id()
    AND uploaded_by = auth.uid()
  );

-- ─────────────────────────────────────────────
-- RLS Policies: lab_results
-- ─────────────────────────────────────────────
CREATE POLICY "labs_all_admin" ON lab_results
  FOR ALL USING (is_admin());

CREATE POLICY "labs_select_member" ON lab_results
  FOR SELECT USING (member_id = get_my_member_id());

-- ─────────────────────────────────────────────
-- RLS Policies: reminders
-- ─────────────────────────────────────────────
CREATE POLICY "reminders_all_admin" ON reminders
  FOR ALL USING (is_admin());

CREATE POLICY "reminders_select_member" ON reminders
  FOR SELECT USING (member_id = get_my_member_id());

CREATE POLICY "reminders_update_member" ON reminders
  FOR UPDATE USING (member_id = get_my_member_id());

-- ─────────────────────────────────────────────
-- RLS Policies: risk_flags
-- ─────────────────────────────────────────────
CREATE POLICY "flags_all_admin" ON risk_flags
  FOR ALL USING (is_admin());

CREATE POLICY "flags_select_member" ON risk_flags
  FOR SELECT USING (member_id = get_my_member_id());

-- ─────────────────────────────────────────────
-- RLS Policies: audit_logs
-- ─────────────────────────────────────────────
CREATE POLICY "audit_insert" ON audit_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "audit_select_admin" ON audit_logs
  FOR SELECT USING (is_admin());

CREATE POLICY "audit_select_own" ON audit_logs
  FOR SELECT USING (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- Storage bucket for health documents
-- ─────────────────────────────────────────────
-- Run this separately in the Supabase dashboard or via CLI:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('health-documents', 'health-documents', false);

-- Storage policies (run after bucket creation):
-- CREATE POLICY "storage_admin_all" ON storage.objects FOR ALL USING (
--   bucket_id = 'health-documents' AND is_admin()
-- );
-- CREATE POLICY "storage_member_upload" ON storage.objects FOR INSERT WITH CHECK (
--   bucket_id = 'health-documents'
--   AND (storage.foldername(name))[1] = get_my_member_id()::text
--   AND auth.uid() IS NOT NULL
-- );
-- CREATE POLICY "storage_member_read" ON storage.objects FOR SELECT USING (
--   bucket_id = 'health-documents'
--   AND (storage.foldername(name))[1] = get_my_member_id()::text
-- );

-- ─────────────────────────────────────────────
-- Seed: Initial 6 JMF family members
-- ─────────────────────────────────────────────
INSERT INTO family_members (full_name) VALUES
  ('Ahmed'),
  ('Nazila'),
  ('Yasin'),
  ('Maryam'),
  ('Akbar'),
  ('Member 6 Placeholder')
ON CONFLICT DO NOTHING;
