import { voiceManager, type NoiseCancellationMode } from '../lib/voice';
import React, { useState, useEffect, useRef } from 'react';
import type { Room, RightTab, Friend } from '../types';
import {
  IconMessageSquare,
  IconMusic,
  IconChevronRight,
  IconMoreHorizontal,
  IconMicOff,
  IconUsers,
  IconVolume2,
  IconPhoneHangup,
  IconShare,
  IconHeadphonesOff,
  IconWave,
  IconX,
  IconCheck,
  IconSearch
} from '../components/Icons';
import { apiFetch } from '../lib/api';
import { wsClient } from '../lib/ws';

interface Props {
  room: Room;
  currentUser?: any;
  friends?: Friend[];
  isMuted: boolean;
  isDeafened: boolean;
  onMute?: () => void;
  onDisconnect?: () => void;
  rightOpen: boolean;
  rightTab: RightTab;
  onRightTabChange: (t: RightTab) => void;
  onToggleRight: () => void;
}

export default function VoiceRoomView({
  room,
  currentUser,
  friends = [],
  isMuted,
  isDeafened,
  onMute,
  onDisconnect,
  rightOpen,
  rightTab,
  onRightTabChange,
  onToggleRight,
}: Props) {
  const [copiedRoomLink, setCopiedRoomLink] = useState(false);
  const handleCopyRoomLink = () => {
    const link = `${window.location.origin}/?joinRoom=${room.id}`;
    navigator.clipboard.writeText(link);
    setCopiedRoomLink(true);
    setTimeout(() => setCopiedRoomLink(false), 2500);
  };

  const [ncMode, setNcMode] = useState<NoiseCancellationMode>(() => voiceManager.getNoiseCancellationMode());
  const [showNcMenu, setShowNcMenu] = useState(false);
  const ncMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return voiceManager.onNoiseCancellationModeChange((newMode) => {
      setNcMode(newMode);
    });
  }, []);

  useEffect(() => {
    if (!showNcMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ncMenuRef.current && !ncMenuRef.current.contains(e.target as Node)) {
        setShowNcMenu(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showNcMenu]);

  const handleSelectNcMode = async (mode: NoiseCancellationMode) => {
    setShowNcMenu(false);
    await voiceManager.setNoiseCancellationMode(mode);
    setNcMode(voiceManager.getNoiseCancellationMode());
  };

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [userVolumes, setUserVolumes] = useState<Record<string, number>>({});
  const [locallyMuted, setLocallyMuted] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  // In-Room Friends Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [invitedUserIds, setInvitedUserIds] = useState<Record<string, boolean>>({});
  const [invitingUserIds, setInvitingUserIds] = useState<Record<string, boolean>>({});
  const [modalFriends, setModalFriends] = useState<any[]>(friends || []);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  // Sync with prop when available
  useEffect(() => {
    if (friends && friends.length > 0) {
      setModalFriends(friends);
    }
  }, [friends]);

  // Real-time fresh fetch whenever Invite Modal is opened
  useEffect(() => {
    if (showInviteModal) {
      setIsLoadingFriends(true);
      apiFetch('/api/friends')
        .then((data) => {
          if (data?.friends && Array.isArray(data.friends)) {
            setModalFriends(data.friends);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingFriends(false));
    }
  }, [showInviteModal]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClose = () => setActiveMenuId(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const isOwner = currentUser?.id ? room.ownerId === currentUser.id : false;

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVolumeChange = (userId: string, vol: number) => {
    setUserVolumes((prev) => ({ ...prev, [userId]: vol }));
    voiceManager.setPeerVolume(userId, vol);
  };

  const handleToggleLocalMute = (userId: string) => {
    const next = !locallyMuted[userId];
    setLocallyMuted((prev) => ({ ...prev, [userId]: next }));
    voiceManager.setPeerMuted(userId, next);
  };

  const [kickingId, setKickingId] = useState<string | null>(null);

  const handleKickMember = async (memberId: string, memberName: string) => {
    if (!window.confirm(`Kick ${memberName} from this room?`)) return;
    setKickingId(memberId);
    try {
      await apiFetch(`/api/rooms/${room.id}/kick`, {
        method: 'POST',
        body: JSON.stringify({ targetUserId: memberId }),
      });
      setActiveMenuId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to kick member');
    } finally {
      setKickingId(null);
    }
  };

  const handleInviteFriend = async (friend: any) => {
    const targetUserId = friend.userId || friend.id;
    if (!targetUserId) return;
    setInvitingUserIds((prev) => ({ ...prev, [targetUserId]: true }));
    try {
      await apiFetch('/api/rooms/invites', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId,
          roomId: room.id,
          roomName: room.name,
        }),
      });
      wsClient.send('room:invite', {
        targetUserId,
        roomId: room.id,
        roomName: room.name,
      });
      setInvitedUserIds((prev) => ({ ...prev, [targetUserId]: true }));
    } catch (err) {
      console.error('Failed to send invite:', err);
    } finally {
      setInvitingUserIds((prev) => ({ ...prev, [targetUserId]: false }));
    }
  };

  const eligibleFriends = modalFriends.filter((f) => {
    const st = f.state || '';
    return st === 'friend' || st === 'accepted' || (!st.startsWith('pending') && st !== 'blocked');
  });

  const filteredFriends = eligibleFriends.filter((f) =>
    (f.username || '').toLowerCase().includes(inviteSearchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative">
      <div className="flex items-center justify-between gap-2 px-3.5 py-3 sm:px-6 sm:py-4 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur">
        {/* Room Header Info */}
        <div className="min-w-0 flex items-center gap-2">
          <h1 className="text-zinc-100 font-semibold text-sm sm:text-base truncate max-w-[150px] sm:max-w-[240px]">{room.name}</h1>
          <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Connected
          </span>
        </div>

        {/* Clean, Non-Stacking Single-Row Toolbar */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap flex-shrink-0">
          {/* Noise Cancellation & Engine Selector (Open & Accessible in Room Toolbar) */}
          <div className="relative flex-shrink-0" ref={ncMenuRef}>
            <div className="flex items-center rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors p-0.5">
              {/* Quick toggle icon: toggles between active and off */}
              <button
                onClick={() => {
                  const next = ncMode === 'off' ? 'dsp' : 'off';
                  handleSelectNcMode(next);
                }}
                className={`p-1.5 rounded-md transition-colors cursor-pointer active:scale-95 ${
                  ncMode === 'dsp'
                    ? 'text-blue-400 hover:text-blue-300'
                    : ncMode === 'rnnoise'
                    ? 'text-purple-400 hover:text-purple-300'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title={
                  ncMode === 'dsp'
                    ? 'Noise Cancellation: Studio DSP (Click to turn off)'
                    : ncMode === 'rnnoise'
                    ? 'Noise Cancellation: AI RNNoise (Click to turn off)'
                    : 'Noise Cancellation: OFF (Click to turn on)'
                }
              >
                <IconWave size={17} />
              </button>

              {/* Mode Badge & Dropdown Trigger */}
              <button
                onClick={() => setShowNcMenu(!showNcMenu)}
                className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer select-none ${
                  ncMode === 'dsp'
                    ? 'text-blue-300 bg-blue-500/15 hover:bg-blue-500/25'
                    : ncMode === 'rnnoise'
                    ? 'text-purple-300 bg-purple-500/15 hover:bg-purple-500/25'
                    : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800'
                }`}
                title="Switch Noise Cancellation Engine"
              >
                <span className="hidden xs:inline sm:inline">
                  {ncMode === 'dsp' ? 'Studio' : ncMode === 'rnnoise' ? 'AI Neural' : 'Off'}
                </span>
                <span className="xs:hidden sm:hidden">
                  {ncMode === 'dsp' ? 'DSP' : ncMode === 'rnnoise' ? 'AI' : 'Off'}
                </span>
                <svg
                  className={`w-3 h-3 transition-transform ${showNcMenu ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>

            {/* Quick Engine Dropdown Popover */}
            {showNcMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-64 p-1.5 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1.5 border-b border-zinc-800/80 mb-1">
                  <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Noise Cancellation Engine</p>
                  <p className="text-[10px] text-zinc-500">Switch algorithm directly in call</p>
                </div>

                {/* Option 1: Studio DSP */}
                <button
                  onClick={() => handleSelectNcMode('dsp')}
                  className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors cursor-pointer ${
                    ncMode === 'dsp' ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30' : 'hover:bg-zinc-800 text-zinc-300'
                  }`}
                >
                  <span className="text-base leading-none mt-0.5">🎙️</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Studio Isolation</span>
                      {ncMode === 'dsp' && <span className="text-blue-400 text-xs font-bold">✓</span>}
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">
                      Zero latency (&lt;1ms), natural tone, bird chirp ducking & AC hum notch.
                    </p>
                  </div>
                </button>

                {/* Option 2: AI RNNoise */}
                <button
                  onClick={() => handleSelectNcMode('rnnoise')}
                  className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors cursor-pointer mt-1 ${
                    ncMode === 'rnnoise' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30' : 'hover:bg-zinc-800 text-zinc-300'
                  }`}
                >
                  <span className="text-base leading-none mt-0.5">🧠</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">AI Neural (RNNoise)</span>
                      {ncMode === 'rnnoise' && <span className="text-purple-400 text-xs font-bold">✓</span>}
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">
                      Deep-learning WASM AI. Scrubs out mechanical typing, barking dogs & chatter.
                    </p>
                  </div>
                </button>

                {/* Option 3: Off */}
                <button
                  onClick={() => handleSelectNcMode('off')}
                  className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors cursor-pointer mt-1 ${
                    ncMode === 'off' ? 'bg-zinc-800/80 text-zinc-200 border border-zinc-700' : 'hover:bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <span className="text-base leading-none mt-0.5">⭕</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Disabled (Raw Mic)</span>
                      {ncMode === 'off' && <span className="text-zinc-400 text-xs font-bold">✓</span>}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">
                      Direct raw pass-through without acoustic processing.
                    </p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Share Room */}
          <button
            onClick={handleCopyRoomLink}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-accent text-zinc-300 hover:text-white text-xs font-medium transition-all shadow-sm cursor-pointer active:scale-95 flex-shrink-0"
            title="Copy sharable room link"
          >
            <IconShare size={13} />
            <span className="hidden sm:inline">{copiedRoomLink ? 'Copied!' : 'Share'}</span>
          </button>

          {/* End Call / Leave Button */}
          {onDisconnect && (
            <button
              onClick={onDisconnect}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-md active:scale-95 transition-all cursor-pointer flex-shrink-0"
              title="Leave Room (End Call)"
            >
              <IconPhoneHangup size={13} />
              <span className="hidden sm:inline">End Call</span>
            </button>
          )}

          {/* Action buttons beside End Call */}
          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            {/* Friends Button: Opens In-Room Invite modal */}
            <button
              onClick={() => setShowInviteModal(true)}
              className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 p-1.5 rounded transition-colors cursor-pointer"
              title="Invite Friends to Room"
            >
              <IconUsers size={16} />
            </button>

            {/* Chat Button */}
            <button
              onClick={() => {
                if (rightOpen && rightTab === 'chat') {
                  onToggleRight();
                } else {
                  onRightTabChange('chat');
                }
              }}
              className={`p-1.5 rounded transition-colors cursor-pointer ${rightOpen && rightTab === 'chat' ? 'text-accent bg-zinc-800' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
              title="Room Chat"
            >
              <IconMessageSquare size={16} />
            </button>

            {/* Music Button */}
            <button
              onClick={() => {
                if (rightOpen && rightTab === 'music') {
                  onToggleRight();
                } else {
                  onRightTabChange('music');
                }
              }}
              className={`p-1.5 rounded transition-colors cursor-pointer ${rightOpen && rightTab === 'music' ? 'text-accent bg-zinc-800' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
              title="Music Player"
            >
              <IconMusic size={16} />
            </button>

            {/* Expand / Collapse Chevron */}
            <button
              onClick={onToggleRight}
              className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
              title={rightOpen ? 'Collapse panel' : 'Expand panel'}
            >
              <IconChevronRight size={16} className={`transition-transform duration-200 ${rightOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 pb-24 sm:pb-6">
        <p className="text-zinc-600 text-xs font-medium uppercase tracking-wide mb-4">
          {room.memberCount} {room.memberCount === 1 ? 'participant' : 'participants'}
        </p>

        <div className="space-y-1">
          {room.members.map((member) => {
            const isMe = currentUser ? member.id === currentUser.id : member.isMe;
            const vol = userVolumes[member.id] ?? 100;
            const isLocallyMuted = locallyMuted[member.id] ?? false;

            return (
              <div
                key={member.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded group transition-colors ${member.isSpeaking ? 'bg-accent/8' : 'hover:bg-zinc-900/50'}`}
              >
                <div className={`relative flex-shrink-0 ${member.isSpeaking ? 'ring-2 ring-accent/60 rounded-full' : ''}`}>
                  <Avatar initials={member.initials} color={member.color} size="md" />
                  {member.isOwner && (
                    <span className="absolute -top-1 -right-1 text-[9px] bg-zinc-700 text-zinc-300 rounded-full w-3.5 h-3.5 flex items-center justify-center">
                      *
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className={`text-sm font-medium truncate ${isMe ? 'text-zinc-100' : 'text-zinc-200'}`}>
                      <span>{member.username}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">#{member.tag || (member.isGuest ? 'guest' : '1000')}</span>
                      {isMe && <span className="text-zinc-500 font-normal text-xs ml-1">(you)</span>}
                    </span>
                    {member.isSpeaking && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                    )}
                    {(isMe ? isMuted : (member.isMuted || isLocallyMuted)) && (
                      <span className="flex items-center gap-1 text-[11px] text-red-400 bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 rounded font-medium flex-shrink-0" title="Microphone Muted">
                        <IconMicOff size={11} />
                        <span>Muted</span>
                      </span>
                    )}
                    {(isMe ? isDeafened : member.isDeafened) && (
                      <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded font-medium flex-shrink-0" title="Audio Deafened">
                        <IconHeadphonesOff size={11} />
                        <span>Deafened</span>
                      </span>
                    )}
                  </div>
                  {member.isSpeaking && (
                    <p className="text-accent text-xs mt-0.5">Speaking</p>
                  )}
                </div>

                {/* 3-Dots Menu Button */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId((prev) => (prev === member.id ? null : member.id));
                    }}
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-200 p-2 sm:p-1 rounded hover:bg-zinc-800 cursor-pointer -mr-1"
                    title="Participant options"
                  >
                    <IconMoreHorizontal size={16} />
                  </button>

                  {/* Dropdown Menu */}
                  {activeMenuId === member.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full mt-1.5 w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl p-2 z-50 text-xs space-y-1.5"
                    >
                      <div className="px-2 py-1 border-b border-zinc-800/80">
                        <p className="font-semibold text-zinc-200 truncate">{member.username}</p>
                        <p className="text-[10px] text-zinc-500 font-mono truncate">{member.id}</p>
                      </div>

                      {isMe ? (
                        <>
                          <button
                            onClick={() => handleCopyId(member.id)}
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer flex items-center justify-between"
                          >
                            <span>Copy User ID</span>
                            {copied && <span className="text-emerald-400 text-[10px]">Copied!</span>}
                          </button>
                          {onMute && (
                            <button
                              onClick={onMute}
                              disabled={isDeafened}
                              className={`w-full text-left px-2 py-1.5 rounded transition-colors ${isDeafened ? 'text-zinc-600 cursor-not-allowed' : 'hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 cursor-pointer'}`}
                            >
                              {isDeafened ? 'Undeafen to unmute' : isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="px-2 py-1">
                            <div className="flex items-center justify-between text-zinc-400 text-[11px] mb-1">
                              <span className="flex items-center gap-1"><IconVolume2 size={12} /> Volume</span>
                              <span>{vol}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="200"
                              value={vol}
                              onChange={(e) => handleVolumeChange(member.id, Number(e.target.value))}
                              className="w-full accent-accent h-1 cursor-pointer"
                            />
                          </div>

                          <div className="h-px bg-zinc-800 my-1" />

                          <button
                            onClick={() => handleToggleLocalMute(member.id)}
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer flex items-center justify-between"
                          >
                            <span>Mute for me</span>
                            <span className="text-[10px] text-zinc-500">{isLocallyMuted ? 'Muted' : 'Unmuted'}</span>
                          </button>

                          <button
                            onClick={() => handleCopyId(member.id)}
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer"
                          >
                            Copy User ID
                          </button>

                          {isOwner && !member.isOwner && member.id !== currentUser?.id && (
                            <>
                              <div className="h-px bg-zinc-800 my-1" />
                              <button
                                onClick={() => handleKickMember(member.id, member.username)}
                                disabled={kickingId === member.id}
                                className="w-full text-left px-2 py-1.5 rounded hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {kickingId === member.id ? 'Kicking...' : 'Kick from room'}
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isDeafened && (
          <div className="mt-6 px-3 py-2.5 rounded bg-zinc-900 border border-zinc-800">
            <p className="text-zinc-400 text-sm">You are deafened — others cannot hear you either.</p>
          </div>
        )}

        {isMuted && !isDeafened && (
          <div className="mt-6 px-3 py-2.5 rounded bg-zinc-900 border border-zinc-800">
            <p className="text-zinc-400 text-sm">Your microphone is muted.</p>
          </div>
        )}
      </div>

      {/* In-Room Friends Invite Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <IconUsers size={18} className="text-accent" />
                <h2 className="text-sm font-semibold text-zinc-100">Invite Friends to Room</h2>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Close"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Quick Share Link Bar */}
            <div className="px-5 py-3 bg-zinc-950/60 border-b border-zinc-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-zinc-300 font-medium truncate">Share room link</p>
                <p className="text-[11px] text-zinc-500 truncate">Anyone with the link can join directly</p>
              </div>
              <button
                onClick={handleCopyRoomLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-all shadow-sm cursor-pointer active:scale-95 flex-shrink-0"
              >
                <IconShare size={13} />
                <span>{copiedRoomLink ? 'Copied Link!' : 'Copy Link'}</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-zinc-800/80">
              <div className="relative">
                <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search friends..."
                  value={inviteSearchQuery}
                  onChange={(e) => setInviteSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {/* Friends List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[140px]">
              {isLoadingFriends && modalFriends.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-xs flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                  <span>Loading friends...</span>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs">
                  {eligibleFriends.length === 0
                    ? 'No friends found. Add friends in the Friends tab to invite them here.'
                    : `No friends match "${inviteSearchQuery}".`}
                </div>
              ) : (
                filteredFriends.map((f: any) => {
                  const targetId = f.userId || f.id;
                  const isInRoom = room.members?.some((m: any) => m.id === targetId || m.userId === targetId);
                  const isInvited = invitedUserIds[targetId];
                  const isInviting = invitingUserIds[targetId];

                  return (
                    <div
                      key={targetId}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-zinc-950/40 border border-zinc-800/60 hover:border-zinc-700/60 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar initials={f.initials || f.username?.slice(0, 2).toUpperCase() || 'FR'} color={f.color || '#6366f1'} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-200 truncate">{f.username}</p>
                          <p className="text-[10px] text-zinc-500 font-mono truncate">#{f.tag || '1000'}</p>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {isInRoom ? (
                          <span className="text-[11px] text-zinc-400 bg-zinc-800/80 px-2 py-1 rounded">
                            In Room
                          </span>
                        ) : isInvited ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded font-medium">
                            <IconCheck size={12} />
                            <span>Invited!</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleInviteFriend(f)}
                            disabled={isInviting}
                            className="px-3 py-1 rounded bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            {isInviting ? 'Inviting...' : 'Invite'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ initials, color, size = 'md' }: { initials: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-6 h-6 text-[9px]', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base' };
  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}
