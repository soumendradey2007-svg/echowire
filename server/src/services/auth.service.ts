import argon2 from 'argon2';
import crypto from 'node:crypto';
import { db } from '../db';
import { users, sessions } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  static async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  static async createSession(userId: string, userAgent?: string, ipAddress?: string): Promise<{ rawToken: string; expiresAt: Date }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.insert(sessions).values({
      userId,
      tokenHash,
      userAgent: userAgent?.slice(0, 500) || null,
      ipAddress: ipAddress?.slice(0, 45) || null,
      expiresAt,
    });

    return { rawToken, expiresAt };
  }

  static async validateSession(rawToken: string) {
    if (!rawToken || rawToken.length < 16) return null;
    const tokenHash = this.hashToken(rawToken);

    const [sessionRecord] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
      .limit(1);

    if (!sessionRecord) return null;

    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.id, sessionRecord.userId))
      .limit(1);

    if (!userRecord) return null;

    return { session: sessionRecord, user: userRecord };
  }

  static async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    await db
      .delete(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    return true;
  }

  static async revokeAllOtherSessions(userId: string, currentSessionId: string): Promise<boolean> {
    const all = await db.select().from(sessions).where(eq(sessions.userId, userId));
    for (const s of all) {
      if (s.id !== currentSessionId) {
        await db.delete(sessions).where(eq(sessions.id, s.id));
      }
    }
    return true;
  }
}
