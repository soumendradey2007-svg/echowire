# EchoWire

A lightweight real-time voice-chat platform for gamers with a restrained, human-designed interface, built with:
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, `livekit-client`
- **Backend**: Node.js, Fastify 4, WebSocket, Argon2id, Zod
- **Database**: PostgreSQL with Drizzle ORM (and zero-config embedded PGlite for local development)
- **Voice SFU**: LiveKit WebRTC architecture

## Quick Start
1. **Start the Fastify backend**:
   ```bash
   pnpm --filter echowire-server dev
   ```
2. **Start the Vite frontend** (in another terminal):
   ```bash
   pnpm dev
   ```
3. Open http://localhost:8443 in your browser.
