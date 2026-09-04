import { wsClient } from '../lib/ws'
import React, { useState, useEffect } from 'react'
import type { Friend } from '../types'
import { IconPlus, IconCheck, IconX, IconMoreHorizontal, IconSearch } from '../components/Icons'
import { apiFetch } from '../lib/api'

interface Props {
  friends: Friend[];
  activeRoom?: any;
  onRefresh?: () => void;
  invites?: any[];
  onAcceptInvite?: (inv: any) => void;
  onDeclineInvite?: (invId: string) => void;
  onRefreshInvites?: () => void;
}

type Tab = 'all' | 'online' | 'pending' | 'blocked' | 'invites'

export default function FriendsView({ friends, activeRoom, onRefresh, invites = [], onAcceptInvite, onDeclineInvite, onRefreshInvites }: Props) {
  // Live countdown ticker for expiring 5-min room invites
  const [, setTimerTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTimerTick((v) => v + 1);
      const now = Date.now();
      for (const inv of invites) {
        if (inv.expiresAt <= now && onDeclineInvite) {
          onDeclineInvite(inv.id);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [invites, onDeclineInvite]);
  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addValue, setAddValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  // Close dropdown menu when clicking anywhere on screen
  useEffect(() => {
    const handleClose = () => setActiveMenuId(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const pendingIncomingCount = friends.filter((f) => f.state === 'pending-in').length;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: friends.filter((f) => f.state === 'friend' || f.state === 'pending-in').length },
    { id: 'online', label: 'Online', count: friends.filter((f) => f.status === 'online' && f.state === 'friend').length },
    { id: 'pending', label: 'Pending', count: friends.filter((f) => f.state.startsWith('pending')).length },
    { id: 'blocked', label: 'Blocked', count: friends.filter((f) => f.state === 'blocked').length },
    { id: 'invites', label: 'Invites', count: invites.length },
  ]

  const filtered = friends.filter((f) => {
    const matchesQuery = f.username.toLowerCase().includes(query.toLowerCase())
    if (tab === 'online') return matchesQuery && f.status === 'online' && f.state === 'friend'
    if (tab === 'all') return matchesQuery && (f.state === 'friend' || f.state === 'pending-in')
    if (tab === 'pending') return matchesQuery && f.state.startsWith('pending')
    if (tab === 'blocked') return matchesQuery && f.state === 'blocked'
    return matchesQuery
  })

  const handleSend = async () => {
    if (!addValue.trim()) return
    setLoading(true)
    setMessage(null)
    try {
      await apiFetch('/api/friends/requests', {
        method: 'POST',
        body: JSON.stringify({ targetUsername: addValue.trim() }),
      })
      setMessage({ type: 'ok', text: 'Friend request sent!' })
      setAddValue('')
      onRefresh?.()
      setTimeout(() => {
        setShowAdd(false)
        setMessage(null)
      }, 1500)
    } catch (err: any) {
      setMessage({ type: 'err', text: err.message || 'Failed to send request' })
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (id: string) => {
    try {
      await apiFetch(`/api/friends/${id}/accept`, { method: 'POST' })
      onRefresh?.()
    } catch (err: any) {
      alert(err.message || 'Failed to accept')
    }
  }

  const handleDecline = async (id: string) => {
    try {
      await apiFetch(`/api/friends/${id}/reject`, { method: 'POST' })
      onRefresh?.()
    } catch (err: any) {
      alert(err.message || 'Failed to reject')
    }
  }

  const handleRemoveFriend = async (friendshipId: string, username: string) => {
    if (!confirm(`Remove ${username} from your friends list?`)) return;
    try {
      await apiFetch(`/api/friends/${friendshipId}`, { method: 'DELETE' });
      setActiveMenuId(null);
      onRefresh?.();
    } catch (err: any) {
      alert(err.message || 'Failed to remove friend');
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
      <div className="px-6 py-4 border-b border-zinc-900">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-zinc-100 font-semibold text-base">Friends</h1>
            {pendingIncomingCount > 0 && (
              <span className="bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                {pendingIncomingCount} new
              </span>
            )}
          </div>
          <button
            onClick={() => { setShowAdd((v) => !v); setMessage(null); }}
            className="flex items-center gap-1.5 bg-accent text-white text-sm font-medium px-3 py-1.5 rounded hover:bg-accent/90 transition-colors cursor-pointer"
          >
            <IconPlus size={14} />
            Add friend
          </button>
        </div>

        {showAdd && (
          <div className="mb-4 p-3 rounded bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="flex gap-2">
              <input
                className="flex-1 bg-transparent text-zinc-100 text-sm outline-none placeholder:text-zinc-600"
                placeholder="Enter username or unique User ID..."
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                autoFocus
              />
              <button
                onClick={handleSend}
                disabled={loading}
                className="text-sm font-medium text-accent hover:text-accent/80 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send request'}
              </button>
            </div>
            {message && (
              <p className={`text-xs ${message.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                {message.text}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 mb-3 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded transition-colors cursor-pointer flex-shrink-0 ${tab === t.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${t.id === 'pending' && pendingIncomingCount > 0 ? 'bg-accent text-white font-bold' : tab === t.id ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800 text-zinc-500'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative">
          <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm rounded pl-8 pr-3 py-2 outline-none focus:border-accent placeholder:text-zinc-600 transition-colors"
            placeholder="Search friends..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'invites' ? (
          <div className="p-4 space-y-2">
            {invites.length === 0 ? (
              <div className="text-center py-12 px-4 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800/80">
                <p className="text-zinc-300 text-sm font-medium">No pending room invites</p>
                <p className="text-zinc-500 text-xs mt-1">When friends invite you to join their room, you'll see them here.</p>
              </div>
            ) : (
              invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-semibold flex items-center justify-center text-sm flex-shrink-0">
                      {inv.fromUsername ? inv.fromUsername.slice(0, 2).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-zinc-100 text-sm font-semibold truncate">{inv.fromUsername}</p>
                        <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded font-mono font-medium">
                          {formatRemaining(inv.expiresAt)} left
                        </span>
                      </div>
                      <p className="text-zinc-400 text-xs mt-0.5 truncate">
                        Invited you to <span className="text-zinc-200 font-medium">{inv.roomName}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/50 flex-shrink-0">
                    <button
                      onClick={() => onDeclineInvite && onDeclineInvite(inv.id)}
                      className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => onAcceptInvite && onAcceptInvite(inv)}
                      className="flex-1 sm:flex-none px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all cursor-pointer shadow active:scale-95"
                    >
                      Accept & Join
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="p-2 space-y-1">
            {filtered.map((f) => (
              <FriendRow
                key={f.id}
                friend={f}
                activeRoom={activeRoom}
                activeMenuId={activeMenuId}
                onToggleMenu={(id) => setActiveMenuId((prev) => (prev === id ? null : id))}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onRemove={handleRemoveFriend}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FriendRow({
  friend,
  activeRoom,
  activeMenuId,
  onToggleMenu,
  onAccept,
  onDecline,
  onRemove,
}: {
  friend: Friend
  activeRoom?: any
  activeMenuId: string | null
  onToggleMenu: (id: string) => void
  onAccept: (id: string) => void
  onDecline: (id: string) => void
  onRemove: (id: string, name: string) => void
}) {
  const [copied, setCopied] = useState(false);

  const statusColor = {
    online: 'bg-online',
    away: 'bg-away',
    offline: 'bg-zinc-600',
  }[friend.status]

  const handleCopyId = () => {
    navigator.clipboard.writeText(friend.userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isMenuOpen = activeMenuId === friend.id;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded hover:bg-zinc-900/60 group transition-colors bg-zinc-900/20 border border-zinc-900/40 relative">
      <div className="relative flex-shrink-0">
        <Avatar initials={friend.initials} color={friend.color} />
        {friend.state === 'friend' && (
          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 ${statusColor}`} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-zinc-200 text-sm font-medium truncate">{friend.username}</p>
          <span className="text-[10px] text-zinc-500 font-mono">#{friend.tag || '1000'}</span>
        </div>
        <p className="text-zinc-500 text-xs truncate">
          {friend.state === 'pending-in' && 'Incoming friend request'}
          {friend.state === 'pending-out' && 'Request sent'}
          {friend.state === 'blocked' && 'Blocked'}
          {friend.state === 'friend' && (
            friend.location ? `In ${friend.location}` : friend.status === 'away' ? 'Away' : friend.status === 'offline' ? 'Offline' : 'Online'
          )}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {friend.state === 'pending-in' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onAccept(friend.id)}
              className="flex items-center gap-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white px-2.5 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer active:scale-95 shadow-sm"
              title="Accept friend request"
            >
              <IconCheck size={13} />
              <span>Accept</span>
            </button>
            <button
              onClick={() => onDecline(friend.id)}
              className="flex items-center gap-1 bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 px-2.5 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer active:scale-95"
              title="Decline friend request"
            >
              <IconX size={13} />
              <span>Decline</span>
            </button>
          </div>
        )}

        {friend.state === 'pending-out' && (
          <span className="text-xs text-zinc-500 italic px-2 py-1 bg-zinc-900 rounded">
            Pending
          </span>
        )}

        {(friend.state === 'friend' || friend.state === 'blocked') && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMenu(friend.id);
              }}
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Friend options"
            >
              <IconMoreHorizontal size={14} />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl p-1.5 z-50 text-xs space-y-1"
              >
                <div className="px-2 py-1 border-b border-zinc-800">
                  <p className="font-semibold text-zinc-200 truncate">{friend.username}</p>
                  <p className="text-[10px] text-zinc-500 font-mono truncate">{friend.userId}</p>
                </div>

                {activeRoom && (
                  <button
                    onClick={async () => {
                      try {
                        await apiFetch('/api/rooms/invites', {
                          method: 'POST',
                          body: JSON.stringify({
                            targetUserId: friend.userId,
                            roomId: activeRoom.id,
                            roomName: activeRoom.name,
                          }),
                        });
                        wsClient.send('room:invite', {
                          targetUserId: friend.userId,
                          roomId: activeRoom.id,
                          roomName: activeRoom.name,
                        });
                        setMessage({ type: 'ok', text: `Invite to "${activeRoom.name}" sent to ${friend.username}! (Valid 5 mins)` });
                        setTimeout(() => setMessage(null), 3000);
                      } catch (e: any) {
                        setMessage({ type: 'err', text: e.message || 'Failed to send invite' });
                      }
                    }}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-accent/20 text-accent font-medium transition-colors cursor-pointer"
                  >
                    Invite to ${activeRoom.name}
                  </button>
                )}

                <button
                  onClick={handleCopyId}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>Copy User ID</span>
                  {copied && <span className="text-emerald-400 text-[10px]">Copied!</span>}
                </button>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(friend.username);
                    alert(`Copied @${friend.username} to clipboard!`);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer"
                >
                  Copy Username
                </button>

                <div className="h-px bg-zinc-800 my-1" />

                <button
                  onClick={() => onRemove(friend.id, friend.username)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                >
                  Remove Friend
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-white text-sm flex-shrink-0"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  )
}

function EmptyState({ tab }: { tab: Tab }) {
  const messages: Record<Tab, { title: string; body: string }> = {
    all: { title: 'No friends yet', body: 'Add people by username or User ID to get started.' },
    online: { title: "Nobody's online", body: 'Your friends are offline right now.' },
    pending: { title: 'No pending requests', body: "You're all caught up." },
    blocked: { title: 'No blocked users', body: "You haven't blocked anyone." },
  }
  const m = messages[tab]
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
      <p className="text-zinc-300 text-sm font-medium mb-1">{m.title}</p>
      <p className="text-zinc-600 text-sm">{m.body}</p>
    </div>
  )
}

function formatRemaining(expiresAt: number) {
  const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
