-- Migration: Add sale fields to appointments table
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS installation_address TEXT,
    ADD COLUMN IF NOT EXISTS total_value          NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_m2             NUMERIC DEFAULT 0;
