import { createServer } from './server';
import { config } from './config';

async function start() {
  const app = await createServer();
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`[ECHOWIRE SERVER] Running at http://${config.host}:${config.port}`);
  } catch (err) {
    console.error('[ECHOWIRE SERVER] Startup failed:', err);
    process.exit(1);
  }
}

start();
