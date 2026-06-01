-- ═══════════════════════════════════════════════════════════════
-- GROVIX Supabase Schema — Videos Table
-- ═══════════════════════════════════════════════════════════════
-- Run this FIRST in Supabase SQL Editor to create the table.
-- Then run the cleanup command below to flush out short clips.

-- ── VIDEOS TABLE ─────────────────────────────────────────────
-- Stores cached YouTube video data from the Edge Function.
-- duration_sec is CRITICAL — used for the 60-minute movie filter.

CREATE TABLE IF NOT EXISTS videos (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  yt_video_id   TEXT    NOT NULL UNIQUE,  -- YouTube video ID (e.g. "zSWdZVtXT7E")
  title         TEXT    NOT NULL,
  thumbnail_url TEXT,
  category      TEXT    NOT NULL DEFAULT 'movie',  -- 'movie' | 'music' | 'short'
  genre         TEXT[]  DEFAULT '{}',              -- e.g. '{"Action","Sci-Fi"}'
  duration_sec  INTEGER NOT NULL DEFAULT 0,        -- Duration in SECONDS — used for filtering
  channel       TEXT    DEFAULT '',
  language      TEXT    DEFAULT 'English',
  views         BIGINT  DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── INDEXES ──────────────────────────────────────────────────
-- Speed up category + duration queries (the main filter combo)

CREATE INDEX IF NOT EXISTS idx_videos_category ON videos (category);
CREATE INDEX IF NOT EXISTS idx_videos_duration ON videos (duration_sec);
CREATE INDEX IF NOT EXISTS idx_videos_cat_duration ON videos (category, duration_sec);

-- ── RLS (Row Level Security) ─────────────────────────────────
-- Public read, no write from client (Edge Function writes)

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Videos are publicly readable"
  ON videos FOR SELECT
  TO anon, authenticated
  USING (true);

-- ═══════════════════════════════════════════════════════════════
-- MISSING REQUESTS TABLE
-- ═══════════════════════════════════════════════════════════════
-- When a user searches for a movie and it's not in the cache,
-- the search term is logged here. The Edge Function cron job
-- processes the most-requested terms first.

CREATE TYPE request_status AS ENUM ('pending', 'processing', 'done', 'failed');

CREATE TABLE IF NOT EXISTS missing_requests (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  search_query  TEXT    NOT NULL,
  category      TEXT    DEFAULT 'movie',
  status        request_status DEFAULT 'pending',
  request_count INTEGER DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE(search_query, category)
);

-- ── Index for pending requests (cron job picks these up)

CREATE INDEX IF NOT EXISTS idx_missing_status ON missing_requests (status);
CREATE INDEX IF NOT EXISTS idx_missing_count ON missing_requests (request_count DESC);

ALTER TABLE missing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Missing requests are publicly readable"
  ON missing_requests FOR SELECT
  TO anon, authenticated
  USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
--  CLEANUP COMMAND — Run this in Supabase SQL Editor NOW
-- ══════════════════════════════════════════════════════════════════════════════
-- This instantly DELETEs all short clips from the videos table
-- where category is 'movie' but duration is under 60 minutes.
-- These are trailers, clips, songs, reviews — NOT full movies.
--
-- 3600 seconds = 60 minutes = the minimum for a "full movie"
--
-- Run:  DELETE FROM videos WHERE category = 'movie' AND duration_sec < 3600;
--
-- To preview what will be deleted first (safe, read-only):
-- Run:  SELECT id, yt_video_id, title, duration_sec FROM videos WHERE category = 'movie' AND duration_sec < 3600;
-- ══════════════════════════════════════════════════════════════════════════════
