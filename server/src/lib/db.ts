import mongoose from 'mongoose';
import { env } from '../config/env.js';

let pending: Promise<typeof mongoose> | null = null;

/** Connection is cached across serverless invocations. */
export async function connectDB(uri = env().MONGO_URI) {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!pending) {
    mongoose.set('strictQuery', true);
    // In production, indexes are created once by scripts/setup-production.ts (syncIndexes) instead of
    // being re-checked on every serverless cold start, which added extra round trips to the first request.
    const prod = process.env.NODE_ENV === 'production';
    pending = mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, maxPoolSize: 10, autoIndex: !prod }).catch((err) => {
      pending = null;
      throw err;
    });
  }
  return pending;
}
