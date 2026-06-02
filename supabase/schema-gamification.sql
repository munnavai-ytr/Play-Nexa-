-- ═══════════════════════════════════════════════════════════════
-- GROVIX — Step 3: Gamification & Push Notifications Schema
-- ═══════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor AFTER the base schema.sql
-- Adds: Game Data RPCs, Push Subscriptions, Webhook Trigger
-- Optimized for: 2GB RAM safe, zero lag, minimal DB load
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- PART 1: GAME DATA RPC FUNCTIONS
-- ═══════════════════════════════════════════════════════════════


-- ── 1A. Fetch all game data for a logged-in user ──────────────
-- Returns every game row for this user (scores, coins, plays)

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


-- ── 1B. Fetch single game data for a user ─────────────────────
-- Used during gameplay to get current high score without extra data

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


-- ── 1C. Update/Add game score (Upsert) ────────────────────────
-- Called after each gameplay session ends
-- Only updates high_score if new score > old score
-- Always adds coins earned and increments plays
-- Returns the updated row

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
  v_current_coins INTEGER;
  v_current_plays INTEGER;
  v_result_id UUID;
BEGIN
  -- Get profile ID from auth user ID
  SELECT id INTO v_profile_id
  FROM user_profiles
  WHERE auth_user_id = p_auth_user_id
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found for auth_user_id %', p_auth_user_id;
  END IF;

  -- Try to get existing row
  SELECT high_score, coins, plays
  INTO v_current_high, v_current_coins, v_current_plays
  FROM game_data
  WHERE user_id = v_profile_id AND game_slug = p_game_slug;

  IF v_current_high IS NOT NULL THEN
    -- UPDATE: only bump high_score if new score is higher
    UPDATE game_data
    SET high_score = GREATEST(high_score, p_score),
        coins = coins + p_coins_earned,
        plays = plays + 1,
        last_played = NOW()
    WHERE user_id = v_profile_id AND game_slug = p_game_slug
    RETURNING id INTO v_result_id;
  ELSE
    -- INSERT: first time playing this game
    INSERT INTO game_data (user_id, game_slug, high_score, coins, plays)
    VALUES (v_profile_id, p_game_slug, p_score, p_coins_earned, 1)
    RETURNING id INTO v_result_id;
  END IF;

  -- Also add coins to user_profiles.total_coins
  IF p_coins_earned > 0 THEN
    UPDATE user_profiles
    SET coins = coins + p_coins_earned
    WHERE id = v_profile_id;
  END IF;

  -- Return updated row
  RETURN QUERY
    SELECT gd.id, gd.game_slug, gd.high_score, gd.coins, gd.plays
    FROM game_data gd
    WHERE gd.id = v_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 1D. Fetch total coins across all games for a user ─────────
-- Also returns the user_profiles.coins (includes bonus coins etc.)

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
  -- Get profile coins (accumulated total)
  SELECT coins INTO v_profile_coins
  FROM user_profiles
  WHERE auth_user_id = p_auth_user_id;

  -- Get sum of game_data coins
  SELECT COALESCE(SUM(gd.coins), 0), COUNT(*)
  INTO v_game_coins, v_games_count
  FROM game_data gd
  INNER JOIN user_profiles up ON up.id = gd.user_id
  WHERE up.auth_user_id = p_auth_user_id;

  -- Use profile coins as the truth (it accumulates all)
  v_profile_coins := COALESCE(v_profile_coins, 0);

  RETURN QUERY
    SELECT v_profile_coins, v_game_coins, v_games_count;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ── 1E. Global Leaderboard (Top 10 players by high score) ─────
-- Can filter by specific game or show overall
-- Joins game_data with user_profiles for display names

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


