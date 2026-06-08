'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  formatDuration,
  lsGet,
  lsSet,
  isNativePlatform,
  type VideoFile,
  type SubCue,
  parseSubtitle,
} from '@/lib/mediaUtils';

const STORAGE_KEYS = {
  volume: 'pn_video_volume',
  speed: 'pn_video_speed',
  brightness: 'pn_video_brightness',
  aspect: 'pn_video_aspect',
  repeat: 'pn_video_repeat',
  history: 'pn_video_history',
} as const;

interface HistoryEntry {
  position: number;
  updatedAt: number;
}

type AspectRatio = 'fit' | 'fill' | '16:9' | '4:3' | 'zoom';
type RepeatMode = 'off' | 'one';

export function useVideoPlayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(() => {
    const saved = lsGet(STORAGE_KEYS.volume);
    return saved !== null ? parseFloat(saved) : 0.75;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [brightness, setBrightnessState] = useState<number>(() => {
    const saved = lsGet(STORAGE_KEYS.brightness);
    return saved !== null ? parseFloat(saved) : 1;
  });
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(() => {
    const saved = lsGet(STORAGE_KEYS.speed);
    return saved !== null ? parseFloat(saved) : 1.0;
  });
  const [aspectRatio, setAspectRatioState] = useState<AspectRatio>(() => {
    const saved = lsGet(STORAGE_KEYS.aspect);
    return (saved as AspectRatio) || 'fit';
  });
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [subtitleTrack, setSubtitleTrack] = useState<SubCue[] | null>(null);
  const [audioTrack, setAudioTrackState] = useState<number>(0);
  const [repeatMode, setRepeatModeState] = useState<RepeatMode>(() => {
    const saved = lsGet(STORAGE_KEYS.repeat);
    return (saved as RepeatMode) || 'off';
  });
  const [pipMode, setPipMode] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [currentVideo, setCurrentVideo] = useState<VideoFile | null>(null);
  const [resumePosition, setResumePosition] = useState<number | null>(null);

  // ── Controls auto-hide ──────────────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  // ── Video event listeners ───────────────────────────────────────────
  const attachVideoListeners = useCallback(
    (el: HTMLVideoElement) => {
      const onTimeUpdate = () => {
        setCurrentTime(el.currentTime);
      };

      const onLoadedMetadata = () => {
        setDuration(el.duration);
        el.volume = volume;
        el.playbackRate = playbackSpeed;
        el.muted = isMuted;

        if (resumePosition !== null && resumePosition > 0) {
          el.currentTime = resumePosition;
          setResumePosition(null);
        }
      };

      const onEnded = () => {
        if (repeatMode === 'one') {
          el.currentTime = 0;
          el.play();
        } else {
          setIsPlaying(false);
        }
      };

      const onPlay = () => {
        setIsPlaying(true);
        resetHideTimer();
      };

      const onPause = () => {
        setIsPlaying(false);
      };

      el.addEventListener('timeupdate', onTimeUpdate);
      el.addEventListener('loadedmetadata', onLoadedMetadata);
      el.addEventListener('ended', onEnded);
      el.addEventListener('play', onPlay);
      el.addEventListener('pause', onPause);

      return () => {
        el.removeEventListener('timeupdate', onTimeUpdate);
        el.removeEventListener('loadedmetadata', onLoadedMetadata);
        el.removeEventListener('ended', onEnded);
        el.removeEventListener('play', onPlay);
        el.removeEventListener('pause', onPause);
      };
    },
    [resumePosition, repeatMode, resetHideTimer, volume, playbackSpeed, isMuted]
  );

  // ── Sync video ref listeners when ref changes ───────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const cleanup = attachVideoListeners(el);
    return cleanup;
  }, [attachVideoListeners]);

  // ── Sync volume to element ──────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.volume = volume;
    }
    lsSet(STORAGE_KEYS.volume, String(volume));
  }, [volume]);

  // ── Sync muted to element ───────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.muted = isMuted;
    }
  }, [isMuted]);

  // ── Sync speed to element ───────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.playbackRate = playbackSpeed;
    }
    lsSet(STORAGE_KEYS.speed, String(playbackSpeed));
  }, [playbackSpeed]);

  // ── Sync brightness (CSS filter on container is handled by consumer) ─
  useEffect(() => {
    lsSet(STORAGE_KEYS.brightness, String(brightness));
  }, [brightness]);

  // ── Persist aspect ratio ────────────────────────────────────────────
  useEffect(() => {
    lsSet(STORAGE_KEYS.aspect, aspectRatio);
  }, [aspectRatio]);

  // ── Persist repeat mode ─────────────────────────────────────────────
  useEffect(() => {
    lsSet(STORAGE_KEYS.repeat, repeatMode);
  }, [repeatMode]);

  // ── Fullscreen change listener ──────────────────────────────────────
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  // ── PiP events ──────────────────────────────────────────────────────
  useEffect(() => {
    const onEnterPip = () => setPipMode(true);
    const onLeavePip = () => setPipMode(false);

    const el = videoRef.current;
    if (el) {
      el.addEventListener('enterpictureinpicture', onEnterPip);
      el.addEventListener('leavepictureinpicture', onLeavePip);
    }
    return () => {
      if (el) {
        el.removeEventListener('enterpictureinpicture', onEnterPip);
        el.removeEventListener('leavepictureinpicture', onLeavePip);
      }
    };
  }, [currentVideo]);

  // ── Save position on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      const el = videoRef.current;
      if (!el || !currentVideo) return;
      try {
        const raw = lsGet(STORAGE_KEYS.history);
        const history: Record<string, HistoryEntry> = raw
          ? JSON.parse(raw)
          : {};
        history[currentVideo.id] = {
          position: el.currentTime,
          updatedAt: Date.now(),
        };
        lsSet(STORAGE_KEYS.history, JSON.stringify(history));
      } catch {
        // silently ignore storage errors
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo]);

  // ── Controls ────────────────────────────────────────────────────────
  const play = useCallback(() => {
    const el = videoRef.current;
    if (el) {
      el.play().catch(() => {
        // autoplay may be blocked
      });
    }
  }, []);

  const pause = useCallback(() => {
    const el = videoRef.current;
    if (el) {
      el.pause();
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    const el = videoRef.current;
    if (el) {
      el.currentTime = Math.max(0, Math.min(seconds, el.duration || 0));
    }
    resetHideTimer();
  }, [resetHideTimer]);

  const skip = useCallback(
    (seconds: number) => {
      const el = videoRef.current;
      if (el) {
        el.currentTime = Math.max(
          0,
          Math.min(el.currentTime + seconds, el.duration || 0)
        );
      }
      resetHideTimer();
    },
    [resetHideTimer]
  );

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (clamped > 0) {
      setIsMuted(false);
    }
  }, []);

  const setSpeed = useCallback((rate: number) => {
    setPlaybackSpeedState(rate);
  }, []);

  const setAspectRatio = useCallback((ratio: AspectRatio) => {
    setAspectRatioState(ratio);
  }, []);

  const toggleLock = useCallback(() => {
    setIsLocked((prev) => !prev);
  }, []);

  const togglePip = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await el.requestPictureInPicture();
      }
    } catch {
      // PiP not supported or blocked
    }
    resetHideTimer();
  }, [resetHideTimer]);

  const loadSubtitle = useCallback(async (file: File): Promise<void> => {
    try {
      const text = await file.text();
      const cues = parseSubtitle(text);
      setSubtitleTrack(cues);
    } catch {
      setSubtitleTrack(null);
    }
  }, []);

  const setAudioTrack = useCallback((index: number) => {
    const el = videoRef.current;
    if (!el) return;

    const audioTracks = (el as HTMLVideoElement & { audioTracks?: AudioTrackList }).audioTracks;
    if (audioTracks && audioTracks.length > 0) {
      for (let i = 0; i < audioTracks.length; i++) {
        audioTracks[i].enabled = i === index;
      }
    }
    setAudioTrackState(index);
  }, []);

  const setBrightness = useCallback((val: number) => {
    setBrightnessState(Math.max(0, Math.min(1, val)));
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        const container = el.parentElement || el;
        await container.requestFullscreen();
      }
    } catch {
      // fullscreen not supported
    }
    resetHideTimer();
  }, [resetHideTimer]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const loadVideo = useCallback(
    (video: VideoFile) => {
      const el = videoRef.current;

      // Save current video position before switching
      if (el && currentVideo) {
        try {
          const raw = lsGet(STORAGE_KEYS.history);
          const history: Record<string, HistoryEntry> = raw
            ? JSON.parse(raw)
            : {};
          history[currentVideo.id] = {
            position: el.currentTime,
            updatedAt: Date.now(),
          };
          lsSet(STORAGE_KEYS.history, JSON.stringify(history));
        } catch {
          // silently ignore
        }
      }

      setCurrentVideo(video);
      setCurrentTime(0);
      setDuration(0);
      setSubtitleTrack(null);
      setAudioTrackState(0);
      setResumePosition(null);

      if (el) {
        el.src = video.url;
        el.load();
      }

      // Check for saved position (resume logic)
      try {
        const raw = lsGet(STORAGE_KEYS.history);
        if (raw) {
          const history: Record<string, HistoryEntry> = JSON.parse(raw);
          const entry = history[video.id];
          if (entry && entry.position > 5) {
            setResumePosition(entry.position);
          }
        }
      } catch {
        // silently ignore
      }

      resetHideTimer();
    },
    [currentVideo, resetHideTimer]
  );

  const cycleRepeat = useCallback(() => {
    setRepeatModeState((prev) => {
      if (prev === 'off') return 'one';
      return 'off';
    });
  }, []);

  return {
    // Ref
    videoRef,

    // State
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    brightness,
    playbackSpeed,
    aspectRatio,
    isLocked,
    isFullscreen,
    subtitleTrack,
    audioTrack,
    repeatMode,
    pipMode,
    showControls,
    currentVideo,
    resumePosition,

    // Functions
    play,
    pause,
    seek,
    skip,
    setVolume,
    setSpeed,
    setAspectRatio,
    toggleLock,
    togglePip,
    loadSubtitle,
    setAudioTrack,
    setBrightness,
    toggleFullscreen,
    toggleMute,
    loadVideo,
    cycleRepeat,
    resetHideTimer,

    // Utility
    formatDuration,
  };
}
