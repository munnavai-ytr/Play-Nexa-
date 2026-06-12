-- ══════════════════════════════════════════════════════════════
-- Play Nexa — Phase 2: Auto Sync Engine Schema Updates
-- ══════════════════════════════════════════════════════════════
-- Run this ENTIRE script in Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query)
-- ══════════════════════════════════════════════════════════════

-- ── Add published_at to movies if missing ──
ALTER TABLE movies
  ADD COLUMN IF NOT EXISTS
  published_at TIMESTAMPTZ DEFAULT NOW();

-- ── Add source_channel_id to movies ──
ALTER TABLE movies
  ADD COLUMN IF NOT EXISTS
  source_channel_id UUID
  REFERENCES yt_channels(id) ON DELETE SET NULL;

-- ── Add source_channel_id to music_tracks ──
ALTER TABLE music_tracks
  ADD COLUMN IF NOT EXISTS
  source_channel_id UUID
  REFERENCES yt_channels(id) ON DELETE SET NULL;

-- ── Add view_count to music_tracks if missing ──
ALTER TABLE music_tracks
  ADD COLUMN IF NOT EXISTS
  view_count INTEGER DEFAULT 0;

-- ── Add description to movies if missing ──
ALTER TABLE movies
  ADD COLUMN IF NOT EXISTS
  description TEXT;

-- ── Add language to movies if missing ──
ALTER TABLE movies
  ADD COLUMN IF NOT EXISTS
  language TEXT DEFAULT 'Bangla';

-- ── CRON job for auto sync (run in SQL editor) ──
-- Requires pg_cron extension
-- Uncomment and run ONLY if pg_cron is enabled on your Supabase project:
--
-- SELECT cron.schedule(
--   'auto-sync-channels',
--   '0 */6 * * *',  -- every 6 hours
--   $$
--   SELECT net.http_post(
--     url := current_setting('app.supabase_url')
--       || '/functions/v1/auto-sync',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' ||
--         current_setting('app.service_key'),
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   )
--   $$
-- );

-- ── Verify columns ──
-- Run this to verify all columns exist:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name IN ('movies', 'music_tracks')
--   AND column_name IN (
--     'published_at', 'source_channel_id',
--     'view_count', 'description', 'language'
--   )
--   ORDER BY table_name, column_name;
