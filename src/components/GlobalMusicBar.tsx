import React, { useEffect, useRef, useState } from 'react';
import { IconPlay, IconPause, IconSkipForward, IconMusic, IconVolume2 } from './Icons';
import { wsClient } from '../lib/ws';

interface GlobalMusicBarProps {
  musicState: any;
  activeRoomId?: string | null;
  onOpenMusicPanel: () => void;
}

export default function GlobalMusicBar({ musicState, activeRoomId, onOpenMusicPanel }: GlobalMusicBarProps) {
  const [volume, setVolume] = useState(75);
  const [showVolume, setShowVolume] = useState(false);
  const playerRef = useRef<any>(null);
  const currentTrackIdRef = useRef<string | null>(null);

  const isInMusicRoom = !!(activeRoomId && musicState?.roomId === activeRoomId);
  const track = isInMusicRoom ? musicState?.track : null;
  const isPlaying = isInMusicRoom && !!musicState?.isPlaying;

  // Load YouTube IFrame API script once globally
  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }
  }, []);

  // Room-Scoped YouTube Player Management
  useEffect(() => {
    if (!isInMusicRoom || !track || !track.providerTrackId) {
      if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
        try { playerRef.current.pauseVideo(); } catch {}
      }
      return;
    }

    const videoId = track.providerTrackId;

    const setupPlayer = () => {
      const YT = (window as any).YT;
      if (!YT || !YT.Player) {
        setTimeout(setupPlayer, 150);
        return;
      }

      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        if (currentTrackIdRef.current !== videoId) {
          currentTrackIdRef.current = videoId;
          try {
            playerRef.current.loadVideoById(videoId);
            playerRef.current.setVolume(volume);
            if (isPlaying) {
              playerRef.current.playVideo();
            } else {
              playerRef.current.pauseVideo();
            }
          } catch {}
        } else {
          try {
            if (isPlaying && typeof playerRef.current.playVideo === 'function') {
              playerRef.current.playVideo();
            } else if (!isPlaying && typeof playerRef.current.pauseVideo === 'function') {
              playerRef.current.pauseVideo();
            }
          } catch {}
        }
      } else {
        const mount = document.getElementById('yt-global-player-mount');
        if (mount) {
          currentTrackIdRef.current = videoId;
          playerRef.current = new YT.Player('yt-global-player-mount', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
              autoplay: isPlaying ? 1 : 0,
              controls: 0,
              disablekb: 1,
              playsinline: 1,
              rel: 0,
              origin: window.location.origin,
              enablejsapi: 1,
            },
            events: {
              onReady: (e: any) => {
                (window as any).__echowire_yt = e.target;
                e.target.setVolume(volume);
                if (isPlaying) e.target.playVideo();
              },
              onStateChange: (e: any) => {
                if (e.data === 0) {
                  if (activeRoomId) {
                    wsClient.send('music:control', { roomId: activeRoomId, action: 'skip' });
                  }
                }
              },
            },
          });
          (window as any).__echowire_yt = playerRef.current;
        }
      }
    };

    setupPlayer();
  }, [isInMusicRoom, track?.providerTrackId, isPlaying, activeRoomId]);

  // Sync volume changes
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      try { playerRef.current.setVolume(volume); } catch {}
    }
  }, [volume]);

  return (
    <>
      {/* Valid viewport element (w-48 h-32 at bottom-right, -z-50) so YouTube viewability checks pass without 3s auto-pause */}
      <div
        className="fixed bottom-0 right-0 w-48 h-32 pointer-events-none opacity-[0.01] overflow-hidden -z-50"
        aria-hidden="true"
      >
        <div id="yt-global-player-mount" className="w-full h-full" />
      </div>

      {track && (
        <div className="fixed bottom-16 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-[380px] z-40 bg-zinc-900/95 backdrop-blur-md border border-zinc-800/90 rounded-xl shadow-2xl p-2.5 flex items-center gap-3 transition-all animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            onClick={onOpenMusicPanel}
            className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden flex-shrink-0 relative flex items-center justify-center cursor-pointer group"
            title="Open Music Panel"
          >
            {track.thumbnailUrl ? (
              <img src={track.thumbnailUrl} alt={track.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            ) : (
              <IconMusic size={18} className="text-accent" />
            )}
            {isPlaying && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 bg-accent rounded-full animate-bounce h-2" style={{ animationDelay: '0ms' }} />
                  <span className="w-0.5 bg-accent rounded-full animate-bounce h-3" style={{ animationDelay: '150ms' }} />
                  <span className="w-0.5 bg-accent rounded-full animate-bounce h-1.5" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          <div onClick={onOpenMusicPanel} className="min-w-0 flex-1 cursor-pointer">
            <p className="text-zinc-100 text-xs font-semibold truncate hover:text-accent transition-colors">
              {track.title}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-zinc-400 text-[11px] truncate max-w-[140px]">{track.artist || 'YouTube'}</span>
              <span className="text-[9px] bg-accent/20 text-accent font-medium px-1.5 py-0.2 rounded font-mono flex-shrink-0">
                Room Audio
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                wsClient.send('music:control', {
                  roomId: activeRoomId || 'global',
                  action: isPlaying ? 'pause' : 'play',
                });
              }}
              className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent/90 transition-transform active:scale-95 cursor-pointer shadow"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <IconPause size={14} /> : <IconPlay size={14} />}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                wsClient.send('music:control', {
                  roomId: activeRoomId || 'global',
                  action: 'skip',
                });
              }}
              className="w-8 h-8 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Skip"
            >
              <IconSkipForward size={15} />
            </button>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowVolume(!showVolume);
                }}
                className="w-8 h-8 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
                title="Volume"
              >
                <IconVolume2 size={15} />
              </button>
              {showVolume && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-10 right-0 bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 shadow-xl w-32 flex flex-col gap-1.5 z-50"
                >
                  <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                    <span>Volume</span>
                    <span>{volume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full accent-accent h-1 cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
