import type { Room, Friend, Message } from './types'

export const ME = {
  id: 'me',
  username: 'zephyr',
  initials: 'ZK',
  color: '#7c7cf5',
  isMe: true,
}

export const ROOMS: Room[] = [
  {
    id: '1',
    name: 'Late Night Squad',
    description: 'Just chilling after ranked',
    isPrivate: true,
    memberCount: 3,
    maxMembers: 8,
    members: [
      { id: 'me', username: 'zephyr', initials: 'ZK', color: '#7c7cf5', isMe: true, isOwner: true },
      { id: '2', username: 'marcusv', initials: 'MV', color: '#34d399', isSpeaking: true },
      { id: '3', username: 'suki_x', initials: 'SK', color: '#f97316', isMuted: true },
    ],
  },
  {
    id: '2',
    name: 'Ranked Grind',
    description: 'Diamond+ only',
    isPrivate: false,
    memberCount: 5,
    maxMembers: 12,
    members: [
      { id: '4', username: 'nova_gg', initials: 'NG', color: '#60a5fa', isOwner: true },
      { id: '5', username: 'phantom', initials: 'PH', color: '#a78bfa', isSpeaking: true },
      { id: '6', username: 'clutch99', initials: 'C9', color: '#fb7185', isMuted: true },
      { id: '7', username: 'drift.exe', initials: 'DX', color: '#fbbf24' },
      { id: '8', username: 'kylie_r', initials: 'KR', color: '#34d399', isMuted: true },
    ],
  },
  {
    id: '3',
    name: 'Chill & Chat',
    description: 'No pressure, just hanging',
    isPrivate: false,
    memberCount: 2,
    maxMembers: 6,
    members: [
      { id: '9', username: 'ember', initials: 'EM', color: '#f97316', isOwner: true },
      { id: '10', username: 'loop_', initials: 'LP', color: '#38bdf8' },
    ],
  },
  {
    id: '4',
    name: 'Strat Session',
    description: 'Pro practice',
    isPrivate: true,
    memberCount: 8,
    maxMembers: 8,
    members: [],
  },
]

export const FRIENDS: Friend[] = [
  { id: '1', username: 'alex.chen', initials: 'AC', color: '#60a5fa', status: 'online', state: 'friend', location: 'Ranked Grind' },
  { id: '2', username: 'jordan_k', initials: 'JK', color: '#34d399', status: 'online', state: 'friend' },
  { id: '3', username: 'sam_r', initials: 'SR', color: '#a78bfa', status: 'away', state: 'friend' },
  { id: '4', username: 'taylor.b', initials: 'TB', color: '#fbbf24', status: 'offline', state: 'friend' },
  { id: '5', username: 'nova_gg', initials: 'NG', color: '#60a5fa', status: 'online', state: 'pending-in' },
  { id: '6', username: 'clutch99', initials: 'C9', color: '#fb7185', status: 'offline', state: 'blocked' },
]

export const MESSAGES: Message[] = [
  { id: '1', userId: '2', username: 'marcusv', initials: 'MV', color: '#34d399', content: 'gg that last game was insane', time: '11:42 PM' },
  { id: '2', userId: '3', username: 'suki_x', initials: 'SK', color: '#f97316', content: "we're actually getting better at this", time: '11:43 PM' },
  { id: '3', userId: 'me', username: 'zephyr', initials: 'ZK', color: '#7c7cf5', content: "one more round? I'm feeling it", time: '11:44 PM' },
  { id: '4', userId: '2', username: 'marcusv', initials: 'MV', color: '#34d399', content: 'always', time: '11:44 PM' },
  { id: '5', userId: '3', username: 'suki_x', initials: 'SK', color: '#f97316', content: 'give me 2 min, getting water', time: '11:45 PM' },
]
