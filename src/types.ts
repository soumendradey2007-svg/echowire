export interface Member {
  id: string
  username: string
  initials: string
  color: string
  isSpeaking?: boolean
  isMuted?: boolean
  isDeafened?: boolean
  isOwner?: boolean
  isMe?: boolean
}

export interface Room {
  id: string
  name: string
  description?: string
  isPrivate: boolean
  memberCount: number
  maxMembers: number
  members: Member[]
}

export interface Friend {
  id: string
  username: string
  initials: string
  color: string
  status: 'online' | 'offline' | 'away'
  state: 'friend' | 'pending-in' | 'pending-out' | 'blocked'
  location?: string
}

export interface Message {
  id: string
  userId: string
  username: string
  initials: string
  color: string
  content: string
  time: string
}

export type NavView = 'rooms' | 'friends' | 'settings'
export type RightTab = 'members' | 'chat' | 'music'
export type AuthMode = 'landing' | 'signin' | 'signup' | 'forgot'
