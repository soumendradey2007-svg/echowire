
export function getUserTag(user: { id: string; email?: string | null }): string {
  if (user.email && (user.email.endsWith('@guest.echowire.local') || user.email.startsWith('guest_'))) {
    return 'guest';
  }
  const hex = (user.id || '').replace(/[^0-9a-fA-F]/g, '').slice(0, 8);
  const num = parseInt(hex, 16) || 1234;
  return String((num % 9000) + 1000);
}

﻿import type { FastifyInstance } from 'fastify';
import { RegisterSchema, LoginSchema, UpdateProfileSchema, ChangePasswordSchema } from '../shared/validators';
import { AuthService } from '../services/auth.service';
import { RateLimiter } from '../services/rate-limit.service';
import { EmailService } from '../services/email.service';
import { db } from '../db';
import { users, sessions } from '../db/schema';
import { eq, or, and, gt } from 'drizzle-orm';
import { config } from '../config';
import crypto from 'node:crypto';

export async function authRoutes(app: FastifyInstance) {

  // Guest Login Endpoint (Zoom-style temporary user)
  app.post('/api/auth/guest', async (req, reply) => {
    try {
      const ip = req.ip || '127.0.0.1';
      const rl = RateLimiter.check(`guest:${ip}`, 10, 60000);
      if (!rl.allowed) return reply.status(429).send({ error: 'Guest creation limit reached. Max 10 attempts per minute.' });
      const { username } = (req.body as any) || {};
      const cleanName = (username || 'Guest').trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').slice(0, 16) || 'Guest';
      const guestRand = Math.random().toString(36).slice(2, 7);
      const guestId = crypto.randomUUID();
      const guestEmail = `guest_${guestRand}@guest.echowire.local`;
      const dummyPasswordHash = await AuthService.hashPassword(crypto.randomBytes(16).toString('hex'));

      const [newUser] = await db.insert(users).values({
        id: guestId,
        username: cleanName,
        email: guestEmail,
        passwordHash: dummyPasswordHash,
        isEmailVerified: true,
      }).returning();

      const { rawToken, expiresAt } = await AuthService.createSession(newUser.id, req.headers['user-agent'], req.ip);

      reply.setCookie(config.cookieName, rawToken, {
        path: '/',
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'lax',
        expires: expiresAt,
      });

      return {
        user: {
          id: newUser.id,
          username: newUser.username,
          tag: 'guest',
          userTag: `${newUser.username}#guest`,
          isGuest: true,
          email: newUser.email,
          avatarUrl: null,
          bio: 'Temporary Guest',
          status: 'online',
          isEmailVerified: true,
          createdAt: newUser.createdAt.toISOString(),
        }
      };
    } catch (err: any) {
      console.error('[GUEST LOGIN ERROR]', err);
      return reply.status(500).send({ error: err.message || 'Failed to enter as guest' });
    }
  });

  // Verification Endpoint
  app.get('/api/auth/verify', async (req, reply) => {
    try {
      const { token } = req.query as { token?: string };
      if (!token) return reply.status(400).send({ error: 'Missing verification token' });

      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.verificationToken, token), gt(users.verificationExpiresAt, new Date())))
        .limit(1);

      if (!user) {
        return reply.status(400).send({ error: 'Invalid or expired verification link' });
      }

      await db
        .update(users)
        .set({
          isEmailVerified: true,
          verificationToken: null,
          verificationExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      const { rawToken, expiresAt } = await AuthService.createSession(user.id, req.headers['user-agent'], req.ip);

      reply.setCookie(config.cookieName, rawToken, {
        path: '/',
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'lax',
        expires: expiresAt,
      });

      return { success: true, message: 'Email verified successfully!' };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Verification failed' });
    }
  });

  // Register Endpoint
  app.post('/api/auth/register', async (req, reply) => {
    try {
      const ip = req.ip || '127.0.0.1';
      const rl = RateLimiter.check(`reg:${ip}`, 30, 60000);
      if (!rl.allowed) return reply.status(429).send({ error: 'Too many registration attempts. Please wait 1 minute.' });

      const body = RegisterSchema.parse(req.body);
      const [existing] = await db
        .select()
        .from(users)
        .where(or(eq(users.username, body.username), eq(users.email, body.email)))
        .limit(1);

      const verifyToken = crypto.randomBytes(32).toString('hex');
      const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:8443';
      const devVerifyUrl = `http://${host}?verify_token=${verifyToken}`;

      if (existing) {
        if (!existing.isEmailVerified) {
          const passwordHash = await AuthService.hashPassword(body.password);
          await db
            .update(users)
            .set({
              username: body.username,
              email: body.email,
              passwordHash,
              verificationToken: verifyToken,
              verificationExpiresAt: verifyExpires,
              updatedAt: new Date(),
            })
            .where(eq(users.id, existing.id));

          console.log('\n======================================================');
          console.log(`[AUTH] 🔗 Verification link for ${body.email}:`);
          console.log(devVerifyUrl);
          console.log('======================================================\n');

          await EmailService.sendVerificationEmail(body.email, body.username, verifyToken);

          return {
            success: true,
            requiresVerification: true,
            devVerifyUrl,
            message: 'A fresh confirmation email has been sent to your inbox.',
          };
        }

        return reply.status(400).send({
          error: existing.username === body.username ? 'Username is already taken' : 'Email is already registered',
        });
      }

      const passwordHash = await AuthService.hashPassword(body.password);
      await db
        .insert(users)
        .values({
          username: body.username,
          email: body.email,
          passwordHash,
          isEmailVerified: false,
          verificationToken: verifyToken,
          verificationExpiresAt: verifyExpires,
        });

      console.log('\n======================================================');
      console.log(`[AUTH] 🔗 Verification link for ${body.email}:`);
      console.log(devVerifyUrl);
      console.log('======================================================\n');

      await EmailService.sendVerificationEmail(body.email, body.username, verifyToken);

      return {
        success: true,
        requiresVerification: true,
        devVerifyUrl,
        message: 'A confirmation email has been sent to your inbox. Please check your email to activate your account.',
      };
    } catch (err: any) {
      console.error('[REGISTER ERROR]', err);
      return reply.status(500).send({ error: err.message || 'Registration failed' });
    }
  });

  // Login Endpoint
  app.post('/api/auth/login', async (req, reply) => {
    try {
      const ip = req.ip || '127.0.0.1';
      const rl = RateLimiter.check(`login:${ip}`, 10, 60000);
      if (!rl.allowed) return reply.status(429).send({ error: 'Too many login attempts. Please wait 1 minute.' });

      const body = LoginSchema.parse(req.body);
      const [user] = await db
        .select()
        .from(users)
        .where(or(eq(users.email, body.emailOrUsername), eq(users.username, body.emailOrUsername)))
        .limit(1);

      if (!user || !(await AuthService.verifyPassword(user.passwordHash, body.password))) {
        return reply.status(401).send({ error: 'Invalid email/username or password' });
      }

      if (!user.isEmailVerified) {
        const devVerifyUrl = user.verificationToken ? `http://localhost:8443?verify_token=${user.verificationToken}` : null;
        if (devVerifyUrl) {
          console.log('\n======================================================');
          console.log(`[AUTH] Unverified user login attempt. Verification link:`);
          console.log(devVerifyUrl);
          console.log('======================================================\n');
        }
        return reply.status(403).send({
          error: 'Please check your email and verify your account before signing in.',
          devVerifyUrl: devVerifyUrl || undefined,
        });
      }

      const { rawToken, expiresAt } = await AuthService.createSession(user.id, req.headers['user-agent'], ip);

      reply.setCookie(config.cookieName, rawToken, {
        path: '/',
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'lax',
        expires: expiresAt,
      });

      const tag = getUserTag(user);
      const isGuest = user.email.endsWith('@guest.echowire.local');
      return {
        user: {
          id: user.id,
          username: user.username,
          tag,
          userTag: `${user.username}#${tag}`,
          isGuest,
          email: user.email,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          status: user.status,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt.toISOString(),
        },
      };
    } catch (err: any) {
      console.error('[LOGIN ERROR]', err);
      return reply.status(500).send({ error: err.message || 'Login failed' });
    }
  });

  // Logout Endpoint
  app.post('/api/auth/logout', async (req, reply) => {
    try {
      const token = req.cookies[config.cookieName];
      if (token) {
        const auth = await AuthService.validateSession(token);
        if (auth) {
          await AuthService.revokeSession(auth.session.id, auth.user.id);
        }
      }
      reply.clearCookie(config.cookieName, { path: '/' });
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Logout failed' });
    }
  });

  // Me Endpoint
  app.get('/api/auth/me', async (req, reply) => {
    try {
      const token = req.cookies[config.cookieName];
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Invalid or expired session' });

      const tag = getUserTag(auth.user);
      const isGuest = auth.user.email.endsWith('@guest.echowire.local');
      return {
        user: {
          id: auth.user.id,
          username: auth.user.username,
          tag,
          userTag: `${auth.user.username}#${tag}`,
          isGuest,
          email: auth.user.email,
          avatarUrl: auth.user.avatarUrl,
          bio: auth.user.bio,
          status: auth.user.status,
          isEmailVerified: auth.user.isEmailVerified,
          createdAt: auth.user.createdAt.toISOString(),
        },
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Session lookup failed' });
    }
  });

  // Profile Update
  app.patch('/api/auth/profile', async (req, reply) => {
    try {
      const token = req.cookies[config.cookieName];
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const body = UpdateProfileSchema.parse(req.body);
      const [updated] = await db
        .update(users)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(users.id, auth.user.id))
        .returning();

      return {
        user: {
          id: updated.id,
          username: updated.username,
          email: updated.email,
          avatarUrl: updated.avatarUrl,
          bio: updated.bio,
          status: updated.status,
          isEmailVerified: updated.isEmailVerified,
          createdAt: updated.createdAt.toISOString(),
        },
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Profile update failed' });
    }
  });

  // Password Update
  app.post('/api/auth/password', async (req, reply) => {
    try {
      const token = req.cookies[config.cookieName];
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const body = ChangePasswordSchema.parse(req.body);
      if (!(await AuthService.verifyPassword(auth.user.passwordHash, body.currentPassword))) {
        return reply.status(400).send({ error: 'Current password is incorrect' });
      }

      const newHash = await AuthService.hashPassword(body.newPassword);
      await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, auth.user.id));
      return { success: true, message: 'Password updated successfully' };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Password update failed' });
    }
  });

  // Sessions List
  app.get('/api/auth/sessions', async (req, reply) => {
    try {
      const token = req.cookies[config.cookieName];
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const allSessions = await db.select().from(sessions).where(eq(sessions.userId, auth.user.id));
      return {
        sessions: allSessions.map((s: any) => ({
          id: s.id,
          userId: s.userId,
          userAgent: s.userAgent,
          ipAddress: s.ipAddress,
          current: s.id === auth.session.id,
          expiresAt: s.expiresAt.toISOString(),
          createdAt: s.createdAt.toISOString(),
        })),
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to fetch sessions' });
    }
  });

  // Revoke Session
  app.delete('/api/auth/sessions/:id', async (req, reply) => {
    try {
      const token = req.cookies[config.cookieName];
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const { id } = req.params as { id: string };
      await AuthService.revokeSession(id, auth.user.id);
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to revoke session' });
    }
  });

  // Delete Account
  app.delete('/api/auth/delete', async (req, reply) => {
    try {
      const token = req.cookies[config.cookieName];
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      await db.delete(users).where(eq(users.id, auth.user.id));
      reply.clearCookie(config.cookieName, { path: '/' });
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to delete account' });
    }
  });
}
