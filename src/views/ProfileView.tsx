import { useState } from 'react'
import { IconUser, IconLogOut, IconChevronLeft } from '../components/Icons'
import { apiFetch } from '../lib/api'

interface Props {
  currentUser: any
  onBack: () => void
  onLogout: () => void
  onProfileUpdate?: (user: any) => void
}

const inputCls = 'bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm rounded px-3 py-2 outline-none focus:border-accent placeholder:text-zinc-600 transition-colors'

function StatusDot({ status }: { status: string }) {
  if (status === 'dnd') {
    return (
      <span className="w-4 h-4 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-[9px] leading-none shadow-sm flex-shrink-0" title="Do Not Disturb">
        💤
      </span>
    )
  }
  if (status === 'in_room') {
    return (
      <span className="w-4 h-4 rounded-full bg-purple-950/80 border border-purple-500/60 flex items-center justify-center text-purple-300 shadow-sm flex-shrink-0" title="In Voice Room">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
        </svg>
      </span>
    )
  }
  const colorMap: Record<string, string> = {
    online: 'bg-online',
    away: 'bg-away',
    offline: 'bg-zinc-600',
  }
  return <span className={`w-2 h-2 rounded-full ${colorMap[status] || 'bg-online'} flex-shrink-0`} />
}

export default function ProfileView({ currentUser, onBack, onLogout, onProfileUpdate }: Props) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editUsername, setEditUsername] = useState(currentUser?.username || '')
  const [editBio, setEditBio] = useState(currentUser?.bio || '')
  const [saving, setSaving] = useState(false)
  const [editMsg, setEditMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogoutClick = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const username = currentUser?.username || 'User'
  const initials = username.slice(0, 2).toUpperCase()
  const tag = currentUser?.tag || (currentUser?.isGuest ? 'guest' : '1000')
  const email = currentUser?.email || ''
  const bio = currentUser?.bio || ''
  const isGuest = currentUser?.isGuest || false
  const isVerified = currentUser?.isEmailVerified || false
  const status = currentUser?.status || 'online'
  const createdAt = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown'

  const handleCopyId = () => {
    if (currentUser?.id) {
      navigator.clipboard.writeText(currentUser.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setEditMsg(null)
    try {
      const res = await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ username: editUsername, bio: editBio || null }),
      })
      if (res.user) {
        onProfileUpdate?.({ ...currentUser, ...res.user })
      }
      setEditMsg({ type: 'ok', text: 'Profile updated!' })
      setEditing(false)
      setTimeout(() => setEditMsg(null), 3000)
    } catch (err: any) {
      setEditMsg({ type: 'err', text: err.message || 'Failed to update profile' })
    } finally {
      setSaving(false)
    }
  }

  const statusLabel: Record<string, string> = {
    online: 'Online',
    dnd: 'Do Not Disturb',
    away: 'Away',
    offline: 'Offline',
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-4 sm:p-8 overflow-y-auto">
      {/* Back button */}
      <div className="w-full max-w-md mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm transition-colors cursor-pointer"
        >
          <IconChevronLeft size={16} />
          <span>Back</span>
        </button>
      </div>

      {/* Profile Card */}
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-br from-accent/40 via-purple-600/30 to-blue-600/20" />

        {/* Avatar */}
        <div className="px-6 -mt-10">
          <div className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-white text-2xl border-4 border-zinc-900 shadow-xl" style={{ backgroundColor: '#7c7cf5' }}>
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={username} className="w-full h-full rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
        </div>

        {/* Info */}
        <div className="px-6 pt-3 pb-6 space-y-4">
          {/* Username & Tag */}
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">
              {username}
              <span className="text-zinc-500 text-sm font-mono ml-1">#{tag}</span>
            </h2>
            {isGuest && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Guest Account
              </span>
            )}
          </div>

          {/* Bio */}
          {bio && (
            <div className="bg-zinc-950/60 rounded-lg p-3 border border-zinc-800/60">
              <p className="text-zinc-300 text-sm leading-relaxed">{bio}</p>
            </div>
          )}

          {/* Details grid */}
          <div className="space-y-3">
            {/* Email */}
            {!isGuest && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 text-xs uppercase tracking-wider font-medium">Email</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-300 text-sm">{email}</span>
                  {isVerified ? (
                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]" title="Verified">✓</span>
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]" title="Not verified">!</span>
                  )}
                </div>
              </div>
            )}

            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-xs uppercase tracking-wider font-medium">Status</span>
              <div className="flex items-center gap-1.5">
                <StatusDot status={status} />
                <span className="text-zinc-300 text-sm">{statusLabel[status] || 'Online'}</span>
              </div>
            </div>

            {/* Member Since */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-xs uppercase tracking-wider font-medium">Member Since</span>
              <span className="text-zinc-300 text-sm">{createdAt}</span>
            </div>

            {/* User ID */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-xs uppercase tracking-wider font-medium">User ID</span>
              <button
                onClick={handleCopyId}
                className="text-zinc-400 hover:text-accent text-xs font-mono transition-colors cursor-pointer"
              >
                {copied ? 'Copied!' : currentUser?.id?.slice(0, 12) + '…'}
              </button>
            </div>
          </div>

          {/* Edit Profile */}
          {!isGuest && (
            <div className="border-t border-zinc-800 pt-4">
              {!editing ? (
                <button
                  onClick={() => { setEditing(true); setEditUsername(username); setEditBio(bio); }}
                  className="text-sm text-accent hover:text-accent/80 font-medium transition-colors cursor-pointer"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-zinc-400 text-xs font-medium mb-1">Username</label>
                    <input
                      className={`${inputCls} w-full`}
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      maxLength={32}
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-xs font-medium mb-1">Bio</label>
                    <input
                      className={`${inputCls} w-full`}
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Tell people about yourself"
                      maxLength={250}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="text-sm font-medium bg-accent text-white px-4 py-1.5 rounded hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditing(false); setEditMsg(null); }}
                      className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {editMsg && (
                <p className={`text-xs mt-2 ${editMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {editMsg.text}
                </p>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-zinc-800 pt-4">
            <button
              onClick={handleLogoutClick}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 text-sm font-medium transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoggingOut ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5 text-red-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <span>{isGuest ? 'Leaving guest session...' : 'Logging out...'}</span>
                </>
              ) : (
                <>
                  <IconLogOut size={14} />
                  <span>{isGuest ? 'Leave Guest Session' : 'Log Out'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
