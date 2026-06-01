---
Task ID: 1
Agent: Main Agent
Task: Clean short clips from Movie Hub — SQL cleanup + Frontend fetch optimization

Work Log:
- Read current codebase: youtube.ts, search.ts, movies.json, fallback.ts, cache.ts, useMovies.ts, movies/page.tsx
- Installed @supabase/supabase-js package
- Created /src/lib/supabase.ts — Singleton Supabase client with 3s timeout, lazy init
- Created /supabase/schema.sql — Videos table schema with indexes + RLS + cleanup SQL command
- Updated /src/lib/youtube.ts — isMovie() filter changed from `sec > 2400` (40 min) to `sec >= 3600` (60 min strict), expanded blacklist with 15+ new keywords
- Created /src/lib/db-cache.ts — Supabase hybrid cache service with strict 60-minute movie filter
- Verified ZERO UI files were modified — only data filtration logic changed

Stage Summary:
- SQL cleanup command: `DELETE FROM videos WHERE category = 'movie' AND duration_sec < 3600;`
- Preview command: `SELECT id, yt_video_id, title, duration_sec FROM videos WHERE category = 'movie' AND duration_sec < 3600;`
- Frontend filter: isMovie() now requires `sec >= 3600` (60 min) + expanded 35+ keyword blacklist
- New db-cache.ts provides Supabase-first fetch with 60-min filter built into every query
- Data flow: Supabase DB (60-min filter) → LocalStorage → YouTube API (60-min filter) → Static Fallback
- No UI files touched — Movie Hub grid/list component is 100% unchanged
