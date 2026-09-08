import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { AuthService } from '../services/auth.service';
import { RateLimiter } from '../services/rate-limit.service';
import { MusicService } from '../services/music.service';
import { db } from '../db';
import { messages, roomMembers, rooms } from '../db/schema';
import { and, eq } from 'drizzle-orm';
import { config } from '../config';

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  username: string;
  currentRoomId: string | null;
  isAuthenticated: boolean;
}

function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const item of header.split(';')) {
    const [key, ...val] = item.trim().split('=');
    if (key) {
      cookies[key] = decodeURIComponent(val.join('='));
    }
  }
  return cookies;
}

export class WsGateway {
  private static clients = new Map<WebSocket, ConnectedClient>();
  private static voiceStates = new Map<string, { isMuted: boolean; isDeafened: boolean; isSpeaking: boolean }>();

  static getVoiceState(userId: string): { isMuted: boolean; isDeafened: boolean; isSpeaking: boolean } {
    return this.voiceStates.get(userId) || { isMuted: false, isDeafened: false, isSpeaking: false };
  }

  static register(app: FastifyInstance) {
    app.get('/api/ws', { websocket: true }, async (connection: any, req) => {
      // Fastify WebSocket v10 passes socket directly, v8 passes connection.socket
      const ws: WebSocket = connection?.socket || connection;
      if (!ws || typeof ws.on !== 'function') {
        console.error('[WS] Received invalid websocket stream');
        return;
      }

      const rawCookie = req.headers.cookie;
      const parsedCookies = parseCookies(rawCookie);
      const queryToken = (req.query as any)?.token || (req.query as any)?.auth_token;
      let headerToken: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader && typeof authHeader === 'string') {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
          headerToken = parts[1].trim();
        } else if (parts[0].length >= 16) {
          headerToken = parts[0].trim();
        }
      }
      const sessionToken = queryToken || headerToken || parsedCookies[config.cookieName];

      const client: ConnectedClient = {
        ws,
        userId: '',
        username: '',
        currentRoomId: null,
        isAuthenticated: false,
      };

      if (sessionToken) {
        const auth = await AuthService.validateSession(sessionToken);
        if (auth) {
          client.userId = auth.user.id;
          client.username = auth.user.username;
          client.isAuthenticated = true;
        }
      }

      this.clients.set(ws, client);

      // If not authenticated immediately, give 5 seconds to send an in-band { type: 'auth', data: { token } }
      let authTimeout: NodeJS.Timeout | null = null;
      if (!client.isAuthenticated) {
        authTimeout = setTimeout(() => {
          if (!client.isAuthenticated) {
            try { ws.close(4401, 'Unauthorized'); } catch {}
          }
        }, 5000);
      }

      ws.on('message', async (raw: any) => {
        try {
          const payload = JSON.parse(raw.toString());
          if (payload?.type === 'auth') {
            const token = payload?.data?.token;
            if (token) {
              const auth = await AuthService.validateSession(token);
              if (auth) {
                client.userId = auth.user.id;
                client.username = auth.user.username;
                client.isAuthenticated = true;
                if (authTimeout) {
                  clearTimeout(authTimeout);
                  authTimeout = null;
                }
                ws.send(JSON.stringify({ type: 'auth:success', data: { userId: client.userId } }));
                return;
              }
            }
            try { ws.close(4401, 'Unauthorized'); } catch {}
            return;
          }

          if (!client.isAuthenticated) {
            try { ws.close(4401, 'Unauthorized'); } catch {}
            return;
          }

          await this.handleEvent(client, payload);
        } catch (err) {
          console.error('[WS] Error processing message:', err);
        }
      });

      ws.on('close', async () => {
        if (authTimeout) {
          clearTimeout(authTimeout);
          authTimeout = null;
        }
        if (client.currentRoomId && client.userId) {
          const rId = client.currentRoomId;
          const uId = client.userId;
          try {
            await db.delete(roomMembers).where(and(eq(roomMembers.roomId, rId), eq(roomMembers.userId, uId)));
            const [room] = await db.select().from(rooms).where(eq(rooms.id, rId)).limit(1);
            const remaining = await db.select().from(roomMembers).where(eq(roomMembers.roomId, rId));
            if (room && room.description !== 'Personal Room' && remaining.length === 0) {
              await db.delete(rooms).where(eq(rooms.id, rId));
              WsGateway.broadcast('room:deleted', { roomId: rId });
            } else {
              WsGateway.broadcast('room:member_left', { roomId: rId, userId: uId });
            }
          } catch (e) {}
          WsGateway.broadcast('voice:peer_left', { roomId: rId, userId: uId });
        }
        if (client.userId) {
          WsGateway.voiceStates.delete(client.userId);
        }
        this.clients.delete(ws);
      });
    });
  }

  private static async handleEvent(client: ConnectedClient, payload: { type: string; data: any }) {
    const { type, data } = payload;

    // WebRTC Signaling for live cross-device voice chat
    if (type === 'room:invite') {
      const { targetUserId, roomId, roomName } = data || {};
      if (!roomId || !targetUserId) return;
      // Authorize that sender is a member of the room
      const [isMember] = await db
        .select()
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, client.userId)))
        .limit(1);
      if (!isMember) return;

      for (const [ws, c] of this.clients.entries()) {
        if (c.userId === targetUserId && ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'room:invite_received',
            data: {
              roomId,
              roomName,
              fromUserId: client.userId,
              fromUsername: client.username,
            },
          }));
        }
      }
    }

    if (type === 'webrtc:signal') {
      const { targetUserId, signal } = data || {};
      if (!targetUserId || !client.currentRoomId) return;

      // Ensure target user is in the same room as the sender to prevent cross-room signal spoofing/eavesdropping
      for (const [ws, c] of this.clients.entries()) {
        if (c.userId === targetUserId && c.currentRoomId === client.currentRoomId && ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'webrtc:signal',
            data: {
              fromUserId: client.userId,
              signal,
            },
          }));
        }
      }
    }

    if (type === 'voice:join') {
      const { roomId } = data || {};
      if (!roomId) return;

      // Verify that the user has an active membership record in this room
      const [membership] = await db
        .select()
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, client.userId)))
        .limit(1);

      if (!membership) {
        client.ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'You must join the room via the room join API before establishing voice connection.' },
        }));
        return;
      }

      client.currentRoomId = roomId;
      const existingPeers: any[] = [];
      const myState = WsGateway.getVoiceState(client.userId);
      for (const [ws, c] of this.clients.entries()) {
        if (c.currentRoomId === roomId && c.userId !== client.userId && ws.readyState === 1) {
          const peerState = WsGateway.getVoiceState(c.userId);
          existingPeers.push({
            userId: c.userId,
            username: c.username,
            isMuted: peerState.isMuted,
            isDeafened: peerState.isDeafened,
            isSpeaking: peerState.isSpeaking,
          });
          ws.send(JSON.stringify({
            type: 'voice:peer_joined',
            data: {
              userId: client.userId,
              username: client.username,
              isMuted: myState.isMuted,
              isDeafened: myState.isDeafened,
              isSpeaking: myState.isSpeaking,
            },
          }));
        }
      }
      if (existingPeers.length > 0) {
        client.ws.send(JSON.stringify({
          type: 'voice:existing_peers',
          data: { peers: existingPeers },
        }));
      }
    }

    if (type === 'voice:leave') {
      const { roomId } = data || {};
      const targetRoom = roomId || client.currentRoomId;
      client.currentRoomId = null;
      WsGateway.voiceStates.delete(client.userId);
      if (targetRoom) {
        this.broadcastToRoom(targetRoom, 'voice:peer_left', { userId: client.userId });
      }
    }

    if (type === 'voice:state_change') {
      const { roomId, isMuted, isDeafened, isSpeaking } = data || {};
      const targetRoomId = roomId || client.currentRoomId;
      if (!targetRoomId || targetRoomId !== client.currentRoomId) return;

      WsGateway.voiceStates.set(client.userId, {
        isMuted: !!isMuted,
        isDeafened: !!isDeafened,
        isSpeaking: !!isSpeaking,
      });
      this.broadcastToRoom(targetRoomId, 'voice:state_change', {
        userId: client.userId,
        roomId: targetRoomId,
        isMuted: !!isMuted,
        isDeafened: !!isDeafened,
        isSpeaking: !!isSpeaking,
      }, client.userId);
    }

    if (type === 'chat:send') {
      const { roomId, content } = data || {};
      if (!roomId || !content || typeof content !== 'string') return;
      if (client.currentRoomId !== roomId) {
        // Also verify DB membership if user hasn't joined voice in this room
        const [isMember] = await db
          .select()
          .from(roomMembers)
          .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, client.userId)))
          .limit(1);
        if (!isMember) {
          client.ws.send(JSON.stringify({ type: 'error', data: { message: 'You must be a member of the room to send messages.' } }));
          return;
        }
      }

      const rl = RateLimiter.check(`chat:${client.userId}`, 5, 1000);
      if (!rl.allowed) {
        client.ws.send(JSON.stringify({ type: 'error:rate_limited', data: { message: 'Chat rate limit exceeded. You can only send 5 messages per second.', retryAfterMs: rl.retryAfterMs } }));
        return;
      }

      const cleanContent = content.trim().slice(0, 2000);
      const [newMsg] = await db.insert(messages).values({
        roomId,
        userId: client.userId,
        content: cleanContent,
      }).returning();

      this.broadcastToRoom(roomId, 'chat:message', {
        id: newMsg.id,
        roomId: newMsg.roomId,
        userId: newMsg.userId,
        content: newMsg.content,
        isPinned: newMsg.isPinned,
        editedAt: null,
        createdAt: newMsg.createdAt.toISOString(),
        author: {
          id: client.userId,
          username: client.username,
          avatarUrl: null,
          createdAt: newMsg.createdAt.toISOString(),
        },
      });
    }

    if (type === 'music:get_state') {
      const targetRoomId = data?.roomId || client.currentRoomId;
      if (targetRoomId) {
        const state = MusicService.getState(targetRoomId);
        client.ws.send(JSON.stringify({ type: 'music:sync', data: state }));
      }
    }

    if (type === 'music:control') {
      const { roomId, action, positionSeconds, position, track } = data || {};
      const targetRoomId = roomId || client.currentRoomId;
      if (targetRoomId) {
        if (client.currentRoomId !== targetRoomId) {
          const [isMember] = await db
            .select()
            .from(roomMembers)
            .where(and(eq(roomMembers.roomId, targetRoomId), eq(roomMembers.userId, client.userId)))
            .limit(1);
          if (!isMember) return;
        }
        const targetPos = position !== undefined ? position : positionSeconds;
        const updated = MusicService.control(targetRoomId, action, targetPos, track);
        this.broadcastToRoom(targetRoomId, 'music:sync', updated);
      }
    }
  }

  static sendToUser(userId: string, type: string, data: any): boolean {
    let sent = false;
    const msg = JSON.stringify({ type, data });
    for (const [ws, c] of this.clients.entries()) {
      if (c.userId === userId && ws.readyState === 1) {
        ws.send(msg);
        sent = true;
      }
    }
    return sent;
  }

  static broadcast(type: string, data: any) {
    const msg = JSON.stringify({ type, data });
    for (const [ws] of this.clients.entries()) {
      if (ws.readyState === 1) {
        ws.send(msg);
      }
    }
  }

  static broadcastToRoom(roomId: string, type: string, data: any, excludeUserId?: string) {
    const msg = JSON.stringify({ type, data });
    for (const [ws, c] of this.clients.entries()) {
      if (c.currentRoomId === roomId && ws.readyState === 1 && (!excludeUserId || c.userId !== excludeUserId)) {
        ws.send(msg);
      }
    }
  }
}
