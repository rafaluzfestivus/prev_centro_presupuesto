-- Migration: Update conversations table for WhatsApp integration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS direction   TEXT NOT NULL DEFAULT 'inbound'
        CHECK (direction IN ('inbound', 'outbound')),
    ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'sent', 'delivered', 'read', 'failed')),
    ADD COLUMN IF NOT EXISTS wa_message_id TEXT,
    ADD COLUMN IF NOT EXISTS phone       TEXT,
    ADD COLUMN IF NOT EXISTS media_url   TEXT,
    ADD COLUMN IF NOT EXISTS media_type  TEXT,
    ADD COLUMN IF NOT EXISTS push_name   TEXT;

-- Index for fast phone lookups (finding client by phone)
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);

-- Enable Realtime on conversations table (run this once)
-- ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
