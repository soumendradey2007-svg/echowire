import { spawn } from 'node:child_process';

console.log('\x1b[36m[ECHOWIRE]\x1b[0m Starting Backend (port 3001) and Frontend (port 8443) together in 1 terminal...\n');

const isWindows = process.platform === 'win32';

// 1. Start Backend Fastify Server
const server = spawn('pnpm', ['--filter', 'echowire-server', 'dev'], {
  stdio: 'inherit',
  shell: isWindows,
});

// 2. Start Frontend Vite Dev Server
const client = spawn('pnpm', ['exec', 'vite'], {
  stdio: 'inherit',
  shell: isWindows,
});

function handleExit() {
  server.kill();
  client.kill();
  process.exit();
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
process.on('exit', handleExit);
