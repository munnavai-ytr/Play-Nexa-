// src/app/profile/page.tsx
// ============================================================================
// Play Nexa — Profile page (complete rebuild)
//
// - NO coins, NO subscription tiers anywhere — this is a 100% free app.
// - Guest state: Sign In / Create Account CTAs + quick settings visible.
// - Logged-in: gradient-ring avatar, count-up stats from real Supabase
//   counts + localStorage download log, achievements computed from real
//   thresholds, activity list with 5 real navigable routes, quick
//   settings (Dark Mode / Notifications / Language / Help / Rate / Share),
//   invite friends with real generated referral code + copy/share,
//   Security row that triggers real Firebase resetPassword, Sign Out
//   with confirm modal that calls real Firebase logout.
// - App version pulled from Capacitor App.getInfo() with web fallback.
// - Min 44px touch targets, AMOLED dark base (#0D0D0D), no backdrop-blur.
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { logout, resetPassword } from '@/lib/firebaseAuth';
import { supabase } from '@/lib/supabase';
import StatCounter from '@/components/profile/StatCounter';
import AchievementBadge from '@/components/profile/AchievementBadge';

// Lazy-load Capacitor App plugin (not installed in web build).
async function getCapApp(): Promise<{
  getInfo: () => Promise<{ version: string; build: string }>;
} | null> {
  try {
    if (typeof window === 'undefined') return null;
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (!cap?.isNativePlatform?.()) return null;
    // String variable so TS/bundler can't resolve the module at build time.
    const mod = 'app';
    const path = `@capacitor/${mod}`;
    const imported = await import(/* webpackIgnore: true */ /* @vite-ignore */ path);
    return imported.App as unknown as {
      getInfo: () => Promise<{ version: string; build: string }>;
    };
  } catch {
    return null;
  }
}

// Lazy-load Capacitor Push Notifications plugin.
async function getPushNotifications(): Promise<{
  requestPermissions: () => Promise<{ receive: 'granted' | 'denied' }>;
  register: () => Promise<void>;
} | null> {
  try {
    if (typeof window === 'undefined') return null;
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (!cap?.isNativePlatform?.()) return null;
    const mod = 'push-notifications';
    const path = `@capacitor/${mod}`;
    const imported = await import(/* webpackIgnore: true */ /* @vite-ignore */ path);
    return imported.PushNotifications as unknown as {
      requestPermissions: () => Promise<{ receive: 'granted' | 'denied' }>;
      register: () => Promise<void>;
    };
  } catch {
    return null;
  }
}

interface ProfileStats {
  downloads: number;
  saved: number;
  played: number;
}

