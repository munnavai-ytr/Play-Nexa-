'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  ChevronRight,
  Moon,
  Bell,
  HelpCircle,
  Star,
  Share2,
} from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import { Badge } from '@/components/ui/Badge';
import { GlowCard } from '@/components/ui/GlowCard';

interface ActivityItem {
  icon: React.ReactNode;
  label: string;
  href?: string;
}

const activities: ActivityItem[] = [
  { icon: '📥', label: 'Recent Downloads', href: '/download' },
  { icon: '🎬', label: 'Watch History' },
  { icon: '❤️', label: 'Favorites' },
  { icon: '🎵', label: 'My Playlists', href: '/music' },
  { icon: '🎮', label: 'Game History', href: '/games' },
];

export default function ProfilePage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('grovix_dark_mode');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('grovix_notifications');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleDarkMode = useCallback(() => {
    const next = !darkMode;
    setDarkMode(next);
    try {
      localStorage.setItem('grovix_dark_mode', String(next));
    } catch {
      // ignore
    }
  }, [darkMode]);

  const toggleNotifications = useCallback(() => {
    const next = !notifications;
    setNotifications(next);
    try {
      localStorage.setItem('grovix_notifications', String(next));
    } catch {
      // ignore
    }
  }, [notifications]);

  const stats = [
    { label: 'Downloads', value: 24 },
    { label: 'Saved', value: 12 },
    { label: 'Played', value: 8 },
  ];

  return (
    <div className="min-h-screen bg-grovix-bg pb-24">
      <TopBar
        title="Profile"
        showBack
        showSettings
        onSettingsClick={() => router.push('/settings')}
      />

      <div className="px-4 pt-4">
        {/* Avatar Section */}
        <GlowCard glow className="mb-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-grovix-purple to-grovix-cyan flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-white font-bold text-lg">Grovix User</h2>
            <p className="text-grovix-muted text-sm">@grovix_user</p>
            <button
              className="h-10 px-6 border border-grovix-purple text-grovix-purple rounded-xl text-sm font-medium transition-colors duration-150 hover:bg-grovix-purple/10 active:scale-[0.97]"
              type="button"
              aria-label="Edit profile"
            >
              Edit Profile
            </button>
          </div>
        </GlowCard>

        {/* Stats Row */}
        <div className="bg-grovix-card rounded-2xl p-4 grid grid-cols-3 gap-2 mb-6">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center">
              <span className="text-white font-bold text-xl">{stat.value}</span>
              <span className="text-grovix-muted text-xs">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Activity List */}
        <section className="mb-6">
          <h3 className="text-white font-semibold text-sm mb-3">Activity</h3>
          <div className="space-y-2">
            {activities.map((activity) => (
              <button
                key={activity.label}
                onClick={() => {
                  if (activity.href) router.push(activity.href);
                }}
                className="w-full bg-grovix-card rounded-xl p-3 flex items-center min-h-[56px] transition-colors duration-150 hover:bg-grovix-secondary text-left"
                type="button"
                aria-label={activity.label}
              >
                <span className="text-lg mr-3" aria-hidden="true">
                  {activity.icon}
                </span>
                <span className="flex-1 text-white text-sm font-medium">
                  {activity.label}
                </span>
                <ChevronRight className="w-4 h-4 text-grovix-muted" />
              </button>
            ))}
          </div>
        </section>

        {/* Quick Settings */}
        <section className="mb-4">
          <h3 className="text-white font-semibold text-sm mb-3">
            Quick Settings
          </h3>
          <div className="space-y-2">
            {/* Dark Mode Toggle */}
            <div className="bg-grovix-card rounded-xl p-3 flex items-center justify-between min-h-[56px]">
              <div className="flex items-center gap-3">
                <Moon className="w-4 h-4 text-grovix-muted" />
                <span className="text-white text-sm font-medium">
                  Dark Mode
                </span>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`relative w-12 h-6 rounded-full transition-colors duration-150 ${
                  darkMode ? 'bg-grovix-purple' : 'bg-grovix-border'
                }`}
                role="switch"
                aria-checked={darkMode}
                aria-label="Toggle dark mode"
                type="button"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-150 ${
                    darkMode ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Notifications Toggle */}
            <div className="bg-grovix-card rounded-xl p-3 flex items-center justify-between min-h-[56px]">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-grovix-muted" />
                <span className="text-white text-sm font-medium">
                  Notifications
                </span>
              </div>
              <button
                onClick={toggleNotifications}
                className={`relative w-12 h-6 rounded-full transition-colors duration-150 ${
                  notifications ? 'bg-grovix-purple' : 'bg-grovix-border'
                }`}
                role="switch"
                aria-checked={notifications}
                aria-label="Toggle notifications"
                type="button"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-150 ${
                    notifications ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Help & Support */}
            <button
              className="w-full bg-grovix-card rounded-xl p-3 flex items-center justify-between min-h-[56px] transition-colors duration-150 hover:bg-grovix-secondary text-left"
              type="button"
              aria-label="Help and support"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-4 h-4 text-grovix-muted" />
                <span className="text-white text-sm font-medium">
                  Help & Support
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-grovix-muted" />
            </button>

            {/* Rate GROVIX */}
            <button
              className="w-full bg-grovix-card rounded-xl p-3 flex items-center justify-between min-h-[56px] transition-colors duration-150 hover:bg-grovix-secondary text-left"
              type="button"
              aria-label="Rate GROVIX"
            >
              <div className="flex items-center gap-3">
                <Star className="w-4 h-4 text-grovix-muted" />
                <span className="text-white text-sm font-medium">
                  Rate GROVIX
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-grovix-muted" />
            </button>

            {/* Share App */}
            <button
              className="w-full bg-grovix-card rounded-xl p-3 flex items-center justify-between min-h-[56px] transition-colors duration-150 hover:bg-grovix-secondary text-left"
              type="button"
              aria-label="Share app"
            >
              <div className="flex items-center gap-3">
                <Share2 className="w-4 h-4 text-grovix-muted" />
                <span className="text-white text-sm font-medium">
                  Share App
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-grovix-muted" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
