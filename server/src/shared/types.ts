export type RoomType = 'voice' | 'text';
export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member';
export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';
export type UserPresenceStatus = 'online' | 'away' | 'offline';

export interface UserSummary {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio?: string | null;
  status?: UserPresenceStatus;
  createdAt: string;
}

export interface UserProfile extends UserSummary {
  email: string;
  isEmailVerified: boolean;
}

export interface SessionInfo {
  id: string;
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
  current: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
  friend?: UserSummary;
}

export interface UserBlock {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
  blockedUser?: UserSummary;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  description: string | null;
  isPrivate: boolean;
  bitrate: number;
  maxParticipants: number;
  textChatEnabled: boolean;
  ownerId: string;
  createdAt: string;
  memberCount?: number;
  members?: RoomMemberSummary[];
}

export interface RoomMemberSummary {
  id: string;
  username: string;
  initials: string;
  color: string;
  role: MemberRole;
  isMutedByAdmin: boolean;
  isDeafenedByAdmin: boolean;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
  isOwner?: boolean;
  isMe?: boolean;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  role: MemberRole;
  isMutedByAdmin: boolean;
  isDeafenedByAdmin: boolean;
  joinedAt: string;
  user?: UserSummary;
}

export interface RoomInvite {
  id: string;
  roomId: string;
  code: string;
  creatorId: string;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  isPinned: boolean;
  editedAt: string | null;
  createdAt: string;
  author?: UserSummary;
}

export interface MusicTrackMetadata {
  id: string;
  provider: 'youtube' | 'soundcloud' | 'custom';
  providerTrackId: string;
  title: string;
  artist: string | null;
  durationSeconds: number;
  thumbnailUrl: string | null;
}

export interface EphemeralMusicState {
  roomId: string;
  track: MusicTrackMetadata | null;
  isPlaying: boolean;
  basePositionSeconds: number;
  updatedAtServerTime: number;
  queue: MusicTrackMetadata[];
}

export interface LiveKitTokenResponse {
  token: string;
  livekitUrl: string;
  roomName: string;
  participantIdentity: string;
  canPublish: boolean;
  canSubscribe: boolean;
}

export interface WsClientEvents {
  'chat:send': { roomId: string; content: string };
  'chat:typing': { roomId: string; isTyping: boolean };
  'voice:state_change': { roomId: string; isMuted: boolean; isDeafened: boolean; isSpeaking: boolean };
  'presence:update': { status: UserPresenceStatus };
  'admin:action': { roomId: string; targetUserId: string; action: 'mute' | 'unmute' | 'kick' | 'ban'; reason?: string };
  'music:control': { roomId: string; action: 'play' | 'pause' | 'seek' | 'add_track' | 'skip' | 'play_index' | 'remove_queue'; positionSeconds?: number; position?: number; track?: MusicTrackMetadata };
}

export interface WsServerEvents {
  'chat:message': ChatMessage;
  'chat:delete': { messageId: string; roomId: string };
  'voice:state_change': { userId: string; roomId: string; isMuted: boolean; isDeafened: boolean; isSpeaking: boolean };
  'presence:update': { userId: string; status: UserPresenceStatus; currentRoomId: string | null };
  'room:member_joined': { roomId: string; member: RoomMemberSummary };
  'room:member_left': { roomId: string; userId: string };
  'moderation:enforced': { action: string; targetUserId: string; roomId: string; reason?: string };
  'music:sync': EphemeralMusicState;
  'error:rate_limited': { message: string; retryAfterMs: number };
}
