import { RateLimiter } from './services/rate-limit.service';
import { AuthService } from './services/auth.service';
import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { config } from './config';
import { initDb } from './db';
import { authRoutes } from './routes/auth.routes';
import { roomRoutes } from './routes/rooms.routes';
import { messageRoutes } from './routes/messages.routes';
import { friendRoutes } from './routes/friends.routes';
import { WsGateway } from './websocket/gateway';

export async function createServer() {
  const app = fastify({
    logger: config.env !== 'test',
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. curl, mobile apps, server-to-server)
      if (!origin) return cb(null, true);
      if (
        origin === config.clientOrigin ||
        origin === 'https://echowire.vercel.app' ||
        /^https:\/\/echowire(-[a-zA-Z0-9_-]+)?\.vercel\.app$/.test(origin)
      ) {
        return cb(null, true);
      }
      try {
        const u = new URL(origin);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
          return cb(null, true);
        }
      } catch {}
      // Reject unknown origins
      return cb(new Error('CORS: origin not allowed'), false);
    },
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  await app.register(cookie, {
    secret: config.sessionSecret,
  });

  await app.register(rateLimit, {
    max: 2000,
    timeWindow: '1 minute',
  });

  // Safely parse empty JSON bodies without throwing FST_ERR_CTP_EMPTY_JSON_BODY
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    try {
      const str = typeof body === 'string' ? body.trim() : '';
      const json = str === '' ? {} : JSON.parse(str);
      done(null, json);
    } catch (err: any) {
      done(err, undefined);
    }
  });

  await app.register(websocket);

  // Initialize Database
  await initDb();

  // Register WebSocket Gateway
  WsGateway.register(app);

  // Register REST API Routes
  await app.register(authRoutes);
  await app.register(roomRoutes);
  await app.register(messageRoutes);
  await app.register(friendRoutes);

    // Full-length song search endpoint
  app.get('/api/music/search', async (req, reply) => {
    try {
      const ip = req.ip || '127.0.0.1';
      const token = AuthService.extractToken(req);
      const limiterKey = token ? `music_search:${token.slice(0, 16)}` : `music_search:${ip}`;
      const rl = RateLimiter.check(limiterKey, 30, 60000);
      if (!rl.allowed) {
        return reply.status(429).send({ error: 'Song search limit reached. Please wait a few seconds before searching again.' });
      }

      const { q } = req.query as { q: string };
      if (!q || !q.trim()) return { results: [] };

      const query = q.trim();

      // 1. Direct YouTube link or 11-char Video ID detection
      const ytIdMatch = query.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/) ||
                        (query.length === 11 && /^[\w-]{11}$/.test(query) ? [null, query] : null);

      if (ytIdMatch && ytIdMatch[1]) {
        const videoId = ytIdMatch[1];
        try {
          const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
            signal: AbortSignal.timeout(6000),
          });
          if (oembedRes.ok) {
            const oembed: any = await oembedRes.json();
            return {
              results: [{
                id: videoId,
                videoId,
                title: oembed.title || 'YouTube Track',
                artist: oembed.author_name || 'YouTube',
                durationText: '3:30',
                durationSeconds: 210,
                thumbnail: oembed.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              }]
            };
          }
        } catch {}
        return {
          results: [{
            id: videoId,
            videoId,
            title: `YouTube Track (${videoId})`,
            artist: 'YouTube',
            durationText: '3:30',
            durationSeconds: 210,
            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          }]
        };
      }

      // 2. Query YouTube search
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': 'CONSENT=YES+1; PREF=tz=UTC',
        },
        signal: AbortSignal.timeout(6000),
      });

      const html = await res.text();
      const match = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData\s*=\s*({.+?});/s);

      const results: any[] = [];
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          const contents =
            data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

          for (const item of contents) {
            if (results.length >= 10) break;
            const v = item.videoRenderer;
            if (!v || !v.videoId) continue;

            const title = v.title?.runs?.[0]?.text || 'Unknown Track';
            const artist = v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || 'YouTube';
            const durationText = v.lengthText?.simpleText || '3:30';
            const thumbnail = v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`;

            const parts = durationText.split(':').map(Number);
            const durationSeconds = parts.length === 2 ? parts[0] * 60 + parts[1] : (parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 210);

            results.push({
              id: v.videoId,
              videoId: v.videoId,
              title,
              artist,
              durationText,
              durationSeconds,
              thumbnail,
            });
          }
        } catch {}
      }

      // 3. Fallback to public Invidious instances if direct scrape yielded 0 results
      if (results.length === 0) {
        const invidiousInstances = ['https://vid.puffyan.us', 'https://invidious.nerdvpn.de'];
        for (const inst of invidiousInstances) {
          try {
            const invRes = await fetch(`${inst}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(6000),
            });
            if (invRes.ok) {
              const invData: any = await invRes.json();
              if (Array.isArray(invData) && invData.length > 0) {
                for (const item of invData.slice(0, 10)) {
                  if (item.videoId) {
                    const durSec = item.lengthSeconds || 210;
                    const m = Math.floor(durSec / 60);
                    const s = durSec % 60;
                    results.push({
                      id: item.videoId,
                      videoId: item.videoId,
                      title: item.title || 'Track',
                      artist: item.author || 'Artist',
                      durationText: `${m}:${s < 10 ? '0' : ''}${s}`,
                      durationSeconds: durSec,
                      thumbnail: item.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
                    });
                  }
                }
                break;
              }
            }
          } catch {}
        }
      }

      return { results };
    } catch (err: any) {
      console.error('[MUSIC SEARCH ERROR]', err);
      return { results: [] };
    }
  });

  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  return app;
}
