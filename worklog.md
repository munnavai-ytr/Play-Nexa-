---
Task ID: 1
Agent: Main Agent
Task: Full Admin Panel check and fix all issues

Work Log:
- Explored entire project structure and all admin pages
- Read all 14 admin pages, 6 API routes, and core components
- Checked Firebase config, Supabase config, admin auth system
- Verified .env.local has all required keys (Supabase, Firebase, Gemini, YouTube)
- Identified 5 critical issues and fixed them all
- Built project successfully with no errors
- Started server with PM2 and ran comprehensive API tests
- All API routes now return 401 Unauthorized without auth token
- All admin pages protected by client-side auth guard

Stage Summary:
- FIXED: Admin auth guard missing - added auth check in admin layout.tsx
- FIXED: Users API verifyAdmin() always returned true - now checks pna_admin_token cookie
- FIXED: API keys exposed to client in Chat page - now uses keyId instead of apiKey
- FIXED: TopBar missing from admin layout - added with mobile hamburger menu
- FIXED: Mobile sidebar toggle missing - added responsive sidebar with overlay
- FIXED: All admin API routes (movies, channels, yt-import, chat) now have auth checks
- Build: Successful, no errors
- Server: Running on PM2 (playnexa), all endpoints tested
- Chat API: Gemini key has rate limit issues (429) but auth is working correctly
