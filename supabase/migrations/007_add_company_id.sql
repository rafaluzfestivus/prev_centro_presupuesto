-- Fase 2: Separação por empresa (company_id)
-- 1 = Preventiva Centro (Madrid)
-- 2 = Preventiva Este (Barcelona)

-- Tabela de perfis: mapeia utilizador → empresa
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL DEFAULT 1,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profile_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profile_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Adicionar company_id às tabelas principais (todos os registos existentes = Centro)
ALTER TABLE clients              ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Proposta"          ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE appointments        ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE agenda_blocked_periods ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;

-- Índices para performance nos filtros
CREATE INDEX IF NOT EXISTS idx_clients_company       ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_proposta_company      ON "Proposta"(company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_company  ON appointments(company_id);