interface QuickSettingsProps {
  darkMode: boolean;
  onToggleDark: () => void;
  notifEnabled: boolean;
  onToggleNotif: () => void;
  language: 'bn' | 'en';
  onToggleLanguage: () => void;
  onRate: () => void;
  onShare: () => void;
  router: ReturnType<typeof useRouter>;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, supabaseProfile, isLoading, isLoggedIn } = useAuth();

  const [stats, setStats] = useState<ProfileStats>({
    downloads: 0,
    saved: 0,
    played: 0,
  });
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [language, setLanguage] = useState<'bn' | 'en'>('bn');
  const [appVersion, setAppVersion] = useState('1.0.0');

  // ----------------------------------------------------------------------
  // Load real stats from Supabase + localStorage download log.
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!isLoggedIn || !supabaseProfile) {
      setStatsLoaded(true);
      return;
    }

    const loadStats = async () => {
      const authUserId = user?.uid;
      if (!supabase) {
        setStatsLoaded(true);
        return;
      }

      try {
        const [
          watchlistRes,
          musicSavedRes,
          historyRes,
          gameDataRes,
        ] = await Promise.all([
          supabase
            .from('user_watchlist')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', authUserId),
          supabase
            .from('music_saved')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', authUserId),
          supabase
            .from('user_history')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', authUserId),
          supabase
            .from('game_data')
            .select('plays')
            .eq('user_id', supabaseProfile.id),
        ]);

        const watchlistCount = watchlistRes.count || 0;
        const musicSavedCount = musicSavedRes.count || 0;
        const historyCount = historyRes.count || 0;
        const gameData = (gameDataRes.data ?? []) as Array<{ plays?: number }>;
        const totalGamePlays = gameData.reduce(
          (sum, g) => sum + (g.plays || 0),
          0
        );

        // Real download count from localStorage download history log.
        let downloadCount = 0;
        try {
          const dlLog = JSON.parse(
            localStorage.getItem('pn_dl_history') || '[]'
          );
          downloadCount = Array.isArray(dlLog) ? dlLog.length : 0;
        } catch {
          downloadCount = 0;
        }

        setStats({
          downloads: downloadCount,
          saved: (watchlistCount || 0) + (musicSavedCount || 0),
          played: (historyCount || 0) + totalGamePlays,
        });
      } catch {
        // Fall back to localStorage-only count if Supabase is unreachable.
        let downloadCount = 0;
        try {
          const dlLog = JSON.parse(
            localStorage.getItem('pn_dl_history') || '[]'
          );
          downloadCount = Array.isArray(dlLog) ? dlLog.length : 0;
        } catch {
          /* swallow */
        }
        setStats({
          downloads: downloadCount,
          saved: 0,
          played: 0,
        });
      } finally {
        setStatsLoaded(true);
      }
    };

    void loadStats();
  }, [isLoggedIn, supabaseProfile, user]);

  // ----------------------------------------------------------------------
  // Load preferences + app version on mount.
  // ----------------------------------------------------------------------
  useEffect(() => {
    try {
      const theme = localStorage.getItem('pn_theme');
      setDarkMode(theme !== 'light');
      const lang = localStorage.getItem('pn_language') as 'bn' | 'en' | null;
      setLanguage(lang || 'bn');
    } catch {
      /* swallow */
    }

    getCapApp()
      .then((app) => app?.getInfo())
      .then((info) => {
        if (info?.version) setAppVersion(info.version);
      })
      .catch(() => {
        /* web fallback — keep '1.0.0' */
      });
  }, []);

  // ----------------------------------------------------------------------
  // Achievements — computed from real stat thresholds.
  // ----------------------------------------------------------------------
  const achievements = [
    {
      key: 'first_watch',
      emoji: '🎬',
      label: 'First Watch',
      unlocked: stats.played >= 1,
    },
    {
      key: 'downloader',
      emoji: '📥',
      label: 'Downloader',
      unlocked: stats.downloads >= 5,
    },
    {
      key: 'collector',
      emoji: '🔖',
      label: 'Collector',
      unlocked: stats.saved >= 10,
    },
    {
      key: 'binge_watcher',
      emoji: '🍿',
      label: 'Binge Watcher',
      unlocked: stats.played >= 25,
    },
  ];

  // ----------------------------------------------------------------------
  // Toggles & actions.
  // ----------------------------------------------------------------------
  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    try {
      localStorage.setItem('pn_theme', next ? 'dark' : 'light');
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('light-mode', !next);
      }
    } catch {
      /* swallow */
    }
  };

  const toggleNotifications = async () => {
    if (!notifEnabled) {
      const push = await getPushNotifications();
      if (push) {
        try {
          const perm = await push.requestPermissions();
          if (perm.receive === 'granted') {
            await push.register();
            setNotifEnabled(true);
          }
        } catch {
          /* swallow */
        }
      } else {
        // Web fallback — just remember the preference.
        setNotifEnabled(true);
      }
    } else {
      setNotifEnabled(false);
    }
  };

  const toggleLanguage = () => {
    const next = language === 'bn' ? 'en' : 'bn';
    setLanguage(next);
    try {
      localStorage.setItem('pn_language', next);
    } catch {
      /* swallow */
    }
  };

  const handleRateApp = () => {
    const playStoreUrl =
      'https://play.google.com/store/apps/details?id=com.playnexa.app';
    if (typeof window !== 'undefined') {
      window.open(playStoreUrl, '_blank');
    }
  };

  const handleShareApp = async () => {
    const shareData = {
      title: 'Play Nexa',
      text: 'Check out Play Nexa — your ultimate media universe! Movies, music, games, all free.',
      url: 'https://play.google.com/store/apps/details?id=com.playnexa.app',
    };
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData);
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url);
      }
    } catch {
      /* swallow user-cancel */
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch {
      /* swallow */
    }
    setShowLogoutConfirm(false);
    router.replace('/');
  };

  const referralCode = supabaseProfile?.id
    ? 'NEXA-' + supabaseProfile.id.slice(0, 6).toUpperCase()
    : '';

  const handleCopyReferral = () => {
    try {
      navigator.clipboard?.writeText(referralCode);
    } catch {
      /* swallow */
    }
  };

  const handleShareReferral = async () => {
    const text =
      `Join me on Play Nexa! Use my code ${referralCode} 🎬🎵🎮 ` +
      `https://play.google.com/store/apps/details?id=com.playnexa.app`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      /* swallow */
    }
  };

  const handleResetPassword = async () => {
    if (user?.email) {
      try {
        await resetPassword(user.email);
      } catch {
        /* swallow */
      }
    }
  };

  // ----------------------------------------------------------------------
  // Loading state.
  // ----------------------------------------------------------------------
  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-[#0D0D0D] flex items-center justify-center"
        role="status"
        aria-label="Loading profile"
      >
        <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-24">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-white font-bold text-xl">Profile</h1>
      </div>

      {/* GUEST STATE */}
      {!isLoggedIn ? (
        <div className="px-5">
          <div className="bg-[#141414] border border-[#1E1E1E] rounded-2xl p-6 text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-[#7C3AED]/15 flex items-center justify-center mx-auto mb-4">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7C3AED"
                strokeWidth="2"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 className="text-white font-bold text-lg mb-2">
              Sign In to Unlock More
            </h2>
            <p className="text-[#9CA3AF] text-sm leading-relaxed mb-6">
              তোমার watchlist, history আর liked movies save করতে sign in করো
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push('/auth/login')}
                className="w-full h-12 bg-[#7C3AED] rounded-xl text-white font-semibold text-sm active:opacity-80"
              >
                Sign In
              </button>
              <button
                onClick={() => router.push('/auth/signup')}
                className="w-full h-12 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl text-white font-semibold text-sm active:opacity-80"
              >
                Create Account
              </button>
            </div>
          </div>

          {/* Quick settings still usable for guests */}
          <QuickSettingsSection
            darkMode={darkMode}
            onToggleDark={toggleDarkMode}
            notifEnabled={notifEnabled}
            onToggleNotif={toggleNotifications}
            language={language}
            onToggleLanguage={toggleLanguage}
            onRate={handleRateApp}
            onShare={handleShareApp}
            router={router}
          />

          <p className="text-center text-[#4B5563] text-xs mt-8">
            Play Nexa v{appVersion} • Made with ❤️
          </p>
        </div>
      ) : (
        /* LOGGED-IN STATE */
        <div className="px-5">
          {/* Avatar + Name */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="w-20 h-20 rounded-full p-[3px] mb-3"
              style={{
                background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
              }}
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  className="w-full h-full rounded-full object-cover border-2 border-[#0D0D0D]"
                  alt="Avatar"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-[#0D0D0D] flex items-center justify-center text-white text-2xl font-bold">
                  {(user?.displayName ||
                    supabaseProfile?.display_name ||
                    'U')[0].toUpperCase()}
                </div>
              )}
            </div>
            <p className="text-white font-bold text-lg">
              {user?.displayName ||
                supabaseProfile?.display_name ||
                'Play Nexa User'}
            </p>
            <p className="text-[#9CA3AF] text-xs mt-0.5">{user?.email}</p>
            <button
              onClick={() => router.push('/profile/edit')}
              className="mt-3 px-5 py-2 bg-[#1A1A1A] border border-[#2D2D2D] rounded-full text-white text-xs font-medium min-h-[36px] active:opacity-80"
            >
              Edit Profile
            </button>
          </div>

          {/* Stats Row */}
          <div className="flex bg-[#141414] border border-[#1E1E1E] rounded-2xl py-4 mb-6">
            {statsLoaded ? (
              <>
                <StatCounter target={stats.downloads} label="Downloads" />
                <div className="w-px bg-[#1E1E1E]" />
                <StatCounter target={stats.saved} label="Saved" />
                <div className="w-px bg-[#1E1E1E]" />
                <StatCounter target={stats.played} label="Played" />
              </>
            ) : (
              <div className="flex-1 flex justify-center py-2">
                <div className="w-5 h-5 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Achievements */}
          <div className="mb-6">
            <p className="text-white font-semibold text-sm mb-3">
              🏆 Achievements
            </p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {achievements.map((a) => (
                <AchievementBadge
                  key={a.key}
                  emoji={a.emoji}
                  label={a.label}
                  unlocked={a.unlocked}
                />
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="mb-6">
            <p className="text-white font-semibold text-sm mb-3">Activity</p>
            <div className="bg-[#141414] border border-[#1E1E1E] rounded-2xl overflow-hidden">
              {(
                [
                  {
                    emoji: '📥',
                    label: 'Recent Downloads',
                    route: '/profile/downloads',
                  },
                  {
                    emoji: '📜',
                    label: 'Watch History',
                    route: '/profile/history',
                  },
                  {
                    emoji: '❤️',
                    label: 'Favorites',
                    route: '/profile/favorites',
                  },
                  {
                    emoji: '🎵',
                    label: 'My Playlists',
                    route: '/profile/playlists',
                  },
                  {
                    emoji: '🎮',
                    label: 'Game History',
                    route: '/profile/games',
                  },
                ] as Array<{ emoji: string; label: string; route: string }>
              ).map((item, i, arr) => (
                <button
                  key={item.route}
                  onClick={() => router.push(item.route)}
                  className={`w-full flex items-center gap-3 px-4 min-h-[52px] active:bg-[#1A1A1A] ${
                    i < arr.length - 1 ? 'border-b border-[#1E1E1E]' : ''
                  }`}
                >
                  <span className="text-lg">{item.emoji}</span>
                  <span className="flex-1 text-left text-white text-sm">
                    {item.label}
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6B7280"
                    strokeWidth="2"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Settings */}
          <QuickSettingsSection
            darkMode={darkMode}
            onToggleDark={toggleDarkMode}
            notifEnabled={notifEnabled}
            onToggleNotif={toggleNotifications}
            language={language}
            onToggleLanguage={toggleLanguage}
            onRate={handleRateApp}
            onShare={handleShareApp}
            router={router}
          />

          {/* Invite Friends */}
          <div className="bg-[#141414] border border-[#1E1E1E] rounded-2xl p-4 mt-6">
            <p className="text-white font-semibold text-sm mb-1">
              🎁 Invite Friends
            </p>
            <p className="text-[#9CA3AF] text-xs mb-3">
              Your code:{' '}
              <span className="text-[#7C3AED] font-mono">{referralCode}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCopyReferral}
                className="flex-1 h-10 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl text-white text-xs font-medium active:opacity-80"
              >
                📋 Copy
              </button>
              <button
                onClick={handleShareReferral}
                className="flex-1 h-10 bg-[#7C3AED] rounded-xl text-white text-xs font-medium active:opacity-80"
              >
                📤 Share
              </button>
            </div>
          </div>

          {/* Account */}
          <div className="mt-6">
            <p className="text-white font-semibold text-sm mb-3">Account</p>
            <div className="bg-[#141414] border border-[#1E1E1E] rounded-2xl overflow-hidden mb-3">
              <button
                onClick={handleResetPassword}
                className="w-full flex items-center gap-3 px-4 min-h-[52px] active:bg-[#1A1A1A]"
              >
                <span className="text-lg">🔐</span>
                <span className="flex-1 text-left text-white text-sm">
                  Security &amp; Password
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#6B7280"
                  strokeWidth="2"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full h-12 bg-red-900/20 border border-red-700/40 rounded-xl text-red-400 font-semibold text-sm active:opacity-80"
            >
              Sign Out
            </button>
          </div>

          <p className="text-center text-[#4B5563] text-xs mt-8">
            Play Nexa v{appVersion} • Made with ❤️
          </p>
        </div>
      )}

      {/* Logout Confirm Modal */}
      {showLogoutConfirm && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/70"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[61] bg-[#141414] rounded-t-2xl p-6 pb-10 border-t border-[#1E1E1E]">
            <div className="w-10 h-1 bg-[#2D2D2D] rounded-full mx-auto mb-5" />
            <p className="text-white font-bold text-base mb-2 text-center">
              Sign out from Play Nexa?
            </p>
            <p className="text-[#9CA3AF] text-sm text-center mb-6">
              তোমার data save থাকবে, পরে আবার sign in করতে পারবে
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 h-12 bg-[#1A1A1A] border border-[#2D2D2D] rounded-xl text-white text-sm font-medium active:opacity-80"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="flex-1 h-12 bg-red-700 rounded-xl text-white text-sm font-semibold active:opacity-80"
              >
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable Quick Settings section.
// ---------------------------------------------------------------------------
function QuickSettingsSection({
  darkMode,
  onToggleDark,
  notifEnabled,
  onToggleNotif,
  language,
  onToggleLanguage,
  onRate,
  onShare,
  router,
}: QuickSettingsProps) {
  return (
    <div>
      <p className="text-white font-semibold text-sm mb-3">Quick Settings</p>
      <div className="bg-[#141414] border border-[#1E1E1E] rounded-2xl overflow-hidden">
        {/* Dark Mode */}
        <div className="flex items-center gap-3 px-4 min-h-[52px] border-b border-[#1E1E1E]">
          <span className="text-lg">🌙</span>
          <span className="flex-1 text-white text-sm">Dark Mode</span>
          <Toggle checked={darkMode} onChange={onToggleDark} />
        </div>

        {/* Notifications */}
        <div className="flex items-center gap-3 px-4 min-h-[52px] border-b border-[#1E1E1E]">
          <span className="text-lg">🔔</span>
          <span className="flex-1 text-white text-sm">Notifications</span>
          <Toggle checked={notifEnabled} onChange={onToggleNotif} />
        </div>

        {/* Language */}
        <button
          onClick={onToggleLanguage}
          className="w-full flex items-center gap-3 px-4 min-h-[52px] border-b border-[#1E1E1E] active:bg-[#1A1A1A]"
        >
          <span className="text-lg">🌐</span>
          <span className="flex-1 text-left text-white text-sm">Language</span>
          <span className="text-[#7C3AED] text-xs font-semibold">
            {language === 'bn' ? 'বাংলা' : 'English'}
          </span>
        </button>

        {/* Help & Support */}
        <button
          onClick={() => router.push('/help')}
          className="w-full flex items-center gap-3 px-4 min-h-[52px] border-b border-[#1E1E1E] active:bg-[#1A1A1A]"
        >
          <span className="text-lg">❓</span>
          <span className="flex-1 text-left text-white text-sm">
            Help &amp; Support
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6B7280"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* Rate */}
        <button
          onClick={onRate}
          className="w-full flex items-center gap-3 px-4 min-h-[52px] border-b border-[#1E1E1E] active:bg-[#1A1A1A]"
        >
          <span className="text-lg">⭐</span>
          <span className="flex-1 text-left text-white text-sm">
            Rate Play Nexa
          </span>
        </button>

        {/* Share */}
        <button
          onClick={onShare}
          className="w-full flex items-center gap-3 px-4 min-h-[52px] active:bg-[#1A1A1A]"
        >
          <span className="text-lg">📤</span>
          <span className="flex-1 text-left text-white text-sm">Share App</span>
        </button>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${
        checked ? 'bg-[#7C3AED]' : 'bg-[#2D2D2D]'
      }`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${
          checked ? 'left-5' : 'left-0.5'
        }`}
      />
    </button>
  );
}
