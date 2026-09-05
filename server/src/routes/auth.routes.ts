
export function getUserTag(user: { id: string; email?: string | null }): string {
  if (user.email && (user.email.endsWith('@guest.echowire.local') || user.email.startsWith('guest_'))) {
    return 'guest';
  }
  const hex = (user.id || '').replace(/[^0-9a-fA-F]/g, '').slice(0, 8);
  const num = parseInt(hex, 16) || 1234;
  return String((num % 9000) + 1000);
}

function getCookieOptions(expiresAt: Date, rememberMe: boolean = true) {
  const isProd = config.env === 'production' || process.env.NODE_ENV === 'production';
  const base: any = {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
  };
  if (rememberMe) {
    base.expires = expiresAt;
    base.maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  }
  return base;
}

import type { FastifyInstance } from 'fastify';
import { RegisterSchema, LoginSchema, UpdateProfileSchema, ChangePasswordSchema } from '../shared/validators';
import { AuthService } from '../services/auth.service';
import { RateLimiter } from '../services/rate-limit.service';
import { EmailService } from '../services/email.service';
import { db } from '../db';
import { users, sessions } from '../db/schema';
import { eq, or, and, gt, sql } from 'drizzle-orm';
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
        username: `${cleanName}_${guestRand}`,
        email: guestEmail,
        passwordHash: dummyPasswordHash,
        isEmailVerified: true,
      }).returning();

      const { rawToken, expiresAt } = await AuthService.createSession(newUser.id, req.headers['user-agent'], req.ip);

      reply.setCookie(config.cookieName, rawToken, getCookieOptions(expiresAt));

      return {
        token: rawToken,
        user: {
          id: newUser.id,
          username: cleanName,
          tag: 'guest',
          userTag: `${cleanName}#guest`,
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

  // Google OAuth Endpoint
  app.post('/api/auth/google', async (req, reply) => {
    try {
      const ip = req.ip || '127.0.0.1';
      const rl = RateLimiter.check(`google:${ip}`, 10, 60000);
      if (!rl.allowed) return reply.status(429).send({ error: 'Too many Google sign-in attempts. Please wait 1 minute.' });

      const { credential, rememberMe = true } = (req.body as any) || {};
      if (!credential) return reply.status(400).send({ error: 'Missing Google credential' });

      // Verify Google ID token via Google's tokeninfo endpoint
      // This validates the JWT signature, expiry, audience, and issuer
      const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '217664802574-sk6blcmddomtucjia25le32mq2r7iod4.apps.googleusercontent.com';
      
      let payload: any;
      try {
        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
        if (!verifyRes.ok) {
          return reply.status(401).send({ error: 'Invalid Google credential. Token verification failed.' });
        }
        payload = await verifyRes.json();
        
        // Verify audience matches our client ID
        if (payload.aud !== GOOGLE_CLIENT_ID) {
          return reply.status(401).send({ error: 'Google token audience mismatch. Potential forgery detected.' });
        }
        // Verify issuer
        if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
          return reply.status(401).send({ error: 'Google token issuer invalid.' });
        }
      } catch (verifyErr) {
        console.error('[GOOGLE VERIFY ERROR]', verifyErr);
        return reply.status(401).send({ error: 'Failed to verify Google credential' });
      }

      const { email, name, picture } = payload;
      if (!email) return reply.status(400).send({ error: 'No email provided by Google account' });

      let [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!existingUser) {
        const baseUsername = (name || email.split('@')[0])
          .replace(/[^a-zA-Z0-9_]/g, '')
          .slice(0, 20) || 'User';
        const randSuffix = Math.floor(1000 + Math.random() * 9000);
        const finalUsername = `${baseUsername}_${randSuffix}`;
        const dummyPasswordHash = await AuthService.hashPassword(crypto.randomBytes(32).toString('hex'));

        const [created] = await db
          .insert(users)
          .values({
            username: finalUsername,
            email,
            passwordHash: dummyPasswordHash,
            avatarUrl: picture || null,
            isEmailVerified: true,
          })
          .returning();
        existingUser = created;
      } else if (!existingUser.isEmailVerified) {
        await db
          .update(users)
          .set({ isEmailVerified: true, updatedAt: new Date() })
          .where(eq(users.id, existingUser.id));
      }

      const { rawToken, expiresAt } = await AuthService.createSession(
        existingUser.id,
        req.headers['user-agent'],
        req.ip
      );

      reply.setCookie(config.cookieName, rawToken, getCookieOptions(expiresAt, rememberMe));

      const tag = getUserTag(existingUser);
      return {
        token: rawToken,
        user: {
          id: existingUser.id,
          username: existingUser.username,
          tag,
          userTag: `${existingUser.username}#${tag}`,
          email: existingUser.email,
          avatarUrl: existingUser.avatarUrl,
          bio: existingUser.bio,
          status: existingUser.status,
          isEmailVerified: true,
          createdAt: existingUser.createdAt.toISOString(),
        },
      };
    } catch (err: any) {
      console.error('[GOOGLE AUTH ERROR]', err);
      return reply.status(500).send({ error: err.message || 'Google authentication failed' });
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

      reply.setCookie(config.cookieName, rawToken, getCookieOptions(expiresAt));

      const tag = getUserTag(user);
      const isGuest = user.email ? (user.email.endsWith('@guest.echowire.local') || user.email.startsWith('guest_')) : false;

      return {
        success: true,
        message: 'Email verified successfully!',
        token: rawToken,
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
          isEmailVerified: true,
          createdAt: user.createdAt.toISOString(),
        },
      };
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

      // Bot Protection: Reject automated bots that fill in hidden honeypot fields
      if (body.website_hp && body.website_hp.trim().length > 0) {
        return reply.status(400).send({ error: 'Automated request detected.' });
      }

      // Bot Protection: Reject sub-second scripted submissions
      if (body.formTimestamp && typeof body.formTimestamp === 'number') {
        const elapsed = Date.now() - body.formTimestamp;
        if (elapsed > 0 && elapsed < 750) {
          return reply.status(400).send({ error: 'Form submitted too quickly. Please try again.' });
        }
      }

      // DPDP Act 2023 Compliance: Verify affirmative consent
      if (body.agreedToTerms === false) {
        return reply.status(400).send({ error: 'You must agree to the Terms of Service and Privacy Policy to create an account.' });
      }

      const cleanUsername = body.username.trim();
      const cleanEmail = body.email.trim().toLowerCase();

      const [existing] = await db
        .select()
        .from(users)
        .where(or(
          sql`LOWER(${users.username}) = LOWER(${cleanUsername})`,
          sql`LOWER(${users.email}) = ${cleanEmail}`
        ))
        .limit(1);

      const verifyToken = crypto.randomBytes(32).toString('hex');
      const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      if (existing) {
        if (existing.email.endsWith('@guest.echowire.local')) {
          await db.delete(users).where(eq(users.id, existing.id));
        } else if (existing.email.toLowerCase() === cleanEmail) {
          if (!existing.isEmailVerified) {
            const passwordHash = await AuthService.hashPassword(body.password);
            await db
              .update(users)
              .set({
                username: cleanUsername,
                email: cleanEmail,
                passwordHash,
                verificationToken: verifyToken,
                verificationExpiresAt: verifyExpires,
                updatedAt: new Date(),
              })
              .where(eq(users.id, existing.id));

            await EmailService.sendVerificationEmail(cleanEmail, cleanUsername, verifyToken);

            return {
              success: true,
              requiresVerification: true,
              message: 'A fresh confirmation email has been sent to your inbox.',
            };
          }

          return reply.status(400).send({
            error: 'An account with this email is already registered and verified. Please sign in.',
          });
        } else {
          return reply.status(400).send({
            error: 'This username is taken by another account. Please pick a different username.',
          });
        }
      }

      const passwordHash = await AuthService.hashPassword(body.password);
      await db
        .insert(users)
        .values({
          username: cleanUsername,
          email: cleanEmail,
          passwordHash,
          isEmailVerified: false,
          verificationToken: verifyToken,
          verificationExpiresAt: verifyExpires,
        });

      await EmailService.sendVerificationEmail(cleanEmail, cleanUsername, verifyToken);

      return {
        success: true,
        requiresVerification: true,
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
      const rl = RateLimiter.check(`login:${ip}`, 15, 60000);
      if (!rl.allowed) return reply.status(429).send({ error: 'Too many login attempts. Please wait 1 minute.' });

      const body = LoginSchema.parse(req.body);
      const cleanQuery = body.emailOrUsername.trim().toLowerCase();
      const [user] = await db
        .select()
        .from(users)
        .where(or(
          sql`LOWER(${users.email}) = ${cleanQuery}`,
          sql`LOWER(${users.username}) = ${cleanQuery}`
        ))
        .limit(1);

      if (!user) {
        return reply.status(401).send({ error: 'No account found with that email or username. Please check your spelling or create an account.' });
      }

      if (user.email.endsWith('@guest.echowire.local')) {
        return reply.status(400).send({ error: 'This is a temporary guest account. Please continue as guest or create a real account.' });
      }

      if (!(await AuthService.verifyPassword(user.passwordHash, body.password))) {
        return reply.status(401).send({ error: 'Incorrect password. Please try again or use "Forgot password?".' });
      }

      if (!user.isEmailVerified) {
        return reply.status(403).send({
          error: 'Please check your email and verify your account before signing in.',
        });
      }

      const rememberMe = body.rememberMe !== false;
      const { rawToken, expiresAt } = await AuthService.createSession(
        user.id,
        req.headers['user-agent'],
        ip,
        rememberMe
      );

      reply.setCookie(config.cookieName, rawToken, getCookieOptions(expiresAt, rememberMe));

      const tag = getUserTag(user);
      const isGuest = user.email.endsWith('@guest.echowire.local');
      return {
        token: rawToken,
        rememberMe,
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

  // Forgot Password Endpoint
  app.post('/api/auth/forgot-password', async (req, reply) => {
    try {
      const ip = req.ip || '127.0.0.1';
      const rl = RateLimiter.check(`forgot:${ip}`, 5, 60000);
      if (!rl.allowed) return reply.status(429).send({ error: 'Too many requests. Please wait 1 minute.' });

      const { email } = (req.body as any) || {};
      if (!email || !email.trim()) return reply.status(400).send({ error: 'Please enter your email address' });

      const cleanEmail = email.trim().toLowerCase();
      const [user] = await db
        .select()
        .from(users)
        .where(sql`LOWER(${users.email}) = ${cleanEmail}`)
        .limit(1);

      if (user && !user.email.endsWith('@guest.echowire.local')) {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await db
          .update(users)
          .set({
            verificationToken: resetToken,
            verificationExpiresAt: resetExpires,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));

        await EmailService.sendPasswordResetEmail(user.email, user.username, resetToken);
      }

      return {
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      };
    } catch (err: any) {
      console.error('[FORGOT PASSWORD ERROR]', err);
      return reply.status(500).send({ error: err.message || 'Failed to process request' });
    }
  });

  // Reset Password Endpoint
  app.post('/api/auth/reset-password', async (req, reply) => {
    try {
      const ip = req.ip || '127.0.0.1';
      const rl = RateLimiter.check(`reset_pw:${ip}`, 5, 60000);
      if (!rl.allowed) return reply.status(429).send({ error: 'Too many password reset attempts. Please wait 1 minute.' });

      const { token, newPassword } = (req.body as any) || {};
      if (!token) return reply.status(400).send({ error: 'Missing reset token' });
      if (!newPassword || newPassword.length < 8) {
        return reply.status(400).send({ error: 'Password must be at least 8 characters' });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.verificationToken, token), gt(users.verificationExpiresAt, new Date())))
        .limit(1);

      if (!user) {
        return reply.status(400).send({ error: 'Invalid or expired password reset link. Please request a new one.' });
      }

      const newHash = await AuthService.hashPassword(newPassword);
      await db
        .update(users)
        .set({
          passwordHash: newHash,
          isEmailVerified: true,
          verificationToken: null,
          verificationExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      const { rawToken, expiresAt } = await AuthService.createSession(user.id, req.headers['user-agent'], req.ip);
      reply.setCookie(config.cookieName, rawToken, getCookieOptions(expiresAt));

      const tag = getUserTag(user);
      return {
        success: true,
        message: 'Password reset successfully! Logging you in...',
        token: rawToken,
        user: {
          id: user.id,
          username: user.username,
          tag,
          userTag: `${user.username}#${tag}`,
          isGuest: false,
          email: user.email,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          status: user.status,
          isEmailVerified: true,
          createdAt: user.createdAt.toISOString(),
        },
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Password reset failed' });
    }
  });

  // Logout Endpoint
  app.post('/api/auth/logout', async (req, reply) => {
    try {
      const token = AuthService.extractToken(req);
      if (token) {
        const auth = await AuthService.validateSession(token);
        if (auth) {
          await AuthService.revokeSession(auth.session.id, auth.user.id);
        }
      }
      const isProd = config.env === 'production' || process.env.NODE_ENV === 'production';
      reply.clearCookie(config.cookieName, {
        path: '/',
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
      });
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Logout failed' });
    }
  });

  // Me Endpoint
  app.get('/api/auth/me', async (req, reply) => {
    try {
      const token = AuthService.extractToken(req);
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
      const token = AuthService.extractToken(req);
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      const body = UpdateProfileSchema.parse(req.body);

      // Check username uniqueness if changing username
      if (body.username && body.username !== auth.user.username) {
        const [existing] = await db
          .select()
          .from(users)
          .where(sql`LOWER(${users.username}) = LOWER(${body.username})`)
          .limit(1);
        if (existing && existing.id !== auth.user.id) {
          return reply.status(409).send({ error: 'This username is already taken. Please choose a different one.' });
        }
      }

      const [updated] = await db
        .update(users)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(users.id, auth.user.id))
        .returning();

      const tag = getUserTag(updated);
      return {
        user: {
          id: updated.id,
          username: updated.username,
          tag,
          userTag: `${updated.username}#${tag}`,
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
      const token = AuthService.extractToken(req);
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
      const token = AuthService.extractToken(req);
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
      const token = AuthService.extractToken(req);
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
      const token = AuthService.extractToken(req);
      if (!token) return reply.status(401).send({ error: 'Not authenticated' });
      const auth = await AuthService.validateSession(token);
      if (!auth) return reply.status(401).send({ error: 'Session expired' });

      // Clean up all sessions first
      await db.delete(sessions).where(eq(sessions.userId, auth.user.id));
      await db.delete(users).where(eq(users.id, auth.user.id));
      const isProd = config.env === 'production' || process.env.NODE_ENV === 'production';
      reply.clearCookie(config.cookieName, {
        path: '/',
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
      });
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to delete account' });
    }
  });
}

