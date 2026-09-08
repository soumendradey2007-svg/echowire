import dotenv from 'dotenv';
dotenv.config();

const env = process.env.NODE_ENV || 'development';
const sessionSecret = process.env.SESSION_SECRET || 'echowire-dev-insecure-session-secret-change-in-prod-32bytes';

if (env === 'production') {
  if (!process.env.SESSION_SECRET || sessionSecret.includes('echowire-dev-insecure') || sessionSecret.length < 32) {
    console.warn('[SECURITY WARNING] In production, SESSION_SECRET must be set to a cryptographically strong secret of at least 32 characters.');
  }
}

export const config = {
  env,
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:8443',
  sessionSecret,
  cookieName: 'echowire_session',
  databaseUrl: process.env.DATABASE_URL || '',
  livekitUrl: process.env.LIVEKIT_URL || 'ws://localhost:7880',
  livekitApiKey: process.env.LIVEKIT_API_KEY || 'devkey',
  livekitApiSecret: process.env.LIVEKIT_API_SECRET || 'secret',
};
