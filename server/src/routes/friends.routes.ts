import type { FastifyInstance } from 'fastify';
import { FriendRequestSchema } from '../shared/validators';
import { AuthService } from '../services/auth.service';
import { db } from '../db';
import { friendships, users, userBlocks } from '../db/schema';
import { eq, or, and } from 'drizzle-orm';
import { config } from '../config';

export async function friendRoutes(app: FastifyInstance) {
  app.get('/api/friends', async (req, reply) => {
    try {
      const token = req.cookies[config.cookieName];
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const fRecords = await db
        .select()
        .from(friendships)
        .where(or(eq(friendships.requesterId, auth.user.id), eq(friendships.addresseeId, auth.user.id)));

      const blocks = await db.select().from(userBlocks).where(eq(userBlocks.blockerId, auth.user.id));
      const result = [];

      for (const f of fRecords) {
        const otherId = f.requesterId === auth.user.id ? f.addresseeId : f.requesterId;
        const [u] = await db.select().from(users).where(eq(users.id, otherId)).limit(1);
        if (!u) continue;

        let state = 'friend';
        if (f.status === 'pending') {
          state = f.requesterId === auth.user.id ? 'pending-out' : 'pending-in';
        } else if (f.status === 'blocked') {
          state = 'blocked';
        }

        const hex = (u.id || '').replace(/[^0-9a-fA-F]/g, '').slice(0, 8);
        const num = parseInt(hex, 16) || 1234;
        const tag = String((num % 9000) + 1000);
        result.push({
          id: f.id,
          userId: u.id,
          username: u.username,
          tag,
          userTag: `${u.username}#${tag}`,
          initials: u.username.slice(0, 2).toUpperCase(),
          color: '#7c7cf5',
          status: u.status,
          state,
        });
      }

      for (const b of blocks) {
        const [u] = await db.select().from(users).where(eq(users.id, b.blockedId)).limit(1);
        if (u && !result.some((r) => r.userId === u.id)) {
          result.push({
            id: b.id,
            userId: u.id,
            username: u.username,
            initials: u.username.slice(0, 2).toUpperCase(),
            color: '#71717a',
            status: 'offline',
            state: 'blocked',
          });
        }
      }

      return { friends: result };
    } catch (err) {
      console.error('[FRIENDS ERROR]', err);
      return reply.status(500).send({ error: err.message || 'Failed to list friends' });
    }
  });

  app.post('/api/friends/requests', async (req, reply) => {
    try {
      const token = req.cookies[config.cookieName];
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const body = FriendRequestSchema.parse(req.body);
      const query = body.targetUsername.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);

      let target: any = null;
      if (isUuid) {
        [target] = await db.select().from(users).where(eq(users.id, query)).limit(1);
      } else if (query.includes('#')) {
        const [namePart, tagPart] = query.split('#');
        const candidates = await db.select().from(users).where(eq(users.username, namePart.trim()));
        target = candidates.find((c) => {
          const hex = (c.id || '').replace(/[^0-9a-fA-F]/g, '').slice(0, 8);
          const num = parseInt(hex, 16) || 1234;
          const tag = String((num % 9000) + 1000);
          return tag === tagPart.trim();
        }) || candidates[0];
      } else {
        [target] = await db.select().from(users).where(eq(users.username, query)).limit(1);
      }

      if (!target) return reply.status(404).send({ error: 'User not found. Check username or User ID.' });
      if (target.id === auth.user.id) return reply.status(400).send({ error: 'You cannot friend yourself' });

      const [existing] = await db
        .select()
        .from(friendships)
        .where(
          or(
            and(eq(friendships.requesterId, auth.user.id), eq(friendships.addresseeId, target.id)),
            and(eq(friendships.requesterId, target.id), eq(friendships.addresseeId, auth.user.id))
          )
        )
        .limit(1);

      if (existing) {
        return reply.status(400).send({ error: 'Friendship or request already exists' });
      }

      await db.insert(friendships).values({
        requesterId: auth.user.id,
        addresseeId: target.id,
        status: 'pending',
      });

      return { success: true, message: 'Friend request sent!' };
    } catch (err) {
      return reply.status(500).send({ error: err.message || 'Failed to send friend request' });
    }
  });

  app.post('/api/friends/:id/accept', async (req, reply) => {
    try {
      const token = req.cookies[config.cookieName];
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const { id } = req.params;
      await db
        .update(friendships)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(and(eq(friendships.id, id), eq(friendships.addresseeId, auth.user.id)));

      return { success: true };
    } catch (err) {
      return reply.status(500).send({ error: err.message || 'Failed to accept request' });
    }
  });

  app.post('/api/friends/:id/reject', async (req, reply) => {
    try {
      const token = req.cookies[config.cookieName];
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const { id } = req.params;
      await db.delete(friendships).where(and(eq(friendships.id, id), eq(friendships.addresseeId, auth.user.id)));
      return { success: true };
    } catch (err) {
      return reply.status(500).send({ error: err.message || 'Failed to reject request' });
    }
  });

  app.delete('/api/friends/:id', async (req, reply) => {
    try {
      const token = req.cookies[config.cookieName];
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const { id } = req.params;
      await db.delete(friendships).where(eq(friendships.id, id));
      return { success: true };
    } catch (err) {
      return reply.status(500).send({ error: err.message || 'Failed to remove friend' });
    }
  });
}
