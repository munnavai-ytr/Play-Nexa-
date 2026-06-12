-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  PLAY NEXA — Complete Database Setup (All-in-One)                          ║
-- ║  একটা প্রম্পটে সব টেবিল তৈরি হবে — কপি করে Supabase SQL Editor এ পেস্ট করো  ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝
--
-- ব্যবহার:
--   1. Supabase Dashboard → SQL Editor → New Query
--   2. এই পুরো কোডটা কপি-পেস্ট করো
--   3. "Run" বাটনে ক্লিক করো
--   4. সব টেবিল, ইনডেক্স, RLS পলিসি, RPC, সিড ডাটা একসাথে তৈরি হয়ে যাবে
--
-- রান করার পর:
--   1. Authentication → Users → Add user → Create new user
--      Email: admin@playnexa.com  Password: PlayNexa@2024
--   2. User এর UUID কপি করো
--   3. নিচের SQL রান করো (UUID বসাও):
--      INSERT INTO admin_users (user_id, email, role)
--      VALUES ('PASTE_UUID_HERE', 'admin@playnexa.com', 'superadmin');
--
-- ══════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 1: ENUM TYPES                                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

DO $$ BEGIN
  -- Create request_status enum if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
    CREATE TYPE request_status AS ENUM ('pending', 'processing', 'done', 'failed');
  END IF;
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 2: CORE TABLES                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: videos (লিগেসি — আগের ভার্সন থেকে আসা)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS videos (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  yt_video_id     TEXT    NOT NULL UNIQUE,
  title           TEXT    NOT NULL,
  thumbnail_url   TEXT,
  category        TEXT    DEFAULT 'movie' CHECK (category IN ('movie','music','short')),
  genre           TEXT[]  DEFAULT '{}',
  duration_sec    INTEGER DEFAULT 0 NOT NULL,
  channel         TEXT    DEFAULT '',
  language        TEXT    DEFAULT 'English',
  region          TEXT    DEFAULT 'international' CHECK (region IN ('bangladesh','india','international')),
  dubbed_tags     TEXT[]  DEFAULT '{}',
  views           BIGINT  DEFAULT 0,
  source          TEXT    DEFAULT 'manual',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_videos_category ON videos (category);
CREATE INDEX IF NOT EXISTS idx_videos_created  ON videos (created_at DESC);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read videos" ON videos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated can insert videos" ON videos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update videos" ON videos FOR UPDATE TO authenticated USING (true);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: missing_requests (ইউজার রিকোয়েস্ট ট্র্যাকিং)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS missing_requests (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  search_query    TEXT    NOT NULL,
  category        TEXT    DEFAULT 'movie',
  status          request_status DEFAULT 'pending',
  request_count   INTEGER DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(search_query, category)
);

CREATE INDEX IF NOT EXISTS idx_missing_status ON missing_requests (status);

