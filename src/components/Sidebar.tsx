import React, { useState } from 'react'
import type { NavView, Room } from '../types'
import { IconHash, IconUsers, IconSettings, IconMic, IconMicOff, IconHeadphones, IconHeadphonesOff, IconPhoneHangup } from './Icons'

interface Props {
  currentUser: any
  navView: NavView
  onNavChange: (v: NavView) => void
  activeRoom: Room | null
  isMuted: boolean
  isDeafened: boolean
  pendingFriends: number
  onMute: () => void
  onDeafen: () => void
  onDisconnect: () => void
}

export default function Sidebar({ currentUser, navView, onNavChange, activeRoom, isMuted, isDeafened, pendingFriends, onMute, onDeafen, onDisconnect }: Props) {
  const [copied, setCopied] = useState(false);
  const navItems = [
    { id: 'rooms' as NavView, label: 'Rooms', icon: <IconHash size={16} /> },
    { id: 'friends' as NavView, label: 'Friends', icon: <IconUsers size={16} />, badge: pendingFriends },
  ]

  const handleCopyId = () => {
    if (currentUser?.id) {
      navigator.clipboard.writeText(currentUser.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const username = currentUser?.username || 'User';
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <aside className="hidden sm:flex w-56 flex-shrink-0 flex-col bg-zinc-900 border-r border-zinc-800">
      <div className="px-4 py-4 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-zinc-100 font-semibold tracking-tight hidden sm:inline">EchoWire</span>
        <span className="text-accent font-bold tracking-tight sm:hidden mx-auto">EW</span>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavChange(item.id)}
            className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded text-sm text-left transition-colors cursor-pointer ${navView === item.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'}`}
          >
            <span className="flex items-center gap-2.5">
              <span className={navView === item.id ? 'text-zinc-300' : 'text-zinc-600'}>{item.icon}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </span>
            {item.badge ? (
              <span className="w-4 h-4 rounded-full bg-accent text-white text-[10px] font-medium flex items-center justify-center flex-shrink-0">
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="border-t border-zinc-800">
        {activeRoom && (
          <div className="px-3 py-3 border-b border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-online flex-shrink-0" />
                  <p className="text-zinc-300 text-xs font-medium truncate">{activeRoom.name}</p>
                </div>
                <p className="text-zinc-600 text-xs">Voice connected</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={onMute}
                disabled={isDeafened}
                title={isDeafened ? 'Undeafen to unmute microphone' : (isMuted ? 'Unmute Microphone' : 'Mute Microphone')}
                className={`p-1.5 rounded-full transition-all shadow-sm ${isDeafened ? 'bg-zinc-800/80 text-zinc-500 border border-zinc-700/60 cursor-not-allowed opacity-60' : isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 cursor-pointer' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 cursor-pointer'}`}
              >
                {isMuted || isDeafened ? <IconMicOff size={13} /> : <IconMic size={13} />}
              </button>
              <button
                onClick={onDeafen}
                title={isDeafened ? 'Undeafen Headphones' : 'Deafen Headphones'}
                className={`p-1.5 rounded-full transition-all cursor-pointer shadow-sm ${isDeafened ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'}`}
              >
                {isDeafened ? <IconHeadphonesOff size={13} /> : <IconHeadphones size={13} />}
              </button>
              <div className="flex-1" />
              <VoiceButton onClick={onDisconnect} title="Disconnect" active={false} destructive>
                <IconPhoneHangup size={13} />
              </VoiceButton>
            </div>
          </div>
        )}

        <div className="px-2 sm:px-3 py-3 flex items-center justify-center sm:justify-start gap-2.5 bg-zinc-950/40">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white text-xs" style={{ backgroundColor: '#7c7cf5' }}>
              {initials}
            </div>
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-online border-2 border-zinc-900" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-200 text-xs font-medium truncate hidden sm:block">
              {username}<span className="text-zinc-500 text-[10px] font-mono">#{currentUser?.tag || (currentUser?.isGuest ? 'guest' : '1000')}</span>
            </p>
            <button
              type="button"
              onClick={handleCopyId}
              className="text-zinc-500 hover:text-accent text-[10px] truncate block text-left transition-colors cursor-pointer"
              title="Click to copy your unique User ID"
            >
              {copied ? 'Copied ID!' : (currentUser?.id ? `#${currentUser.id.slice(0, 8)} (Copy)` : 'Online')}
            </button>
          </div>
          <button
            onClick={() => onNavChange('settings')}
            className="text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer flex-shrink-0"
            title="Settings"
          >
            <IconSettings size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function VoiceButton({
  onClick,
  title,
  active,
  destructive,
  children,
}: {
  onClick: () => void
  title: string
  active: boolean
  destructive: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors cursor-pointer ${
        destructive
          ? 'text-zinc-500 hover:text-err hover:bg-err/10'
          : active
          ? 'text-zinc-100 bg-zinc-700'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
      }`}
    >
      {children}
    </button>
  )
}
