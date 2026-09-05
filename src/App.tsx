import { useState, useEffect, useRef } from 'react';
import { IconHash, IconUsers, IconUser, IconMic, IconMicOff, IconHeadphones, IconHeadphonesOff, IconPhoneOff, IconPhoneHangup, IconMessageSquare, IconSettings } from './components/Icons';
import type { NavView, RightTab, AuthMode } from './types';
import { apiFetch, setAuthToken } from './lib/api';
import { wsClient } from './lib/ws';
import { voiceManager } from './lib/voice';
import AuthView from './views/AuthView';
import RoomsView from './views/RoomsView';
import VoiceRoomView from './views/VoiceRoomView';
import FriendsView from './views/FriendsView';
import SettingsView from './views/SettingsView';
import ProfileView from './views/ProfileView';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';
import GlobalMusicBar from './components/GlobalMusicBar';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('landing');
  const [navView, setNavView] = useState<NavView>('rooms');
  const [rooms, setRooms] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('chat');
  const [rightOpen, setRightOpen] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [incomingInvite, setIncomingInvite] = useState<any>(null);
  const [invites, setInvites] = useState<any[]>([]);

  // Navigation with Browser History integration
  const navigateNav = (view: NavView, push = true) => {
    setNavView(view);
    if (push) {
      const targetPath = view === 'rooms' ? (activeRoomId ? `/rooms/${activeRoomId}` : '/rooms') : `/${view}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ type: 'nav', view, activeRoomId }, '', targetPath);
      }
    }
  };

  const navigateAuth = (mode: AuthMode, push = true) => {
    setAuthMode(mode);
    if (push) {
      const targetPath = mode === 'landing' ? '/' : `/${mode}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ type: 'auth', authMode: mode }, '', targetPath);
      }
    }
  };

  // Restore route from URL on initial load
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/signin' || path === '/login') setAuthMode('signin');
    else if (path === '/signup' || path === '/register') setAuthMode('signup');
    else if (path === '/forgot') setAuthMode('forgot');
    else if (path === '/friends') setNavView('friends');
    else if (path === '/settings') setNavView('settings');
    else if (path === '/profile') setNavView('profile');
    else if (path.startsWith('/rooms')) setNavView('rooms');
  }, []);

  // Handle Browser Back / Forward Button Navigation (Arrow on top of browser)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const search = new URLSearchParams(window.location.search);

      if (!currentUser) {
        if (search.get('reset_token')) {
          setAuthMode('forgot');
          return;
        }
        if (path === '/signin' || path === '/login') {
          setAuthMode('signin');
        } else if (path === '/signup' || path === '/register') {
          setAuthMode('signup');
        } else if (path === '/forgot') {
          setAuthMode('forgot');
        } else {
          setAuthMode('landing');
        }
        return;
      }

      // Authenticated navigation
      if (path.startsWith('/rooms/')) {
        const rId = path.replace('/rooms/', '').trim();
        setNavView('rooms');
        if (rId && rId !== activeRoomId) {
          handleJoin(rId);
        }
      } else if (path === '/friends') {
        setNavView('friends');
      } else if (path === '/settings') {
        setNavView('settings');
      } else if (path === '/profile') {
        setNavView('profile');
      } else {
        setNavView('rooms');
        if (activeRoomId) {
          handleDisconnect();
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser, activeRoomId]);

  const loadInvites = () => {
    apiFetch('/api/rooms/invites')
      .then((data) => {
        const valid = (data.invites || []).filter((inv: any) => inv.expiresAt > Date.now());
        setInvites(valid);
      })
      .catch(() => {});
  };
  
  // Global WebSocket listeners (real-time invites and room updates even when not in a room)
  useEffect(() => {
    if (!currentUser) return;

    const offInvite = wsClient.on('room:invite_received', (inv: any) => {
      const fullInvite = {
        id: inv.id || `inv-${Date.now()}`,
        roomId: inv.roomId,
        roomName: inv.roomName,
        fromUserId: inv.fromUserId,
        fromUsername: inv.fromUsername || 'Friend',
        expiresAt: inv.expiresAt || (Date.now() + 5 * 60 * 1000),
      };
      setInvites((prev) => [fullInvite, ...prev.filter((x) => x.id !== fullInvite.id && x.roomId !== inv.roomId)]);
      setIncomingInvite(fullInvite);
    });

    const offRoomDeleted = wsClient.on('room:deleted', ({ roomId }: any) => {
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      if (activeRoomId === roomId) {
        handleDisconnect();
      }
    });

    const offMemberLeft = wsClient.on('room:member_left', ({ roomId, userId }: any) => {
      setRooms((prev) =>
        prev.map((r) => {
          if (r.id !== roomId) return r;
          const updated = r.members?.filter((m: any) => m.id !== userId) || [];
          return { ...r, memberCount: updated.length, members: updated };
        })
      );
    });

    const offMemberJoined = wsClient.on('room:member_joined', ({ roomId, member }: any) => {
      setRooms((prev) =>
        prev.map((r) => {
          if (r.id !== roomId) return r;
          const exists = r.members?.some((m: any) => m.id === member.id);
          const updated = exists ? r.members : [...(r.members || []), member];
          return { ...r, memberCount: updated.length, members: updated };
        })
      );
    });

    return () => {
      offInvite();
      offRoomDeleted();
      offMemberLeft();
      offMemberJoined();
    };
  }, [currentUser?.id, activeRoomId]);

  const [roomMusicState, setRoomMusicState] = useState<any>({ track: null, isPlaying: false, queue: [] });

  // Dedicated Cross-Room Music Synchronization
  useEffect(() => {
    if (!currentUser) return;

    const offMusic = wsClient.on('music:sync', (sync: any) => {
      if (sync) {
        setRoomMusicState(sync);
      }
    });

    // Request initial music state immediately
    wsClient.send('music:get_state', { roomId: activeRoomId || 'global' });

    return () => {
      offMusic();
    };
  }, [currentUser?.id, activeRoomId]);

  const [mobileAudioBlocked, setMobileAudioBlocked] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('joinRoom');
    if (joinId) {
      sessionStorage.setItem('pendingJoinRoom', joinId);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      const pending = sessionStorage.getItem('pendingJoinRoom');
      if (pending) {
        sessionStorage.removeItem('pendingJoinRoom');
        window.history.replaceState({}, '', window.location.pathname);
        handleJoin(pending);
      }
    }
  }, [currentUser]);


  useEffect(() => {
    if (mobileAudioBlocked) {
      const timer = setTimeout(() => setMobileAudioBlocked(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [mobileAudioBlocked]);
  const globalAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const handleFirstGesture = () => {
      voiceManager.unlockAudio();
    };
    window.addEventListener('click', handleFirstGesture, { once: true });
    window.addEventListener('touchstart', handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };
  }, []);

  const loadRooms = () => {
    apiFetch('/api/rooms')
      .then((data) => setRooms(data.rooms || []))
      .catch(console.error);
  };

  const loadFriends = () => {
    apiFetch('/api/friends')
      .then((data) => setFriends(data.friends || []))
      .catch(console.error);
  };

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((data) => {
        setCurrentUser(data.user);
        wsClient.connect();
        loadRooms();
        loadFriends();
        loadInvites();
      })
      .catch(() => setCurrentUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeRoomId) return;
    apiFetch(`/api/rooms/${activeRoomId}/messages`)
      .then((data) => {
        setMessages(
          (data.messages || []).map((m: any) => ({
            id: m.id,
            userId: m.userId,
            username: m.author?.username || 'User',
            initials: (m.author?.username || 'U').slice(0, 2).toUpperCase(),
            color: '#7c7cf5',
            content: m.content,
            time: new Date(m.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          }))
        );
      })
      .catch(console.error);

    const offChat = wsClient.on('chat:message', (msg: any) => {
      if (msg.roomId === activeRoomId) {
        setMessages((prev) => [
          ...prev,
          {
            id: msg.id,
            userId: msg.userId,
            username: msg.author?.username || 'User',
            initials: (msg.author?.username || 'U').slice(0, 2).toUpperCase(),
            color: '#7c7cf5',
            content: msg.content,
            time: new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          },
        ]);
      }
    });

    const offMemberLeft = wsClient.on('room:member_left', ({ roomId, userId }: any) => {
      setRooms((prev) =>
        prev.map((r) => {
          if (r.id !== roomId) return r;
          const updated = r.members?.filter((m: any) => m.id !== userId) || [];
          return { ...r, memberCount: updated.length, members: updated };
        })
      );
    });

    const offMemberJoined = wsClient.on('room:member_joined', ({ roomId, member }: any) => {
      setRooms((prev) =>
        prev.map((r) => {
          if (r.id !== roomId) return r;
          const exists = r.members?.some((m: any) => m.id === member.id);
          const updated = exists ? r.members : [...(r.members || []), member];
          return { ...r, memberCount: updated.length, members: updated };
        })
      );
    });

    const offRoomDeleted = wsClient.on('room:deleted', ({ roomId }: any) => {
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      if (activeRoomId === roomId) {
        handleDisconnect();
      }
    });

    const offInvite = wsClient.on('room:invite_received', (inv: any) => {
      const fullInvite = {
        id: inv.id || `inv-${Date.now()}`,
        roomId: inv.roomId,
        roomName: inv.roomName,
        fromUserId: inv.fromUserId,
        fromUsername: inv.fromUsername || 'Friend',
        expiresAt: inv.expiresAt || (Date.now() + 5 * 60 * 1000),
      };
      setInvites((prev) => [fullInvite, ...prev.filter((x) => x.roomId !== inv.roomId)]);
      setIncomingInvite(fullInvite);
    });

    const offVoice = wsClient.on('voice:state_change', (vs: any) => {
      if (vs.roomId === activeRoomId) {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === activeRoomId
              ? {
                  ...r,
                  members: r.members?.map((m: any) =>
                    m.id === vs.userId ? { ...m, isSpeaking: vs.isSpeaking, isMuted: vs.isMuted, isDeafened: vs.isDeafened } : m
                  ),
                }
              : r
          )
        );
      }
    });

    const offPeerJoined = wsClient.on('voice:peer_joined', (data: any) => {
      if (!data?.userId) return;
      setRooms((prev) =>
        prev.map((r) =>
          r.id === activeRoomId
            ? {
                ...r,
                members: r.members?.map((m: any) =>
                  m.id === data.userId
                    ? { ...m, isMuted: !!data.isMuted, isDeafened: !!data.isDeafened, isSpeaking: !!data.isSpeaking }
                    : m
                ),
              }
            : r
        )
      );
    });

    const offExistingPeers = wsClient.on('voice:existing_peers', (data: any) => {
      if (!data?.peers || !Array.isArray(data.peers)) return;
      const peerMap = new Map<string, any>(data.peers.map((p: any) => [p.userId, p]));
      setRooms((prev) =>
        prev.map((r) =>
          r.id === activeRoomId
            ? {
                ...r,
                members: r.members?.map((m: any) => {
                  const p = peerMap.get(m.id);
                  return p ? { ...m, isMuted: !!p.isMuted, isDeafened: !!p.isDeafened, isSpeaking: !!p.isSpeaking } : m;
                }),
              }
            : r
        )
      );
    });

    return () => {
      offChat();
      offVoice();
      offPeerJoined();
      offExistingPeers();
      offInvite();
      offMemberLeft();
      offMemberJoined();
      offRoomDeleted();
    };
  }, [activeRoomId]);

  
  const handleAcceptInvite = async (inv: any) => {
    try {
      await apiFetch(`/api/rooms/invites/${inv.id}/accept`, { method: 'POST' }).catch(() => {});
      setInvites((prev) => prev.filter((x) => x.id !== inv.id));
      setIncomingInvite(null);
      await handleJoin(inv.roomId);
    } catch (err: any) {
      alert(err.message || 'Failed to join room');
    }
  };

  const handleDeclineInvite = async (invId: string) => {
    await apiFetch(`/api/rooms/invites/${invId}/decline`, { method: 'POST' }).catch(() => {});
    setInvites((prev) => prev.filter((x) => x.id !== invId));
    if (incomingInvite?.id === invId) {
      setIncomingInvite(null);
    }
  };

  const handleJoin = async (id: string) => {
    try {
      await apiFetch(`/api/rooms/${id}/join`, { method: 'POST' });
      setActiveRoomId(id);
      wsClient.send("music:get_state", { roomId: id });
      setNavView('rooms');
      setRightOpen(true);
      const targetPath = `/rooms/${id}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ type: 'room', roomId: id }, '', targetPath);
      }

      // Connect live WebRTC Voice Chat across devices!
      await voiceManager.joinRoom(id, currentUser.id, (speaking) => {
        setIsSpeaking(speaking);
        wsClient.send('voice:state_change', {
          roomId: id,
          isMuted,
          isDeafened,
          isSpeaking: speaking,
        });
      });
      loadRooms();
    } catch (err: any) {
      alert(err.message || 'Failed to join room');
    }
  };

  const handleDisconnect = async () => {
    if (activeRoomId) {
      voiceManager.leaveRoom();
      const res: any = await apiFetch(`/api/rooms/${activeRoomId}/leave`, { method: 'POST' }).catch(() => ({}));
      setActiveRoomId(null);
      setIsMuted(false);
      setIsDeafened(false);
      if (window.location.pathname !== '/rooms') {
        window.history.pushState({ type: 'nav', view: 'rooms' }, '', '/rooms');
      }

      if (currentUser?.isGuest || res?.guestEnded) {
        setAuthToken(null);
        setCurrentUser(null);
        wsClient.disconnect();
        setNavView('rooms');
      } else {
        loadRooms();
      }
    }
  };

  const handleLogout = async () => {
    // Call backend to revoke server-side session
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    // Clear client-side state
    setAuthToken(null);
    setCurrentUser(null);
    wsClient.disconnect();
    setNavView('rooms');
    setAuthMode('landing');
    // Clean any stale URL params
    window.history.replaceState({}, '', '/');
  };

  
  useEffect(() => {
    if (!activeRoomId || !roomMusicState?.track || !roomMusicState.isPlaying) {
      if (globalAudioRef.current) {
        globalAudioRef.current.pause();
      }
      return;
    }

    const track = roomMusicState.track;
    if (track.provider !== 'youtube' && track.providerTrackId && (track.providerTrackId.startsWith('http') || track.providerTrackId.startsWith('/'))) {
      if (!globalAudioRef.current) {
        globalAudioRef.current = new Audio(track.providerTrackId);
        globalAudioRef.current.onended = () => {
          wsClient.send('music:control', { roomId: activeRoomId, action: 'skip' });
        };
      } else if (globalAudioRef.current.src !== track.providerTrackId) {
        globalAudioRef.current.src = track.providerTrackId;
      }

      globalAudioRef.current.play()
        .then(() => setMobileAudioBlocked(false))
        .catch(() => {
          // Mobile browser autoplay policy blocked audio
          setMobileAudioBlocked(true);
        });
    }
  }, [activeRoomId, roomMusicState?.track, roomMusicState?.isPlaying]);
  
  const handleSendMessage = (content: string) => {
    if (!activeRoomId) return;
    wsClient.send('chat:send', { roomId: activeRoomId, content });
  };

  const handleMuteToggle = () => {
    if (isDeafened) {
      // Discord rule: When deafened, user CANNOT unmute! Must undeafen first.
      return;
    }
    const next = !isMuted;
    setIsMuted(next);
    voiceManager.setMuted(next);
    if (activeRoomId) {
      wsClient.send('voice:state_change', {
        roomId: activeRoomId,
        isMuted: next,
        isDeafened: false,
        isSpeaking: false,
      });
      setRooms((prev) =>
        prev.map((r) =>
          r.id === activeRoomId
            ? {
                ...r,
                members: r.members?.map((m: any) =>
                  m.id === currentUser?.id ? { ...m, isMuted: next, isDeafened: false, isSpeaking: false } : m
                ),
              }
            : r
        )
      );
    }
  };

  const handleDeafenToggle = () => {
    const nextDeafen = !isDeafened;
    setIsDeafened(nextDeafen);
    voiceManager.setDeafened(nextDeafen);
    const nextMute = nextDeafen ? true : isMuted;
    if (nextDeafen) {
      setIsMuted(true);
      voiceManager.setMuted(true);
    }
    if (activeRoomId) {
      wsClient.send('voice:state_change', {
        roomId: activeRoomId,
        isMuted: nextMute,
        isDeafened: nextDeafen,
        isSpeaking: false,
      });
      setRooms((prev) =>
        prev.map((r) =>
          r.id === activeRoomId
            ? {
                ...r,
                members: r.members?.map((m: any) =>
                  m.id === currentUser?.id ? { ...m, isMuted: nextMute, isDeafened: nextDeafen, isSpeaking: false } : m
                ),
              }
            : r
        )
      );
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950 text-zinc-400">
        <p className="text-sm">Connecting to EchoWire...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthView
        mode={authMode}
        onModeChange={navigateAuth}
        onAuth={(user?: any) => {
          if (user) {
            setCurrentUser(user);
            wsClient.connect();
            loadRooms();
            loadFriends();
            loadInvites();
          } else {
            apiFetch('/api/auth/me')
              .then((d) => {
                setCurrentUser(d.user);
                wsClient.connect();
                loadRooms();
                loadFriends();
                loadInvites();
              })
              .catch(console.error);
          }
        }}
      />
    );
  }

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;
  const pendingCount = friends.filter((f) => f.state === 'pending-in').length;

  return (
    <div className="flex h-[100dvh] w-full bg-zinc-950 text-zinc-100 overflow-hidden select-none sm:select-auto">
      <Sidebar
        currentUser={currentUser}
        navView={navView}
        onNavChange={navigateNav}
        activeRoom={activeRoom}
        isMuted={isMuted}
        isDeafened={isDeafened}
        pendingFriends={pendingCount}
        onMute={handleMuteToggle}
        onDeafen={handleDeafenToggle}
        onDisconnect={handleDisconnect}
      />

            <main className="flex-1 flex min-w-0 overflow-hidden relative pb-16 sm:pb-0">
        {incomingInvite && (
          <TimedInvitePopup
            invite={incomingInvite}
            onAccept={() => {
              handleJoin(incomingInvite.roomId);
              setIncomingInvite(null);
            }}
            onDecline={() => setIncomingInvite(null)}
          />
        )}
        {navView === 'rooms' && activeRoom ? (
          <VoiceRoomView
            room={activeRoom}
            currentUser={currentUser}
            onMute={handleMuteToggle}
            onDisconnect={handleDisconnect}
            isMuted={isMuted}
            isDeafened={isDeafened}
            rightOpen={rightOpen}
            rightTab={rightTab}
            onRightTabChange={(t) => { setRightTab(t); setRightOpen(true); }}
            onToggleRight={() => setRightOpen((v) => !v)}
          />
        ) : navView === 'rooms' ? (
          <RoomsView rooms={rooms} onJoin={handleJoin} onRefresh={loadRooms} currentUser={currentUser} />
        ) : navView === 'friends' ? (
          <FriendsView
            friends={friends}
            activeRoom={activeRoom}
            onRefresh={loadFriends}
            invites={invites}
            onAcceptInvite={handleAcceptInvite}
            onDeclineInvite={handleDeclineInvite}
            onRefreshInvites={loadInvites}
          />
        ) : navView === 'profile' ? (
          <ProfileView
            currentUser={currentUser}
            onBack={() => navigateNav('rooms')}
            onLogout={handleLogout}
          />
        ) : (
          <SettingsView
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Thumb-friendly Mobile Bottom Bar (visible on phones) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/90 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),10px)] flex items-center justify-around shadow-2xl">
        <button
          onClick={() => navigateNav('rooms')}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[44px] rounded-lg transition-all active:scale-95 cursor-pointer ${navView === 'rooms' ? 'text-accent font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          <IconHash size={20} />
          <span className="text-[10px]">Rooms</span>
        </button>

        <button
          onClick={() => navigateNav('friends')}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[44px] rounded-lg relative transition-all active:scale-95 cursor-pointer ${navView === 'friends' ? 'text-accent font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          <IconUsers size={20} />
          <span className="text-[10px]">Friends</span>
          {pendingCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-accent animate-ping" />
          )}
        </button>

        {activeRoom ? (
          <>
            <div className="h-6 w-px bg-zinc-800 mx-0.5" />
            <button
              onClick={handleMuteToggle}
              disabled={isDeafened}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 shadow ${isDeafened ? 'bg-zinc-800/80 text-zinc-500 border border-zinc-700/60 cursor-not-allowed opacity-60' : isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30 cursor-pointer' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-pointer'}`}
              title={isDeafened ? 'Undeafen to unmute mic' : isMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {isMuted || isDeafened ? <IconMicOff size={18} /> : <IconMic size={18} />}
            </button>

            <button
              onClick={handleDeafenToggle}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 shadow cursor-pointer ${isDeafened ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}
              title={isDeafened ? 'Undeafen Headphones' : 'Deafen Headphones'}
            >
              {isDeafened ? <IconHeadphonesOff size={18} /> : <IconHeadphones size={18} />}
            </button>

            <button
              onClick={() => setRightOpen((v) => !v)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${rightOpen ? 'bg-accent text-white' : 'bg-zinc-800 text-zinc-300'}`}
              title="Chat & Music"
            >
              <IconMessageSquare size={18} />
            </button>

            <button
              onClick={handleDisconnect}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 text-white border border-red-500/50 shadow-lg active:scale-90 transition-all cursor-pointer"
              title="Leave Room (End Call)"
            >
              <IconPhoneHangup size={18} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => navigateNav('profile')}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[44px] rounded-lg transition-all active:scale-95 cursor-pointer ${navView === 'profile' ? 'text-accent font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <IconUser size={20} />
              <span className="text-[10px]">Profile</span>
            </button>
            <button
              onClick={() => navigateNav('settings')}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[44px] rounded-lg transition-all active:scale-95 cursor-pointer ${navView === 'settings' ? 'text-accent font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <IconSettings size={20} />
              <span className="text-[10px]">Settings</span>
            </button>
          </>
        )}
      </nav>


      {/* Mobile Audio Autoplay Unlock Banner */}
      {mobileAudioBlocked && activeRoom && (
        <div
          onClick={() => {
            setMobileAudioBlocked(false);
            voiceManager.unlockAudio();
          }}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-accent text-white px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-white/20 cursor-pointer animate-in fade-in"
        >
          <span className="text-xs font-medium">Audio ready. Tap to listen</span>
          <button
            type="button"
            className="bg-white text-zinc-900 text-xs font-bold px-3 py-1 rounded-full cursor-pointer hover:bg-zinc-100 shadow"
          >
            Dismiss
          </button>
        </div>
      )}

      {currentUser && rightOpen && (activeRoom || rightTab === 'music') && (
        <RightPanel
          room={activeRoom}
          activeRoomId={activeRoomId}
          sharedMusicState={roomMusicState}
          messages={messages}
          tab={rightTab}
          onTabChange={setRightTab}
          onClose={() => setRightOpen(false)}
          onSendMessage={handleSendMessage}
          currentUser={currentUser}
        />
      )}

      {currentUser && (
        <GlobalMusicBar
          musicState={roomMusicState}
          activeRoomId={activeRoomId}
          onOpenMusicPanel={() => {
            setRightTab('music');
            setRightOpen(true);
          }}
        />
      )}
    </div>
  );
}

function TimedInvitePopup({ invite, onAccept, onDecline }: { invite: any; onAccept: () => void; onDecline: () => void }) {
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, Math.floor((invite.expiresAt - Date.now()) / 1000)));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((invite.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        onDecline();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [invite]);

  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  const timeFormatted = `${m}:${s < 10 ? '0' : ''}${s}`;
  const pct = (timeLeft / 300) * 100;

  return (
    <div className="fixed top-5 left-4 right-4 sm:left-auto sm:right-5 sm:w-80 z-50 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-4">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-accent/20 text-accent font-semibold flex items-center justify-center text-xs flex-shrink-0">
            {invite.fromUsername ? invite.fromUsername.slice(0, 2).toUpperCase() : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-zinc-100 text-xs font-semibold truncate">
              {invite.fromUsername}
            </p>
            <p className="text-zinc-400 text-[11px] truncate">
              invited you to <span className="text-zinc-200 font-medium">{invite.roomName}</span>
            </p>
          </div>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 flex-shrink-0">
          {timeFormatted}
        </span>
      </div>

      <div className="w-full bg-zinc-950 rounded-full h-1 mb-3.5 overflow-hidden">
        <div
          className="bg-accent h-full transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onDecline}
          className="flex-1 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
        >
          Decline
        </button>
        <button
          onClick={onAccept}
          className="flex-1 py-1.5 rounded bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors cursor-pointer shadow"
        >
          Accept & Join
        </button>
      </div>
    </div>
  );
}
