-- ══════════════════════════════════════════════════════════════
-- Play Nexa — Phase 3: Game Hub Schema
-- ══════════════════════════════════════════════════════════════
-- Run this ENTIRE script in Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query)
-- ══════════════════════════════════════════════════════════════

-- ── Drop and recreate games table (full schema) ──
DROP TABLE IF EXISTS games CASCADE;

CREATE TABLE games (
  id           UUID DEFAULT gen_random_uuid()
               PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL,
  game_type    TEXT NOT NULL DEFAULT 'offline'
               CHECK (game_type IN (
                 'offline',
                 'download',
                 'online',
                 'mini'
               )),
  apk_url      TEXT,
  web_url      TEXT,
  cover_url    TEXT NOT NULL,
  size         TEXT DEFAULT '0 MB',
  version      TEXT DEFAULT '1.0',
  min_android  TEXT DEFAULT '5.0',
  is_featured  BOOLEAN DEFAULT false,
  is_hidden    BOOLEAN DEFAULT false,
  is_free      BOOLEAN DEFAULT true,
  downloads    INTEGER DEFAULT 0,
  rating       REAL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Game downloads tracking (per user per game) ──
CREATE TABLE IF NOT EXISTS game_downloads (
  id          UUID DEFAULT gen_random_uuid()
              PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id)
              ON DELETE CASCADE,
  game_id     UUID REFERENCES games(id)
              ON DELETE CASCADE,
  downloaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

-- ── RLS ──
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_downloads ENABLE ROW LEVEL SECURITY;

-- ── Public read policies ──
CREATE POLICY "games_public_read"
  ON games FOR SELECT USING (true);

CREATE POLICY "game_downloads_user_own"
  ON game_downloads FOR ALL
  USING (auth.uid() = user_id);
