-- ═══════════════════════════════════════════════════════════════
-- GROVIX Supabase Schema — Videos Table
-- ═══════════════════════════════════════════════════════════════
-- Run this FIRST in Supabase SQL Editor to create the table.
-- Then run the cleanup command below to flush out short clips.

-- ── VIDEOS TABLE ─────────────────────────────────────────────
-- Stores cached YouTube video data from the Edge Function.
-- duration_sec is CRITICAL — used for the 70-minute movie filter.

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
  region        TEXT    DEFAULT 'international',   -- 'bangladesh' | 'india' | 'international'
  dubbed_tags   TEXT[]  DEFAULT '{}',              -- e.g. '{"Bangla Dubbed","Hindi Sub"}'
  views         BIGINT  DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── INDEXES ──────────────────────────────────────────────────
-- Speed up category + duration queries (the main filter combo)

CREATE INDEX IF NOT EXISTS idx_videos_category ON videos (category);
CREATE INDEX IF NOT EXISTS idx_videos_duration ON videos (duration_sec);
CREATE INDEX IF NOT EXISTS idx_videos_cat_duration ON videos (category, duration_sec);
CREATE INDEX IF NOT EXISTS idx_videos_region ON videos (region);
CREATE INDEX IF NOT EXISTS idx_videos_language ON videos (language);
CREATE INDEX IF NOT EXISTS idx_videos_cat_region ON videos (category, region);

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


-- ════════════════════════════════════════════════════════════════════════════
--  RPC: upsert_missing_request — used by AI Smart Search & AI Movie Hunter
-- ════════════════════════════════════════════════════════════════════════════
-- When a user searches for something not in the DB, this function logs it.
-- If the search query already exists, it increments the request_count instead
-- of creating a duplicate. This lets the AI Movie Hunter prioritize the most
-- requested searches.

CREATE OR REPLACE FUNCTION upsert_missing_request(
  p_query TEXT,
  p_category TEXT DEFAULT 'movie'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO missing_requests (search_query, category, status, request_count)
  VALUES (p_query, p_category, 'pending', 1)
  ON CONFLICT (search_query, category)
  DO UPDATE SET
    request_count = missing_requests.request_count + 1,
    updated_at = now();
END;
$$;

-- ── Allow anon access to the RPC (server-side only, but uses anon key) ──
GRANT EXECUTE ON FUNCTION upsert_missing_request(TEXT, TEXT) TO anon, authenticated;

-- ── Allow the service role to INSERT/UPDATE missing_requests ──
-- (Needed for the fallback upsert in AI Smart Search)
CREATE POLICY "Allow insert on missing_requests"
  ON missing_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update on missing_requests"
  ON missing_requests FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);


-- ══════════════════════════════════════════════════════════════════════════════
--  CLEANUP COMMAND — Run this in Supabase SQL Editor NOW
-- ══════════════════════════════════════════════════════════════════════════════
-- This instantly DELETEs all short clips from the videos table
-- where category is 'movie' but duration is under 70 minutes.
-- These are trailers, clips, songs, reviews — NOT full movies.
-- Fake videos claiming 2-3 hours in the title but actually 2-3 minutes
-- long are caught by the Bulletproof Movie Authenticator's ISO 8601
-- duration parser, which reads the ACTUAL duration from YouTube's
-- contentDetails.duration field (not the title).
--
-- 4200 seconds = 70 minutes = the minimum for a "verified full movie"
--
-- Run:  DELETE FROM videos WHERE category = 'movie' AND duration_sec < 4200;
--
-- To preview what will be deleted first (safe, read-only):
-- Run:  SELECT id, yt_video_id, title, duration_sec FROM videos WHERE category = 'movie' AND duration_sec < 4200;
--
-- To add region & dubbed_tags columns to existing table (if not new):
-- ALTER TABLE videos ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'international';
-- ALTER TABLE videos ADD COLUMN IF NOT EXISTS dubbed_tags TEXT[] DEFAULT '{}';
-- ══════════════════════════════════════════════════════════════════════════════
