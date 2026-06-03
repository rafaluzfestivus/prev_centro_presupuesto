-- Migration 009: Row Level Security for multi-tenant tables
-- Protects clients, Proposta and appointments at the database level
-- so even a bug in application code cannot leak cross-company data.
--
-- NOTE: The public proposal flow (/proposal/*) uses the service_role key
-- via server actions, which bypasses RLS intentionally. All direct client
-- queries from the browser use the anon key and will be governed by these policies.

-- ─────────────────────────────────────────────────────────────
-- Helper: get the company_id of the authenticated user
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────
-- clients
-- ─────────────────────────────────────────────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_own_company" ON clients
  FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "clients_insert_own_company" ON clients
  FOR INSERT WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "clients_update_own_company" ON clients
  FOR UPDATE USING (company_id = get_user_company_id());

CREATE POLICY "clients_delete_own_company" ON clients
  FOR DELETE USING (company_id = get_user_company_id());

-- ─────────────────────────────────────────────────────────────
-- Proposta
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "Proposta" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposta_select_own_company" ON "Proposta"
  FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "proposta_insert_own_company" ON "Proposta"
  FOR INSERT WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "proposta_update_own_company" ON "Proposta"
  FOR UPDATE USING (company_id = get_user_company_id());

CREATE POLICY "proposta_delete_own_company" ON "Proposta"
  FOR DELETE USING (company_id = get_user_company_id());

-- ─────────────────────────────────────────────────────────────
-- appointments
-- ─────────────────────────────────────────────────────────────
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_select_own_company" ON appointments
  FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "appointments_insert_own_company" ON appointments
  FOR INSERT WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "appointments_update_own_company" ON appointments
  FOR UPDATE USING (company_id = get_user_company_id());

CREATE POLICY "appointments_delete_own_company" ON appointments
  FOR DELETE USING (company_id = get_user_company_id());
