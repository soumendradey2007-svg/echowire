import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { AuthService } from '../services/auth.service';
import { RateLimiter } from '../services/rate-limit.service';
import { MusicService } from '../services/music.service';
import { db } from '../db';
import { messages } from '../db/schema';
import { config } from '../config';

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  username: string;
  currentRoomId: string | null;
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
      const sessionToken = parsedCookies[config.cookieName];

      if (!sessionToken) {
        try { ws.close(4401, 'Unauthorized'); } catch {}
        return;
      }

      const auth = await AuthService.validateSession(sessionToken);
      if (!auth) {
        try { ws.close(4401, 'Unauthorized'); } catch {}
        return;
      }

      const client: ConnectedClient = {
        ws,
        userId: auth.user.id,
        username: auth.user.username,
        currentRoomId: null,
      };

      this.clients.set(ws, client);

      ws.on('message', async (raw: any) => {
        try {
          const payload = JSON.parse(raw.toString());
          await this.handleEvent(client, payload);
        } catch (err) {
          console.error('[WS] Error processing message:', err);
        }
      });

      ws.on('close', async () => {
        if (client.currentRoomId) {
          const rId = client.currentRoomId;
          const uId = client.userId;
          try {
            const { roomMembers: rmTable, rooms: rTable } = await import('../db/schema');
            const { and: andEq, eq: eqCol } = await import('drizzle-orm');
            await db.delete(rmTable).where(andEq(eqCol(rmTable.roomId, rId), eqCol(rmTable.userId, uId)));
            const [room] = await db.select().from(rTable).where(eqCol(rTable.id, rId)).limit(1);
            const remaining = await db.select().from(rmTable).where(eqCol(rmTable.roomId, rId));
            if (room && room.description !== 'Personal Room' && remaining.length === 0) {
              await db.delete(rTable).where(eqCol(rTable.id, rId));
              WsGateway.broadcast('room:deleted', { roomId: rId });
            } else {
              WsGateway.broadcast('room:member_left', { roomId: rId, userId: uId });
            }
          } catch (e) {}
          WsGateway.broadcast('voice:peer_left', { roomId: rId, userId: uId });
        }
        WsGateway.voiceStates.delete(client.userId);
        this.clients.delete(ws);
      });
    });
  }

  private static async handleEvent(client: ConnectedClient, payload: { type: string; data: any }) {
    const { type, data } = payload;

        // WebRTC Signaling for live cross-device voice chat
    if (type === 'room:invite') {
      const { targetUserId, roomId, roomName } = data;
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
      const { targetUserId, signal } = data;
      for (const [ws, c] of this.clients.entries()) {
        if (c.userId === targetUserId && ws.readyState === 1) {
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
      const { roomId } = data;
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
      const { roomId } = data;
      client.currentRoomId = null;
      WsGateway.voiceStates.delete(client.userId);
      this.broadcastToRoom(roomId, 'voice:peer_left', { userId: client.userId });
    }

    if (type === 'voice:state_change') {
      const { roomId, isMuted, isDeafened, isSpeaking } = data;
      client.currentRoomId = roomId;
      WsGateway.voiceStates.set(client.userId, {
        isMuted: !!isMuted,
        isDeafened: !!isDeafened,
        isSpeaking: !!isSpeaking,
      });
      this.broadcastToRoom(roomId, 'voice:state_change', {
        userId: client.userId,
        roomId,
        isMuted: !!isMuted,
        isDeafened: !!isDeafened,
        isSpeaking: !!isSpeaking,
      });
    }

    if (type === 'chat:send') {
      const { roomId, content } = data;
      if (!content || typeof content !== 'string') return;

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
      const { roomId } = data;
      const state = MusicService.getState(roomId);
      client.ws.send(JSON.stringify({ type: 'music:sync', data: state }));
    }

    if (type === 'music:control') {
      const { roomId, action, positionSeconds, track } = data;
      const updated = MusicService.control(roomId, action, positionSeconds, track);
      this.broadcastToRoom(roomId, 'music:sync', updated);
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

  static broadcastToRoom(roomId: string, type: string, data: any) {
    this.broadcast(type, data);
  }
}
