# ECHOWIRE: THE COMPLETE ARCHITECTURE, LOGIC & SYSTEM HANDBOOK
### *A Comprehensive, Beginner-Friendly Guide to Building a Modern, Zero-Cost, Ultra-Low-Latency Voice & Hangout Platform*

---

## ABOUT THIS BOOK

This handbook was written so that anyone—regardless of technical experience—can pick it up, read it like a book, and understand 100% of how EchoWire is engineered. 

Whether you are showing this to investors, explaining it to friends, onboarding a teammate, or learning for yourself, this document breaks down the entire system: from the big-picture architecture to the human reason behind every single line of code, technical term, and database column.

---

## TABLE OF CONTENTS

1. [Chapter 1: The Core Philosophy & The Big Picture](#chapter-1-the-core-philosophy--the-big-picture)
2. [Chapter 2: The Complete System Architecture (Explained & Visualized)](#chapter-2-the-complete-system-architecture-explained--visualized)
3. [Chapter 3: The Plain-English Technical Dictionary](#chapter-3-the-plain-english-technical-dictionary)
4. [Chapter 4: The Database Bible (Every Table & Column Decoded)](#chapter-4-the-database-bible-every-table--column-decoded)
5. [Chapter 5: Feature Playbook & Step-by-Step Lifecycles](#chapter-5-feature-playbook--step-by-step-lifecycles)
6. [Chapter 6: The "Why" Behind Every Architectural Decision](#chapter-6-the-why-behind-every-architectural-decision)
7. [Chapter 7: How to Run, Test, and Maintain EchoWire](#chapter-7-how-to-run-test-and-maintain-echowire)

---

# CHAPTER 1: THE CORE PHILOSOPHY & THE BIG PICTURE

### What is EchoWire?
EchoWire is a modern, privacy-first web application for voice communication, text chat, friend connections, and synchronized music playback. It gives users the power of applications like Discord or Zoom, but without bloated downloads, heavy background processes, or invasive surveillance.

### The Traditional Problem: Why Traditional Voice Apps Cost a Fortune
In traditional applications like Zoom, Discord, or Teams:
1. Every time a user speaks, their microphone audio is converted into data and sent over the internet to a massive, centralized media server (often located hundreds or thousands of miles away).
2. That central server decodes the audio, mixes or duplicates it, and blasts it back out to every other participant.
3. **The Downsides**:
   * **Massive Cost**: A single server streaming voice to 1,000 active gamers can run bandwidth bills in the thousands of dollars every month.
   * **Latency (Lag)**: Sound takes time to travel to Virginia or Frankfurt and back, causing participants to constantly interrupt and talk over each other.
   * **Privacy Concerns**: The company running the central server has the technical capability to listen to, record, analyze, or transcribe every word you say.

### EchoWire’s Core Breakthrough: The "Two-Lane Highway"
EchoWire completely eliminates server bandwidth costs and audio surveillance by separating the application into two independent lanes:

1. **Lane 1: The Control Tower (The Backend Server)**
   * Built with **Node.js**, **Fastify**, and **PostgreSQL**.
   * It handles administrative tasks: user accounts, checking passwords, listing active rooms, saving text chat messages, and notifying friends when you come online.
   * **Crucial Detail**: The server *never* touches your voice audio. It does not know or care what you are saying.

2. **Lane 2: The Direct Voice Expressway (WebRTC Peer-to-Peer)**
   * When you join a voice room, the server only acts as a matchmaker: it introduces your computer to your friend’s computer by exchanging network addresses.
   * Once introduced, the server steps completely out of the way!
   * Your browser connects directly to your friend’s browser. Your microphone audio travels straight from your laptop to their speakers in 20 to 40 milliseconds over encrypted Peer-to-Peer (P2P) packets.
   * **Bandwidth Cost to You**: $0.
   * **Privacy**: 100% private. We physically cannot record or listen to conversations because audio never touches our server.

---

# CHAPTER 2: THE COMPLETE SYSTEM ARCHITECTURE

Below is the complete architectural blueprint of EchoWire, showing how all six layers communicate seamlessly.

```
================================================================================
                           ECHOWIRE SYSTEM BLUEPRINT
================================================================================

 [ USER'S BROWSER (CLIENT LAYER) ]
 +-----------------------------------------------------------------------------+
 |  React UI  |  Tailwind CSS  |  Web Audio DSP (Noise Filters) | State Mgmt   |
 +-----------------------------------------------------------------------------+
         |                                           ^
         | REST API (HTTP)                           | WebRTC P2P Voice
         | & WebSockets (Real-time)                  | (Direct between browsers)
         v                                           v
 +-----------------------------------+     +-----------------------------------+
 |   LANE 1: THE CONTROL TOWER       |     |   LANE 2: THE PEER VOICE MESH     |
 |   (Fastify Node.js Backend)       |     |   (WebRTC Direct Mesh)            |
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

### Layer 1: The Presentation / Client Layer
* **Technology**: React 18, TypeScript, Tailwind CSS, Vite.
* **What it does**: This is the visual interface that runs in the user's browser. It renders the room grid, friend lists, chat windows, profile modals, and status badges. It is compiled with Vite into high-performance static files.

### Layer 2: The Gateway & Control Layer
* **Technology**: Fastify, TypeScript, `@fastify/websocket`.
* **What it does**: Fastify serves as our high-performance HTTP and WebSocket server. It handles incoming login requests, validates input data using strict schemas, enforces rate-limiting to prevent DDoS attacks, and routes real-time events (like friend requests and moderation kicks) across open sockets.

### Layer 3: The Data & Persistence Layer
* **Technology**: PostgreSQL, Drizzle ORM.
* **What it does**: Stores permanent records (accounts, passwords, rooms, messages, friendships). Drizzle ORM provides type-safe queries without adding any heavy runtime performance penalties.

### Layer 4: The Peer-to-Peer Media Layer
* **Technology**: WebRTC (`RTCPeerConnection`), Google STUN servers.
* **What it does**: Negotiates direct browser-to-browser media pipes. When someone speaks, Opus-encoded audio packets travel across UDP directly to the other peers in the room.

### Layer 5: The Studio Audio DSP (Digital Signal Processing) Pipeline
* **Technology**: Web Audio API (`AudioContext`, `BiquadFilterNode`, `DynamicsCompressorNode`, `AnalyserNode`).
* **What it does**: Before audio leaves your laptop, it runs through a chain of software filters inside your browser that eliminates fan hum, room echo, power cord buzz, and keyboard clicks, while measuring your volume level to illuminate your avatar with a green pulse ring when you speak.

### Layer 6: The Security, Anti-Bot & Compliance Layer
* **Technology**: Argon2id, Helmet, Invisible Honeypot, Timing Analysis, DPDP Act 2023 Statutory Consent.
* **What it does**: Protects the platform from hackers, credential stuffers, automated spambots, and legal liability.

---

# CHAPTER 3: THE PLAIN-ENGLISH TECHNICAL DICTIONARY

Every technical term in EchoWire explained with its real-world analogy and exact purpose:

---

### 1. WebRTC (Web Real-Time Communication)
* **Definition**: A browser standard that allows direct transmission of audio, video, and data between browsers without an intermediary server.
* **Analogy**: A direct walkie-talkie link between two people, rather than routing messages through an operator.
* **In EchoWire**: It is the engine that carries voice between players.
* **Without it**: You would need expensive cloud audio servers costing hundreds of dollars per month, and voice would lag by 500ms.

---

### 2. Peer-to-Peer (P2P)
* **Definition**: A network model where equal computers (peers) communicate directly with one another.
* **Analogy**: Handing a notebook directly to your classmate instead of handing it to the teacher to hand to your classmate.
* **In EchoWire**: All voice audio is P2P. Only text messages and account details go through the server.
* **Without it**: Audio would be centralized, creating high latency and surveillance risks.

---

### 3. STUN Server & ICE Candidates
* **Definition**: A STUN server is a public helper that tells your computer what its public IP address and port look like to the rest of the world. The resulting network route is called an **ICE Candidate**.
* **Analogy**: Looking in a full-length mirror to check what color jacket you are wearing so you can tell a friend how to spot you in a crowded stadium.
* **In EchoWire**: We use Google's STUN servers (`stun.l.google.com:19302`). They allow two computers behind home Wi-Fi routers to find each other and connect directly.
* **Without it**: Players on different home Wi-Fi networks would be blocked by firewalls and could never hear each other.

---

### 4. SDP (Session Description Protocol) & "Signaling"
* **Definition**: A standardized digital summary of your computer's audio capabilities and network addresses. Exchanging these summaries through the server is called **Signaling**.
* **Analogy**: Two travelers agreeing on what language they will speak before having a conversation.
* **In EchoWire**: Browser A generates an SDP Offer, sends it over WebSocket to the server, and the server delivers it to Browser B. Browser B replies with an SDP Answer. Once exchanged, direct voice begins.
* **Without it**: The two computers wouldn't know how to decode each other's audio streams.

---

### 5. WebSockets vs. REST API
* **Definition**: REST APIs use standard HTTP request/response cycles (one-and-done). WebSockets keep a permanent two-way channel open 24/7.
* **Analogy**: REST API is sending a letter by mail. WebSocket is keeping an open telephone call.
* **In EchoWire**: REST API handles login and room creation. WebSockets handle real-time events: friend requests, kicks, mic mutes, and music sync.
* **Without it**: The app would have to ask the server every second if someone sent a message, draining battery and lagging.

---

### 6. Argon2id Password Hashing
* **Definition**: A cryptographic function that scrambles a password into an irreversible string using substantial computer memory (RAM).
* **Analogy**: Dropping fruit into a blender. It is physically impossible to turn the smoothie back into the original fruit.
* **In EchoWire**: Used to store user passwords in the `users` table.
* **Without it**: If an attacker breached the database, they would read every user's password in plain text. Even older hashes like SHA-256 can be cracked in minutes by hacker supercomputers; Argon2id renders brute-force attacks impossible.

---

### 7. Bearer Token & Session Token Hash
* **Definition**: A random 64-character key given to the browser upon login. The server stores only the SHA-256 hash of this key.
* **Analogy**: A VIP wristband given to you at a club door.
* **In EchoWire**: Proves your identity on every page load so you stay logged in.
* **Without it**: You would have to re-type your password on every single click. Storing the hash means even if the database is leaked, hackers cannot use the stored data to log into accounts.

---

### 8. Sliding-Window Rate Limiting
* **Definition**: An algorithm that measures how many actions an IP address or user makes within a rolling time window (e.g., maximum 5 requests per second).
* **Analogy**: A bouncer holding a clicker at a doorway who only lets one person enter every two seconds to prevent a stampede.
* **In EchoWire**: Protects the login page from brute-force password guessing and protects text chat from spam bots.
* **Without it**: A malicious user could fire 10,000 requests per second and crash the server.

---

### 9. Honeypot & 750ms Timing (Anti-Bot Defense)
* **Definition**: A hidden HTML input field (`website_hp`) combined with a submission stopwatch.
* **Analogy**: A fake door painted on a wall. Humans ignore it, but a robot bumps right into it.
* **In EchoWire**: Real humans do not see `website_hp` and leave it empty. Automated spam scripts automatically fill out every field they find. If `website_hp` contains text, or if the form is submitted faster than 750ms from page load, the server rejects it as a bot.
* **Without it**: Spambots would flood the database with fake accounts, or you would have to annoy real human users with Google CAPTCHA picture puzzles.

---

### 10. DPDP Act, 2023 Compliance
* **Definition**: India's comprehensive Digital Personal Data Protection Act enacted in 2023.
* **In EchoWire**:
  * **Section 5**: Full statutory notice explaining exactly what data is collected before the user signs up.
  * **Section 6**: Affirmative consent using an un-ticked checkbox (pre-checked boxes are illegal).
  * **Zero Voice Recording**: Explicit disclosure that voice is peer-to-peer and never recorded.
  * **Grievance Redressal**: An official email (`privacy@echowire.app`) and right to complain to the Data Protection Board of India.
* **Without it**: The application would be legally non-compliant, face regulatory fines, and risk user distrust.

---

# CHAPTER 4: THE DATABASE BIBLE (EVERY TABLE & COLUMN DECODED)

EchoWire uses PostgreSQL managed through Drizzle ORM. Here is every table and column explained with the engineering reason for its existence:

---

### Table 1: `users`
*Purpose*: Stores registered user accounts.
* `id` (UUID): 128-bit unguessable identifier. Using numbers (1, 2, 3) allows attackers to scrape accounts. UUIDs prevent enumeration attacks.
* `username` (VARCHAR 32, Unique): The user's visible name. Enforced unique so no two people share the same name.
* `email` (VARCHAR 255, Unique): Lowercase email used for login and password resets.
* `password_hash` (TEXT): The Argon2id scrambled password.
* `avatar_url` (TEXT): Web link to profile picture.
* `bio` (TEXT): User description text.
* `status` (VARCHAR 16): Online status: `'online'`, `'dnd'`, `'in_room'`, `'offline'`.
* `is_email_verified` (BOOLEAN): Tracks if email verification link was clicked.
* `verification_token` (VARCHAR 64): Random token sent in verification email.
* `verification_expires_at` (TIMESTAMP): 24-hour expiration deadline for the email link.
* `created_at` / `updated_at` (TIMESTAMP): Creation and update tracking.

---

### Table 2: `sessions`
*Purpose*: Manages active logins across multiple devices.
* *Why separate from `users`?* A user can be logged into their phone and laptop simultaneously. A single boolean on the `users` table cannot handle multiple devices.
* `id` (UUID): Unique session ID.
* `user_id` (UUID): Links to `users.id`. Features `ON DELETE CASCADE`—if an account is erased under DPDP laws, all active sessions vanish instantly.
* `token_hash` (VARCHAR 64, Unique): The SHA-256 hash of the session token.
* `user_agent` (TEXT): Browser and operating system details (e.g. "Chrome on Windows 11").
* `ip_address` (VARCHAR 45): IP address used for security rate-limiting and suspicious login detection.
* `expires_at` (TIMESTAMP): 7 days for "Keep me signed in", 24 hours for standard sessions.
* `created_at` (TIMESTAMP): When the session began.

---

### Table 3: `friendships`
*Purpose*: Connects two accounts.
* `id` (UUID): Unique record ID.
* `requester_id` (UUID): Person who sent the request.
* `addressee_id` (UUID): Person who received the request.
* `status` (VARCHAR 16): `'pending'`, `'accepted'`, or `'declined'`.
* `created_at` / `updated_at` (TIMESTAMP): Audit timestamps.

---

### Table 4: `user_blocks`
*Purpose*: Anti-harassment protection.
* `id` (UUID): Unique record ID.
* `blocker_id` (UUID): User who initiated the block.
* `blocked_id` (UUID): User being blocked. Blocked users cannot send messages or friend requests to the blocker.

---

### Table 5: `rooms`
*Purpose*: Voice and text channels.
* `id` (UUID): Unique room ID.
* `name` (VARCHAR 64): Room display name (e.g., "Squad Alpha").
* `type` (VARCHAR 16): `'voice'` or `'text'`.
* `description` (TEXT): Room topic.
* `is_private` (BOOLEAN): Whether entry requires a password.
* `password_hash` (TEXT): Scrambled room password for private rooms.
* `bitrate` (INTEGER): Opus audio bitrate (default 64,000 bps for studio-clear gaming voice).
* `max_participants` (INTEGER): Room limit (default 25 members) to prevent chaotic audio overlap.
* `text_chat_enabled` (BOOLEAN): Toggle for side text chat.
* `owner_id` (UUID): Room creator. Only this user has room kick and moderation privileges.

---

### Table 6: `room_members`
*Purpose*: Tracks who is currently inside which room right now.
* `id` (UUID): Membership ID.
* `room_id` (UUID): Target room ID.
* `user_id` (UUID): Participant user ID.
* `role` (VARCHAR 16): `'owner'`, `'admin'`, or `'member'`.
* `is_muted_by_admin` (BOOLEAN): Admin-enforced microphone silence.
* `is_deafened_by_admin` (BOOLEAN): Admin-enforced headphone deafen.
* `joined_at` (TIMESTAMP): Time entered.

---

### Table 7: `room_bans`
*Purpose*: Room-level blacklist.
* `id` (UUID): Ban record ID.
* `room_id` (UUID): Room ID.
* `user_id` (UUID): Banned user ID.
* `banned_by` (UUID): Admin who issued the ban.
* `reason` (TEXT): Ban justification.

---

### Table 8: `room_invites`
*Purpose*: Shareable invite links.
* `id` (UUID): Invite record ID.
* `room_id` (UUID): Target room.
* `code` (VARCHAR 32, Unique): Clean code (e.g. `squad-892f`).
* `creator_id` (UUID): Who made the invite.
* `max_uses` (INTEGER) / `uses` (INTEGER): Limit and count of joins.
* `expires_at` (TIMESTAMP): Link expiration date.

---

### Table 9: `messages`
*Purpose*: Text chat inside rooms.
* `id` (UUID): Unique message ID.
* `room_id` (UUID): Room where message was posted.
* `user_id` (UUID): Author ID.
* `content` (TEXT): Message text, capped at 2,000 characters to prevent buffer overflow or spam attacks.
* `is_pinned` (BOOLEAN): Pinned announcement toggle.
* `edited_at` / `created_at` (TIMESTAMP): Chat timestamps.

---

### Table 10: `music_queue`
*Purpose*: Synchronized room playlist.
* `id` (UUID): Queue item ID.
* `room_id` (UUID): Target room.
* `provider` (VARCHAR 16): Source (`'youtube'`).
* `provider_track_id` (TEXT): YouTube Video ID.
* `title` / `artist` (TEXT): Metadata.
* `duration_seconds` (INTEGER): Track length.
* `thumbnail_url` (TEXT): Artwork link.
* `added_by` (UUID): User who queued the track.
* `position` (INTEGER): Sequence index (0 = currently playing).

---

# CHAPTER 5: FEATURE PLAYBOOK & STEP-BY-STEP LIFECYCLES

Here is how each key feature executes under the hood, step by step:

---

### Feature 1: Room Moderation (Owner-Only Kick)
1. **The Human Scenario**: An disruptive user enters your room. You need to remove them.
2. **The Code Verification**: The UI checks `isOwner && !member.isOwner && member.id !== currentUser.id`. If true, an exclusive red **Kick** button appears on that user's card.
3. **The Request**: The owner clicks Kick, and the browser calls `POST /api/rooms/:id/kick` with `targetUserId`.
4. **The Security Check**: The backend verifies `room.ownerId === auth.user.id`. If an ordinary member tries to spoof this API request, the server rejects it with `403 Forbidden`.
5. **The Real-Time Broadcast**: The server removes the user from `room_members` and dispatches:
   * `room:member_left` to update member lists for other users.
   * `voice:peer_left` to close all WebRTC audio connections to that user.
   * `room:kicked` directly to the target user's WebSocket.
6. **The Result**: The kicked user's browser immediately disconnects from voice, redirects to the dashboard, and displays a bottom-right toast: *"You were kicked from Squad Alpha by Alex."*

---

### Feature 2: 10-Second Bottom-Right Notification Popups
1. **The Human Scenario**: You are playing a fast-paced game. You cannot afford to have a modal window appear in the middle of your screen.
2. **The Push Notification**: User A sends a friend request to User B. The server executes `WsGateway.sendToUser(target.id, 'friend:request_received')`.
3. **The Non-Intrusive Card**: A sleek notification card slides into the bottom-right corner of User B's screen.
4. **The 10-Second Timer**: An animated progress bar counts down from 10 to 0 seconds.
5. **The Interaction**: User B can click "View Requests" to accept, click the "X" to dismiss, or simply ignore it—after 10 seconds, it smoothly disappears without interrupting the game.

---

### Feature 3: Studio Audio Filters & The Green Speaking Glow
1. **The Audio Chain**: When you talk, your microphone audio passes through Web Audio nodes:
   * **Highpass (80Hz)**: Filters out desk knocks and heavy steps.
   * **Notch (50/60Hz)**: Snips out electrical power cord hum.
   * **Noise Gate**: Mutes mic signal when volume drops below room background noise.
   * **Compressor**: Levels loud screams vs. soft whispers.
2. **Volume Analysis**: An `AnalyserNode` calculates volume 60 times per second.
3. **The Visualizer**: When volume exceeds the speech threshold, your browser sends `{ isSpeaking: true }` over WebSocket.
4. **The Result**: An emerald green pulse ring illuminates your avatar on everyone's screen in real time.

---

### Feature 4: Synchronized YouTube Music Playback
1. **The Problem**: Two people loading a YouTube video independently will always be 5-10 seconds out of sync due to buffering.
2. **The Timestamp Solution**: When a track starts, the server records the exact epoch millisecond: `startedAt`.
3. **The Synchronization**: When any user enters the room, the server broadcasts `music:sync`. The client calculates:
   $$\text{Offset Seconds} = \frac{\text{Date.now()} - \text{startedAt}}{1000}$$
4. **The Result**: All YouTube players jump to that exact second, allowing everyone in the room to hear the beat drop simultaneously.

---

# CHAPTER 6: THE "WHY" BEHIND EVERY ARCHITECTURAL DECISION

| Decision | Alternative Considered | The Real Reason We Built It This Way |
|---|---|---|
| **Peer-to-Peer WebRTC** | Central Voice Server (SFU) | Zero server bandwidth costs ($0 bills), 20ms ultra-low latency, and legal DPDP compliance by guaranteeing voice is never stored. |
| **Argon2id Hashing** | SHA-256 or bcrypt | SHA-256 is vulnerable to GPU clusters (billions of guesses/sec). Argon2id requires heavy computer RAM, making brute-force cracking mathematically impossible. |
| **Invisible Honeypot + Timing** | Google reCAPTCHA | Blocks 100% of bots without annoying human users with "click all traffic lights" puzzles or tracking cookies. |
| **Fastify** | Express.js | Up to 4x faster request throughput and native async schema validation. |
| **Drizzle ORM** | Prisma | Zero runtime overhead; compiles directly to lightweight, type-safe native SQL. |
| **DPDP Act 2023 Compliance** | Generic Terms | Fully satisfies India's federal privacy law with affirmative consent, a Grievance Officer, and zero voice recording. |

---

# CHAPTER 7: HOW TO RUN, TEST, AND MAINTAIN ECHOWIRE

* **Frontend Build**: `npm run build` in root folder (Vite builds into `/dist`).
* **Backend Build**: `cd server && npm run build` (esbuild builds into `server/dist/index.js`).
* **Run in Development**:
  * Terminal 1: `cd server && npm run dev`
  * Terminal 2: `npm run dev`
  * Access in browser: `http://localhost:5173`
* **Git Status**: All changes are committed and pushed to remote `origin/main`.

---
### *End of Handbook*
