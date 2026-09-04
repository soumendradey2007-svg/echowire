import React, { useState, useRef, useEffect } from 'react'
import type { Room, Message, RightTab } from '../types'
import { IconX, IconUsers, IconMessageSquare, IconMusic, IconSend, IconPlay, IconPause, IconVolume2, IconMicOff, IconPlus, IconSkipForward, IconSearch, IconHeadphonesOff } from './Icons'
import { wsClient } from '../lib/ws'

interface Props {
  room: Room
  activeRoomId?: string | null
  sharedMusicState?: any
  messages: Message[]
  tab: RightTab
  onTabChange: (t: RightTab) => void
  onClose: () => void
  onSendMessage?: (content: string) => void
  currentUser?: any
}

function formatTime(secs: number) {
  if (!secs || isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function RightPanel({ room, activeRoomId, sharedMusicState, messages, tab, onTabChange, onClose, onSendMessage, currentUser }: Props) {
  const tabs: { id: RightTab; icon: React.ReactNode; label: string }[] = [
    { id: 'members', icon: <IconUsers size={14} />, label: 'Members' },
    { id: 'chat', icon: <IconMessageSquare size={14} />, label: 'Chat' },
    { id: 'music', icon: <IconMusic size={14} />, label: 'Music' },
  ]

  return (
    <aside className="fixed sm:relative inset-y-0 right-0 z-50 w-full sm:w-80 flex-shrink-0 flex flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl transition-all">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${tab === t.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer p-1">
          <IconX size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'members' && <MembersTab room={room} />}
        {tab === 'chat' && <ChatTab messages={messages} onSendMessage={onSendMessage} currentUser={currentUser} />}
        {tab === 'music' && <MusicTab activeRoomId={activeRoomId || room.id} sharedMusicState={sharedMusicState} currentUser={currentUser} />}
      </div>
    </aside>
  )
}

function MembersTab({ room }: { room: Room }) {
  return (
    <div className="flex-1 overflow-y-auto p-3">
      <p className="text-zinc-600 text-xs font-medium uppercase tracking-wide px-2 mb-2">
        {room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}
      </p>
      <div className="space-y-0.5">
        {room.members.map((m) => (
          <div key={m.id} className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-zinc-900/60 group transition-colors">
            <div className={`relative flex-shrink-0 ${m.isSpeaking ? 'ring-2 ring-accent/50 rounded-full' : ''}`}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-white text-xs"
                style={{ backgroundColor: m.color }}
              >
                {m.initials}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-zinc-300 text-xs font-medium truncate">{m.username}</span>
                {m.isOwner && <span className="text-[9px] text-zinc-500">*</span>}
                {m.isSpeaking && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
                {m.isMuted && (
                  <span className="flex items-center gap-0.5 text-[10px] text-red-400 flex-shrink-0" title="Muted">
                    <IconMicOff size={10} />
                  </span>
                )}
                {m.isDeafened && (
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-400 flex-shrink-0" title="Deafened">
                    <IconHeadphonesOff size={10} />
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChatTab({ messages, onSendMessage, currentUser }: { messages: Message[]; onSendMessage?: (content: string) => void; currentUser?: any }) {
  const [value, setValue] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    if (!value.trim()) return
    onSendMessage?.(value.trim())
    setValue('')
  }

  let prevUserId = ''

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {messages.map((msg) => {
          const isNew = msg.userId !== prevUserId
          prevUserId = msg.userId
          const isMe = currentUser ? msg.userId === currentUser.id : msg.userId === 'me'
          return (
            <ChatMessage key={msg.id} message={msg} showHeader={isNew} isMe={isMe} />
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-3 border-t border-zinc-800">
        <div className="flex items-center gap-2 bg-zinc-900 rounded px-3 py-2">
          <input
            className="flex-1 bg-transparent text-zinc-100 text-sm outline-none placeholder:text-zinc-600"
            placeholder="Message..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button
            onClick={send}
            disabled={!value.trim()}
            className="text-zinc-500 hover:text-accent disabled:opacity-30 transition-colors cursor-pointer"
          >
            <IconSend size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function ChatMessage({ message, showHeader, isMe }: { message: Message; showHeader: boolean; isMe: boolean }) {
  return (
    <div className={`${showHeader ? 'mt-3' : 'mt-0.5'}`}>
      {showHeader && (
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center font-semibold text-white text-[9px] flex-shrink-0"
            style={{ backgroundColor: message.color }}
          >
            {message.initials}
          </div>
          <span className={`text-xs font-medium truncate ${isMe ? 'text-accent' : 'text-zinc-300'}`}>
            {message.username}
          </span>
          <span className="text-[10px] text-zinc-600">{message.time}</span>
        </div>
      )}
      <div className="pl-7">
        <p className="text-zinc-200 text-sm leading-relaxed break-words">{message.content}</p>
      </div>
    </div>
  )
}

function MusicTab({ activeRoomId, sharedMusicState, currentUser }: { activeRoomId?: string; sharedMusicState?: any; currentUser?: any }) {
  const [musicState, setMusicState] = useState<any>({
    track: null,
    isPlaying: false,
    queue: [],
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(210)
  const [volume, setVolume] = useState(75)
  const progressBarRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<any>(null)

  // Load YouTube IFrame API script
  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }
  }, []);

  // Request room music state
  useEffect(() => {
    if (activeRoomId) {
      wsClient.send('music:get_state', { roomId: activeRoomId });
    }

    const unsub = wsClient.on('music:sync', (sync: any) => {
      if (sync) {
        setMusicState({
          track: sync.track,
          isPlaying: !!sync.isPlaying,
          queue: sync.queue || [],
        });
      }
    });

    return () => unsub();
  }, [activeRoomId]);

    useEffect(() => {
    if (sharedMusicState && sharedMusicState.track !== undefined) {
      setMusicState(sharedMusicState);
    }
  }, [sharedMusicState]);

  const current = musicState.track;

  // Initialize and update YouTube Player for full length track
  useEffect(() => {
    if (!current) return;

    const initPlayer = () => {
      const YT = (window as any).YT;
      if (!YT || !YT.Player) {
        setTimeout(initPlayer, 250);
        return;
      }

      const videoId = current.providerTrackId;
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        try {
          playerRef.current.loadVideoById(videoId);
          playerRef.current.setVolume(volume);
          if (musicState.isPlaying) {
            playerRef.current.playVideo();
          } else {
            playerRef.current.pauseVideo();
          }
        } catch {}
      } else {
        const container = document.getElementById('yt-full-player');
        if (container) {
          playerRef.current = new YT.Player('yt-full-player', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
              autoplay: musicState.isPlaying ? 1 : 0,
              controls: 0,
              disablekb: 1,
              modestbranding: 1,
              rel: 0,
            },
            playerVars: {
              autoplay: musicState.isPlaying ? 1 : 0,
              controls: 0,
              disablekb: 1,
              modestbranding: 1,
              rel: 0,
              playsinline: 1,
            },
            events: {
              onReady: (e: any) => {
                e.target.setVolume(volume);
                try {
                  if (typeof e.target.setPlaybackQuality === 'function') {
                    e.target.setPlaybackQuality('small');
                  }
                } catch {}
                if (musicState.isPlaying) e.target.playVideo();
              },
              onStateChange: (e: any) => {
                // 0 means Track Ended naturally
                if (e.data === 0) {
                  handleSkip();
                }
              },
            },
          });
        }
      }
    };

    initPlayer();
  }, [current?.providerTrackId]);

  // Sync play/pause with YouTube player
  useEffect(() => {
    if (playerRef.current) {
      try {
        if (musicState.isPlaying && typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo();
        } else if (!musicState.isPlaying && typeof playerRef.current.pauseVideo === 'function') {
          playerRef.current.pauseVideo();
        }
      } catch {}
    }
  }, [musicState.isPlaying]);

  // Update volume
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      try {
        playerRef.current.setVolume(volume);
      } catch {}
    }
  }, [volume]);

  // Track real timeline time & duration every 500ms
  useEffect(() => {
    const timer = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const cur = playerRef.current.getCurrentTime();
          const dur = playerRef.current.getDuration() || current?.durationSeconds || 210;
          if (dur > 0) {
            setCurrentTime(cur);
            setDuration(dur);
          }
        } catch {}
      }
    }, 500);

    return () => clearInterval(timer);
  }, [current]);

  // Search full-length tracks
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      if (res.status === 429) {
        setSearchError(data.error || 'Song search limit reached. Max 12 searches per minute.');
        return;
      }
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('Full song search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const playSongNow = (song: any) => {
    if (!activeRoomId) return;
    const track = {
      id: song.videoId,
      provider: 'youtube',
      providerTrackId: song.videoId,
      title: song.title,
      artist: song.artist,
      thumbnailUrl: song.thumbnail,
      durationSeconds: song.durationSeconds || 210,
      addedBy: currentUser?.username || 'Member',
    };

    wsClient.send('music:control', {
      roomId: activeRoomId,
      action: 'play_now',
      track,
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  const addSongToQueue = (song: any) => {
    if (!activeRoomId) return;
    const track = {
      id: song.videoId,
      provider: 'youtube',
      providerTrackId: song.videoId,
      title: song.title,
      artist: song.artist,
      thumbnailUrl: song.thumbnail,
      durationSeconds: song.durationSeconds || 210,
      addedBy: currentUser?.username || 'Member',
    };

    wsClient.send('music:control', {
      roomId: activeRoomId,
      action: 'add_track',
      track,
    });
  };

  const togglePlay = () => {
    if (!activeRoomId) return;
    wsClient.send('music:control', {
      roomId: activeRoomId,
      action: musicState.isPlaying ? 'pause' : 'play',
    });
  };

  const handleSkip = () => {
    if (!activeRoomId) return;
    wsClient.send('music:control', {
      roomId: activeRoomId,
      action: 'skip',
    });
  };

  const playQueueIndex = (index: number) => {
    if (!activeRoomId) return;
    wsClient.send('music:control', {
      roomId: activeRoomId,
      action: 'play_index',
      position: index,
    });
  };

  const handleRemoveQueue = (index: number) => {
    if (!activeRoomId) return;
    wsClient.send('music:control', {
      roomId: activeRoomId,
      action: 'remove_queue',
      position: index,
    });
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = pct * duration;
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(targetTime, true);
    }
    setCurrentTime(targetTime);
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
      <div>
        {/* Sync status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${musicState.isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
            <span className="text-zinc-400 text-xs font-medium">{musicState.isPlaying ? 'Playing Full Track in Room' : 'Music Paused'}</span>
          </div>
          {current && (
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{current.artist}</span>
          )}
        </div>

        {/* Hidden 1x1 audio element for minimal CPU/GPU/network load */}
        <div className="w-[1px] h-[1px] overflow-hidden opacity-0 pointer-events-none absolute -left-[9999px]">
          <div id="yt-full-player" className="w-full h-full" />
        </div>

        {/* Audio Only Player Card */}
        {current ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 mb-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden flex-shrink-0 relative flex items-center justify-center">
                {current.thumbnailUrl ? (
                  <img src={current.thumbnailUrl} alt={current.title} className="w-full h-full object-cover" />
                ) : (
                  <IconMusic size={20} className="text-accent" />
                )}
                {musicState.isPlaying && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="flex items-end gap-0.5 h-3">
                      <span className="w-0.5 bg-accent rounded-full animate-bounce h-2" style={{ animationDelay: '0ms' }} />
                      <span className="w-0.5 bg-accent rounded-full animate-bounce h-3" style={{ animationDelay: '150ms' }} />
                      <span className="w-0.5 bg-accent rounded-full animate-bounce h-1.5" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-zinc-100 text-xs font-semibold truncate">{current.title}</p>
                <p className="text-zinc-400 text-[11px] truncate mt-0.5">{current.artist}</p>
                <span className="inline-block mt-1 text-[9px] bg-accent/15 text-accent font-medium px-1.5 py-0.2 rounded font-mono">Audio Only</span>
              </div>
            </div>

            {/* Live Timeline Scrubber */}
            <div className="my-2.5">
              <div
                ref={progressBarRef}
                onClick={handleSeek}
                className="w-full h-1.5 bg-zinc-800 rounded-full cursor-pointer relative overflow-hidden group"
                title="Click to seek"
              >
                <div
                  className="h-full bg-accent rounded-full transition-all duration-150"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-1 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 mt-2">
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent/90 transition-transform active:scale-95 cursor-pointer shadow"
                title={musicState.isPlaying ? 'Pause for room' : 'Play for room'}
              >
                {musicState.isPlaying ? <IconPause size={17} /> : <IconPlay size={17} />}
              </button>
              <button
                onClick={handleSkip}
                className="p-2 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Skip to next song in queue"
              >
                <IconSkipForward size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/40 border border-dashed border-zinc-800/80 rounded-lg p-5 mb-4 text-center">
            <IconMusic size={24} className="text-zinc-600 mx-auto mb-1.5" />
            <p className="text-zinc-300 text-xs font-medium">No song playing</p>
            <p className="text-zinc-500 text-[11px] mt-0.5">Search any song below to start playing!</p>
          </div>
        )}

        {/* Volume Control */}
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded px-3 py-2 mb-4">
          <div className="flex items-center justify-between text-zinc-400 text-[11px] mb-1">
            <span className="flex items-center gap-1.5"><IconVolume2 size={12} /> Volume</span>
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

        {/* Search Songs Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 mb-4">
          <p className="text-zinc-200 text-xs font-semibold mb-2 flex items-center gap-1.5">
            <IconSearch size={13} className="text-accent" /> Search Any Song
          </p>

          <div className="flex gap-1.5 mb-2">
            <input
              className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs rounded px-2.5 py-1.5 outline-none focus:border-accent placeholder:text-zinc-600"
              placeholder="Song or artist name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="bg-accent text-white text-xs px-3 py-1.5 rounded hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {searching ? '...' : 'Search'}
            </button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pt-1">
              {searchResults.map((song) => (
                <div
                  key={song.videoId}
                  className="flex items-center gap-2 p-1.5 rounded bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 transition-colors"
                >
                  <img src={song.thumbnail} alt="" className="w-10 h-7 rounded object-cover flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-zinc-200 text-xs font-medium truncate">{song.title}</p>
                    <p className="text-zinc-500 text-[10px] truncate">{song.artist} ({song.durationText})</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => playSongNow(song)}
                      className="text-[10px] bg-accent/20 hover:bg-accent text-accent hover:text-white px-2 py-1 rounded transition-colors cursor-pointer font-medium"
                      title="Play now in room"
                    >
                      Play
                    </button>
                    <button
                      onClick={() => addSongToQueue(song)}
                      className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-1.5 py-1 rounded transition-colors cursor-pointer"
                      title="Add to queue"
                    >
                      + Queue
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Up Next in Queue */}
        <div className="border-t border-zinc-800 pt-3">
          <p className="text-zinc-400 text-xs font-medium mb-2">
            Up Next in Queue ({musicState.queue.length})
          </p>

          {musicState.queue.length === 0 ? (
            <p className="text-zinc-600 text-[11px] py-1">Queue is empty. Search songs above to add to queue.</p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {musicState.queue.map((item: any, idx: number) => (
                <div
                  key={item.id || idx}
                  onClick={() => playQueueIndex(idx)}
                  className="flex items-center justify-between gap-2 p-1.5 rounded bg-zinc-900/60 border border-zinc-800/60 hover:bg-zinc-800/60 transition-colors cursor-pointer group"
                  title="Click to play this track now"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {item.thumbnailUrl && (
                      <img src={item.thumbnailUrl} alt="" className="w-8 h-6 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-zinc-200 text-xs font-medium truncate">
                        <span className="text-zinc-500 mr-1 font-mono">#{idx + 1}</span>
                        {item.title}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">{item.artist}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">Play</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveQueue(idx);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 p-1 rounded transition-opacity cursor-pointer"
                      title="Remove from queue"
                    >
                      <IconX size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
