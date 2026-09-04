import { useState } from 'react'
import { IconUser, IconLogOut, IconChevronLeft } from '../components/Icons'

interface Props {
  currentUser: any
  onBack: () => void
  onLogout: () => void
}

export default function ProfileView({ currentUser, onBack, onLogout }: Props) {
  const [copied, setCopied] = useState(false)

  const username = currentUser?.username || 'User'
  const initials = username.slice(0, 2).toUpperCase()
  const tag = currentUser?.tag || (currentUser?.isGuest ? 'guest' : '1000')
  const email = currentUser?.email || ''
  const bio = currentUser?.bio || ''
  const isGuest = currentUser?.isGuest || false
  const isVerified = currentUser?.isEmailVerified || false
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
                <span className="w-2 h-2 rounded-full bg-online" />
                <span className="text-zinc-300 text-sm capitalize">{currentUser?.status || 'online'}</span>
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

          {/* Divider */}
          <div className="border-t border-zinc-800 pt-4">
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 text-sm font-medium transition-all cursor-pointer"
            >
              <IconLogOut size={14} />
              {isGuest ? 'Leave Guest Session' : 'Log Out'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
