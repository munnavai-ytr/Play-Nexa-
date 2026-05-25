'use client';

import { useState, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import PlatformCard from '@/components/platforms/PlatformCard';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import platformsData from '@/data/platforms.json';

interface Platform {
  id: string;
  name: string;
  color: string;
  url: string;
  tagline: string;
  icon: string;
  collections: string[];
}

const typedPlatformsData = platformsData as Platform[];

export default function PlatformsPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const handlePlatformClick = useCallback((url: string) => {
    setPendingUrl(url);
    setConfirmOpen(true);
  }, []);

  const handleConfirm = useCallback(() => {
    if (pendingUrl) {
      window.open(pendingUrl, '_blank');
    }
    setConfirmOpen(false);
    setPendingUrl(null);
  }, [pendingUrl]);

  const handleClose = useCallback(() => {
    setConfirmOpen(false);
    setPendingUrl(null);
  }, []);

  return (
    <div className="min-h-screen bg-grovix-bg pb-24">
      <TopBar title="Streaming Platforms" showBack />

      <div className="px-4 pt-4">
        <p className="text-grovix-muted text-sm mb-4">
          Browse your favorite streaming platforms. Tap any platform to open.
        </p>

        {/* 2-column grid */}
        <div className="grid grid-cols-2 gap-3">
          {typedPlatformsData.map((platform) => (
            <div
              key={platform.id}
              onClick={() => handlePlatformClick(platform.url)}
              className="active:scale-[0.97] transition-transform duration-150"
              role="button"
              tabIndex={0}
              aria-label={`Open ${platform.name}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handlePlatformClick(platform.url);
                }
              }}
            >
              <PlatformCard
                id={platform.id}
                name={platform.name}
                color={platform.color}
                tagline={platform.tagline}
                icon={platform.icon}
              />
            </div>
          ))}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Leaving GROVIX"
        message="You are about to open an external streaming platform. GROVIX is not responsible for external content. Continue?"
      />
    </div>
  );
}
