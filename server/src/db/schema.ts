import { pgTable, text, varchar, timestamp, boolean, integer, uuid, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  status: varchar('status', { length: 16 }).notNull().default('online'),
  isEmailVerified: boolean('is_email_verified').notNull().default(false),
  verificationToken: varchar('verification_token', { length: 64 }),
  verificationExpiresAt: timestamp('verification_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 45 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userExpIdx: index('sessions_user_exp_idx').on(t.userId, t.expiresAt),
  tokenIdx: index('sessions_token_idx').on(t.tokenHash),
}));

export const friendships = pgTable('friendships', {
  id: uuid('id').primaryKey().defaultRandom(),
  requesterId: uuid('requester_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  addresseeId: uuid('addressee_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pairIdx: index('friendships_pair_idx').on(t.requesterId, t.addresseeId),
}));

export const userBlocks = pgTable('user_blocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  blockerId: uuid('blocker_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  blockedId: uuid('blocked_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 64 }).notNull(),
  type: varchar('type', { length: 16 }).notNull().default('voice'),
  description: text('description'),
  isPrivate: boolean('is_private').notNull().default(false),
  passwordHash: text('password_hash'),
  bitrate: integer('bitrate').notNull().default(64000),
  maxParticipants: integer('max_participants').notNull().default(25),
  textChatEnabled: boolean('text_chat_enabled').notNull().default(true),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const roomMembers = pgTable('room_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 16 }).notNull().default('member'),
  isMutedByAdmin: boolean('is_muted_by_admin').notNull().default(false),
  isDeafenedByAdmin: boolean('is_deafened_by_admin').notNull().default(false),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  roomUserIdx: index('room_members_room_user_idx').on(t.roomId, t.userId),
}));

export const roomBans = pgTable('room_bans', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  bannedBy: uuid('banned_by').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const roomInvites = pgTable('room_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'cascade' }).notNull(),
  code: varchar('code', { length: 32 }).notNull().unique(),
  creatorId: uuid('creator_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  maxUses: integer('max_uses'),
  uses: integer('uses').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  isPinned: boolean('is_pinned').notNull().default(false),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  roomTimeIdx: index('messages_room_time_idx').on(t.roomId, t.createdAt),
}));

export const musicQueue = pgTable('music_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'cascade' }).notNull(),
  provider: varchar('provider', { length: 16 }).notNull().default('youtube'),
  providerTrackId: text('provider_track_id').notNull(),
  title: text('title').notNull(),
  artist: text('artist'),
  durationSeconds: integer('duration_seconds').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  addedBy: uuid('added_by').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
