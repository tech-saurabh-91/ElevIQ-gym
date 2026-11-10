/**
 * Zero-setup local run: starts a throwaway in-memory MongoDB, seeds the demo gym,
 * then starts the API on PORT (default 5000). Nothing touches your real database.
 *
 *   npm run dev:memory
 */
import { spawn } from 'node:child_process';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGO_URI = mongo.getUri('gym_dev');
process.env.JWT_SECRET ||= 'local-dev-secret-change-me-0123456789';
process.env.ROOT_DOMAIN ||= 'localhost';
process.env.DEFAULT_TENANT_SLUG ||= 'demo';
process.env.CLIENT_ORIGINS ||= 'http://localhost:5173';
process.env.PLATFORM_ADMIN_EMAIL ||= 'vendor@example.com';
// Never inherit a real Atlas URI or Redis from .env in this mode.
process.env.REDIS_URL = '';

// Async spawn: the parent must keep reading mongod's output pipe or mongod stalls.
const code = await new Promise<number>((resolve) => {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/seed.ts'], { stdio: 'inherit', env: process.env });
  child.on('exit', (c) => resolve(c ?? 1));
});
if (code !== 0) {
  await mongo.stop();
  process.exit(code);
}

await import('../src/index.js');

const stop = async () => { await mongo.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
