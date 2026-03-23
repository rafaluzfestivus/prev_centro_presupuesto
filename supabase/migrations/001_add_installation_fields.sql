-- Migration: Add installation fields to Proposta table
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

ALTER TABLE "Proposta"
    ADD COLUMN IF NOT EXISTS installation_address TEXT,
    ADD COLUMN IF NOT EXISTS installation_notes    TEXT,
    ADD COLUMN IF NOT EXISTS before_photos         TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS after_photos          TEXT[] DEFAULT '{}';
