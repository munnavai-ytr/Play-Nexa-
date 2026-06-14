---
Task ID: 1
Agent: main
Task: Firebase Auth Login System (VidMate-style) + Preview Fix

Work Log:
- Updated firebaseAuth.ts with Apple Sign-In (OAuthProvider), Guest/Anonymous login (signInAnonymously), and guest upgrade functions (upgradeGuestWithEmail, upgradeGuestWithGoogle, upgradeGuestWithApple)
- Updated useAuth.ts hook with isGuest flag for guest user detection
- Rebuilt /auth/login/page.tsx as VidMate-style with 4 login options: Google, Email, Guest, Apple
- Rebuilt /auth/signup/page.tsx with Google + Apple social login buttons
- Updated /profile/page.tsx to support guest users - no longer blocks non-logged-in users, shows upgrade prompt for guests, login prompt for unauthenticated users
- Added Guest Upgrade Modal with Google, Apple, and Email upgrade options
- Built Next.js project successfully (zero errors)
- Started production server on port 3000, verified all pages return HTTP 200

Stage Summary:
- Firebase Auth now supports: Google, Email/Password, Apple, Guest (anonymous) login
- Guest users can use the app freely without login (like VidMate)
- Guest users can upgrade their account from Profile page (Google/Apple/Email)
- Profile page shows guest badge and upgrade prompt
- Server is running at http://127.0.0.1:3000/
- All auth pages working: /auth/login, /auth/signup, /auth/reset, /profile
