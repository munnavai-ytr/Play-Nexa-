-- ═══════════════════════════════════════════════════════════════
-- Phase 4: YT Music Online Feature — Play Nexa
-- Creates music_likes and music_saved tables for engagement
-- RLS policies: users can only manage their own records
-- ═══════════════════════════════════════════════════════════════

-- ── music_likes: track which users liked which tracks ──

CREATE TABLE IF NOT EXISTS music_likes (
  id          UUID DEFAULT gen_random_uuid()
              PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES
              auth.users(id) ON DELETE CASCADE,
  track_id    UUID NOT NULL REFERENCES
              music_tracks(id) ON DELETE CASCADE,
  youtube_id  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, track_id)
);

-- ── music_saved: track which users saved/bookmarked tracks ──

CREATE TABLE IF NOT EXISTS music_saved (
  id          UUID DEFAULT gen_random_uuid()
              PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES
              auth.users(id) ON DELETE CASCADE,
  track_id    UUID NOT NULL REFERENCES
              music_tracks(id) ON DELETE CASCADE,
  youtube_id  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, track_id)
);

-- ── Enable Row Level Security ──

ALTER TABLE music_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_saved ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies: users can only access their own records ──

CREATE POLICY "music_likes_own"
  ON music_likes FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "music_saved_own"
  ON music_saved FOR ALL
  USING (auth.uid() = user_id);

-- ── Indexes for fast lookups ──

CREATE INDEX IF NOT EXISTS idx_music_likes_user
  ON music_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_music_likes_track
  ON music_likes(track_id);

CREATE INDEX IF NOT EXISTS idx_music_saved_user
  ON music_saved(user_id);

CREATE INDEX IF NOT EXISTS idx_music_saved_track
  ON music_saved(track_id);
