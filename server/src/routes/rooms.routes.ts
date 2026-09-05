import { RateLimiter } from '../services/rate-limit.service';
import type { FastifyInstance } from 'fastify';
import { CreateRoomSchema } from '../shared/validators';
import { AuthService } from '../services/auth.service';
import { LiveKitService } from '../services/livekit.service';
import { db } from '../db';
import { rooms, roomMembers, users, roomBans } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { config } from '../config';
import { WsGateway } from '../websocket/gateway';

// In-memory set of rooms each user has joined during their session
const userJoinedHistory = new Map<string, Set<string>>();


// Persistent in-memory room invites store (5 min TTL)
interface StoredRoomInvite {
  id: string;
  roomId: string;
  roomName: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  expiresAt: number;
}
export const serverRoomInvites = new Map<string, StoredRoomInvite>();

export function cleanExpiredInvites() {
  const now = Date.now();
  for (const [id, inv] of serverRoomInvites.entries()) {
    if (inv.expiresAt <= now) {
      serverRoomInvites.delete(id);
    }
  }
}

export async function roomRoutes(app: FastifyInstance) {
  // GET /api/rooms - List only rooms relevant to the authenticated user
  app.get('/api/rooms', async (req, reply) => {
    try {
      const token = AuthService.extractToken(req);
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const currentUserId = auth.user.id;
      const isGuest = auth.user.email ? (auth.user.email.endsWith('@guest.echowire.local') || auth.user.email.startsWith('guest_')) : false;

      // 1. Ensure registered (non-guest) users have their permanent Personal Room
      if (!isGuest) {
        const [existingPersonal] = await db
          .select()
          .from(rooms)
          .where(and(eq(rooms.ownerId, currentUserId), eq(rooms.description, 'Personal Room')))
          .limit(1);

        if (!existingPersonal) {
          await db.insert(rooms).values({
            name: `${auth.user.username}'s Room`,
            type: 'voice',
            description: 'Personal Room',
            ownerId: currentUserId,
            isPrivate: false,
          });
        }
      }

      // 2. Fetch all rooms and filter visibility
      const allRooms = await db.select().from(rooms).orderBy(desc(rooms.createdAt));
      const result = [];

      for (const r of allRooms) {
        const members = await db
          .select({
            member: roomMembers,
            user: users,
          })
          .from(roomMembers)
          .innerJoin(users, eq(roomMembers.userId, users.id))
          .where(eq(roomMembers.roomId, r.id));

        const isPersonal = r.description === 'Personal Room';
        const isOwner = r.ownerId === currentUserId;
        const isCurrentMember = members.some((m) => m.user.id === currentUserId);
        const wasJoined = userJoinedHistory.get(currentUserId)?.has(r.id);

        // Auto-expire only genuinely abandoned temporary rooms (older than 15 mins with 0 members)
        const isAbandoned = !isPersonal && members.length === 0 && (Date.now() - new Date(r.createdAt).getTime() > 15 * 60 * 1000);
        if (isAbandoned) {
          await db.delete(rooms).where(eq(rooms.id, r.id));
          for (const [, set] of userJoinedHistory.entries()) {
            set.delete(r.id);
          }
          continue;
        }

        cleanExpiredInvites();
        const isInvited = Array.from(serverRoomInvites.values()).some(
          (inv) => inv.roomId === r.id && inv.toUserId === currentUserId && inv.expiresAt > Date.now()
        );

        // Room Visibility Rules:
        // - Public rooms are visible to everyone (registered users and guests)
        // - Personal rooms and Private rooms are visible to owner, active members, or registered members in directory
        const isVisible = !r.isPrivate || isPersonal || isOwner || isCurrentMember || (wasJoined && members.length > 0);
        if (!isVisible) continue;

        result.push({
          id: r.id,
          name: r.name,
          type: r.type,
          description: r.description,
          isPersonal,
          isPrivate: r.isPrivate,
          isInvited,
          bitrate: r.bitrate,
          maxParticipants: r.maxParticipants,
          textChatEnabled: r.textChatEnabled,
          ownerId: r.ownerId,
          isOwner,
          createdAt: r.createdAt.toISOString(),
          memberCount: members.length,
          members: members.map((m: any) => {
            const isGuestMember = m.user.email ? (m.user.email.endsWith('@guest.echowire.local') || m.user.email.startsWith('guest_')) : false;
            const hex = (m.user.id || '').replace(/[^0-9a-fA-F]/g, '');
            const num = parseInt(hex.slice(0, 8), 16) || 1234;
            const tag = isGuestMember ? `g-${hex.slice(0, 4).toUpperCase() || 'GST'}` : String((num % 9000) + 1000);
            const vState = WsGateway.getVoiceState(m.user.id);
            return {
              tag,
              userTag: `${m.user.username}#${tag}`,
              isGuest: isGuestMember,
              id: m.user.id,
              username: m.user.username,
              initials: m.user.username.slice(0, 2).toUpperCase(),
              color: '#7c7cf5',
              role: m.member.role,
              isMutedByAdmin: m.member.isMutedByAdmin,
              isDeafenedByAdmin: m.member.isDeafenedByAdmin,
              isOwner: m.member.role === 'owner',
              isMuted: vState.isMuted,
              isDeafened: vState.isDeafened,
              isSpeaking: vState.isSpeaking,
            };
          }),
        });
      }

      return { rooms: result };
    } catch (err: any) {
      console.error('[ROOMS ERROR]', err);
      return reply.status(500).send({ error: err.message || 'Failed to list rooms' });
    }
  });

  // POST /api/rooms - Create a custom room
  app.post('/api/rooms', async (req, reply) => {
    try {
      const token = AuthService.extractToken(req);
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      // Guests can only join public channels, cannot create rooms
      const isGuest = auth.user.email ? (auth.user.email.endsWith('@guest.echowire.local') || auth.user.email.startsWith('guest_')) : false;
      if (isGuest) {
        return reply.status(403).send({ error: 'Guest accounts cannot create rooms. Please create a free account or sign in to host rooms.' });
      }

      const rl = RateLimiter.check(`room_create:${auth.user.id}`, 5, 60000);
      if (!rl.allowed) {
        return reply.status(429).send({ error: 'Room creation limit reached. You can only create 5 rooms per minute.' });
      }

      const body = CreateRoomSchema.parse(req.body);
      const passwordHash = body.password ? await AuthService.hashPassword(body.password) : null;

      const [newRoom] = await db.insert(rooms).values({
        name: body.name,
        type: body.type,
        description: body.description || null,
        isPrivate: body.isPrivate,
        passwordHash,
        bitrate: body.bitrate,
        maxParticipants: body.maxParticipants,
        textChatEnabled: body.textChatEnabled,
        ownerId: auth.user.id,
      }).returning();

      // Automatically enroll creator as owner member of the new room so it is never empty
      await db.insert(roomMembers).values({
        roomId: newRoom.id,
        userId: auth.user.id,
        role: 'owner',
      });

      // Track in user joined history
      if (!userJoinedHistory.has(auth.user.id)) {
        userJoinedHistory.set(auth.user.id, new Set());
      }
      userJoinedHistory.get(auth.user.id)!.add(newRoom.id);

      return { room: newRoom };
    } catch (err: any) {
      console.error('[ROOM CREATE ERROR]', err);
      return reply.status(500).send({ error: err.message || 'Failed to create room' });
    }
  });

  // POST /api/rooms/:id/join - Join a room
  app.post('/api/rooms/:id/join', async (req, reply) => {
    try {
      const token = AuthService.extractToken(req);
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const { id } = req.params as { id: string };
      const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
      if (!room) return reply.status(404).send({ error: 'Room not found' });

      const isGuest = auth.user.email ? (auth.user.email.endsWith('@guest.echowire.local') || auth.user.email.startsWith('guest_')) : false;
      const isPersonal = room.description === 'Personal Room';
      const isOwner = room.ownerId === auth.user.id;

      if (room.isPrivate && isGuest) {
        return reply.status(403).send({ error: 'Private rooms require a registered account. Please sign in to join.' });
      }
      if (isPersonal && isGuest) {
        return reply.status(403).send({ error: 'Personal rooms are private. Please sign in to join.' });
      }

      // Privacy Authorization: Check active invite or existing membership
      cleanExpiredInvites();
      const body = (req.body || {}) as any;
      const hasDirectInvite = Array.from(serverRoomInvites.values()).some(
        (inv) => inv.roomId === id && inv.toUserId === auth.user.id && inv.expiresAt > Date.now()
      );
      const isViaInvite = !!body.viaInvite || hasDirectInvite;

      const [existingMember] = await db
        .select()
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, auth.user.id)))
        .limit(1);

      const hasAccess = isOwner || isViaInvite || !!existingMember;

      // Personal Room Privacy Guard:
      if (isPersonal && !hasAccess) {
        return reply.status(403).send({
          error: 'This is a private personal room. You can only enter if invited by the room owner.'
        });
      }

      // Private Custom Channel Privacy Guard:
      if (room.isPrivate && !hasAccess) {
        return reply.status(403).send({
          error: 'This is a private room. You can only enter if invited by the room owner.'
        });
      }

      // Leave any other room currently in
      const prevMemberships = await db.select().from(roomMembers).where(eq(roomMembers.userId, auth.user.id));
      for (const pm of prevMemberships) {
        if (pm.roomId !== id) {
          await db.delete(roomMembers).where(and(eq(roomMembers.roomId, pm.roomId), eq(roomMembers.userId, auth.user.id)));
          WsGateway.broadcast('room:member_left', { roomId: pm.roomId, userId: auth.user.id });
          WsGateway.broadcast('voice:peer_left', { roomId: pm.roomId, userId: auth.user.id });

          const [prevRoom] = await db.select().from(rooms).where(eq(rooms.id, pm.roomId)).limit(1);
          const rem = await db.select().from(roomMembers).where(eq(roomMembers.roomId, pm.roomId));
          if (prevRoom && prevRoom.description !== 'Personal Room' && rem.length === 0) {
            await db.delete(rooms).where(eq(rooms.id, pm.roomId));
            WsGateway.broadcast('room:deleted', { roomId: pm.roomId });
          }
        }
      }

      // Check bans
      const [ban] = await db
        .select()
        .from(roomBans)
        .where(and(eq(roomBans.roomId, id), eq(roomBans.userId, auth.user.id)))
        .limit(1);
      if (ban) return reply.status(403).send({ error: 'You are banned from this room' });

      const currentMembers = await db.select().from(roomMembers).where(eq(roomMembers.roomId, id));
      if (currentMembers.length >= room.maxParticipants) {
        return reply.status(400).send({ error: 'Room is full' });
      }

      const [existing] = await db
        .select()
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, auth.user.id)))
        .limit(1);

      if (!existing) {
        await db.insert(roomMembers).values({
          roomId: id,
          userId: auth.user.id,
          role: room.ownerId === auth.user.id ? 'owner' : 'member',
        });
      }

      // Track that this user has joined this room
      if (!userJoinedHistory.has(auth.user.id)) {
        userJoinedHistory.set(auth.user.id, new Set());
      }
      userJoinedHistory.get(auth.user.id)!.add(id);

      // Broadcast member joined
      WsGateway.broadcast('room:member_joined', {
        roomId: id,
        member: {
          id: auth.user.id,
          username: auth.user.username,
          initials: auth.user.username.slice(0, 2).toUpperCase(),
          color: '#7c7cf5',
          role: room.ownerId === auth.user.id ? 'owner' : 'member',
          isOwner: room.ownerId === auth.user.id,
        },
      });

      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to join room' });
    }
  });

  // POST /api/rooms/:id/leave - Leave a room
  app.post('/api/rooms/:id/leave', async (req, reply) => {
    try {
      const token = AuthService.extractToken(req);
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const { id } = req.params as { id: string };
      const isGuest = auth.user.email?.endsWith('@guest.echowire.local');
      if (isGuest) {
        await db.delete(roomMembers).where(eq(roomMembers.userId, auth.user.id));
        const isProd = config.env === 'production' || process.env.NODE_ENV === 'production';
        reply.clearCookie(config.cookieName, {
          path: '/',
          secure: isProd,
          sameSite: isProd ? 'none' : 'lax',
        });
        WsGateway.broadcast('room:member_left', { roomId: id, userId: auth.user.id });
        WsGateway.broadcast('voice:peer_left', { roomId: id, userId: auth.user.id });
        return { success: true, guestEnded: true };
      }
      await db.delete(roomMembers).where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, auth.user.id)));

      WsGateway.broadcast('room:member_left', { roomId: id, userId: auth.user.id });
      WsGateway.broadcast('voice:peer_left', { roomId: id, userId: auth.user.id });

      const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
      const remaining = await db.select().from(roomMembers).where(eq(roomMembers.roomId, id));
      if (room && room.description !== 'Personal Room' && remaining.length === 0) {
        await db.delete(rooms).where(eq(rooms.id, id));
        WsGateway.broadcast('room:deleted', { roomId: id });
      }

      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to leave room' });
    }
  });
  // DELETE /api/rooms/:id - Delete a room (only owner can delete)
  app.delete('/api/rooms/:id', async (req, reply) => {
    try {
      const token = AuthService.extractToken(req);
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const { id } = req.params as { id: string };
      const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
      if (!room) return reply.status(404).send({ error: 'Room not found' });

      // Personal rooms are default permanent channels and cannot be deleted
      if (room.description === 'Personal Room') {
        return reply.status(403).send({ error: 'Personal rooms are default and cannot be deleted.' });
      }

      const isGuest = auth.user.email?.endsWith('@guest.echowire.local');
      if (room.isPrivate && isGuest) {
        return reply.status(403).send({ error: 'Private rooms require a registered account. Please sign in to join.' });
      }

      if (room.ownerId !== auth.user.id) {
        return reply.status(403).send({ error: 'Only the room owner can delete this room' });
      }

      await db.delete(roomMembers).where(eq(roomMembers.roomId, id));
      await db.delete(rooms).where(eq(rooms.id, id));

      WsGateway.broadcast('room:deleted', { roomId: id });
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to delete room' });
    }
  });


  // GET /api/rooms/invites - List active invites for current user
  app.get('/api/rooms/invites', async (req, reply) => {
    try {
      const token = AuthService.extractToken(req);
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      cleanExpiredInvites();
      const userInvites = [];
      for (const inv of serverRoomInvites.values()) {
        if (inv.toUserId === auth.user.id && inv.expiresAt > Date.now()) {
          userInvites.push(inv);
        }
      }
      return { invites: userInvites };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to list invites' });
    }
  });

  // POST /api/rooms/invites - Create and send a room invite
  app.post('/api/rooms/invites', async (req, reply) => {
    try {
      const token = AuthService.extractToken(req);
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const { targetUserId, roomId, roomName } = req.body as any;
      if (!targetUserId || !roomId) {
        return reply.status(400).send({ error: 'targetUserId and roomId are required' });
      }

      cleanExpiredInvites();
      const inviteId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const invite: StoredRoomInvite = {
        id: inviteId,
        roomId,
        roomName: roomName || 'Voice Room',
        fromUserId: auth.user.id,
        fromUsername: auth.user.username,
        toUserId: targetUserId,
        expiresAt: Date.now() + 5 * 60 * 1000,
      };

      serverRoomInvites.set(inviteId, invite);

      // Push real-time notification to user's websocket
      WsGateway.sendToUser(targetUserId, 'room:invite_received', invite);

      return { success: true, invite };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to send invite' });
    }
  });

  // POST /api/rooms/invites/:id/decline - Decline/remove invite
  app.post('/api/rooms/invites/:id/decline', async (req, reply) => {
    const { id } = req.params as { id: string };
    serverRoomInvites.delete(id);
    return { success: true };
  });

  // POST /api/rooms/invites/:id/accept - Accept invite
  app.post('/api/rooms/invites/:id/accept', async (req, reply) => {
    const { id } = req.params as { id: string };
    const inv = serverRoomInvites.get(id);
    serverRoomInvites.delete(id);
    return { success: true, roomId: inv?.roomId };
  });

  // POST /api/rooms/:id/kick - Owner kicks a member from the room
  app.post('/api/rooms/:id/kick', async (req, reply) => {
    try {
      const token = AuthService.extractToken(req);
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const { id } = req.params as { id: string };
      const { targetUserId } = req.body as { targetUserId: string };
      if (!targetUserId) return reply.status(400).send({ error: 'targetUserId is required' });

      const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
      if (!room) return reply.status(404).send({ error: 'Room not found' });

      if (room.ownerId !== auth.user.id) {
        return reply.status(403).send({ error: 'Only the room owner can kick members' });
      }

      if (targetUserId === auth.user.id) {
        return reply.status(400).send({ error: 'You cannot kick yourself' });
      }

      // Remove member from room
      await db.delete(roomMembers).where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, targetUserId)));

      // Notify everyone the member left
      WsGateway.broadcast('room:member_left', { roomId: id, userId: targetUserId });
      WsGateway.broadcast('voice:peer_left', { roomId: id, userId: targetUserId });

      // Notify the kicked user specifically
      WsGateway.sendToUser(targetUserId, 'room:kicked', {
        roomId: id,
        roomName: room.name,
        kickedBy: auth.user.username,
      });

      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to kick member' });
    }
  });

}
