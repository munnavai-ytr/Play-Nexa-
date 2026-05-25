'use client';

interface FallbackModalProps {
  isOpen: boolean;
  status: 'connecting' | 'fallback' | 'done';
  currentSource: string | null;
  onClose: () => void;
}

export default function FallbackModal({
  isOpen,
  status,
  currentSource,
  onClose,
}: FallbackModalProps) {
  const progressActive = isOpen && status === 'connecting';

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-grovix-card border border-grovix-border rounded-2xl p-6 max-w-sm w-full text-center">
        {/* Connecting State */}
        {status === 'connecting' && (
          <>
            <div className="mb-4">
              <span className="download-spinner inline-block w-8 h-8 border-[3px] border-grovix-border border-t-grovix-purple rounded-full" />
            </div>
            <p className="text-white font-semibold text-base mb-1">
              Connecting to media source...
            </p>
            {currentSource && (
              <p className="text-grovix-muted text-xs mb-4">
                Source: {currentSource}
              </p>
            )}
            {/* Progress bar */}
            <div className="h-1 bg-grovix-border rounded-full overflow-hidden">
              <div
                className={`
                  h-full bg-grovix-purple rounded-full
                  ${progressActive ? 'animate-progress-bar' : ''}
                `}
              />
            </div>
          </>
        )}

        {/* Fallback State */}
        {status === 'fallback' && (
          <>
            <div className="mb-4">
              <span className="download-spinner inline-block w-8 h-8 border-[3px] border-grovix-border border-t-grovix-cyan rounded-full" />
            </div>
            <p className="text-white font-semibold text-base mb-1">
              Switching to alternate route...
            </p>
            <p className="text-grovix-muted text-xs">
              Primary source unavailable, trying fallback
            </p>
          </>
        )}

        {/* Done State */}
        {status === 'done' && (
          <>
            <div className="mb-4">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-grovix-success/20 text-grovix-success text-xl">
                ✓
              </span>
            </div>
            <p className="text-white font-semibold text-base mb-1">
              Connected! Redirecting...
            </p>
            <p className="text-grovix-muted text-xs">
              Your download will begin shortly
            </p>
          </>
        )}
      </div>
    </div>
  );
}
