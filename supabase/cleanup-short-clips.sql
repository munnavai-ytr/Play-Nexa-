-- ═══════════════════════════════════════════════════════════════
-- GROVIX — Clean Up Short Clips from Movie Category
-- ═══════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to delete all fake "movies"
-- that are actually short clips (< 60 minutes)
--
-- BEFORE RUNNING: This permanently deletes rows. Back up if needed:
--   CREATE TABLE videos_backup AS SELECT * FROM videos;
-- ═══════════════════════════════════════════════════════════════


-- ── 1. CHECK: How many short clips are in the movie category? ──
-- Run this first to see the damage BEFORE deleting

SELECT
  COUNT(*) AS total_movies,
  COUNT(*) FILTER (WHERE duration_sec < 3600) AS short_clips_under_60min,
  COUNT(*) FILTER (WHERE duration_sec < 2400) AS short_clips_under_40min,
  COUNT(*) FILTER (WHERE duration_sec >= 3600) AS real_full_movies
FROM videos
WHERE category = 'movie';


-- ── 2. PREVIEW: Show the short clips that will be deleted ──
-- Review these before running the DELETE

SELECT
  id,
  yt_video_id,
  title,
  duration_sec,
  (duration_sec / 60) AS duration_minutes,
  views,
  created_at
FROM videos
WHERE category = 'movie'
  AND duration_sec < 3600
ORDER BY duration_sec ASC;


-- ── 3. DELETE: Remove all short clips from movie category ──
-- This is the main cleanup command

DELETE FROM videos
WHERE category = 'movie'
  AND duration_sec < 3600;


-- ── 4. VERIFICATION: Confirm cleanup worked ──

SELECT
  COUNT(*) AS remaining_movies,
  MIN(duration_sec / 60) AS shortest_movie_min,
  MAX(duration_sec / 60) AS longest_movie_min,
  AVG(duration_sec / 60)::INTEGER AS avg_movie_min
FROM videos
WHERE category = 'movie';
-- Expected: shortest_movie_min should be >= 60


-- ── 5. BONUS: Also clean up videos with suspicious titles ──
-- These might have slipped through even if duration > 60 min

DELETE FROM videos
WHERE category = 'movie'
  AND (
    title ILIKE '%trailer%'
    OR title ILIKE '%teaser%'
    OR title ILIKE '%clip%'
    OR title ILIKE '%song%'
    OR title ILIKE '%episode%'
    OR title ILIKE '%season%'
    OR title ILIKE '%reaction%'
    OR title ILIKE '%gameplay%'
    OR title ILIKE '%walkthrough%'
  );


-- ═══════════════════════════════════════════════════════════════
-- DONE! After running this:
-- 1. All movie-category videos are guaranteed >= 60 minutes
-- 2. No trailers, clips, or episodes remain
-- 3. Shorts and music categories are untouched
-- 4. Re-run the cron/Edge Function to populate with real movies
-- ═══════════════════════════════════════════════════════════════
