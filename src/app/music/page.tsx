'use client';

import { useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import MusicPlayer from '@/components/music/MusicPlayer';
import Equalizer from '@/components/music/Equalizer';
import LyricsPanel from '@/components/music/LyricsPanel';
import musicData from '@/data/music.json';

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  album: string;
  thumbnail: string;
}

const typedMusicData = musicData as Song[];

export default function MusicPage() {
  const [selectedSong, setSelectedSong] = useState<Song>(typedMusicData[0]);

  return (
    <div className="min-h-screen bg-grovix-bg pb-24">
      <TopBar title="Music Player" showBack />

      <div className="px-4 pt-4">
        {/* Music Player */}
        <MusicPlayer
          title={selectedSong.title}
          artist={selectedSong.artist}
          thumbnail={selectedSong.thumbnail}
          duration={selectedSong.duration}
        />

        {/* Equalizer */}
        <div className="mt-6">
          <Equalizer />
        </div>

        {/* Lyrics Panel */}
        <div className="mt-6">
          <LyricsPanel />
        </div>

        {/* Song List */}
        <section className="mt-6">
          <h2 className="text-white font-semibold text-base mb-3">
            📋 Up Next
          </h2>
          <div className="space-y-2">
            {typedMusicData.map((song) => {
              const isActive = song.id === selectedSong.id;
              return (
                <button
                  key={song.id}
                  onClick={() => setSelectedSong(song)}
                  className={`w-full text-left bg-grovix-card rounded-xl p-3 flex items-center gap-3 transition-colors duration-150 ${
                    isActive
                      ? 'border border-grovix-purple bg-grovix-purple/10'
                      : 'border border-transparent hover:bg-grovix-secondary'
                  }`}
                  type="button"
                  aria-label={`Play ${song.title} by ${song.artist}`}
                  aria-pressed={isActive}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        isActive ? 'text-grovix-purple' : 'text-white'
                      }`}
                    >
                      {song.title}
                    </p>
                    <p className="text-grovix-muted text-xs truncate">
                      {song.artist}
                    </p>
                  </div>
                  <span className="text-grovix-muted text-xs flex-shrink-0">
                    {song.duration}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
