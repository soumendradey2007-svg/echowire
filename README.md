<div align="center">

# EchoWire ⚡

**Real-time voice chat, text messaging, and synchronized music for gamers and communities.**  
*Built with a clean, distraction-free interface, studio-grade DSP noise cancellation, and ultra-low latency WebRTC.*

[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-4.28-000000?style=flat-square&logo=fastify&logoColor=white)](https://fastify.dev/)
[![LiveKit](https://img.shields.io/badge/LiveKit-WebRTC-FF4F00?style=flat-square&logo=webrtc&logoColor=white)](https://livekit.io/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon.tech-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://neon.tech/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

[Live Demo](https://echowire.vercel.app) • [Architecture](#architecture) • [Features](#key-features) • [Quick Start](#quick-start) • [Deployment](#deployment-guide)

---

</div>

## Overview

EchoWire is an open-source, lightweight alternative to Discord designed for high-performance communication during gaming and collaborative sessions. It avoids unnecessary bloat, focusing entirely on **crystal-clear voice**, **synchronized room music**, and **instant messaging**.

```
                           ┌───────────────────────────────┐
                           │      EchoWire Web Client      │
                           │   (React 19, Tailwind v4)     │
                           └───────────────┬───────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │ HTTPS / WSS                                 │ WebRTC Audio
                    ▼                                             ▼
       ┌─────────────────────────┐                   ┌─────────────────────────┐
       │   Fastify API Server    │                   │   LiveKit SFU Server    │
       │ (Auth, Rooms, WebSockets│                   │ (Selective Forward Unit │
       │  Rate Limit, Music API) │                   │  Opus Low-Latency Voice)│
       └────────────┬────────────┘                   └─────────────────────────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│  Neon PostgreSQL │  │ Embedded PGlite  │
│  (Production DB) │  │ (Local Dev DB)   │
└──────────────────┘  └──────────────────┘
```

---

## Key Features

### 🎙️ Discord-Grade Studio DSP Voice Architecture
- **24 dB/octave Butterworth High-Pass Filter (80 Hz)**: Strips desk rumbles, laptop vibrations, and HVAC hum.
- **Dual Electrical Hum Notch Filters (50 Hz & 60 Hz, Q = 30)**: Cleans mains hum without affecting vocal tone.
- **Parametric Vocal Peaking Filter (2.8 kHz, +2.5 dB, Q = 1.2)**: Enhances vocal articulation and presence.
- **High-Frequency Cutoff (11 kHz)**: Eliminates coil whine, monitor interference, and harsh static hiss.
- **Broadcast AGC Dynamics Compressor**: Prevents microphone clipping when shouting and boosts quiet speech.
- **Opus Codec Optimization**: Injects `usedtx=1`, `useinbandfec=1`, and optimal bitrate targets into WebRTC SDP negotiation for packet loss resilience.

### 🎵 Synchronized Room Music Player
- Search and stream YouTube audio directly within voice channels.
- Shared queue management with position reordering.
- Synchronized play, pause, and timestamp scrubbing across all room participants in real-time.

### 💬 Real-Time Messaging & Channels
- Text channels with low-latency WebSocket communication.
- Message editing, pinned announcements, and live typing/speaker indicators.
- Direct Messaging (DM) system and mutual friend management (requests, accepts, blocks).

### 🔒 Enterprise-Grade Security & Authentication
- **Argon2id** password hashing with salt generation.
- **Google OAuth 2.0 (Google Identity Services)**: Cryptographically verified against Google's `tokeninfo` endpoint.
- **"Keep Me Signed In"**: Dual-tier storage (`localStorage` vs. `sessionStorage`) with persistent 30-day cookie vs. browser session cookie.
- **Zoom-Style Instant Guest Mode**: Join voice rooms instantly with a temporary display name without signing up.
- **Rate Limiting**: Token-bucket algorithm across sensitive endpoints (auth, room creation, song search).
- **CORS & CSP Hardened**: Custom origin filtering and strict security headers via Fastify Helmet.

### 🗄️ Hybrid Database Engine
- **Production**: Serverless PostgreSQL via [Neon.tech](https://neon.tech) with connection pooling and SSL encryption.
- **Local Development**: Embedded zero-config [PGlite](https://pglite.dev/) engine (runs real PostgreSQL in-memory/file without requiring a local Postgres installation).

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons |
| **Voice / WebRTC** | LiveKit Client (`livekit-client`), Web Audio API DSP Nodes |
| **Backend API** | Node.js, Fastify 4, `@fastify/websocket`, `@fastify/rate-limit`, `@fastify/cors` |
| **Authentication** | Argon2id, Google Identity Services (GIS), Crypto UUID sessions |
| **ORM & Database** | Drizzle ORM, Neon Serverless PostgreSQL (`postgres.js`), `@electric-sql/pglite` |
| **Validation** | Zod v3 |

---

## Project Structure

```text
echowire/
├── index.html                   # HTML entrypoint with Google GIS client script
├── src/                         # React 19 Frontend
│   ├── App.tsx                  # Core state, navigation history, and view router
│   ├── main.tsx                 # Client application root
│   ├── components/              # Reusable UI components
│   │   ├── Sidebar.tsx          # Channel navigation, user bar, room controls
│   │   ├── RoomView.tsx         # Voice participant grid and room text chat
│   │   ├── MusicPlayer.tsx      # Synchronized room music playback
│   │   ├── ProfileModal.tsx     # User profile and account preferences
│   │   ├── DirectMessages.tsx   # Private 1-on-1 chats and friend lists
│   │   └── Icons.tsx            # SVG icon library
│   ├── views/                   # Top-level application views
│   │   ├── AuthView.tsx         # Sign in, register, guest, and Google OAuth
│   │   ├── ProfileView.tsx      # Standalone user profile view
│   │   └── SettingsView.tsx     # Audio device selection & DSP toggles
│   └── lib/
│       ├── api.ts               # HTTP client with Bearer auth injection
│       ├── voice.ts             # WebRTC DSP audio pipeline & LiveKit integration
│       └── ws.ts                # WebSocket client gateway
├── server/                      # Fastify Backend
│   ├── src/
│   │   ├── index.ts             # Server entrypoint
│   │   ├── server.ts            # Fastify server plugins, CORS, and health checks
│   │   ├── config.ts            # Environment variables loader
│   │   ├── db/                  # Drizzle ORM schema and migrations
│   │   │   ├── index.ts         # Hybrid DB connection (Neon Postgres / PGlite)
│   │   │   └── schema.ts        # Database table schemas
│   │   ├── routes/              # REST API controllers
│   │   │   ├── auth.routes.ts   # Authentication, verification, and Google login
│   │   │   ├── rooms.routes.ts  # Room lifecycle, participants, and permissions
│   │   │   ├── messages.routes.ts # Channel and DM message queries
│   │   │   └── friends.routes.ts  # Friendship requests and blocking
│   │   ├── services/            # Business logic
│   │   │   ├── auth.service.ts  # Argon2id hashing and session management
│   │   │   ├── email.service.ts # Verification and reset emails (Resend/SMTP)
│   │   │   └── rate-limit.service.ts # In-memory rate limiting
│   │   └── websocket/
│   │       └── gateway.ts       # Room pub/sub, chat broadcast, and voice sync
│   └── package.json
└── package.json                 # Monorepo / root package definition
```

---

## Quick Start

### Prerequisites
- **Node.js**: `v20.x` or higher
- **Package Manager**: `pnpm` (recommended) or `npm`

### 1. Clone the Repository
```bash
git clone https://github.com/soumendradey2007-svg/echowire.git
cd echowire
```

### 2. Install Dependencies
```bash
pnpm install
cd server && pnpm install && cd ..
```

### 3. Configure Environment Variables
Create a `.env` file in the `server/` directory:

```env
NODE_ENV=development
PORT=3001
HOST=0.0.0.0
CLIENT_ORIGIN=http://localhost:5173
SESSION_SECRET=a_very_long_secure_random_string_here_32_bytes_min

# Optional: Remote PostgreSQL (Leave blank to use embedded zero-config PGlite)
DATABASE_URL=

# LiveKit SFU (Can use LiveKit Cloud free tier or local Docker instance)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# Google OAuth Client ID
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

### 4. Run the Development Environment
Run both backend and frontend concurrently:

```bash
# Terminal 1: Fastify Backend
pnpm --filter echowire-server dev

# Terminal 2: Vite Frontend
pnpm dev
```

Open your browser to `http://localhost:5173`.

---

## Deployment Guide

EchoWire is built for zero-cost deployment using cloud free tiers:

### 1. Database: [Neon](https://neon.tech)
1. Create a free project on Neon.
2. Copy the **Pooled Connection String** (`postgresql://...`).
3. Set this as `DATABASE_URL` in your backend environment.

### 2. Backend: [Render](https://render.com)
1. Create a new **Web Service** pointing to your repository.
2. Root Directory: `server`
3. Build Command: `npm run build`
4. Start Command: `npm run start`
5. Configure your Environment Variables (`DATABASE_URL`, `SESSION_SECRET`, `CLIENT_ORIGIN`, `LIVEKIT_*`).
6. *Optional*: Prevent 15-minute free tier sleeping by pinging `https://your-service.onrender.com/api/health` every 10 minutes via [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com).

### 3. Frontend: [Vercel](https://vercel.com)
1. Import the repository into Vercel.
2. Framework Preset: **Vite**
3. Add Environment Variable:
   - `VITE_API_URL`: `https://your-backend.onrender.com`
4. Deploy!

---

## Google Cloud Console Configuration

To enable Google Sign-In on your production site:
1. Go to the [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Select your OAuth 2.0 Web Client ID.
3. Under **Authorized JavaScript origins**, add:
   - `https://your-app.vercel.app`
   - `http://localhost:5173`
4. Under **Authorized redirect URIs**, add:
   - `https://your-app.vercel.app`
   - `http://localhost:5173`
5. Save changes.

---

## Contributing

Contributions are welcome! If you'd like to improve the DSP pipeline, UI components, or add new integrations:
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## License

Distributed under the **MIT License**. See `LICENSE` for more information.