ALTER TABLE missing_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read missing_requests" ON missing_requests FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated can manage missing_requests" ON missing_requests FOR ALL TO authenticated USING (true);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: yt_channels (ইউটিউব চ্যানেল ম্যানেজমেন্ট)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS yt_channels (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_url       TEXT    NOT NULL,
  channel_id        TEXT    NOT NULL UNIQUE,
  channel_name      TEXT    NOT NULL,
  channel_avatar    TEXT,
  channel_type      TEXT    NOT NULL DEFAULT 'movies'
                    CHECK (channel_type IN ('movies','music','mixed')),
  filter_keywords   TEXT[]  DEFAULT ARRAY[
                        'full movie','official movie',
                        'bangla movie','bengali movie',
                        'full film','natok','telefilm',
                        'web series','short film'
                      ],
  exclude_keywords  TEXT[]  DEFAULT ARRAY[
                        'trailer','teaser','song',
                        'making','interview','behind',
                        'promo','preview'
                      ],
  auto_sync         BOOLEAN DEFAULT true,
  sync_interval     INTEGER DEFAULT 6,
  last_synced_at    TIMESTAMPTZ,
  total_imported    INTEGER DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_yt_channels_type    ON yt_channels (channel_type);
CREATE INDEX IF NOT EXISTS idx_yt_channels_active  ON yt_channels (is_active) WHERE is_active = true;

ALTER TABLE yt_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "yt_channels_public_read" ON yt_channels FOR SELECT USING (true);
CREATE POLICY "yt_channels_admin_manage" ON yt_channels FOR ALL TO authenticated USING (true);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: sync_logs (অটো সিঙ্ক লগ)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sync_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id      UUID REFERENCES yt_channels(id) ON DELETE CASCADE,
  channel_name    TEXT,
  videos_found    INTEGER DEFAULT 0,
  videos_added    INTEGER DEFAULT 0,
  videos_skipped  INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'success' CHECK (status IN ('success','failed','partial')),
  error_message   TEXT,
  synced_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_channel ON sync_logs (channel_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_time    ON sync_logs (synced_at DESC);

ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_logs_public_read" ON sync_logs FOR SELECT USING (true);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: channel_display (চ্যানেল ফিল্টার চিপস + ব্যাজ কালার)
-- MovieHub ও MusicHub এ চ্যানেল ফিল্টার চিপস দেখানোর জন্য
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS channel_display (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id    TEXT    NOT NULL UNIQUE,
  display_name  TEXT    NOT NULL,
  logo_url      TEXT,
  badge_color   TEXT    NOT NULL DEFAULT '#7C3AED',
  border_color  TEXT    NOT NULL DEFAULT '#2D2D2D',
  is_visible    BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_display_visible  ON channel_display (is_visible) WHERE is_visible = true;
CREATE INDEX IF NOT EXISTS idx_channel_display_sort     ON channel_display (sort_order);

ALTER TABLE channel_display ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channel_display_public_read" ON channel_display FOR SELECT USING (true);
CREATE POLICY "channel_display_admin_manage" ON channel_display FOR ALL TO authenticated USING (true);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: ai_scan_jobs (Gemini AI স্ক্যান জব ট্র্যাকিং)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_scan_jobs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_name  TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'scanning'
                  CHECK (status IN ('scanning','completed','failed')),
  total_videos  INTEGER DEFAULT 0,
  processed     INTEGER DEFAULT 0,
  movies_found  INTEGER DEFAULT 0,
  music_found   INTEGER DEFAULT 0,
  skipped       INTEGER DEFAULT 0,
  error_message TEXT,
  started_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_scan_status ON ai_scan_jobs (status);
CREATE INDEX IF NOT EXISTS idx_ai_scan_time   ON ai_scan_jobs (started_at DESC);

ALTER TABLE ai_scan_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_scan_jobs_public_read" ON ai_scan_jobs FOR SELECT USING (true);
CREATE POLICY "ai_scan_jobs_admin_manage" ON ai_scan_jobs FOR ALL TO authenticated USING (true);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: movies (মুভি হাব — Gemini স্ক্যান থেকে আসা ডাটা)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS movies (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  youtube_id        TEXT    NOT NULL,
  title             TEXT    NOT NULL,
  thumbnail         TEXT,
  channel_name      TEXT    DEFAULT '',
  channel_id        TEXT    DEFAULT '',
  published_at      TIMESTAMPTZ,
  view_count        BIGINT  DEFAULT 0,
  description       TEXT    DEFAULT '',
  duration          TEXT    DEFAULT '',
  is_hidden         BOOLEAN DEFAULT false,
  source_channel_id UUID    REFERENCES yt_channels(id) ON DELETE SET NULL,
  language          TEXT    DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movies_youtube_id  ON movies (youtube_id);
CREATE INDEX IF NOT EXISTS idx_movies_channel     ON movies (channel_name);
CREATE INDEX IF NOT EXISTS idx_movies_channel_id  ON movies (channel_id);
CREATE INDEX IF NOT EXISTS idx_movies_created     ON movies (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movies_hidden      ON movies (is_hidden) WHERE is_hidden = false;

ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read movies" ON movies FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated can insert movies" ON movies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update movies" ON movies FOR UPDATE TO authenticated USING (true);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: music_tracks (YT মিউজিক — Gemini স্ক্যান থেকে আসা ডাটা)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS music_tracks (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  youtube_id        TEXT    NOT NULL UNIQUE,
  title             TEXT    NOT NULL,
  thumbnail         TEXT    NOT NULL,
  channel_name      TEXT    NOT NULL,
  channel_id        TEXT    NOT NULL,
  duration          TEXT,
  published_at      TIMESTAMPTZ,
  view_count        INTEGER DEFAULT 0,
  is_hidden         BOOLEAN DEFAULT false,
  source_channel_id UUID    REFERENCES yt_channels(id) ON DELETE SET NULL,
  description       TEXT    DEFAULT '',
  language          TEXT    DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_music_youtube_id  ON music_tracks (youtube_id);
CREATE INDEX IF NOT EXISTS idx_music_channel     ON music_tracks (channel_name);
CREATE INDEX IF NOT EXISTS idx_music_channel_id  ON music_tracks (channel_id);
CREATE INDEX IF NOT EXISTS idx_music_created     ON music_tracks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_music_hidden      ON music_tracks (is_hidden) WHERE is_hidden = false;

ALTER TABLE music_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "music_tracks_public_read" ON music_tracks FOR SELECT USING (true);
CREATE POLICY "music_tracks_admin_manage" ON music_tracks FOR ALL TO authenticated USING (true);


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 3: USER ENGAGEMENT TABLES (Like, Save, History)                   ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: user_likes (মুভি লাইক)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_likes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id    UUID    NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  youtube_id  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, movie_id)
);

CREATE INDEX IF NOT EXISTS idx_user_likes_user  ON user_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_movie ON user_likes (movie_id);

ALTER TABLE user_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns likes" ON user_likes FOR ALL USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: user_watchlist (মুভি ওয়াচলিস্ট / সেভ)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_watchlist (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id    UUID    NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  youtube_id  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, movie_id)
);

CREATE INDEX IF NOT EXISTS idx_user_watchlist_user  ON user_watchlist (user_id);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_movie ON user_watchlist (movie_id);

ALTER TABLE user_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns watchlist" ON user_watchlist FOR ALL USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: user_history (মুভি ওয়াচ হিস্ট্রি)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_history (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id    UUID    NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  youtube_id  TEXT,
  watched_at  TIMESTAMPTZ DEFAULT now(),
  watch_count INTEGER DEFAULT 1,
  UNIQUE(user_id, movie_id)
);

CREATE INDEX IF NOT EXISTS idx_user_history_user    ON user_history (user_id);
CREATE INDEX IF NOT EXISTS idx_user_history_watched ON user_history (watched_at DESC);

ALTER TABLE user_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns history" ON user_history FOR ALL USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: music_likes (মিউজিক লাইক)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS music_likes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id    UUID    NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
  youtube_id  TEXT    NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_music_likes_user  ON music_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_music_likes_track ON music_likes (track_id);

ALTER TABLE music_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "music_likes_own" ON music_likes FOR ALL USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: music_saved (মিউজিক সেভ/বুকমার্ক)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS music_saved (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id    UUID    NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
  youtube_id  TEXT    NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_music_saved_user  ON music_saved (user_id);
CREATE INDEX IF NOT EXISTS idx_music_saved_track ON music_saved (track_id);

ALTER TABLE music_saved ENABLE ROW LEVEL SECURITY;
CREATE POLICY "music_saved_own" ON music_saved FOR ALL USING (auth.uid() = user_id);


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 4: USER PROFILES & AUTH                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: user_profiles (ইউজার প্রোফাইল)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id  UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name  TEXT    DEFAULT '',
  email         TEXT,
  avatar_url    TEXT,
  auth_provider TEXT    DEFAULT 'email',
  coins         INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_auth ON user_profiles (auth_user_id);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = auth_user_id);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: admin_users (অ্যাডমিন অ্যাক্সেস কন্ট্রোল)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_users (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT    NOT NULL,
  role        TEXT    NOT NULL DEFAULT 'admin',
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can read admin_users" ON admin_users FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Users can check own admin status" ON admin_users FOR SELECT USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: admin_activity_log (অ্যাডমিন অ্যাকশন লগ)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_activity_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id    UUID,
  action      TEXT    NOT NULL,
  target      TEXT    NOT NULL,
  details     JSONB   DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_log_created ON admin_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_log_admin  ON admin_activity_log (admin_id);

ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage activity log" ON admin_activity_log FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated can read activity log" ON admin_activity_log FOR SELECT TO authenticated USING (true);


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 5: APP CONFIG TABLES                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: app_features (ফিচার টগল — কোন ফিচার লাইভ/হিডেন/কামিং সুন)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_features (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key        TEXT    NOT NULL UNIQUE,
  name               TEXT    NOT NULL,
  label              TEXT    DEFAULT '',
  icon               TEXT    DEFAULT '',
  status             TEXT    NOT NULL DEFAULT 'live',
  description        TEXT    DEFAULT '',
  coming_soon_message TEXT   DEFAULT '',
  lock_reason        TEXT    DEFAULT '',
  sort_order         INTEGER DEFAULT 0,
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- ডিফল্ট ফিচার সিড ডাটা
INSERT INTO app_features (feature_key, name, label, icon, status, description, sort_order) VALUES
  ('movie_hub',  'Movie Hub',  'Movies',  '🎬', 'live',        'Browse and watch movies from top channels', 1),
  ('game_hub',   'Game Hub',   'Games',   '🎮', 'live',        'Play mini games and track scores',          2),
  ('ytmusic',    'YT Music',   'Music',   '🎵', 'live',        'YouTube Music integration',                 3),
  ('downloader', 'Downloader', 'Download','📥', 'live',        'Download videos from platforms',            4),
  ('offline',    'Offline Mode','Offline','💾', 'live',        'Save media for offline playback',           5),
  ('shorts',     'Shorts',     'Shorts',  '⚡', 'hidden',      'Short video clips',                         6),
  ('local_player','Local Player','Player','🎞️', 'live',        'Play local media files',                    7)
ON CONFLICT (feature_key) DO NOTHING;

ALTER TABLE app_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read features" ON app_features FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated can manage features" ON app_features FOR ALL TO authenticated USING (true);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: app_settings (গ্লোবাল অ্যাপ সেটিংস)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_settings (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key         TEXT    NOT NULL UNIQUE,
  value       JSONB   NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO app_settings (key, value) VALUES
  ('branding',    '{"app_name": "Play Nexa", "tagline": "Your Entertainment Hub"}'),
  ('colors',      '{"primary": "#7C3AED", "accent": "#06B6D4"}'),
  ('maintenance', '{"enabled": false, "message": "Under maintenance"}')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read settings" ON app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated can manage settings" ON app_settings FOR ALL TO authenticated USING (true);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: notifications_log (পুশ নোটিফিকেশন হিস্ট্রি)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  message     TEXT    DEFAULT '',
  sent_to     TEXT    DEFAULT 'all',
  target      TEXT    DEFAULT 'all',
  icon        TEXT    DEFAULT '',
  action_url  TEXT    DEFAULT '',
  sent_at     TIMESTAMPTZ DEFAULT now(),
  sent_count  INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_notifications_sent ON notifications_log (sent_at DESC);

ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage notifications" ON notifications_log FOR ALL TO authenticated USING (true);


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 6: GAME HUB TABLES                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: games (গেম ক্যাটালগ)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS games (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT    NOT NULL,
  description  TEXT,
  category     TEXT    NOT NULL,
  game_type    TEXT    NOT NULL DEFAULT 'offline'
               CHECK (game_type IN ('offline','download','online','mini')),
  apk_url      TEXT,
  web_url      TEXT,
  cover_url    TEXT    NOT NULL,
  size         TEXT    DEFAULT '0 MB',
  version      TEXT    DEFAULT '1.0',
  min_android  TEXT    DEFAULT '5.0',
  is_featured  BOOLEAN DEFAULT false,
  is_hidden    BOOLEAN DEFAULT false,
  is_free      BOOLEAN DEFAULT true,
  downloads    INTEGER DEFAULT 0,
  rating       REAL    DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_games_category  ON games (category);
CREATE INDEX IF NOT EXISTS idx_games_type      ON games (game_type);
CREATE INDEX IF NOT EXISTS idx_games_featured  ON games (is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_games_hidden    ON games (is_hidden) WHERE is_hidden = false;

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games_public_read" ON games FOR SELECT USING (true);
CREATE POLICY "games_admin_manage" ON games FOR ALL TO authenticated USING (true);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: game_scores (গেম স্কোর ট্র্যাকিং)
-- ──────────────────────────────────────────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS idx_game_scores_game   ON game_scores (game_slug);
CREATE INDEX IF NOT EXISTS idx_game_scores_high   ON game_scores (high_score DESC);

ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own scores" ON game_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scores" ON game_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scores" ON game_scores FOR UPDATE USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: game_data (RPC ফাংশনের জন্য — game_scores এর মিরর)
-- upsert_game_score RPC এই টেবিল ব্যবহার করে
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS game_data (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    REFERENCES user_profiles(id) ON DELETE CASCADE,
  game_slug   TEXT    NOT NULL,
  high_score  INTEGER DEFAULT 0,
  coins       INTEGER DEFAULT 0,
  plays       INTEGER DEFAULT 0,
  last_played TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, game_slug)
);

CREATE INDEX IF NOT EXISTS idx_game_data_slug  ON game_data (game_slug);
CREATE INDEX IF NOT EXISTS idx_game_data_high  ON game_data (high_score DESC);

ALTER TABLE game_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own game data" ON game_data FOR SELECT
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can insert own game data" ON game_data FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can update own game data" ON game_data FOR UPDATE
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: game_downloads (গেম ডাউনলোড ট্র্যাকিং)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS game_downloads (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID    REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id       UUID    REFERENCES games(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMPTZ DEFAULT now(),
  status        TEXT    DEFAULT 'pending',
  progress      NUMERIC DEFAULT 0,
  file_path     TEXT    DEFAULT '',
  UNIQUE(user_id, game_id)
);

ALTER TABLE game_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_downloads_user_own" ON game_downloads FOR ALL USING (auth.uid() = user_id);


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 7: PUSH NOTIFICATIONS TABLES                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: push_subscriptions (FCM ডিভাইস টোকেন)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  platform     TEXT DEFAULT 'web',
  device_info  TEXT DEFAULT '',
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  last_used    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(device_token)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user   ON push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_subs_token  ON push_subscriptions (device_token);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own push subscriptions" ON push_subscriptions FOR SELECT
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()) OR auth.role() = 'service_role');
CREATE POLICY "Users can insert own push subscriptions" ON push_subscriptions FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can update own push subscriptions" ON push_subscriptions FOR UPDATE
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users can delete own push subscriptions" ON push_subscriptions FOR DELETE
  USING (user_id IN (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()));


-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: notification_log (নোটিফিকেশন লগ — গ্যামিফিকেশন সিস্টেমের জন্য)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_log (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT    NOT NULL,
  body         TEXT    NOT NULL,
  category     TEXT    DEFAULT 'new_content',
  sent_count   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_log_created ON notification_log (created_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notification log readable by all" ON notification_log FOR SELECT USING (true);
CREATE POLICY "Notification log write by service_role" ON notification_log FOR INSERT WITH CHECK (auth.role() = 'service_role');


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 8: RPC FUNCTIONS                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝


-- ──────────────────────────────────────────────────────────────────────────────
-- RPC: upsert_missing_request (মিসিং রিকোয়েস্ট আপসার্ট)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_missing_request(
  p_search_query TEXT,
  p_category TEXT DEFAULT 'movie'
)
RETURNS TABLE (id BIGINT, search_query TEXT, category TEXT, status TEXT, request_count INTEGER) AS $$
DECLARE
  v_id BIGINT;
  v_count INTEGER;
BEGIN
  INSERT INTO missing_requests (search_query, category, status, request_count)
  VALUES (p_search_query, p_category, 'pending', 1)
  ON CONFLICT (search_query, category)
  DO UPDATE SET
    request_count = missing_requests.request_count + 1,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN QUERY
    SELECT mr.id, mr.search_query, mr.category, mr.status::TEXT, mr.request_count
    FROM missing_requests mr
    WHERE mr.id = v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────────────────────────
-- RPC: fetch_user_game_data (ইউজারের সব গেম ডাটা)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fetch_user_game_data(
  p_auth_user_id UUID
)
RETURNS TABLE (
  id UUID,
  game_slug TEXT,
  high_score INTEGER,
  coins INTEGER,
  plays INTEGER,
  last_played TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
  SELECT gd.id, gd.game_slug, gd.high_score, gd.coins, gd.plays,
         gd.last_played, gd.created_at
  FROM game_data gd
  INNER JOIN user_profiles up ON up.id = gd.user_id
  WHERE up.auth_user_id = p_auth_user_id
  ORDER BY gd.last_played DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────────────────────────
-- RPC: fetch_game_score (একটা গেমের স্কোর)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fetch_game_score(
  p_auth_user_id UUID,
  p_game_slug TEXT
)
RETURNS TABLE (
  high_score INTEGER,
  coins INTEGER,
  plays INTEGER
) AS $$
  SELECT gd.high_score, gd.coins, gd.plays
  FROM game_data gd
  INNER JOIN user_profiles up ON up.id = gd.user_id
  WHERE up.auth_user_id = p_auth_user_id
    AND gd.game_slug = p_game_slug;
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────────────────────────
-- RPC: upsert_game_score (গেম স্কোর আপডেট/ইনসার্ট + কয়েন যোগ)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_game_score(
  p_auth_user_id UUID,
  p_game_slug TEXT,
  p_score INTEGER,
  p_coins_earned INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  game_slug TEXT,
  high_score INTEGER,
  coins INTEGER,
  plays INTEGER
) AS $$
DECLARE
  v_profile_id UUID;
  v_current_high INTEGER;
  v_result_id UUID;
BEGIN
  SELECT id INTO v_profile_id FROM user_profiles WHERE auth_user_id = p_auth_user_id LIMIT 1;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found for auth_user_id %', p_auth_user_id;
  END IF;

  SELECT high_score INTO v_current_high
  FROM game_data WHERE user_id = v_profile_id AND game_slug = p_game_slug;

  IF v_current_high IS NOT NULL THEN
    UPDATE game_data
    SET high_score = GREATEST(high_score, p_score),
        coins = coins + p_coins_earned,
        plays = plays + 1,
        last_played = now()
    WHERE user_id = v_profile_id AND game_slug = p_game_slug
    RETURNING id INTO v_result_id;
  ELSE
    INSERT INTO game_data (user_id, game_slug, high_score, coins, plays)
    VALUES (v_profile_id, p_game_slug, p_score, p_coins_earned, 1)
    RETURNING id INTO v_result_id;
  END IF;

  IF p_coins_earned > 0 THEN
    UPDATE user_profiles SET coins = coins + p_coins_earned WHERE id = v_profile_id;
  END IF;

  RETURN QUERY
    SELECT gd.id, gd.game_slug, gd.high_score, gd.coins, gd.plays
    FROM game_data gd WHERE gd.id = v_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────────────────────────
-- RPC: fetch_user_coins (মোট কয়েন)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fetch_user_coins(
  p_auth_user_id UUID
)
RETURNS TABLE (
  total_coins INTEGER,
  game_coins INTEGER,
  games_played INTEGER
) AS $$
DECLARE
  v_profile_coins INTEGER;
  v_game_coins INTEGER;
  v_games_count INTEGER;
BEGIN
  SELECT coins INTO v_profile_coins FROM user_profiles WHERE auth_user_id = p_auth_user_id;
  SELECT COALESCE(SUM(gd.coins), 0), COUNT(*)
  INTO v_game_coins, v_games_count
  FROM game_data gd
  INNER JOIN user_profiles up ON up.id = gd.user_id
  WHERE up.auth_user_id = p_auth_user_id;

  v_profile_coins := COALESCE(v_profile_coins, 0);

  RETURN QUERY SELECT v_profile_coins, v_game_coins, v_games_count;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────────────────────────
-- RPC: fetch_leaderboard (গ্লোবাল লিডারবোর্ড)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fetch_leaderboard(
  p_game_slug TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  rank BIGINT,
  display_name TEXT,
  avatar_url TEXT,
  game_slug TEXT,
  high_score INTEGER,
  coins INTEGER,
  plays INTEGER
) AS $$
  SELECT
    ROW_NUMBER() OVER (
      PARTITION BY gd.game_slug
      ORDER BY gd.high_score DESC, gd.coins DESC
    ) AS rank,
    up.display_name,
    up.avatar_url,
    gd.game_slug,
    gd.high_score,
    gd.coins,
    gd.plays
  FROM game_data gd
  INNER JOIN user_profiles up ON up.id = gd.user_id
  WHERE p_game_slug IS NULL OR gd.game_slug = p_game_slug
  ORDER BY gd.high_score DESC, gd.coins DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────────────────────────
-- RPC: deduct_user_coins (কয়েন কাটা)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION deduct_user_coins(
  p_auth_user_id UUID,
  p_amount INTEGER
)
RETURNS TABLE (success BOOLEAN, remaining_coins INTEGER) AS $$
DECLARE
  v_profile_id UUID;
  v_current INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  SELECT id, coins INTO v_profile_id, v_current
  FROM user_profiles WHERE auth_user_id = p_auth_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  IF v_current < p_amount THEN
    RETURN QUERY SELECT false, v_current;
    RETURN;
  END IF;

  UPDATE user_profiles SET coins = coins - p_amount WHERE id = v_profile_id;
  RETURN QUERY SELECT true, (v_current - p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────────────────────────
-- RPC: register_push_token (FCM টোকেন রেজিস্টার)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION register_push_token(
  p_auth_user_id UUID,
  p_device_token TEXT,
  p_platform TEXT DEFAULT 'web',
  p_device_info TEXT DEFAULT ''
)
RETURNS UUID AS $$
DECLARE
  v_profile_id UUID;
  v_existing_id UUID;
BEGIN
  SELECT id INTO v_profile_id FROM user_profiles WHERE auth_user_id = p_auth_user_id;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  SELECT id INTO v_existing_id FROM push_subscriptions WHERE device_token = p_device_token;

  IF v_existing_id IS NOT NULL THEN
    UPDATE push_subscriptions
    SET user_id = v_profile_id,
        platform = p_platform,
        device_info = p_device_info,
        is_active = true,
        last_used = now()
    WHERE id = v_existing_id;
    RETURN v_existing_id;
  END IF;

  INSERT INTO push_subscriptions (user_id, device_token, platform, device_info)
  VALUES (v_profile_id, p_device_token, p_platform, p_device_info)
  RETURNING id INTO v_existing_id;

  RETURN v_existing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────────────────────────
-- RPC: unregister_push_token (FCM টোকেন আনরেজিস্টার)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION unregister_push_token(
  p_device_token TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE push_subscriptions SET is_active = false WHERE device_token = p_device_token;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────────────────────────
-- RPC: get_active_push_tokens (সব একটিভ টোকেন)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_active_push_tokens(
  p_limit INTEGER DEFAULT 500
)
RETURNS TABLE (device_token TEXT, platform TEXT) AS $$
  SELECT device_token, platform
  FROM push_subscriptions
  WHERE is_active = true
  ORDER BY last_used DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────────────────────────
-- RPC: cleanup_stale_tokens (পুরনো টোকেন ডিঅ্যাক্টিভেট)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_stale_tokens()
RETURNS void AS $$
BEGIN
  UPDATE push_subscriptions
  SET is_active = false
  WHERE last_used < now() - INTERVAL '30 days'
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────────────────────────
-- TRIGGER: notify_new_video (নতুন ভিডিও ইনসার্ট হলে পুশ নোটিফিকেশন)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_new_video()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_category TEXT;
  v_notification_body TEXT;
BEGIN
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  v_title := NEW.title;
  v_category := NEW.category;

  IF v_category = 'music' THEN
    v_notification_body := 'New music added! Check it out.';
  ELSE
    v_notification_body := 'New movie added! Check it out.';
  END IF;

  PERFORM net.http_post(
    url := 'https://gjapqxeksdsiqhvlfrnb.supabase.co/functions/v1/push-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    body := jsonb_build_object(
      'type', 'new_video',
      'title', v_title,
      'body', v_notification_body,
      'category', v_category,
      'video_id', NEW.yt_video_id,
      'thumbnail', COALESCE(NEW.thumbnail_url, '')
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_new_video ON videos;
CREATE TRIGGER trg_notify_new_video
  AFTER INSERT ON videos
  FOR EACH ROW
  WHEN (NEW.source = 'youtube')
  EXECUTE FUNCTION notify_new_video();


-- ──────────────────────────────────────────────────────────────────────────────
-- TRIGGER: auto-update updated_at (সব টেবিলের জন্য অটো আপডেট)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_yt_channels_updated   BEFORE UPDATE ON yt_channels      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_channel_display_updated BEFORE UPDATE ON channel_display FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_app_features_updated  BEFORE UPDATE ON app_features     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_app_settings_updated  BEFORE UPDATE ON app_settings     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_games_updated         BEFORE UPDATE ON games            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_user_profiles_updated BEFORE UPDATE ON user_profiles    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 9: VIEWS (জয়েন কুয়েরি সহজ করার জন্য)                              ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝


-- ──────────────────────────────────────────────────────────────────────────────
-- VIEW: channel_display_with_info
-- channel_display + yt_channels জয়েন — MovieHub/MusicHub চিপস লোড করতে
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW channel_display_with_info AS
SELECT
  cd.id,
  cd.channel_id,
  cd.display_name,
  cd.logo_url,
  cd.badge_color,
  cd.border_color,
  cd.is_visible,
  cd.sort_order,
  yc.channel_name,
  yc.channel_type,
  yc.total_imported,
  yc.channel_avatar
FROM channel_display cd
LEFT JOIN yt_channels yc ON yc.channel_id = cd.channel_id
WHERE cd.is_visible = true
ORDER BY cd.sort_order ASC;

ALTER TABLE channel_display_with_info OWNER TO postgres;


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  SECTION 10: GRANT PERMISSIONS                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- পাবলিক স্কিমায় টেবিল পারমিশন (Supabase ডিফল্ট)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- সিকোয়েন্স পারমিশন (BIGINT IDENTITY কলামের জন্য)
GRANT USAGE, SELECT ON SEQUENCE public.videos_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.missing_requests_id_seq TO anon, authenticated, service_role;


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  ✅ সব হয়ে গেছে! এখন নিচের স্টেপগুলো ফলো করো:                              ║
-- ║                                                                            ║
-- ║  1. Supabase Dashboard → Authentication → Users → Add user                ║
-- ║     Email: admin@playnexa.com    Password: PlayNexa@2024                  ║
-- ║                                                                            ║
-- ║  2. ইউজারের UUID কপি করো                                                   ║
-- ║                                                                            ║
-- ║  3. SQL Editor এ রান করো:                                                  ║
-- ║     INSERT INTO admin_users (user_id, email, role)                         ║
-- ║     VALUES ('UUID_পেস্ট_করো', 'admin@playnexa.com', 'superadmin');            ║
-- ║                                                                            ║
-- ║  4. /admin/login এ লগইন করো                                               ║
-- ║     Email: admin@playnexa.com    Password: PlayNexa@2024                  ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝
