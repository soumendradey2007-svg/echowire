import { useState } from 'react';
import type { Room } from '../types';
import { IconPlus, IconLock, IconX, IconTrash } from '../components/Icons'; import { IconShare } from '../components/Icons';
import { apiFetch } from '../lib/api';

interface Props {
  rooms: Room[];
  onJoin: (id: string) => void | Promise<void>;
  onRefresh?: () => void;
  currentUser?: any;
}

export default function RoomsView({ rooms, onJoin, onRefresh, currentUser }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [maxMembers, setMaxMembers] = useState('8');
  const [textChat, setTextChat] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    'w-full bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm rounded px-3 py-2 outline-none focus:border-accent placeholder:text-zinc-600 transition-colors';

  const handleJoinRoom = async (id: string) => {
    if (joiningId) return;
    setJoiningId(id);
    try {
      await onJoin(id);
    } finally {
      setJoiningId(null);
    }
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      setError('Please enter a room name');
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const res = await apiFetch('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name: roomName.trim(),
          description: roomDesc.trim() || undefined,
          isPrivate,
          maxParticipants: parseInt(maxMembers, 10) || 8,
          textChatEnabled: textChat,
        }),
      });

      setShowCreate(false);
      setRoomName('');
      setRoomDesc('');
      setIsPrivate(false);
      if (res?.room?.id) {
        await onJoin(res.room.id);
      }
      onRefresh?.();
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRoom = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await apiFetch(`/api/rooms/${id}`, { method: 'DELETE' });
      onRefresh?.();
    } catch (err: any) {
      alert(err.message || 'Failed to delete room');
    }
  };

  const isGuest = currentUser?.isGuest || false;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-900">
        <div>
          <h1 className="text-zinc-100 font-semibold text-base">Rooms</h1>
          <p className="text-zinc-500 text-xs mt-0.5">{rooms.length} available</p>
        </div>
        {!isGuest ? (
          <button
            onClick={() => { setShowCreate(true); setError(null); }}
            className="flex items-center gap-1.5 bg-accent text-white text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-accent/90 active:scale-95 transition-all cursor-pointer shadow"
          >
            <IconPlus size={14} />
            <span>New room</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Guest Mode (Public Rooms Only)</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="space-y-2">
          {rooms.map((room) => (
            <RoomRow
              key={room.id}
              room={room}
              onJoin={handleJoinRoom}
              isJoining={joiningId === room.id}
              isAnyJoining={!!joiningId}
              onDelete={handleDeleteRoom}
              currentUser={currentUser}
            />
          ))}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-zinc-100 font-semibold text-sm sm:text-base">Create a new room</h2>
              <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer p-1">
                <IconX size={16} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded">
                {error}
              </div>
            )}

            <div className="space-y-3.5">
              <div>
                <label className="block text-zinc-400 text-xs font-medium mb-1">Room name</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Gaming Lounge, Study Chill..."
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-xs font-medium mb-1">Description (optional)</label>
                <input
                  className={inputCls}
                  placeholder="What is this room about?"
                  value={roomDesc}
                  onChange={(e) => setRoomDesc(e.target.value)}
                />
              </div>

              {/* Channel Privacy Type Selection */}
              <div>
                <label className="block text-zinc-400 text-xs font-medium mb-1.5">Channel Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPrivate(false)}
                    className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      !isPrivate
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <span>🌐</span>
                      <span>Public Channel</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">Anyone can join, including guests</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPrivate(true)}
                    className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      isPrivate
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/30'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <span>🔒</span>
                      <span>Private Channel</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">Logged-in accounts only (No guests)</p>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 bg-zinc-800 text-zinc-300 text-xs font-medium py-2 rounded-lg hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRoom}
                  disabled={creating}
                  className="flex-1 flex items-center justify-center gap-2 bg-accent text-white text-xs font-semibold py-2 rounded-lg hover:bg-accent/90 transition-all cursor-pointer disabled:opacity-50 shadow"
                >
                  {creating ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Creating...</span>
                    </>
                  ) : (
                    'Create Room'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomRow({
  room,
  onJoin,
  onDelete,
  currentUser,
  isJoining = false,
  isAnyJoining = false,
}: {
  room: Room;
  onJoin: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  currentUser?: any;
  isJoining?: boolean;
  isAnyJoining?: boolean;
}) {
  const isFull = room.memberCount >= room.maxMembers;
  const isOwner = currentUser?.id ? room.ownerId === currentUser.id : (room as any).isOwner;
  const isGuest = currentUser?.isGuest || false;
  const isPrivateLockedForGuest = room.isPrivate && isGuest;

  const handleRowClick = () => {
    if (isAnyJoining || isFull) return;
    if (isPrivateLockedForGuest) {
      alert('🔒 This is a Private Room restricted to registered EchoWire members. Please create a free account or sign in to enter private channels.');
      return;
    }
    onJoin(room.id);
  };

  return (
    <div
      onClick={handleRowClick}
      className={`flex items-center justify-between gap-3 px-3.5 py-3 sm:px-4 sm:py-3.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 border ${
        isJoining ? 'border-accent/60 bg-zinc-900/90 shadow-md' : 'border-zinc-800/80 hover:border-zinc-700'
      } transition-all cursor-pointer group shadow-sm active:scale-[0.99]`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-zinc-100 text-sm font-semibold truncate">{room.name}</span>
          
          {/* Distinct Badges: Personal vs Private vs Public */}
          {room.description === 'Personal Room' ? (
            <span className="text-[10px] text-accent bg-accent/15 border border-accent/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 flex-shrink-0">
              Personal
            </span>
          ) : room.isPrivate ? (
            <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 flex-shrink-0">
              <IconLock size={10} />
              Private
            </span>
          ) : (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Public
            </span>
          )}

          {isOwner && room.description !== 'Personal Room' && (
            <span className="text-[10px] text-zinc-400 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
              Owner
            </span>
          )}
          {isFull && (
            <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded flex-shrink-0">
              Full
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-zinc-500 text-[11px] mt-1">
          <span>{room.memberCount} / {room.maxMembers} in room</span>
          {room.description && room.description !== 'Personal Room' && (
            <>
              <span>•</span>
              <span className="truncate">{room.description}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Delete Room Button (for owner) */}
        {isOwner && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(room.id, room.name);
            }}
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
            title="Delete this room"
          >
            <IconTrash size={15} />
          </button>
        )}

        {/* Share Room Link Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            const link = `${window.location.origin}/?joinRoom=${room.id}`;
            navigator.clipboard.writeText(link);
            alert(`Sharable link copied to clipboard!\n${link}`);
          }}
          className="p-2 text-zinc-500 hover:text-accent hover:bg-zinc-800 active:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
          title="Copy room link"
        >
          <IconShare size={14} />
        </button>

        {/* Join Room Button - handles Public vs Private guest lock */}
        {isPrivateLockedForGuest ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              alert('🔒 This is a Private Room restricted to registered EchoWire members. Please create a free account or sign in to enter private channels.');
            }}
            className="flex items-center justify-center gap-1.5 min-w-[70px] text-xs font-semibold px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all cursor-pointer"
            title="Private room - registered members only"
          >
            <IconLock size={12} />
            <span>Members Only</span>
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onJoin(room.id);
            }}
            disabled={isFull || isAnyJoining}
            className="flex items-center justify-center gap-1.5 min-w-[70px] text-xs font-semibold px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-accent text-white hover:bg-accent/90 active:scale-95 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed transition-all shadow cursor-pointer"
          >
            {isJoining ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Joining...</span>
              </>
            ) : (
              'Join'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
