-- Adiciona campo "requer atenção especial" aos agendamentos
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS special_attention BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para filtrar rapidamente os agendamentos com atenção especial
CREATE INDEX IF NOT EXISTS idx_appointments_special_attention ON appointments(special_attention) WHERE special_attention = TRUE;
