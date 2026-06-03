-- Fase 2 (complemento): adicionar company_id a agenda_blocked_periods
-- O CalendarView já usa este campo (filtro + insert) mas a coluna não existia
ALTER TABLE agenda_blocked_periods
    ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_blocked_periods_company
    ON agenda_blocked_periods(company_id);