-- ── 1F. Deduct coins from user (for shop purchases etc.) ──────

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
  FROM user_profiles
  WHERE auth_user_id = p_auth_user_id;

  IF v_profile_id IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  IF v_current < p_amount THEN
    RETURN QUERY SELECT false, v_current;
    RETURN;
  END IF;

  UPDATE user_profiles
  SET coins = coins - p_amount
  WHERE id = v_profile_id;

  RETURN QUERY SELECT true, (v_current - p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════
-- PART 2: PUSH NOTIFICATIONS SCHEMA
-- ═══════════════════════════════════════════════════════════════


-- ── 2A. Push Subscriptions Table ──────────────────────────────
-- Stores FCM device tokens for each user
-- One user can have multiple devices

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,                     -- FCM registration token
  platform     TEXT DEFAULT 'web',                -- "web" | "android" | "ios"
  device_info  TEXT DEFAULT '',                    -- Browser/device name
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  last_used    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(device_token)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_subs_token ON push_subscriptions(device_token);

-- ── 2B. Notification Log Table ────────────────────────────────
-- Tracks sent notifications (for analytics / rate limiting)

CREATE TABLE IF NOT EXISTS notification_log (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  category     TEXT DEFAULT 'new_content',        -- "new_content" | "achievement" | "system"
  sent_count   INTEGER DEFAULT 0,                 -- How many devices received it
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_log_created ON notification_log(created_at DESC);


-- ── RLS for push_subscriptions ──

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (user_id IN (
    SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
  ) OR auth.role() = 'service_role');

CREATE POLICY "Users can insert own push subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (user_id IN (
    SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can update own push subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (user_id IN (
    SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own push subscriptions"
  ON push_subscriptions FOR DELETE
  USING (user_id IN (
    SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
  ));

-- Notification log: service_role can write, anyone can read
CREATE POLICY "Notification log readable by all"
  ON notification_log FOR SELECT
  USING (true);

CREATE POLICY "Notification log write by service_role"
  ON notification_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');


-- ── 2C. RPC: Register / Update device token ──────────────────

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
  -- Get profile ID
  SELECT id INTO v_profile_id
  FROM user_profiles
  WHERE auth_user_id = p_auth_user_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Check if token already exists (might belong to different user after re-login)
  SELECT id INTO v_existing_id
  FROM push_subscriptions
  WHERE device_token = p_device_token;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing: re-assign to current user
    UPDATE push_subscriptions
    SET user_id = v_profile_id,
        platform = p_platform,
        device_info = p_device_info,
        is_active = true,
        last_used = NOW()
    WHERE id = v_existing_id;
    RETURN v_existing_id;
  END IF;

  -- Insert new
  INSERT INTO push_subscriptions (user_id, device_token, platform, device_info)
  VALUES (v_profile_id, p_device_token, p_platform, p_device_info)
  RETURNING id INTO v_existing_id;

  RETURN v_existing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 2D. RPC: Unregister device token (on sign out / token refresh) ──

CREATE OR REPLACE FUNCTION unregister_push_token(
  p_device_token TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE push_subscriptions
  SET is_active = false
  WHERE device_token = p_device_token;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 2E. RPC: Get active tokens for broadcasting ───────────────
-- Used by Edge Function to get all active device tokens

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


-- ═══════════════════════════════════════════════════════════════
-- PART 3: DATABASE WEBHOOK TRIGGER
-- ═══════════════════════════════════════════════════════════════
-- When a new video is inserted (by the nightly cron job),
-- automatically trigger the push-notify Edge Function
-- to send a notification to all subscribed users.
-- ═══════════════════════════════════════════════════════════════

-- ── Enable pg_net extension (required for HTTP calls from DB) ──
-- Run this in Supabase Dashboard → Extensions if not already enabled:
-- CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── 3A. Trigger function: fires after INSERT on videos ────────
-- Only triggers when source = 'youtube' (from cron job, not manual)
-- Uses net.http_post to call the Edge Function asynchronously

CREATE OR REPLACE FUNCTION notify_new_video()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_category TEXT;
  v_notification_body TEXT;
BEGIN
  -- Only trigger for new inserts from the YouTube cron job
  -- Skip manual inserts or updates
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Build notification message
  v_title := NEW.title;
  v_category := NEW.category;

  IF v_category = 'music' THEN
    v_notification_body := 'New music added! Check it out.';
  ELSE
    v_notification_body := 'New movie added! Check it out.';
  END IF;

  -- Call the push-notify Edge Function asynchronously
  -- This is fire-and-forget: doesn't block the INSERT
  -- Replace YOUR_PROJECT_REF with your actual Supabase project ref
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

-- ── 3B. Attach trigger to videos table ────────────────────────
-- Fires AFTER INSERT so the row is committed before notification

DROP TRIGGER IF EXISTS trg_notify_new_video ON videos;
CREATE TRIGGER trg_notify_new_video
  AFTER INSERT ON videos
  FOR EACH ROW
  WHEN (NEW.source = 'youtube')  -- Only cron-inserted videos
  EXECUTE FUNCTION notify_new_video();

-- ── 3C. Set the cron secret (set this to match your CRON_SECRET) ──
-- This is used by the trigger to authenticate with the Edge Function
-- ALTER DATABASE postgres SET app.cron_secret TO 'your_cron_secret_here';


-- ═══════════════════════════════════════════════════════════════
-- PART 4: pg_cron JOBS
-- ═══════════════════════════════════════════════════════════════
-- These jobs maintain the system automatically

-- ── 4A. Clean up stale push tokens weekly ─────────────────────
-- Tokens not used in 30 days get deactivated

CREATE OR REPLACE FUNCTION cleanup_stale_tokens()
RETURNS void AS $$
BEGIN
  UPDATE push_subscriptions
  SET is_active = false
  WHERE last_used < NOW() - INTERVAL '30 days'
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule weekly cleanup (run in SQL Editor):
-- SELECT cron.schedule(
--   'cleanup-push-tokens',
--   '0 3 * * 0',  -- Every Sunday at 3 AM UTC
--   $$SELECT cleanup_stale_tokens();$$
-- );


-- ═══════════════════════════════════════════════════════════════
-- DONE! Deployment Steps:
-- ═══════════════════════════════════════════════════════════════
-- 1. Run this entire file in Supabase SQL Editor
-- 2. Enable pg_net extension (Dashboard → Extensions → pg_net)
-- 3. Set app.cron_secret: ALTER DATABASE postgres SET app.cron_secret TO 'your_secret';
-- 4. Deploy the push-notify Edge Function:
--    supabase functions deploy push-notify
-- 5. Set secrets:
--    supabase secrets set FCM_SERVER_KEY=your_fcm_key
--    (Or use OneSignal REST API key if using OneSignal)
-- 6. Schedule cleanup cron job (see 4A above)
-- 7. Test: Insert a row into videos table manually and verify notification fires
-- ═══════════════════════════════════════════════════════════════
