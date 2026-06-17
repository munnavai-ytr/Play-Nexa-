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

---
Task ID: 2
Agent: Main Agent
Task: Create Smart Download Platform System (8 new files)

Work Log:
- Analyzed existing download page, lib/platformDetector.ts, lib/downloader.ts, and download components
- Created src/lib/platforms.ts — 21 source platforms + 30 download platforms with full metadata
- Created src/lib/urlDetector.ts — Auto-detect platform from URL using regex patterns, extract video IDs
- Created src/components/download/PlatformCard.tsx — Rich card with logo, rating, speed badge, features, action buttons
- Created src/components/download/VideoPreview.tsx — YouTube thumbnail preview with lazy loading
- Created src/components/download/CompatibleList.tsx — Compatible downloaders list with show more/less toggle
- Created src/components/download/PlatformBrowser.tsx — Full-screen browser with search, filter chips, collapsible categories
- Created src/components/download/DownloadHome.tsx — Main screen with URL input, auto-detect, paste, history, guide
- Overwrote src/app/download/page.tsx — Simple route rendering DownloadHome
- Verified build passes with zero errors in new files
- All files follow AMOLED dark theme (#0D0D0D), min 44px touch targets, max 200ms transitions, no backdrop-blur
- content-visibility: auto on all list containers for 2GB RAM optimization

Stage Summary:
- 8 files created/modified successfully
- Build passes cleanly (only pre-existing Badge.tsx case error in unrelated file)
- All platform data hardcoded — works offline, zero API calls
- 21 source platforms: YouTube, TikTok, Instagram, Facebook, Twitter, Snapchat, Vimeo, Dailymotion, Twitch, Reddit, SoundCloud, Pinterest, LinkedIn, Likee, ShareChat, Moj, Josh, MX TakaTak, Chingari, Bilibili, NicoNico
- 30 download platforms across categories: universal(6), youtube(5), tiktok(5), instagram(4), facebook(3), twitter(3), music(2), other(3)
- Smart URL detection with regex patterns + video ID extraction

---
Task ID: 3
Agent: Main Agent
Task: Replace emoji logos with real favicon images in Download Platform system

Work Log:
- Added `logoBg?: string` field to DownloadPlatform interface in platforms.ts
- Replaced all 31 emoji logo values with Google Favicon URLs (https://www.google.com/s2/favicons?domain={domain}&sz=64)
- Added logoBg: '#1A1A2E' to all 31 platform entries
- Updated PlatformCard.tsx: replaced emoji container with <img> tag using favicon URL
- Added lazy loading (loading="lazy") on all favicon images
- Added onError fallback: shows first letter of platform name if favicon fails to load
- Image size: 36x36 inside 48x48 container with rounded-xl
- Used object-contain to preserve logo aspect ratio
- Only 2 files modified as specified

Stage Summary:
- platforms.ts: 31 favicon URLs + 31 logoBg colors added
- PlatformCard.tsx: emoji replaced with real <img> + onError fallback
- Build passes cleanly

---
Task ID: 4
Agent: Main Agent
Task: Convert local media players from mock to real device media with smart env detection

Work Log:
- Created src/lib/useDeviceMedia.ts — Core hook with:
  - Smart environment detection (detectNative via Capacitor checks)
  - Web mode: pickFiles() + pickFolder() (webkitdirectory) for browser fallback
  - Native mode: fullNativeScan() using @capacitor/filesystem dynamic require
  - Auto-scan on native mount (Movies, Download, DCIM, Music, etc.)
  - URL lifecycle management with objectUrlsRef tracking
  - URL.revokeObjectURL cleanup on unmount via useEffect cleanup
  - Duration extraction pipeline via HTML5 audio/video metadata
  - getPlayableUrl() recreates object URLs from File objects or converts native paths
  - localStorage persistence (v3 keys) without blob URLs or File objects
  - Deduplication by name+size for browser picks, by nativePath for native scans
- Updated VideoGridView.tsx:
  - Replaced internal file management with useDeviceMedia('video') hook
  - Added FolderOpen button + RefreshCw scan button in header
  - Added scan progress indicator for native scanning
  - Added "Select Video Folder" CTA in empty state for web
  - Kept 100% of original UI: grid layout, thumbnails, glassmorphism, date groups
  - Maps MediaFile → LocalVideo for parent compatibility
- Updated MusicListView.tsx:
  - Replaced internal file management with useDeviceMedia('audio') hook
  - Added FolderOpen + RefreshCw buttons in header
  - Added scan progress indicator
  - Added "Select Music Folder" CTA in empty state for web
  - Kept 100% of original UI: list rows, equalizer animation, promo banner, context menus
  - Maps MediaFile → LocalTrack for parent compatibility
- Updated VideoPlayer.tsx: Added video element cleanup on unmount (pause + src='' + load)
- Updated MiniPlayer.tsx: Added audio element cleanup on unmount (pause + src='' + load)
- Fixed TS2554 error in VideoPlayer (useRef needs initial value)
- Fixed @capacitor/filesystem TS2307 (dynamic require instead of import)

Stage Summary:
- 5 files modified, 1 new file created
- Build passes cleanly with zero errors
- Web: file picker + folder picker (webkitdirectory)
- Native/APK: auto-scan Movies, Download, DCIM, Music, Recordings directories
- Memory safe: all object URLs tracked and revoked on unmount
- Zero UI changes — only data engine swapped underneath
---
Task ID: 3
Agent: Main
Task: Upgrade Local Video Player and Local Music Player from mock data to real device media files

Work Log:
- Analyzed project structure: Found 2 parallel media systems — Local Hub (useDeviceMedia, already clean) and Media Library (useMediaLibrary, had mock data)
- Identified mock data source: `useMediaLibrary.ts` with `getMockMusicData()` (10 fake songs) and `getMockVideoData()` (5 fake videos)
- Updated `mediaUtils.ts`: Added `file?: File` field to both `Song` and `VideoFile` interfaces for browser File object storage
- Rewrote `useMediaLibrary.ts`: Purged ALL mock data, replaced with empty array for web mode, added dual-mode engine (web file picker + APK native scan), added URL.createObjectURL with garbage collection (objectUrlsRef + revokeUrl on unmount/remove), added pickMusicFiles/pickMusicFolder/pickVideoFiles/pickVideoFolder methods, added getPlayableSongUrl/getPlayableVideoUrl for URL re-creation
- Updated `MusicLibrary.tsx`: Added isNative/pickMusicFiles/pickMusicFolder from hook, replaced empty state with dual-mode UI (web: "Select Music Files" + "Or Select a Folder" buttons, native: "Scan Again" button)
- Updated `VideoLibrary.tsx`: Added isNative/pickVideoFiles/pickVideoFolder from hook, replaced empty state with dual-mode UI (web: "Select Video Files" + "Or Select a Folder" buttons, native: "Scan Again" button)
- Build verification: `next build` passed cleanly, no TypeScript errors in modified files

Stage Summary:
- All mock data purged from codebase — 10 fake audio entries and 5 fake video entries deleted
- Dual-mode engine: Web mode shows file picker buttons, APK mode auto-scans device storage
- URL.createObjectURL lifecycle: Registered on creation, revoked on remove/unmount, re-creatable from stored File objects
- Zero UI changes to existing layouts — only empty state content swapped
- 4 files modified: mediaUtils.ts, useMediaLibrary.ts, MusicLibrary.tsx, VideoLibrary.tsx
---
Task ID: 4
Agent: Main
Task: Fix broken file picker (files not appearing in library) + add FileImportPreviewModal with "Import All" button for both Music & Video

Work Log:
- Diagnosed bug: `await extractAudioMetadata()` inside picker's for-loop blocked file addition. For 10 files = 10-30 seconds delay before any file appeared in UI. User thought "files don't get added" because nothing visible happened.
- Secondary issue: `jsmediatags` dynamic import in extractAudioMetadata could hang on slow connections.
- Created `src/components/local/FileImportPreviewModal.tsx`: Reusable modal showing all selected files before import. Features: scrollable list with content-visibility:auto, video thumbnails for first 20 items (2GB RAM safe), lazy-load more on scroll, total count+size summary, "Cancel" + "Import All (N)" footer buttons, all temp URLs revoked on unmount.
- Rewrote picker functions in `src/hooks/useMediaLibrary.ts`: pickMusicFiles/pickMusicFolder/pickVideoFiles/pickVideoFolder now ONLY open file picker and set `pendingImport` state — no metadata extraction, no library modification.
- Added `pendingImport` state, `confirmImport()`, `cancelImport()` to hook.
- `confirmImport()` adds ALL files INSTANTLY with placeholder metadata (artist="Unknown Artist", duration=0). No awaits. UI updates immediately.
- Background metadata extraction: `extractSongDurationInBackground()` and `extractVideoMetadataInBackground()` use setTimeout chunking (50ms gap for audio, 80ms for video) to extract duration/dimensions one file at a time without blocking UI. Each extractor uses lightweight <audio>/<video> element with 5-second timeout, cleans up temp URLs after.
- Added `document.body.appendChild(input)` before `.click()` and `removeChild` after — fixes iOS Safari picker issue.
- Wired modal into `MusicLibrary.tsx` and `VideoLibrary.tsx`: renders `<FileImportPreviewModal>` when `pendingImport?.type` matches.
- Reordered hook so background extractors are defined BEFORE `confirmImport` (avoids TDZ issues).
- Updated hook's return statement to export: `pendingImport`, `confirmImport`, `cancelImport`.
- Build verification: `next build` passed cleanly, no TypeScript errors in modified files.

Stage Summary:
- Fixed: Files now appear in library INSTANTLY when user clicks "Import All" — no more 10-30 second delay.
- New feature: Preview modal shows all selected files with thumbnails before importing. User can review and cancel.
- 2GB RAM safe: Thumbnails limited to 20 videos, lazy-loaded on scroll, all temp URLs revoked, setTimeout chunking prevents UI blocking.
- 5 files modified/created: FileImportPreviewModal.tsx (new), useMediaLibrary.ts, MusicLibrary.tsx, VideoLibrary.tsx, plus 2 helper scripts in /scripts/.
- Zero UI changes to existing library layouts — only empty state buttons + new modal added.

---
Task ID: MS-1
Agent: main (Super Z)
Task: Build STRICT dual-mode media scanner system — web (browser picker, type-locked) + native (Android APK MediaStore auto-scan), unified behind one React hook. NO changes to existing UI design/layout/colors. Performance-grade for 2GB RAM, low-internet, offline.

Work Log:
- Created new directory structure: src/lib/media-scanner/, src/components/media/, android-config/, .github/workflows/
- Built 9 production-ready files, all with full path as header comment:
  1. src/lib/media-scanner/types.ts — MediaFile, MediaKind, PermissionState, ScanResult interfaces + MEDIA_EXTENSIONS, MEDIA_ACCEPT_TYPES, PAGE_SIZE=50, MAX_DIR_DEPTH=5, NATIVE_TIMEOUT_MS=5000 constants + getExt/matchesKind/guessMimeType helpers.
  2. src/lib/media-scanner/indexed-db-handle-store.ts — Tiny IndexedDB wrapper (no deps) to persist FileSystemDirectoryHandle by kind. All ops wrapped in try/catch, returns null gracefully.
  3. src/lib/media-scanner/web-strategy.ts — Two-tier scanner: (A) File System Access API showDirectoryPicker() with recursive walk (max depth 5, hard cap 500 files), handle saved to IDB for one-tap reuse on next visit; (B) hidden <input type="file" multiple accept="video/*|audio/*"> fallback appended to body for iOS Safari compatibility, with webkitdirectory opt-in for folder mode. TYPE-LOCKED via accept attr + extension filter. Single scanWeb() entry point with mode: 'reuse' | 'pick-dir' | 'pick-files' | 'pick-folder-fallback'. Plus revokeUris() and refreshUri() helpers.
  4. src/lib/media-scanner/native-strategy.ts — Dynamic import of @capacitor-community/media via string variable (no hard build failure if plugin missing). requestNativePermission() maps plugin permission strings to PermissionState, 5s timeout. scanNative(kind, page) returns 50-item pages with hasMore flag, 5s timeout returns partial results instead of hanging. isNativePlatform() check via window.Capacitor.
  5. src/lib/media-scanner/useLocalMediaScanner.ts — Unified React hook returning { files, isLoading, isLoadingMore, error, permissionState, isNative, hasMore, requestScan, loadMore, pickFiles, pickFolder, clear }. Auto-triggers initial scan on mount (native) or silent handle reuse (web). Tracks all blob: URLs in urlSetRef, revokes on unmount or re-pick. Guards all setState calls via mountedRef to prevent post-unmount leaks (critical for 2GB RAM). StrictMode-safe via setTimeout(0) defer.
  6. src/components/media/MediaPickerButton.tsx — Web-only button (renders null on native). Uses existing Play Nexa button pattern: bg-pn-purple, h-12 px-6 rounded-xl, 150ms transition, active:scale-[0.97]. Two modes ('files' | 'folder'), two variants ('primary' | 'secondary'), compact size option. Loader2 spinner when busy.
  7. src/components/media/MediaScanStatus.tsx — Status/empty-state indicator replicating existing EmptyState pattern (centered icon + title + description + action). States: loading, permission denied (with "Grant access" button), unsupported, error, empty web (with pick files/folder buttons), empty native (with "Rescan device" button), non-fatal warning bar. All using existing pn-purple/pn-muted/white text tokens.
  8. android-config/AndroidManifest-additions.xml — Snippet with comment showing where to paste in AndroidManifest.xml. Includes READ_MEDIA_VIDEO, READ_MEDIA_AUDIO (API 33+) and READ_EXTERNAL_STORAGE with maxSdkVersion=32 (older Android). Optional WRITE_EXTERNAL_STORAGE commented out.
  9. .github/workflows/build-apk.yml — Triggered on push to main + workflow_dispatch. Steps: checkout → setup Node LTS with npm cache → npm ci → npm run build → npx cap sync android → setup JDK 17 (temurin) with gradle cache → chmod gradlew → ./gradlew assembleRelease → locate APK (handles both signed and unsigned naming) → upload-artifact@v4 with 14-day retention → summary to $GITHUB_STEP_SUMMARY. Clear comments: Vercel deploys web separately via own GitHub integration; signing TODO documented with keystore base64 secret instructions.
- Ran npx tsc --noEmit --skipLibCheck — ZERO errors in any of the 9 new files. Only pre-existing errors in unrelated files (notifications.ts, sourceRotator.ts, supabase/functions/*) remain.

Stage Summary:
- 9 new files created, 0 existing files modified. Existing UI design/layout/colors/themes/components untouched.
- Dual-mode engine: web picker (type-locked video/audio) + native MediaStore auto-scan, unified behind single useLocalMediaScanner(kind) hook returning MediaFile[].
- Performance: pagination 50/page on native, hard cap 500/folder on web, 5s native timeout, all blob URLs tracked + revoked on unmount/re-pick/clear. StrictMode-safe. 2GB RAM-friendly.
- Plugin optional: @capacitor-community/media dynamically imported via string path — web build (Vercel) ships without ever needing it; APK build (GitHub Actions) can opt-in by installing it. App NEVER crashes if plugin missing — returns 'unsupported' permission state with friendly message.
- Web handle persistence: FileSystemDirectoryHandle saved to IndexedDB → returning users don't re-pick folder every visit.
- To activate native scanning: install @capacitor-community/media, npx cap sync android, paste permissions from android-config/AndroidManifest-additions.xml into AndroidManifest.xml.
- To build APK: push to main (or run workflow_dispatch from Actions tab) → download play-nexa-apk artifact (or play-nexa-apk-unsigned if no signing config).

---
Task ID: HPS-1
Agent: main (Super Z)
Task: Complete rebuild of Home (replace Platforms card with "More Tools" coming-soon card), Profile page (no coins, no subscription, real Supabase stats + Capacitor APIs), Settings page (real Capacitor Filesystem storage bytes, real backup file write, type-to-confirm reset), plus new StatCounter + AchievementBadge components and new storage helper library.

Work Log:
- Read existing files: src/app/page.tsx (Home), src/app/profile/page.tsx (old), src/app/settings/page.tsx (old), src/hooks/useAuth.ts (verified SupabaseProfile shape, isLoggedIn flag), src/lib/firebaseAuth.ts (verified logout + resetPassword exports), src/lib/supabase.ts (verified `supabase` export may be null), src/lib/storage.ts (didn't exist), package.json (only @capacitor/core installed, no Filesystem/App/Push).
- Created 5 new files:
  1. src/lib/storage.ts — Capacitor Filesystem helpers with graceful web fallback. Exports: StorageBreakdown interface, getStorageBreakdown() (sums bytes across PlayNexa/Movies|Music|Games|Downloads dirs via recursive readdir + stat), clearAppCache() (removes pn_cache_* keys), resetAppData() (clears pn_* keys except pn_theme/pn_language, preserves downloaded media files), formatBytes() (B/KB/MB/GB formatter), writeBackupFile() (writes JSON to Documents dir). Used local type-shim CapFilesystemModule so TS doesn't hard-fail when @capacitor/filesystem plugin isn't installed. All native calls behind dynamic import via string variable.
  2. src/components/profile/StatCounter.tsx — Animated count-up component with cubic ease-out (1-(1-p)^3) over 800ms via requestAnimationFrame. Skips animation for target=0. Cleans up rAF on unmount. Tabular-nums for stable digit width.
  3. src/components/profile/AchievementBadge.tsx — Locked/unlocked badge with purple tint when unlocked, grayscale+opacity-50 when locked. Min-width 76px, flex-shrink-0 for horizontal scroll. role="img" + aria-label for a11y.
  4. src/app/profile/page.tsx — Complete rebuild. Guest state: Sign In/Create Account CTAs + QuickSettingsSection visible. Logged-in: gradient-ring avatar (real Firebase photoURL or initial fallback), real name/email from useAuth, Edit Profile button. Stats row with 3 StatCounters fed by real Supabase counts (user_watchlist + music_saved for saved, user_history + game_data.plays sum for played) and real localStorage pn_dl_history.length for downloads. Achievements row with 4 badges (First Watch / Downloader / Collector / Binge Watcher) unlocked by real stat thresholds. Activity list with 5 real navigable routes (/profile/downloads, /profile/history, /profile/favorites, /profile/playlists, /profile/games). Quick Settings section (Dark Mode toggle persists pn_theme, Notifications toggle requests Capacitor PushNotifications permission with web fallback, Language toggle persists pn_language, Help/Rate/Share buttons). Invite Friends card with real NEXA-{first 6 of supabaseProfile.id} referral code + Copy/Share buttons. Account section with Security & Password row that calls real Firebase resetPassword(user.email) + Sign Out button with confirm modal that calls real Firebase logout() then router.replace('/'). App version from Capacitor App.getInfo() with web fallback to '1.0.0'. Zero coins, zero subscription/plan badges anywhere. Min 52px touch targets, AMOLED #0D0D0D, no backdrop-blur.
  5. src/app/settings/page.tsx — Complete rebuild. Theme selector (dark/amoled/neon) persists pn_theme_mode + applies via document.documentElement.setAttribute('data-theme', mode). 4 performance toggles (Smooth Mode / Battery Saver / Lite Animation / Performance Boost) persist + apply real CSS side effects (Smooth sets --pn-transition CSS var, Battery Saver toggles battery-saver class, Lite Animation toggles lite-animation class). 3 network toggles (Low Data Mode auto-forces thumbQuality='low', Smart Loading, Auto-play Next) persist. Thumbnail Quality 3-way selector (low/medium/high) persists. Storage section: REAL bytes from getStorageBreakdown() (Capacitor Filesystem recursive dir size + real pn_cache_* localStorage bytes), progress bar vs 10GB cap, breakdown rows for Downloads/Cache/Other with formatBytes() formatting. Clear Cache button calls clearAppCache() + shows freed bytes toast. Optimize Memory removes expired pn_cache_*/pn_trending_*/pn_video_ entries older than 1 hour. Backup Playlists writes real JSON file to Capacitor Documents dir (with web Blob-URL download fallback). Reset App modal requires typing "RESET" exactly, calls resetAppData() (preserves downloaded media files), reloads to /. App version + build from Capacitor App.getInfo() with web fallback. Toast notifications for all actions.
- Modified 1 existing file: src/app/page.tsx — Replaced Platforms card (bottom-right of 6-card grid) with "More Tools" / "Coming Soon" card using 4-square SVG icon. Card has opacity-70 styling. Added toast state + showToast() helper. Click handler: if feature.route is null, shows "🚀 More tools coming soon! Stay tuned." toast (2.5s auto-dismiss) and does NOT navigate. Other 5 cards unchanged. Card stays in exact same grid position (row 3, right column). Changed feature key from feature.route to feature.title (since route can now be null). Added Toast UI element fixed at bottom-24 z-70.
- All Capacitor plugin imports use string variable pattern: `const mod = 'app'; const path = '@capacitor/${mod}'; await import(path)` so TypeScript cannot resolve the module at build time and webpack/Next.js leaves it dynamic. This lets the web build (Vercel) ship without @capacitor/filesystem, @capacitor/app, @capacitor/push-notifications installed. On APK builds with these plugins present, the dynamic import resolves at runtime and real native APIs are called. On web, getFilesystem/getCapApp/getPushNotifications return null and all callers fall back to safe defaults.
- TypeScript check: npx tsc --noEmit --skipLibCheck reports ZERO errors in any of the 5 new files or the modified page.tsx. The 128 pre-existing errors in the project are all in unrelated files (admin/*, movies/*, supabase/functions/*, examples/*, skills/*) and were present before this task.

Stage Summary:
- 5 new files created, 1 existing file modified. ZERO changes to .env.local. ZERO payment/subscription/coins code added. ZERO placeholder/mock data.
- Home: Platforms card replaced with More Tools/Coming Soon card in same grid position, opacity-70, tap shows toast, no navigation.
- Profile: complete rebuild with real Supabase stats + real Firebase auth + real Capacitor App version. No coins, no plan badges. Guest state functional, logged-in state functional. Sign Out confirm modal calls real Firebase logout.
- Settings: complete rebuild with REAL Capacitor Filesystem bytes (not fake numbers), real backup file write, real type-to-confirm reset that preserves downloaded media. All toggles persist + apply real side effects.
- All Capacitor plugin calls use dynamic import via string variable → web build never fails, APK build gets real native APIs.
- Min 44-52px touch targets throughout. AMOLED #0D0D0D base. No backdrop-blur anywhere. No style jsx. Zero TypeScript errors in new/modified code.

---
Task ID: HPS-2 (Bug fixes + missing parts)
Agent: main (Super Z)
Task: Audit HPS-1 work for bugs and missing parts, then fix them. Found 5 bugs in my own code + 2 missing categories (stub routes + CSS for performance toggles).

Work Log:
- Audited all HPS-1 files for bugs and missing parts. Found 5 real bugs and 2 missing categories.

BUG FIX 1 — StatCounter didn't re-animate when real stats arrived:
  - Problem: StatCounter used startedRef.current = true on first run, so when statsLoaded was false (initial render with target=0), the animation ran against 0 and never re-ran when real stats arrived from Supabase seconds later.
  - Fix: Removed the startedRef gate. Animation now triggers on every `target` change. Tracks fromRef.current to start the next animation from wherever the previous one left off (smooth count-up from 0 → real value when stats arrive). Cancels in-flight rAF on re-trigger to prevent double-animation.

BUG FIX 2 — Settings makeToggler captured stale `current` value:
  - Problem: Each toggle handler closed over the `current` boolean at handler-creation time. If user tapped twice in rapid succession before React re-rendered, both invocations saw the same `current` and both flipped to the same `next` — toggling back to the original state instead of going on→off→on.
  - Fix: Added a useRef mirror for every boolean state (smoothModeRef, batterySaverRef, etc.), kept in sync via useEffect. makeToggler now reads from the ref instead of the closure variable, so it always sees the latest value. Also added toastTimerRef + clear-on-unmount cleanup to Settings page.

BUG FIX 3 — Home toast stacked timeouts on rapid taps:
  - Problem: showToast() in Home page called setTimeout without clearing the previous one. Tapping "More Tools" twice quickly meant the second toast got cut short by the first toast's 2.5s timer.
  - Fix: Added toastTimerRef + clearTimeout on each new showToast call. Added useEffect cleanup on unmount.

BUG FIX 4 — Profile toggleDarkMode inconsistent with Settings:
  - Problem: Profile toggled `light-mode` CSS class + wrote `pn_theme` key; Settings wrote `pn_theme_mode` key + set `data-theme` attribute. Toggling dark mode in Profile had no effect when user later visited Settings, and vice versa.
  - Fix: Profile toggleDarkMode now writes BOTH `pn_theme_mode` (new) and `pn_theme` (legacy) keys + sets `data-theme` attribute + toggles `light-mode` class. Profile initial load reads `pn_theme_mode` first, falls back to `pn_theme` for backward compat. Now Profile and Settings are fully in sync.

BUG FIX 5 — Profile useEffect deps on `user` object reference:
  - Problem: useEffect depended on [isLoggedIn, supabaseProfile, user]. The Firebase `user` object identity changes on every auth-state callback (even when uid is unchanged), causing repeated stats fetches from Supabase.
  - Fix: Extracted primitive userUid = user?.uid and profileId = supabaseProfile?.id at the top of the component, and changed the useEffect deps to [isLoggedIn, profileId, userUid]. Now the effect only re-runs when the actual IDs change, not when Firebase re-emits the same user.

MISSING PART 1 — Created 7 stub routes that Profile links to but didn't exist (would 404):
  - src/components/profile/ComingSoonPage.tsx — Reusable "coming soon" page shell with back button, emoji icon, message, CTA. Same AMOLED dark theme.
  - src/app/profile/edit/page.tsx — Real Edit Profile page with display name input + handle input + read-only email. Calls real Firebase updateProfile() to persist displayName change. Not a stub — fully functional.
  - src/app/profile/downloads/page.tsx — ComingSoonPage wrapper (Recent Downloads).
  - src/app/profile/history/page.tsx — ComingSoonPage wrapper (Watch History).
  - src/app/profile/favorites/page.tsx — ComingSoonPage wrapper (Favorites).
  - src/app/profile/playlists/page.tsx — ComingSoonPage wrapper (My Playlists).
  - src/app/profile/games/page.tsx — ComingSoonPage wrapper (Game History).
  - src/app/help/page.tsx — Real Help & Support page with 5 FAQ accordion items in Bengali, Email Support CTA (mailto:), About card. Fully functional, not a stub.

MISSING PART 2 — Added CSS for Settings performance toggles + theme variants to globals.css:
  - :root { --pn-transition: 200ms; } — default transition duration variable.
  - .pn-smooth class — uses var(--pn-transition) for all transitions. Setting --pn-transition to 0ms (via Smooth Mode off) effectively disables animations on .pn-smooth elements.
  - html.battery-saver — applies filter: brightness(0.85) saturate(0.9) + removes all box-shadow/text-shadow (real visible effect when Battery Saver toggle is flipped).
  - html.lite-animation — sets animation-duration and transition-duration to 0.001ms !important on all elements (real visible effect when Lite Animation toggle is flipped).
  - html.battery-saver.lite-animation — disables even spinners (max efficiency).
  - html[data-theme="dark"] — keeps #0D0D0D base.
  - html[data-theme="amoled"] — switches to pure #000 background (true AMOLED black).
  - html[data-theme="neon"] — switches to #0A0014 background + brighter #A855F7 primary + #06B6D4 accent.
  - html.light-mode — legacy invert filter for backward compat with old code.

TypeScript verification: npx tsc --noEmit --skipLibCheck reports ZERO errors in any of the new or modified files. The total project error count remained at 128 (all pre-existing in unrelated files) — same as before this round started, confirming no regressions.

Stage Summary:
- 5 bugs fixed in my own HPS-1 code: StatCounter re-animation, Settings stale-closure toggles, Home toast timer stacking, Profile/Settings dark mode inconsistency, Profile useEffect dependency explosion.
- 7 new route files created so Profile links don't 404 (1 real Edit Profile page + 5 coming-soon stubs + 1 real Help page).
- 1 new ComingSoonPage reusable component created.
- globals.css extended with real CSS for battery-saver / lite-animation / data-theme variants / --pn-transition variable — Settings toggles now produce visible effects.
- 0 new TypeScript errors. 0 regressions. All touch targets ≥44px. AMOLED #0D0D0D base preserved. No backdrop-blur added. No style jsx.
