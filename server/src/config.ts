import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:8443',
  sessionSecret: process.env.SESSION_SECRET || 'echowire-dev-insecure-session-secret-change-in-prod-32bytes',
  cookieName: 'echowire_session',
  databaseUrl: process.env.DATABASE_URL || '',
  livekitUrl: process.env.LIVEKIT_URL || 'ws://localhost:7880',
  livekitApiKey: process.env.LIVEKIT_API_KEY || 'devkey',
  livekitApiSecret: process.env.LIVEKIT_API_SECRET || 'secret',
};
