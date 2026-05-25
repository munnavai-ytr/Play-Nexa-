'use client';

import { useState, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize,
  Subtitles,
  PictureInPicture2,
  Hand,
  Settings,
} from 'lucide-react';

export default function PlayerPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(32);
  const [playbackSpeed, setPlaybackSpeed] = useState('1x');
  const [currentTime, setCurrentTime] = useState('1:24');
  const totalTime = '4:12';
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speeds = ['0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x'];

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleTapVideo = useCallback(() => {
    setShowControls((prev) => !prev);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!showControls) {
      hideTimerRef.current = setTimeout(() => setShowControls(false), 5000);
    }
  }, [showControls]);

  const handleProgressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      setProgress(val);
      const totalSecs = 4 * 60 + 12;
      const currentSecs = Math.floor((val / 100) * totalSecs);
      const mins = Math.floor(currentSecs / 60);
      const secs = currentSecs % 60;
      setCurrentTime(`${mins}:${secs.toString().padStart(2, '0')}`);
    },
    []
  );

  const cycleSpeed = useCallback(() => {
    const idx = speeds.indexOf(playbackSpeed);
    const next = speeds[(idx + 1) % speeds.length];
    setPlaybackSpeed(next);
  }, [playbackSpeed]);

  return (
    <div className="min-h-screen bg-grovix-bg pb-24">
      {/* Video Area */}
      <div className="relative bg-black aspect-video w-full">
        {/* Placeholder video area */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-grovix-card to-black">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-grovix-purple/20 flex items-center justify-center">
              <Play className="w-8 h-8 text-grovix-purple ml-1" />
            </div>
            <p className="text-grovix-muted text-sm">Tap to play video</p>
          </div>
        </div>

        {/* Tap overlay */}
        <button
          className="absolute inset-0 z-10"
          onClick={handleTapVideo}
          aria-label="Toggle video controls"
          type="button"
        />

        {/* Controls Overlay */}
        {showControls && (
          <div className="absolute inset-0 z-20 flex flex-col justify-between bg-black/40 transition-opacity duration-300">
            {/* Top controls */}
            <div className="flex items-center justify-between p-3">
              <button
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white"
                aria-label="Go back"
                type="button"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-white text-sm font-medium truncate max-w-[200px]">
                Sample Video Title
              </span>
              <button
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white"
                aria-label="Video settings"
                type="button"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>

            {/* Center controls */}
            <div className="flex items-center justify-center gap-8">
              <button
                className="min-h-[48px] min-w-[48px] flex items-center justify-center text-white transition-colors duration-150 hover:text-grovix-purple"
                aria-label="Previous"
                type="button"
              >
                <SkipBack className="w-7 h-7" />
              </button>
              <button
                onClick={togglePlay}
                className="min-h-[56px] min-w-[56px] flex items-center justify-center bg-grovix-purple text-white rounded-full transition-colors duration-150 hover:bg-grovix-purple/90 active:scale-95"
                aria-label={isPlaying ? 'Pause' : 'Play'}
                type="button"
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7" />
                ) : (
                  <Play className="w-7 h-7 ml-0.5" />
                )}
              </button>
              <button
                className="min-h-[48px] min-w-[48px] flex items-center justify-center text-white transition-colors duration-150 hover:text-grovix-purple"
                aria-label="Next"
                type="button"
              >
                <SkipForward className="w-7 h-7" />
              </button>
            </div>

            {/* Bottom controls */}
            <div className="px-4 pb-3">
              {/* Progress scrubber */}
              <input
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={handleProgressChange}
                className="w-full h-1 rounded-full appearance-none cursor-pointer accent-grovix-purple bg-grovix-border"
                aria-label="Video progress"
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-3">
                  <span className="text-white text-xs">
                    {currentTime} / {totalTime}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={cycleSpeed}
                    className="min-h-[44px] px-2 flex items-center justify-center text-white text-xs font-medium rounded-lg bg-grovix-secondary transition-colors duration-150 hover:bg-grovix-purple/20"
                    aria-label={`Playback speed: ${playbackSpeed}`}
                    type="button"
                  >
                    {playbackSpeed}
                  </button>
                  <button
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white transition-colors duration-150 hover:text-grovix-purple"
                    aria-label="Fullscreen"
                    type="button"
                  >
                    <Maximize className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Feature Badges */}
      <div className="px-4 pt-4">
        <h2 className="text-white font-semibold text-base mb-3">
          Player Features
        </h2>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 bg-grovix-secondary border border-grovix-border text-grovix-muted text-xs font-medium rounded-full px-3 py-2 min-h-[36px]">
            <Subtitles className="w-3.5 h-3.5" />
            Subtitles
            <span className="text-grovix-purple text-[10px] font-semibold">
              — Coming Soon
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 bg-grovix-secondary border border-grovix-border text-grovix-muted text-xs font-medium rounded-full px-3 py-2 min-h-[36px]">
            <PictureInPicture2 className="w-3.5 h-3.5" />
            Floating Player
            <span className="text-grovix-purple text-[10px] font-semibold">
              — Coming Soon
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 bg-grovix-secondary border border-grovix-border text-grovix-muted text-xs font-medium rounded-full px-3 py-2 min-h-[36px]">
            <Hand className="w-3.5 h-3.5" />
            Gesture Control
            <span className="text-grovix-purple text-[10px] font-semibold">
              — Coming Soon
            </span>
          </span>
        </div>

        {/* Video Info Placeholder */}
        <div className="mt-6 bg-grovix-card border border-grovix-border rounded-2xl p-4">
          <h3 className="text-white font-semibold text-sm">Video Information</h3>
          <p className="text-grovix-muted text-xs mt-1 leading-relaxed">
            Video player supports playback controls, speed adjustment, and
            fullscreen mode. More features like subtitles, floating player, and
            gesture controls are coming soon.
          </p>
        </div>

        {/* Playback Speed Selector */}
        <div className="mt-4 bg-grovix-card border border-grovix-border rounded-2xl p-4">
          <h3 className="text-white font-semibold text-sm mb-3">
            Playback Speed
          </h3>
          <div className="flex flex-wrap gap-2">
            {speeds.map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-medium transition-colors duration-150 ${
                  playbackSpeed === speed
                    ? 'bg-grovix-purple text-white'
                    : 'bg-grovix-secondary text-grovix-muted border border-grovix-border hover:text-white hover:border-grovix-purple/50'
                }`}
                type="button"
                aria-pressed={playbackSpeed === speed}
              >
                {speed}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
