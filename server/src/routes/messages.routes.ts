import type { FastifyInstance } from 'fastify';
import { db } from '../db';
import { messages, users, rooms, roomMembers } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { AuthService } from '../services/auth.service';

export async function messageRoutes(app: FastifyInstance) {
  app.get('/api/rooms/:id/messages', async (req, reply) => {
    try {
      const token = AuthService.extractToken(req);
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const { id } = req.params as { id: string };

      // Verify room exists and check privacy permissions
      const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
      if (!room) return reply.status(404).send({ error: 'Room not found' });

      if (room.isPrivate && room.ownerId !== auth.user.id) {
        const [membership] = await db
          .select()
          .from(roomMembers)
          .where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, auth.user.id)))
          .limit(1);
        if (!membership) {
          return reply.status(403).send({ error: 'Access denied. You are not a member of this private room.' });
        }
      }

      const raw = await db
        .select({
          msg: messages,
          user: users,
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .where(eq(messages.roomId, id))
        .orderBy(desc(messages.createdAt))
        .limit(50);

      return {
        messages: raw.reverse().map((r: any) => ({
          id: r.msg.id,
          roomId: r.msg.roomId,
          userId: r.msg.userId,
          content: r.msg.content,
          isPinned: r.msg.isPinned,
          editedAt: r.msg.editedAt?.toISOString() || null,
          createdAt: r.msg.createdAt.toISOString(),
          author: {
            id: r.user.id,
            username: r.user.username,
            avatarUrl: r.user.avatarUrl,
            createdAt: r.user.createdAt.toISOString(),
          },
        })),
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to fetch messages' });
    }
  });
}
