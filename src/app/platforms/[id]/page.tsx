'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import PlatformHeader from '@/components/platforms/PlatformHeader';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
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

export default function PlatformDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const platformId = params.id as string;
  const platform = typedPlatformsData.find((p) => p.id === platformId);

  const handleOpenPlatform = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  const handleConfirm = useCallback(() => {
    if (platform?.url) {
      window.open(platform.url, '_blank');
    }
    setConfirmOpen(false);
  }, [platform]);

  const handleClose = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  if (!platform) {
    return (
      <div className="min-h-screen bg-grovix-bg pb-24">
        <TopBar title="Platform" showBack />
        <EmptyState
          icon={AlertCircle}
          title="Platform Not Found"
          description="The platform you are looking for does not exist or has been removed."
          action={{ label: 'Go Back', onClick: () => router.back() }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grovix-bg pb-24">
      <TopBar title={platform.name} showBack />

      <div className="px-4 pt-4 space-y-4">
        {/* Platform Header */}
        <PlatformHeader
          name={platform.name}
          color={platform.color}
          tagline={platform.tagline}
          icon={platform.icon}
          url={platform.url}
          collections={platform.collections}
        />

        {/* Collections Section */}
        {platform.collections && platform.collections.length > 0 && (
          <section>
            <h2 className="text-white font-semibold text-base mb-3">
              Collections
            </h2>
            <div className="space-y-2">
              {platform.collections.map((collection) => (
                <div
                  key={collection}
                  className="bg-grovix-card border border-grovix-border rounded-2xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: platform.color }}
                      aria-hidden="true"
                    />
                    <span className="text-white text-sm font-medium">
                      {collection}
                    </span>
                  </div>
                  <Badge variant="default">Browse</Badge>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Open Platform Button */}
        <button
          onClick={handleOpenPlatform}
          className="w-full bg-grovix-purple text-white rounded-xl h-12 text-base font-semibold flex items-center justify-center gap-2 transition-colors duration-150 hover:bg-grovix-purple/90 active:scale-[0.97]"
          type="button"
          aria-label={`Open ${platform.name}`}
        >
          Open {platform.name}
        </button>
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Leaving GROVIX"
        message={`You are about to open ${platform.name}. GROVIX is not responsible for external content. Continue?`}
      />
    </div>
  );
}
