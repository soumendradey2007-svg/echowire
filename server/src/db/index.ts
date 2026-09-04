import { config } from '../config';
import * as schema from './schema';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import fs from 'node:fs';
import path from 'node:path';

export let db: any;
export let rawSqlExecute: (query: string) => Promise<any>;

export async function initDb() {
  if (config.databaseUrl) {
    try {
      const client = postgres(config.databaseUrl, { max: 10 });
      db = drizzlePg(client, { schema });
      rawSqlExecute = async (q: string) => client.unsafe(q);
      console.log('[DATABASE] Connected to PostgreSQL via DATABASE_URL');
    } catch (err) {
      console.warn('[DATABASE] PostgreSQL connection failed, falling back to embedded PGlite engine:', err);
      initEmbeddedPglite();
    }
  } else {
    initEmbeddedPglite();
  }

  await runMigrations();
}

function initEmbeddedPglite() {
  const dataDir = path.resolve(process.cwd(), 'data/echowire-db');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const pglite = new PGlite(dataDir);
  db = drizzlePglite(pglite, { schema });
  rawSqlExecute = async (q: string) => pglite.exec(q);
  console.log('[DATABASE] Initialized real PostgreSQL database via PGlite engine at data/echowire-db');
}

async function runMigrations() {
  const ddl = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(32) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      status VARCHAR(16) NOT NULL DEFAULT 'online',
      is_email_verified BOOLEAN NOT NULL DEFAULT false,
      verification_token VARCHAR(64),
      verification_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      user_agent TEXT,
      ip_address VARCHAR(45),
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS friendships (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_blocks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(64) NOT NULL,
      type VARCHAR(16) NOT NULL DEFAULT 'voice',
      description TEXT,
      is_private BOOLEAN NOT NULL DEFAULT false,
      password_hash TEXT,
      bitrate INTEGER NOT NULL DEFAULT 64000,
      max_participants INTEGER NOT NULL DEFAULT 25,
      text_chat_enabled BOOLEAN NOT NULL DEFAULT true,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS room_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(16) NOT NULL DEFAULT 'member',
      is_muted_by_admin BOOLEAN NOT NULL DEFAULT false,
      is_deafened_by_admin BOOLEAN NOT NULL DEFAULT false,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS room_bans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      banned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS room_invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      code VARCHAR(32) NOT NULL UNIQUE,
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      max_uses INTEGER,
      uses INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_pinned BOOLEAN NOT NULL DEFAULT false,
      edited_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS music_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      provider VARCHAR(16) NOT NULL DEFAULT 'youtube',
      provider_track_id TEXT NOT NULL,
      title TEXT NOT NULL,
      artist TEXT,
      duration_seconds INTEGER NOT NULL,
      thumbnail_url TEXT,
      added_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_messages_room_time ON messages(room_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_exp ON sessions(user_id, expires_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_room_members_lookup ON room_members(room_id, user_id);
  `;

  await rawSqlExecute(ddl);
}
