import express, { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { allowedOrigins, env } from './config/env.js';
import { connectDB } from './lib/db.js';
import { errorHandler, notFound, rejectMongoOperators } from './lib/http.js';
import { runAsPlatform } from './lib/tenantContext.js';
import { tenantScope, normalizeHost } from './middleware/tenant.js';
import { protect } from './middleware/auth.js';
import { Tenant } from './models/platform.js';
import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import websiteRoutes from './routes/website.js';
import businessRoutes from './routes/business.js';
import crmRoutes from './routes/crm.js';
import billingRoutes from './routes/billing.js';
import reportRoutes from './routes/reports.js';
import staffRoutes, { auditRouter } from './routes/staff.js';
import moduleRoutes from './routes/modules.js';
import portalRoutes from './routes/portal.js';
import platformRoutes from './routes/platform.js';

/** CORS: fixed origins from env + every gym's own sub-domain / custom domain. */
async function originAllowed(origin: string) {
  const clean = origin.replace(/\/+$/, '');
  if (allowedOrigins().includes(clean) || allowedOrigins().includes('*')) return true;
  let host: string;
  try {
    const u = new URL(clean);
    if (u.protocol !== 'https:' && u.hostname !== 'localhost') return false;
    host = normalizeHost(u.hostname);
  } catch {
    return false;
  }
  const root = env().ROOT_DOMAIN.toLowerCase();
  if (host === root || host.endsWith(`.${root}`)) return true;
  return Boolean(await runAsPlatform(() => Tenant.exists({ domains: host })));
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        originAllowed(origin).then((ok) => cb(null, ok), () => cb(null, false));
      },
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant', 'X-Tenant-Host'],
      exposedHeaders: ['Content-Disposition'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      maxAge: 600,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(rejectMongoOperators);

  // Make sure the DB is connected (serverless cold starts) before any route runs.
  app.use(async (_req, _res, next) => {
    try { await connectDB(); next(); } catch (e) { next(e); }
  });

  app.get(['/', '/api', '/api/health'], (_req, res) => res.json({ success: true, status: 'ok', service: 'gym-platform-api', time: new Date().toISOString() }));

  const api = Router();
  api.use(rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

  // Vendor console (no tenant).
  api.use('/platform', platformRoutes);

  // Everything else belongs to exactly one gym.
  const tenantApi = Router();
  tenantApi.use(tenantScope());
  tenantApi.use('/public', publicRoutes);
  tenantApi.use('/auth', authRoutes);
  tenantApi.use('/portal', protect, portalRoutes);

  const admin = Router();
  admin.use(protect);
  admin.use((req, _res, next) => (req.user!.role === 'member' ? next(Object.assign(new Error('Staff only'), { status: 403 })) : next()));
  admin.use('/website', websiteRoutes);
  admin.use('/', businessRoutes);
  admin.use('/', crmRoutes);
  admin.use('/billing', billingRoutes);
  admin.use('/reports', reportRoutes);
  admin.use('/staff', staffRoutes);
  admin.use('/audit', auditRouter);
  admin.use('/ops', moduleRoutes);
  tenantApi.use('/admin', admin);

  api.use('/', tenantApi);
  app.use('/api', api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

const app = createApp();
export default app;
