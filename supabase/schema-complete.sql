-- ══════════════════════════════════════════════════════════════════════════════
-- Play Nexa — Complete Database Setup Script
-- ══════════════════════════════════════════════════════════════════════════════
-- Run this ENTIRE script in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- This creates ALL tables needed for Play Nexa app + Admin Panel
--
-- After running this:
--   1. Go to Supabase → Authentication → Users
--   2. Click "Add user" → "Create new user"
--   3. Email: admin@playnexa.com, Password: PlayNexa@2024
--   4. Copy the user's UUID
--   5. Run: INSERT INTO admin_users (user_id, email, role) VALUES ('PASTE_UUID_HERE', 'admin@playnexa.com', 'superadmin');
-- ══════════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 1: movies
-- ══════════════════════════════════════════════════════════════════════════════
-- Main movies table for the Movie Hub feature

CREATE TABLE IF NOT EXISTS movies (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  youtube_id    TEXT    NOT NULL,
  title         TEXT    NOT NULL,
  thumbnail     TEXT,
  channel_name  TEXT    DEFAULT '',
  channel_id    TEXT    DEFAULT '',
  published_at  TIMESTAMPTZ,
  view_count    BIGINT  DEFAULT 0,
  description   TEXT    DEFAULT '',
  duration      TEXT    DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movies_youtube_id ON movies (youtube_id);
CREATE INDEX IF NOT EXISTS idx_movies_channel ON movies (channel_name);
CREATE INDEX IF NOT EXISTS idx_movies_created ON movies (created_at DESC);

ALTER TABLE movies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read movies"
  ON movies FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow authenticated users to read (for admin panel)
CREATE POLICY "Authenticated can insert movies"
  ON movies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update movies"
  ON movies FOR UPDATE
  TO authenticated
  USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 2: user_likes
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_likes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id    UUID    NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  youtube_id  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, movie_id)
);

CREATE INDEX IF NOT EXISTS idx_user_likes_user ON user_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_movie ON user_likes (movie_id);

ALTER TABLE user_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User owns likes"
  ON user_likes FOR ALL
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 3: user_watchlist
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_watchlist (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id    UUID    NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  youtube_id  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, movie_id)
);

CREATE INDEX IF NOT EXISTS idx_user_watchlist_user ON user_watchlist (user_id);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_movie ON user_watchlist (movie_id);

ALTER TABLE user_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User owns watchlist"
  ON user_watchlist FOR ALL
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 4: user_history
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_history (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id    UUID    NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  youtube_id  TEXT,
  watched_at  TIMESTAMPTZ DEFAULT now(),
  watch_count INTEGER DEFAULT 1,
  UNIQUE(user_id, movie_id)
);

CREATE INDEX IF NOT EXISTS idx_user_history_user ON user_history (user_id);
CREATE INDEX IF NOT EXISTS idx_user_history_watched ON user_history (watched_at DESC);

ALTER TABLE user_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User owns history"
  ON user_history FOR ALL
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 5: admin_users
-- ══════════════════════════════════════════════════════════════════════════════
-- Controls who can access /admin/* routes

CREATE TABLE IF NOT EXISTS admin_users (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT    NOT NULL,
  role        TEXT    NOT NULL DEFAULT 'admin',  -- 'superadmin' | 'admin'
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only service role can read admin_users (not regular users)
CREATE POLICY "Service role can read admin_users"
  ON admin_users FOR SELECT
  USING (auth.role() = 'service_role');

-- Also allow authenticated users to check their own admin status
CREATE POLICY "Users can check own admin status"
  ON admin_users FOR SELECT
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 6: admin_activity_log
-- ══════════════════════════════════════════════════════════════════════════════
-- Tracks all admin actions for audit trail

CREATE TABLE IF NOT EXISTS admin_activity_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id    UUID,
  action      TEXT    NOT NULL,     -- 'create', 'update', 'delete', 'login', etc.
  target      TEXT    NOT NULL,     -- 'movies', 'users', 'settings', etc.
  details     JSONB   DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_log_created ON admin_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_log_admin ON admin_activity_log (admin_id);

ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage activity log"
  ON admin_activity_log FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated can read activity log"
  ON admin_activity_log FOR SELECT
  TO authenticated
  USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 7: app_features
-- ══════════════════════════════════════════════════════════════════════════════
-- Controls which features are visible/enabled in the app

CREATE TABLE IF NOT EXISTS app_features (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key TEXT    NOT NULL UNIQUE,  -- 'movie_hub', 'game_hub', etc.
  name        TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'live',  -- 'live'|'hidden'|'coming_soon'|'locked'|'maintenance'
  description TEXT    DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed default features
INSERT INTO app_features (feature_key, name, status, description) VALUES
  ('movie_hub', 'Movie Hub', 'live', 'Browse and watch movies from top channels'),
  ('game_hub', 'Game Hub', 'live', 'Play mini games and track scores'),
  ('ytmusic', 'YT Music', 'coming_soon', 'YouTube Music integration'),
  ('downloader', 'Downloader', 'live', 'Download videos from platforms'),
  ('offline', 'Offline Mode', 'live', 'Save media for offline playback'),
  ('shorts', 'Shorts', 'hidden', 'Short video clips'),
  ('local_player', 'Local Player', 'live', 'Play local media files')
ON CONFLICT (feature_key) DO NOTHING;

ALTER TABLE app_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read features"
  ON app_features FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated can manage features"
  ON app_features FOR ALL
  TO authenticated
  USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 8: notifications_log
-- ══════════════════════════════════════════════════════════════════════════════
-- Push notification history

CREATE TABLE IF NOT EXISTS notifications_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  sent_to     TEXT    DEFAULT 'all',  -- 'all' | specific user_id
  sent_at     TIMESTAMPTZ DEFAULT now(),
  sent_count  INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_notifications_sent ON notifications_log (sent_at DESC);

ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage notifications"
  ON notifications_log FOR ALL
  TO authenticated
  USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 9: user_profiles
-- ══════════════════════════════════════════════════════════════════════════════
-- Extended user profiles (beyond auth.users)

CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id  UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name  TEXT    DEFAULT '',
  email         TEXT,
  avatar_url    TEXT,
  auth_provider TEXT    DEFAULT 'email',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_auth ON user_profiles (auth_user_id);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 10: app_settings
-- ══════════════════════════════════════════════════════════════════════════════
-- Global app settings controlled by admin

CREATE TABLE IF NOT EXISTS app_settings (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key         TEXT    NOT NULL UNIQUE,
  value       JSONB   NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed default settings
INSERT INTO app_settings (key, value) VALUES
  ('branding', '{"app_name": "Play Nexa", "tagline": "Your Entertainment Hub"}'),
  ('colors', '{"primary": "#7C3AED", "accent": "#06B6D4"}'),
  ('maintenance', '{"enabled": false, "message": "Under maintenance"}')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read settings"
  ON app_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated can manage settings"
  ON app_settings FOR ALL
  TO authenticated
  USING (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 11: game_scores
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS game_scores (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    REFERENCES auth.users(id) ON DELETE CASCADE,
  game_slug   TEXT    NOT NULL,
  high_score  INTEGER DEFAULT 0,
  coins       INTEGER DEFAULT 0,
  plays       INTEGER DEFAULT 0,
  last_played TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, game_slug)
);

CREATE INDEX IF NOT EXISTS idx_game_scores_game ON game_scores (game_slug);

ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scores"
  ON game_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scores"
  ON game_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scores"
  ON game_scores FOR UPDATE
  USING (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- DONE! Now follow these steps to create your first admin account:
-- ══════════════════════════════════════════════════════════════════════════════
--
-- STEP 1: Create a Supabase Auth user
--   Go to: Authentication → Users → Add user → Create new user
--   Email:    admin@playnexa.com
--   Password: PlayNexa@2024
--   (Check your email for confirmation if email confirm is on)
--
-- STEP 2: Copy the user's UUID from the Users table
--   It looks like: a1b2c3d4-e5f6-7890-abcd-ef1234567890
--
-- STEP 3: Add them to admin_users table
--   Run this in SQL Editor (replace the UUID):
--   INSERT INTO admin_users (user_id, email, role)
--   VALUES ('PASTE_YOUR_UUID_HERE', 'admin@playnexa.com', 'superadmin');
--
-- STEP 4: Login at /admin/login with:
--   Email:    admin@playnexa.com
--   Password: PlayNexa@2024
--
-- ══════════════════════════════════════════════════════════════════════════════
