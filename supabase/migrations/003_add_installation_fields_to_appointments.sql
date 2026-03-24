-- Add installation record fields to appointments table
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS installation_notes TEXT,
    ADD COLUMN IF NOT EXISTS before_photos       TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS after_photos        TEXT[] DEFAULT '{}';
