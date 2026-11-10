import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './lib/db.js';

// Local / Docker entry point. On Vercel, api/index.ts exports the app instead.
const port = env().PORT;
connectDB()
  .then(() => app.listen(port, () => console.log(`[api] listening on http://localhost:${port}`)))
  .catch((err) => {
    console.error('[api] failed to start:', err.message);
    process.exit(1);
  });
