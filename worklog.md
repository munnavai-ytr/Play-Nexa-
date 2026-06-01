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

---
Task ID: 2
Agent: Main Agent
Task: Gemini AI Multi-Key Rotation & Movie Discovery Engine

Work Log:
- Created /src/lib/gemini.ts — 5-Key Lottery Manager with health tracking, weighted random selection, 429 auto-fallback, key pool status
- Created /src/app/api/cron/ai-movie-hunter/route.ts — 4-step AI pipeline: Gemini suggests → YouTube fetches → Gemini verifies → Supabase saves
- Created /src/app/api/search/ai/route.ts — Natural language AI search: Gemini parses intent → searches Supabase + YouTube → merges results
- Updated .env with GEMINI_KEY_1-5 placeholders + CRON_SECRET + Supabase + YouTube keys
- Updated /supabase/schema.sql — Added upsert_missing_request RPC + INSERT/UPDATE policies for missing_requests
- TypeScript compile check: ZERO errors in all new files
- Verified ZERO UI files were modified — only API routes and server utilities

Stage Summary:
- Gemini Key Rotator: 5 keys, lottery-style weighted selection, automatic 429 detection + rotation, health tracking per key
- AI Movie Hunter: POST /api/cron/ai-movie-hunter — 4-step pipeline processes missing requests + category queries + Gemini suggestions
- AI Smart Search: POST /api/search/ai — Natural language interpretation, multi-strategy Supabase search + YouTube fallback
- Rate limiting: 30 requests/minute global for AI search, CRON_SECRET auth for hunter
- All processing server-side only — zero client-side overhead
- Data flow: User NL query → Gemini parses intent → Supabase genre/language/text search → YouTube API fallback → merged results
