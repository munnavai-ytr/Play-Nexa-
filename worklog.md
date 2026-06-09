---
Task ID: 1
Agent: Super Z (main)
Task: Remove Security Suite & Restore Clean Profile Page

Work Log:
- Read all 5 main target files (profile/page.tsx, settings/page.tsx, layout.tsx, settings.ts, local/page.tsx) plus all security components
- Mapped full dependency graph: disguise-context → app-lock-store → security-idb → native-bridge → AppLock → CalculatorDisguise → DisguiseWrapper → DisguiseProvider
- Identified SafeFolderModal usage in local/page.tsx and onMoveToSafe in VideoGridView + MusicListView
- Confirmed idb-store.ts and safe-store.ts only used by PrivateLocker (safe to delete)
- Confirmed StealthPlayer is a movie player component, not security (kept)
- Confirmed native-bridge.ts is only used by security features (safe to delete)

Profile Page Changes:
- Removed `Lock` import from lucide-react
- Removed `PrivateLocker` import
- Removed `showPrivateLocker` state
- Removed entire "Privacy" section with Private Folder button
- Removed PrivateLocker overlay rendering

Settings Page Changes:
- Removed `Shield, Eye, Paintbrush, Smartphone` imports from lucide-react
- Removed `AppLock`, `AppLookCustomizer`, `useDisguise`, `loadLockConfig`, `saveLockConfig` imports
- Removed "Security" section (safeRedirect, externalWarning, secureBrowser toggles)
- Removed "System Apps Manager" section (with Lock/Hide/Disguise badges)
- Removed "App Lock & Pattern" section
- Removed "App Hide — Disguise Mode" section
- Removed "App Icon & Label Customizer" section
- Removed `DisguiseSection` component function entirely

Layout Changes:
- Removed `DisguiseProvider` import and JSX wrapper
- Removed `DisguiseWrapper` import and JSX wrapper
- Children now render directly inside `<body>`

Settings Type Changes (settings.ts):
- Removed `safeRedirect`, `externalWarning`, `secureBrowser` from `PlayNexaSettings` interface
- Removed those fields from `DEFAULT_SETTINGS`

Local Page Changes:
- Removed `Shield` import from lucide-react
- Removed `SafeFolderModal` import
- Removed `showSafeFolder` and `safeFolderItem` state
- Removed `handleMoveToSafeVideo` and `handleMoveToSafeTrack` callbacks
- Removed Safe Folder button from control bar
- Removed SafeFolderModal rendering block
- Removed `onMoveToSafe` prop from VideoGridView and MusicListView

VideoGridView Changes:
- Removed `Shield` import
- Removed `onMoveToSafe` from props interface
- Removed "Move to Safe" menu item from context menu

MusicListView Changes:
- Removed `Shield` import
- Removed `onMoveToSafe` from props interface
- Removed "Move to Safe" menu item from context menu

Deleted Files (18 total):
Components:
- src/components/settings/AppLock.tsx
- src/components/settings/AppLookCustomizer.tsx
- src/components/settings/CalculatorDisguise.tsx
- src/components/profile/PrivateLocker.tsx
- src/components/layout/DisguiseWrapper.tsx
- src/components/security/AppLockOverlay.tsx
- src/components/security/SystemAppsManager.tsx
- src/components/security/IconChangerModal.tsx
- src/components/local/SafeFolder.tsx
- src/components/local/SafeFolderModal.tsx
- src/components/local/PinDial.tsx

Lib:
- src/lib/disguise-context.tsx
- src/lib/app-lock-store.ts
- src/lib/app-security-store.ts
- src/lib/security-idb.ts
- src/lib/safe-store.ts
- src/lib/idb-store.ts
- src/lib/native-bridge.ts

Pages:
- src/app/security/page.tsx

Directories removed:
- src/components/security/
- src/app/security/

Verification:
- TypeScript compilation: Zero errors in any changed files
- Dev server: Starts successfully in 553ms
- No remaining imports referencing deleted modules (grep verified)

Stage Summary:
- All 4 security features completely removed: Calculator Disguise, Global App Lock, Icon Changer, Private Media Vault
- Profile page restored to clean state: avatar, stats, activity, quick settings, rate/share
- Settings page restored to clean state: appearance, performance, network, storage
- No broken imports or state errors remain
- Core Profile, BottomNav, Movie Hub, and base Video/Music players untouched and functional
