-- Migration 010: lock down profile self-service columns
--
-- Closes a gap where any logged-in user could self-assign to the other
-- company's tenant (profiles.company_id) or grant themselves admin
-- (profiles.is_admin) via a normal insert/update call using the
-- anon/authenticated key — the app UI already stopped exposing this
-- (see /dashboard/configuracion and /dashboard/nova-proposta), but the
-- database itself did not enforce it.
--
-- NOTE: RLS on `conversations` (WhatsApp/Chatwoot message history) was
-- already enabled directly against the live project on 2026-06-19
-- (untracked here — applied outside this repo's migration history), so it
-- is intentionally not repeated by this migration.

-- ─────────────────────────────────────────────────────────────
-- Lock company_id / is_admin on profiles to column-level privileges
-- ─────────────────────────────────────────────────────────────

-- Ensure is_admin exists — it was already in use by app code (src/lib/profile.ts)
-- without a tracked migration creating it.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Remove blanket INSERT/UPDATE privilege for authenticated on this table, then
-- grant back only the columns a user should be able to set about themselves.
-- company_id/is_admin fall back to their column DEFAULTs (1 / false) on
-- INSERT and simply can't be touched on UPDATE by a non-service-role caller.
REVOKE INSERT, UPDATE ON profiles FROM authenticated;
GRANT INSERT (id, display_name) ON profiles TO authenticated;
GRANT UPDATE (display_name) ON profiles TO authenticated;
