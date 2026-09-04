import type { FastifyInstance } from 'fastify';
import { db } from '../db';
import { messages, users } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

export async function messageRoutes(app: FastifyInstance) {
  app.get('/api/rooms/:id/messages', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
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
