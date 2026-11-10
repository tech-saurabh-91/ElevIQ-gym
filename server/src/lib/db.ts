import mongoose from 'mongoose';
import { env } from '../config/env.js';

let pending: Promise<typeof mongoose> | null = null;

/** Connection is cached across serverless invocations. */
export async function connectDB(uri = env().MONGO_URI) {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!pending) {
    mongoose.set('strictQuery', true);
    pending = mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, maxPoolSize: 10 }).catch((err) => {
      pending = null;
      throw err;
    });
  }
  return pending;
}
