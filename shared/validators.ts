import { z } from 'zod';

export const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username cannot exceed 32 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email address').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters'),
});

export const LoginSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const UpdateProfileSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  bio: z.string().max(250).optional().nullable(),
  avatarUrl: z.string().url().max(1024).optional().nullable(),
  status: z.enum(['online', 'away', 'offline']).optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

export const CreateRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(64),
  type: z.enum(['voice', 'text']).default('voice'),
  description: z.string().max(255).optional(),
  isPrivate: z.boolean().default(false),
  password: z.string().min(4).max(64).optional(),
  bitrate: z.number().int().min(16000).max(128000).default(64000),
  maxParticipants: z.number().int().min(2).max(100).default(25),
  textChatEnabled: z.boolean().default(true),
});

export const UpdateRoomSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(255).optional().nullable(),
  isPrivate: z.boolean().optional(),
  maxParticipants: z.number().int().min(2).max(100).optional(),
  textChatEnabled: z.boolean().optional(),
});

export const JoinRoomSchema = z.object({
  password: z.string().optional(),
});

export const CreateInviteSchema = z.object({
  maxUses: z.number().int().min(1).max(1000).optional().nullable(),
  expiresInHours: z.number().int().min(1).max(720).optional().nullable(),
});

export const SendMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(2000, 'Message cannot exceed 2000 characters'),
});

export const ModerationActionSchema = z.object({
  targetUserId: z.string().uuid('Invalid Target User ID'),
  action: z.enum(['mute', 'unmute', 'kick', 'ban']),
  reason: z.string().max(255).optional(),
});

export const MusicControlSchema = z.object({
  action: z.enum(['play', 'pause', 'seek', 'add_track', 'skip']),
  positionSeconds: z.number().min(0).optional(),
  track: z
    .object({
      provider: z.enum(['youtube', 'soundcloud', 'custom']),
      providerTrackId: z.string(),
      title: z.string(),
      artist: z.string().optional().nullable(),
      durationSeconds: z.number(),
      thumbnailUrl: z.string().optional().nullable(),
    })
    .optional(),
});

export const FriendRequestSchema = z.object({
  targetUsername: z.string().min(3).max(64),
});
