---
Task ID: 1
Agent: Main Agent
Task: Comprehensive check and fix of Supabase connection, admin login, and admin panel

Work Log:
- Read .env file - found only DATABASE_URL, missing all Supabase credentials
- Read supabase.ts, supabaseAdmin.ts - client code correct but env vars missing
- Read admin login page, verify API route, middleware, layout - all code correct
- Read admin dashboard, movies, games, settings, features pages - identified issues
- Fixed .env file: added NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
- Fixed admin movies page: changed supabaseAdmin (service role, null on client) to supabase (anon key, works with auth)
- Fixed admin games page: same fix as movies page
- Created /api/admin/setup route with GET (check if admins exist) and POST (create first admin)
- Updated admin login page: auto-detects setup mode vs login mode
- Created fix-app-settings.sql script to fix JSONB→TEXT mismatch in app_settings table
- Tested all API endpoints: setup GET/POST, verify, movies - all working
- Admin user admin@playnexa.com created successfully in Supabase Auth + admin_users table

Stage Summary:
- ROOT CAUSE: .env file was missing all Supabase credentials (URL, anon key, service role key)
- Admin movies and games pages were using supabaseAdmin client-side (null because service role key is server-only)
- app_settings table value column is JSONB but settings page expects TEXT (fix SQL script provided)
- Admin setup flow works: first visit shows setup form, subsequent visits show login form
- Build succeeds with no errors
