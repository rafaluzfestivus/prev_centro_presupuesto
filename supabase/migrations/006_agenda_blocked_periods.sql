-- Períodos bloqueados na agenda (ex: horário de almoço, férias, etc.)
CREATE TABLE IF NOT EXISTS agenda_blocked_periods (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label       TEXT NOT NULL,
    time_from   TIME NOT NULL,          -- ex: '13:00:00'
    time_to     TIME NOT NULL,          -- ex: '15:00:00'
    days_of_week INTEGER[] DEFAULT NULL, -- NULL = todos os dias; [1,2,3,4,5] = seg-sex (0=dom,6=sáb)
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Apenas um registo por defecto (almoço) para facilitar os testes
-- INSERT INTO agenda_blocked_periods (label, time_from, time_to) VALUES ('Almuerzo', '14:00', '16:00');
