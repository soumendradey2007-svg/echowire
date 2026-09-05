<div align="center">

# EchoWire ⚡

**Real-time voice communication, text messaging, and synchronized music for gamers and communities.**  
*Built with a clean, distraction-free interface, studio-grade DSP noise cancellation, and ultra-low latency WebRTC.*

[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-4.28-000000?style=flat-square&logo=fastify&logoColor=white)](https://fastify.dev/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P%20Voice-FF4F00?style=flat-square&logo=webrtc&logoColor=white)](https://webrtc.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon.tech-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://neon.tech/)
[![DPDP Act 2023](https://img.shields.io/badge/DPDP%20Act%202023-Compliant-emerald?style=flat-square)](ECHOWIRE_HANDBOOK.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

[Architecture](#architecture) • [Features](#key-features) • [System Handbook](#-living-handbook) • [Quick Start](#quick-start) • [Deployment](#deployment-guide)

---

</div>

## Overview

EchoWire is an open-source, lightweight communication platform designed for high-performance voice and chat during gaming, collaborative work, and community hangouts. It eliminates bloated desktop downloads, invasive background telemetry, and expensive server bandwidth by utilizing a decentralized **Two-Lane Architecture**:

1. **The Control Tower (Fastify Backend)**: Coordinates user authentication, room lifecycles, friendships, text messaging, and presence via WebSockets.
2. **The Direct Voice Expressway (WebRTC P2P Mesh)**: Delivers studio-processed, encrypted voice packets directly between participants' browsers with 20–40ms latency and **$0 server media cost**.

```text
================================================================================
                           ECHOWIRE SYSTEM ARCHITECTURE
================================================================================

 [ USER'S BROWSER (CLIENT LAYER) ]
 +-----------------------------------------------------------------------------+
 |  React 19 UI | Top Progress Bar | Web Audio DSP Nodes | WebSocket Client   |
 +-----------------------------------------------------------------------------+
         |                                           ^
         | REST API (HTTP)                           | WebRTC P2P Voice
         | & WebSockets (Real-time)                  | (Direct between browsers)
         v                                           v
 +-----------------------------------+     +-----------------------------------+
 |   LANE 1: CONTROL TOWER (BACKEND) |     |   LANE 2: PEER VOICE MESH         |
 |   (Fastify Node.js + TypeScript)  |     |   (WebRTC Direct Mesh)            |
 |                                   |     |                                   |
 | - Auth Routes (Argon2id Hash)     |     | [Player A] <====================> |
 | - Bot Protection (Honeypot/Timer) |     |            Direct Audio Packets   |
 | - Room Moderation & Kicking       |     |                  (Opus 64kbps)    |
 | - WebSocket Push Gateway          |     | [Player B] <====================> |
 | - Rate Limiter (Sliding Window)   |     |                                   |
 +-----------------------------------+     +-----------------------------------+
         |                                                   ^
         | SQL Queries                                       | STUN IP Lookup
         v                                                   v
 +-----------------------------------+             +-------------------+
 |   PERSISTENCE LAYER (DATABASE)    |             | GOOGLE STUN POOL  |
 |   (PostgreSQL + Drizzle ORM)      |             | (stun.l.google...)|
 |                                   |             +-------------------+
 | - users        - room_members     |
 | - sessions     - messages         |
 | - friendships  - music_queue      |
 | - rooms        - user_blocks      |
 +-----------------------------------+
================================================================================
```

---

## Key Features

### 🎙️ Advanced Studio DSP Voice Architecture
- **24 dB/octave Butterworth High-Pass Filter (80 Hz)**: Strips desk vibrations, mechanical keyboard rumbles, and air conditioning hum.
- **Dual Electrical Hum Notch Filters (50 Hz & 60 Hz, Q = 30)**: Eliminates power cord noise without degrading vocal warmth.
- **Parametric Vocal Peaking Filter (2.8 kHz, +2.5 dB, Q = 1.2)**: Enhances speech intelligibility and crispness.
- **High-Frequency Cutoff (11 kHz)**: Removes coil whine, backlight buzz, and harsh sibilance.
- **Broadcast Dynamics Compressor**: Automatically levels loud shouts and quiet whispers to keep room volume balanced.
- **Real-Time Voice Activity Detection (VAD)**: Calculates RMS audio volume 60 times per second to illuminate avatars with an emerald green pulse ring when speaking.
- **Zero Media Costs ($0 Bills)**: Direct WebRTC P2P mesh completely bypasses centralized media servers.

### ⚡ Instant Visual Feedback & Top Progress Bar
- **Global Network Activity Interceptor**: Tracks outbound user-initiated API requests in `src/lib/api.ts` via an active request bus (`onNetworkLoading`).
- **Top Glowing Progress Bar (`TopLoadingBar`)**: An indigo-to-accent neon beam glides across the top edge of the viewport the moment any network request begins, hitting 100% on completion.
- **Single-Cycle Animation Lock & Anti-Looping**: Uses a cycle lock (`isRunningRef`) and strict interval cleanup to ensure concurrent requests smoothly ride a single progress cycle without looping 5–6 times or jumping backwards.
- **Silent Background Hydration**: Periodic background state sync (`/api/auth/me`, room list, friend list) passes `{ silent: true }` to keep the UI clean, quiet, and flicker-free.
- **15-Second Safety Watchdog**: An automated timeout resets network request counters if a connection drops or hangs, guaranteeing the loading state never freezes on screen.
- **4.5-Second Reassurance Banner**: Automatically presents a floating pill (*"Connecting to EchoWire server..."*) during genuine slow or cold-boot operations and cleanly dismisses on resolution.
- **Per-Button Micro-Interactions**: Inline animated SVG spinners and disabled states on room joining (*"Joining..."*), room creation (*"Creating..."*), authentication (*"Signing in..."*, *"Creating account..."*), and friend/invite actions.
- **Fluid Transitions**: Subtle fade-in animations when switching views for a smooth, app-like feel.

### 🌐 Public vs. Private Channels & Guest Mode
- **Public Channels (`🌐 Public`)**: Open to all users, including guest visitors. Anyone can browse, join, talk over WebRTC, and participate in text chat.
- **Private Channels (`🔒 Private`)**: Exclusively reserved for registered, authenticated members. Guests attempting to join are blocked with clear, informative prompts.
- **Personal Lounges (`💜 Personal`)**: Permanent voice channels for registered users (`Username's Room`) that never expire or auto-delete.
- **Unique Guest Tagging**: Every guest receives a unique UUID-derived tag (e.g. `Guest#g-4A8F`), preventing tag collision or confusion in rooms.
- **Guest Creation Lock**: Guest accounts are scoped to join public rooms and prevented from creating rooms.
- **Atomic Creation & Zero-Race Deletion**: Room creation atomically links the owner to the room, eliminating foreign key race conditions.

### 👑 Room Moderation & Owner Privileges
- **Owner-Only Kick**: Room creators can moderate rooms with an exclusive red **Kick** action. Ordinary members cannot access or spoof kick endpoints.
- **Instant WebRTC Severing**: Kicking a member immediately dispatches `room:kicked`, removes them from `room_members`, and terminates all peer voice connections.
- **Kicked User Notification**: The kicked user is cleanly returned to the lobby with a bottom-right notification toast detailing the action.

### 🔔 10-Second Toast Notification System
- **Real-Time WebSocket Push**: Dispatches instant notifications for incoming friend requests, friend acceptances, room invites, and moderation actions.
- **Non-Intrusive Bottom-Right Cards**: Positioned to avoid disrupting gaming or chat.
- **Animated Countdown Bar**: Each notification features an animated 10-second timer bar and automatically dismisses smoothly if ignored.
- **One-Click Actions**: Includes interactive **Accept & Join** / **Decline** for room invites and **View Requests** for friend connections.

### 🟢 User Presence & Appearance
- **Status Selector**: Choose between 🟢 **Online**, 💤 **Do Not Disturb (DND)**, and 🎧 **In Room**.
- **Visual Badges**: Illustrated with vibrant indicator dots, sleeping icons, and miniature headphone badges across the sidebar, friends list, and profile.
- **Instant Sync**: Updates persist to the database and sync across peers in real time.

### 🎵 Synchronized Room Music Player
- Synchronized YouTube audio streaming directly inside voice channels.
- Shared queue management with track additions and skipping.
- Epoch timestamp synchronization (`music:sync`) ensures all room members hear music in perfect sync regardless of when they join.

### 📜 DPDP Act 2023 Statutory Compliance
- **Statutory Notice (Section 5)**: Explicit notice detailing specified personal data collection and lawful processing purposes.
- **Affirmative Unconditional Consent (Section 6)**: Mandatory legal consent modal (`LegalModal.tsx`) with zero pre-ticked checkboxes.
- **Zero Voice Recording Guarantee**: Voice audio travels exclusively via peer-to-peer WebRTC connections. EchoWire servers never record, listen to, store, analyze, or transcribe any voice communication.
- **Data Principal Rights (Sections 11–13)**: Self-serve profile updates, data correction, account erasure, and nominated representative pathways.
- **Grievance Redressal**: Formal Grievance Officer channel (`privacy@echowire.app`) and statutory notice of complaint rights to the **Data Protection Board of India (DPBI)**.

### 🛡️ Enterprise-Grade Security & Anti-Bot Defense
- **Argon2id Password Hashing**: Memory-hard key derivation to prevent brute-force cracking.
- **Google Identity Services (GIS)**: Cryptographically verified Google OAuth 2.0.
- **Airtight Session Lifecycle & Zero-Leak Sign Out**: Signing out or exiting a guest session atomically halts hardware microphone capture (`MediaStreamTrack.stop()`), closes Web Audio DSP nodes, severs WebRTC peer mesh connections, pauses active room music, permanently deletes the session from the PostgreSQL database, disarms WebSocket auto-reconnect timers, clears cookies/local storage, and purges in-memory states with animated UI feedback.
- **Anti-Bot Invisible Honeypot**: Hidden `website_hp` input traps automated spam scrapers.
- **Submission Timing Defense**: Rejects superhuman sub-second form submissions (< 750ms).
- **Helmet HTTP Security**: Hardened HTTP headers (`frameguard: deny`, `noSniff: true`, `xssFilter: true`, `strict-origin-when-cross-origin`).
- **Sliding-Window Rate Limiting**: Protects authentication, room creation, and invitation endpoints.

### 🗄️ Hybrid Database Engine
- **Production**: Serverless PostgreSQL via [Neon.tech](https://neon.tech) with connection pooling and SSL encryption.
- **Local Development**: Embedded zero-config [PGlite](https://pglite.dev/) engine (runs real PostgreSQL in-memory/file without requiring a local Postgres installation).

---

## 📖 Living Handbook

EchoWire maintains a comprehensive, beginner-friendly system handbook documenting the engineering, logic, database columns, and architectural decisions behind the entire platform:

* **[ECHOWIRE_HANDBOOK.md](file:///ECHOWIRE_HANDBOOK.md)** — Formatted Markdown version with tables and Mermaid architecture diagrams.
* **[ECHOWIRE_HANDBOOK.txt](file:///ECHOWIRE_HANDBOOK.txt)** — Plain-text version readable on any device without markdown viewers.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons |
| **Voice / Media** | WebRTC Peer-to-Peer Mesh, Web Audio API DSP Pipeline |
| **Backend API** | Node.js, Fastify 4, `@fastify/websocket`, `@fastify/rate-limit`, `@fastify/helmet`, `@fastify/cors` |
| **Authentication** | Argon2id, Google Identity Services (GIS), Crypto UUID Sessions |
| **Database & ORM** | Drizzle ORM, Neon Serverless PostgreSQL (`postgres.js`), `@electric-sql/pglite` |
| **Validation** | Zod v3 |
| **Legal** | Digital Personal Data Protection (DPDP) Act 2023 Compliant |

---

## Project Structure

```text
echowire/
├── index.html                   # HTML entrypoint with Google GIS client script
├── ECHOWIRE_HANDBOOK.md         # Comprehensive system architecture & logic handbook
├── ECHOWIRE_HANDBOOK.txt        # Plain-text portable system handbook
├── AGENTS.md                    # Coding agent guidelines & living documentation rules
├── src/                         # React 19 Frontend
│   ├── App.tsx                  # Core state, navigation history, toast notifications, view router
│   ├── main.tsx                 # Client application entrypoint
│   ├── components/              # Reusable UI components
│   │   ├── TopLoadingBar.tsx    # Glowing top progress bar & 3s wake-up notice
│   │   ├── LegalModal.tsx       # DPDP Act 2023 Privacy Policy & Terms modal
│   │   ├── Sidebar.tsx          # Channel navigation, user bar, voice controls
│   │   ├── RightPanel.tsx       # Room chat & synchronized music player
│   │   ├── GlobalMusicBar.tsx   # Persistent bottom music status bar
│   │   └── Icons.tsx            # SVG icon library
│   ├── views/                   # Application views
│   │   ├── AuthView.tsx         # Sign in, register, guest mode, and Google OAuth
│   │   ├── RoomsView.tsx        # Room listings, creation modal, and join states
│   │   ├── VoiceRoomView.tsx    # Live voice grid, owner moderation, speaking indicators
│   │   ├── FriendsView.tsx      # Mutual friends, friend requests, room invite actions
│   │   ├── ProfileView.tsx      # Standalone user profile view & username update
│   │   └── SettingsView.tsx     # Audio devices, studio DSP toggles, online status
│   └── lib/
│       ├── api.ts               # HTTP client with global loading tracking & auth injection
│       ├── voice.ts             # WebRTC P2P voice mesh & Web Audio DSP filters
│       └── ws.ts                # Real-time WebSocket client gateway
├── server/                      # Fastify Backend
│   ├── src/
│   │   ├── index.ts             # Server entrypoint
│   │   ├── server.ts            # Fastify plugins, CORS, Helmet security, health checks
│   │   ├── config.ts            # Environment variables loader
│   │   ├── db/                  # Drizzle ORM schema and database connection
│   │   │   ├── index.ts         # Hybrid DB connection (Neon Postgres / PGlite)
│   │   │   └── schema.ts        # Database table schemas
│   │   ├── routes/              # REST API controllers
│   │   │   ├── auth.routes.ts   # Authentication, verification, profile update, Google login
│   │   │   ├── rooms.routes.ts  # Room lifecycle, owner kick endpoint, invites
│   │   │   ├── messages.routes.ts # Channel message queries
│   │   │   └── friends.routes.ts  # Friendship requests, acceptance, blocking
│   │   ├── services/            # Business logic
│   │   │   ├── auth.service.ts  # Argon2id hashing and session management
│   │   │   ├── email.service.ts # Verification and reset emails (Resend/SMTP)
│   │   │   └── rate-limit.service.ts # In-memory sliding-window rate limiting
│   │   └── websocket/
│   │       └── gateway.ts       # Room pub/sub, chat broadcast, voice state sync, push alerts
│   └── package.json
└── package.json                 # Root monorepo package definition
```

---

## Quick Start

### Prerequisites
- **Node.js**: `v20.x` or higher
- **Package Manager**: `npm` or `pnpm`

### 1. Clone the Repository
```bash
git clone https://github.com/soumendradey2007-svg/echowire.git
cd echowire
```

### 2. Install Dependencies
```bash
npm install
cd server && npm install && cd ..
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

# Google OAuth Client ID (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

### 4. Run the Development Environment
Run both backend and frontend concurrently:

```bash
# Terminal 1: Fastify Backend
cd server && npm run dev

# Terminal 2: Vite Frontend
npm run dev
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
5. Configure your Environment Variables (`DATABASE_URL`, `SESSION_SECRET`, `CLIENT_ORIGIN`, `GOOGLE_CLIENT_ID`).
6. *Recommendation*: Prevent 15-minute free tier sleeping by pinging `https://your-service.onrender.com/api/health` every 10 minutes via [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com).

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
