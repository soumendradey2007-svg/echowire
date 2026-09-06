import React, { useState, useEffect } from 'react'
import { IconUser, IconHeadphones, IconBell, IconShield, IconEye, IconTrash, IconLogOut, IconChevronDown } from '../components/Icons'
import { apiFetch } from '../lib/api'
import { voiceManager, type NoiseCancellationMode } from '../lib/voice'

interface Props {
  currentUser?: any
  onLogout?: () => void
  onProfileUpdate?: (user: any) => void
}

type Section = 'account' | 'voice' | 'notifications' | 'privacy' | 'appearance'

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'account', label: 'Account', icon: <IconUser size={15} /> },
  { id: 'voice', label: 'Voice & Audio', icon: <IconHeadphones size={15} /> },
  { id: 'notifications', label: 'Notifications', icon: <IconBell size={15} /> },
  { id: 'privacy', label: 'Privacy & Security', icon: <IconShield size={15} /> },
  { id: 'appearance', label: 'Appearance', icon: <IconEye size={15} /> },
]

export default function SettingsView({ currentUser, onLogout, onProfileUpdate }: Props) {
  const [section, setSection] = useState<Section>('account')

  return (
    <div className="flex-1 flex min-w-0 bg-zinc-950">
      <div className="w-52 flex-shrink-0 border-r border-zinc-900 py-6 px-3">
        <p className="text-zinc-600 text-xs font-medium uppercase tracking-wide px-3 mb-2">Settings</p>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm text-left transition-colors cursor-pointer ${section === s.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}`}
          >
            <span className={section === s.id ? 'text-zinc-300' : 'text-zinc-600'}>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl px-10 py-8">
          {section === 'account' && <AccountSection currentUser={currentUser} onLogout={onLogout} onProfileUpdate={onProfileUpdate} />}
          {section === 'voice' && <VoiceSection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'privacy' && <PrivacySection />}
          {section === 'appearance' && <AppearanceSection currentUser={currentUser} onProfileUpdate={onProfileUpdate} />}
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-zinc-100 font-semibold text-base">{title}</h2>
      {description && <p className="text-zinc-500 text-sm mt-1">{description}</p>}
    </div>
  )
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-zinc-900">
      <div className="flex-1 min-w-0 pr-6">
        <p className="text-zinc-200 text-sm font-medium">{label}</p>
        {description && <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${checked ? 'bg-accent' : 'bg-zinc-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded px-3 py-1.5 pr-7 outline-none focus:border-accent cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <IconChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
    </div>
  )
}

const inputCls = 'bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm rounded px-3 py-2 outline-none focus:border-accent placeholder:text-zinc-600 transition-colors'

function AccountSection({ currentUser, onLogout, onProfileUpdate }: { currentUser?: any; onLogout?: () => void; onProfileUpdate?: (u: any) => void }) {
  const [username, setUsername] = useState(currentUser?.username || '')
  const [bio, setBio] = useState(currentUser?.bio || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [profileMsg, setProfileMsg] = useState('')
  const [passMsg, setPassMsg] = useState('')
  const [isSigningOut, setIsSigningOut] = useState(false)

  const initials = username.slice(0, 2).toUpperCase() || 'U';

  const handleSaveProfile = async () => {
    try {
      const res = await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ username, bio }),
      });
      if (res?.user) {
        onProfileUpdate?.({ ...currentUser, ...res.user });
      }
      setProfileMsg('Profile updated successfully!');
      setTimeout(() => setProfileMsg(''), 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) return alert('Enter both passwords');
    try {
      await apiFetch('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPassMsg('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setPassMsg(''), 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to change password');
    }
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await onLogout?.();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div>
      <SectionTitle title="Account" description="Manage your profile and login details." />

      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-zinc-900">
        <div className="w-16 h-16 rounded-full flex items-center justify-center font-semibold text-white text-xl flex-shrink-0" style={{ backgroundColor: '#7c7cf5' }}>
          {initials}
        </div>
        <div>
          <p className="text-zinc-200 text-sm font-medium">{username}</p>
          <p className="text-zinc-500 text-xs font-mono mt-0.5">{currentUser?.id || ''}</p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-zinc-400 text-xs font-medium mb-1.5">Username</label>
          <input className={`${inputCls} w-full max-w-sm`} value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="block text-zinc-400 text-xs font-medium mb-1.5">Bio</label>
          <input className={`${inputCls} w-full max-w-sm`} placeholder="Tell people about yourself" value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSaveProfile} className="text-sm font-medium bg-accent text-white px-4 py-2 rounded hover:bg-accent/90 transition-colors cursor-pointer">
            Save changes
          </button>
          {profileMsg && <span className="text-xs text-emerald-400">{profileMsg}</span>}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-3">Change Password</h3>
        <div className="space-y-3 max-w-sm">
          <input className={`${inputCls} w-full`} type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <input className={`${inputCls} w-full`} type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <div className="flex items-center gap-3">
            <button onClick={handleUpdatePassword} className="text-sm font-medium text-zinc-300 border border-zinc-700 px-4 py-2 rounded hover:border-zinc-600 hover:text-zinc-100 transition-colors cursor-pointer">
              Update password
            </button>
            {passMsg && <span className="text-xs text-emerald-400">{passMsg}</span>}
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-zinc-900 space-y-2">
        <button 
          onClick={handleSignOut} 
          disabled={isSigningOut}
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
        >
          {isSigningOut ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span>Signing out...</span>
            </>
          ) : (
            <>
              <IconLogOut size={14} />
              <span>Sign out</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function VoiceSection() {
  const [inputDevice, setInputDevice] = useState('default')
  const [outputDevice, setOutputDevice] = useState('default')
  const [ncMode, setNcMode] = useState<NoiseCancellationMode>(() => voiceManager.getNoiseCancellationMode())
  const [echoCancellation, setEchoCancellation] = useState(true)

  useEffect(() => {
    return voiceManager.onNoiseCancellationModeChange((m) => setNcMode(m))
  }, [])

  const deviceOptions = [
    { value: 'default', label: 'System default' },
    { value: 'mic1', label: 'Default Microphone' },
  ]

  const ncOptions = [
    { value: 'dsp', label: '🎙️ Studio Isolation (Zero Latency & Bird Ducking)' },
    { value: 'rnnoise', label: '🧠 AI Neural Suppression (RNNoise Deep Learning)' },
    { value: 'off', label: '⭕ Disabled (Raw Microphone Input)' },
  ]

  const handleNcModeChange = async (val: string) => {
    await voiceManager.setNoiseCancellationMode(val as NoiseCancellationMode)
    setNcMode(voiceManager.getNoiseCancellationMode())
  }

  return (
    <div>
      <SectionTitle title="Voice & Audio" description="Configure microphone and audio processing." />
      <SettingRow label="Input device">
        <Select value={inputDevice} onChange={setInputDevice} options={deviceOptions} />
      </SettingRow>
      <SettingRow label="Output device">
        <Select value={outputDevice} onChange={setOutputDevice} options={deviceOptions} />
      </SettingRow>
      <SettingRow label="Noise Cancellation Engine" description="Choose between in-house zero-latency Studio DSP or deep-learning RNNoise AI">
        <Select value={ncMode} onChange={handleNcModeChange} options={ncOptions} />
      </SettingRow>
      <SettingRow label="Echo cancellation" description="Prevent audio feedback & acoustic bleed">
        <Toggle checked={echoCancellation} onChange={setEchoCancellation} />
      </SettingRow>
    </div>
  )
}

function NotificationsSection() {
  const [friendRequests, setFriendRequests] = useState(true)
  const [roomInvites, setRoomInvites] = useState(true)

  return (
    <div>
      <SectionTitle title="Notifications" />
      <SettingRow label="Friend requests" description="When someone sends you a friend request">
        <Toggle checked={friendRequests} onChange={setFriendRequests} />
      </SettingRow>
      <SettingRow label="Room invites" description="When a friend invites you to a room">
        <Toggle checked={roomInvites} onChange={setRoomInvites} />
      </SettingRow>
    </div>
  )
}

function PrivacySection() {
  const [discoverability, setDiscoverability] = useState('friends')

  return (
    <div>
      <SectionTitle title="Privacy & Security" />
      <SettingRow label="Who can find you" description="Controls who can search for your account">
        <Select
          value={discoverability}
          onChange={setDiscoverability}
          options={[
            { value: 'everyone', label: 'Everyone (Username or ID)' },
            { value: 'friends', label: 'Friends only' },
          ]}
        />
      </SettingRow>
    </div>
  )
}

function AppearanceSection({ currentUser, onProfileUpdate }: { currentUser?: any; onProfileUpdate?: (u: any) => void }) {
  const [theme, setTheme] = useState('dark')
  const [status, setStatus] = useState(currentUser?.status || 'online')
  const [statusMsg, setStatusMsg] = useState('')

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus)
    setStatusMsg('')
    try {
      const res = await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      if (res?.user) {
        onProfileUpdate?.({ ...currentUser, ...res.user })
      }
      setStatusMsg('Status updated!')
      setTimeout(() => setStatusMsg(''), 2500)
    } catch (err: any) {
      alert(err.message || 'Failed to update status')
      setStatus(currentUser?.status || 'online')
    }
  }

  return (
    <div>
      <SectionTitle title="Appearance" description="Configure your appearance, presence status and app theme." />
      <SettingRow
        label="Online Status"
        description="Choose how you appear to others across EchoWire"
      >
        <div className="flex items-center gap-2.5">
          <Select
            value={status}
            onChange={handleStatusChange}
            options={[
              { value: 'online', label: '🟢 Online' },
              { value: 'dnd', label: '💤 Do Not Disturb' },
              { value: 'in_room', label: '🎧 In Room' },
            ]}
          />
          {statusMsg && <span className="text-xs text-emerald-400 font-medium">{statusMsg}</span>}
        </div>
      </SettingRow>
      <SettingRow label="Theme" description="Select application theme">
        <Select
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
        />
      </SettingRow>
    </div>
  )
}
