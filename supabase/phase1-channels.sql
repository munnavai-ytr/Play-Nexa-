-- ══════════════════════════════════════════════════════════════
-- Play Nexa — Phase 1 Tables: Channel Manager
-- ══════════════════════════════════════════════════════════════
-- Run this ENTIRE script in Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query)
-- ══════════════════════════════════════════════════════════════

-- ── YouTube Channels table ──
CREATE TABLE IF NOT EXISTS yt_channels (
  id                UUID DEFAULT gen_random_uuid()
                    PRIMARY KEY,
  channel_url       TEXT NOT NULL,
  channel_id        TEXT NOT NULL UNIQUE,
  channel_name      TEXT NOT NULL,
  channel_avatar    TEXT,
  channel_type      TEXT NOT NULL DEFAULT 'movies'
                    CHECK (channel_type IN (
                      'movies','music','mixed'
                    )),
  filter_keywords   TEXT[] DEFAULT ARRAY[
                      'full movie','official movie',
                      'bangla movie','bengali movie',
                      'full film','natok','telefilm',
                      'web series','short film'
                    ],
  exclude_keywords  TEXT[] DEFAULT ARRAY[
                      'trailer','teaser','song',
                      'making','interview','behind',
                      'promo','preview'
                    ],
  auto_sync         BOOLEAN DEFAULT true,
  sync_interval     INTEGER DEFAULT 6,
  last_synced_at    TIMESTAMPTZ,
  total_imported    INTEGER DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sync logs table ──
CREATE TABLE IF NOT EXISTS sync_logs (
  id              UUID DEFAULT gen_random_uuid()
                  PRIMARY KEY,
  channel_id      UUID REFERENCES yt_channels(id)
                  ON DELETE CASCADE,
  channel_name    TEXT,
  videos_found    INTEGER DEFAULT 0,
  videos_added    INTEGER DEFAULT 0,
  videos_skipped  INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'success'
                  CHECK (status IN (
                    'success','failed','partial'
                  )),
  error_message   TEXT,
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Music tracks table ──
CREATE TABLE IF NOT EXISTS music_tracks (
  id            UUID DEFAULT gen_random_uuid()
                PRIMARY KEY,
  youtube_id    TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  thumbnail     TEXT NOT NULL,
  channel_name  TEXT NOT NULL,
  channel_id    TEXT NOT NULL,
  duration      TEXT,
  published_at  TIMESTAMPTZ,
  view_count    INTEGER DEFAULT 0,
  is_hidden     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ──
ALTER TABLE yt_channels   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_tracks  ENABLE ROW LEVEL SECURITY;

-- ── Public read policies ──
CREATE POLICY "yt_channels_public_read"
  ON yt_channels FOR SELECT USING (true);

CREATE POLICY "music_tracks_public_read"
  ON music_tracks FOR SELECT USING (true);

CREATE POLICY "sync_logs_public_read"
  ON sync_logs FOR SELECT USING (true);
