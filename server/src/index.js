import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/auth.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = (process.env.CLIENT_URL || 'http://localhost:5173').split(',');
      if (!origin || allowed.includes(origin) || allowed.includes('*')) return cb(null, true);
      return cb(null, true);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false }));
app.use('/api', routes);
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'GymFlow API is running successfully!',
    status: 'online'
  });
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`[api] GymFlow server listening on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('[api] failed to connect to MongoDB:', err.message);
    process.exit(1);
  });

export default app;
