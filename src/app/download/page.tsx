'use client';

import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import UrlInput from '@/components/download/UrlInput';
import PlatformDetector from '@/components/download/PlatformDetector';
import DownloadButton from '@/components/download/DownloadButton';
import FallbackModal from '@/components/download/FallbackModal';
import RecentDownloads from '@/components/download/RecentDownloads';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useDownload } from '@/hooks/useDownload';
import {
  Youtube,
  Music2,
  Tv,
  Camera,
  MessageCircle,
  Film,
  Headphones,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SupportedPlatform {
  key: string;
  name: string;
  icon: LucideIcon;
  color: string;
}

const supportedPlatforms: SupportedPlatform[] = [
  { key: 'youtube', name: 'YouTube', icon: Youtube, color: '#FF0000' },
  { key: 'tiktok', name: 'TikTok', icon: Music2, color: '#00F2EA' },
  { key: 'facebook', name: 'Facebook', icon: Tv, color: '#1877F2' },
  { key: 'instagram', name: 'Instagram', icon: Camera, color: '#E4405F' },
  { key: 'twitter', name: 'Twitter/X', icon: MessageCircle, color: '#1DA1F2' },
  { key: 'vimeo', name: 'Vimeo', icon: Film, color: '#1AB7EA' },
  { key: 'soundcloud', name: 'SoundCloud', icon: Headphones, color: '#FF5500' },
];

export default function DownloadPage() {
  const {
    url,
    platform,
    status,
    currentSource,
    recentDownloads,
    setUrl,
    startDownload,
    cancelDownload,
    loadRecentDownloads,
    error,
  } = useDownload();

  const [mode, setMode] = useState<'video' | 'audio'>('video');
  const [confirmDismissed, setConfirmDismissed] = useState(false);

  // Load recent downloads on mount
  useEffect(() => {
    loadRecentDownloads();
  }, [loadRecentDownloads]);

  // Derive showConfirm directly from status - no effect needed
  // confirmDismissed is reset in handleDownloadClick when user starts a new download
  const showConfirm = status === 'redirecting' && !confirmDismissed;

  const handleDownloadClick = useCallback(() => {
    if (!url.trim()) return;
    setConfirmDismissed(false);
    startDownload();
  }, [url, startDownload]);

  const handleConfirmRedirect = useCallback(() => {
    setConfirmDismissed(true);
  }, []);

  const handleCancelRedirect = useCallback(() => {
    setConfirmDismissed(true);
    cancelDownload();
  }, [cancelDownload]);

  const handleRedownload = useCallback(
    (redownloadUrl: string) => {
      setUrl(redownloadUrl);
    },
    [setUrl]
  );

  const isLoading =
    status === 'detecting' || status === 'connecting' || status === 'redirecting' || status === 'fallback';

  const showFallbackModal = status === 'connecting' || status === 'fallback';

  return (
    <div className="flex min-h-screen flex-col bg-grovix-bg">
      <TopBar
        title="Smart Download"
        showBack
        showSettings
        onSettingsClick={() => {}}
      />

      <main className="flex-1 space-y-6 px-4 pt-6 pb-24">
        {/* URL Input Section */}
        <section aria-label="Download URL input">
          <UrlInput
            value={url}
            onChange={setUrl}
            mode={mode}
            onModeChange={setMode}
          />
        </section>

        {/* Platform Detector */}
        {platform.key && (
          <section aria-label="Detected platform">
            <PlatformDetector platform={platform} />
          </section>
        )}

        {/* Error Message */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Download Button */}
        <section aria-label="Download action">
          <DownloadButton
            onClick={handleDownloadClick}
            loading={isLoading}
            disabled={!url.trim()}
          />
        </section>

        {/* Supported Platforms */}
        <section aria-label="Supported platforms">
          <h2 className="text-white font-semibold text-base mb-3">
            📡 Supported Platforms
          </h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {supportedPlatforms.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.key}
                  className="flex flex-col items-center gap-2 rounded-xl bg-grovix-secondary p-3 min-w-[80px] flex-shrink-0"
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl"
                    style={{ backgroundColor: `${p.color}20` }}
                  >
                    <Icon
                      className="w-5 h-5"
                      style={{ color: p.color }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-grovix-muted text-[10px] font-medium text-center leading-tight">
                    {p.name}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Recent Downloads */}
        {recentDownloads.length > 0 && (
          <section aria-label="Recent downloads">
            <RecentDownloads
              items={recentDownloads}
              onRedownload={handleRedownload}
            />
          </section>
        )}
      </main>

      {/* Fallback Modal */}
      <FallbackModal
        isOpen={showFallbackModal}
        status={status as 'connecting' | 'fallback'}
        currentSource={currentSource}
        onClose={cancelDownload}
      />

      {/* Confirm Modal - shown before external redirect */}
      <ConfirmModal
        isOpen={showConfirm}
        onClose={handleCancelRedirect}
        onConfirm={handleConfirmRedirect}
        title="Leaving GROVIX"
        message="You are about to open an external download platform. GROVIX is not responsible for external content. Continue?"
      />
    </div>
  );
}
