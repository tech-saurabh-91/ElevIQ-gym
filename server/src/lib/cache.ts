import { Redis } from 'ioredis';
import { env } from '../config/env.js';

/** Redis when REDIS_URL is set (local docker / Upstash), otherwise a small in-process TTL map. */
interface Cache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSec: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
}

class MemoryCache implements Cache {
  private m = new Map<string, { v: string; exp: number }>();
  async get<T>(key: string) {
    const hit = this.m.get(key);
    if (!hit) return null;
    if (hit.exp < Date.now()) { this.m.delete(key); return null; }
    return JSON.parse(hit.v) as T;
  }
  async set(key: string, value: unknown, ttlSec: number) {
    if (this.m.size > 5000) this.m.clear();
    this.m.set(key, { v: JSON.stringify(value), exp: Date.now() + ttlSec * 1000 });
  }
  async del(...keys: string[]) { keys.forEach((k) => this.m.delete(k)); }
}

class RedisCache implements Cache {
  constructor(private r: Redis, private fallback = new MemoryCache()) {}
  private ok() { return this.r.status === 'ready'; }
  async get<T>(key: string) {
    if (!this.ok()) return this.fallback.get<T>(key);
    try { const v = await this.r.get(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
  }
  async set(key: string, value: unknown, ttlSec: number) {
    if (!this.ok()) return this.fallback.set(key, value, ttlSec);
    try { await this.r.set(key, JSON.stringify(value), 'EX', ttlSec); } catch { /* cache is best-effort */ }
  }
  async del(...keys: string[]) {
    await this.fallback.del(...keys);
    if (!keys.length || !this.ok()) return;
    try { await this.r.del(...keys); } catch { /* ignore */ }
  }
}

let instance: Cache | null = null;
export function cache(): Cache {
  if (instance) return instance;
  const url = env().REDIS_URL;
  if (url) {
    const r = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 1, enableOfflineQueue: false });
    r.on('error', () => { /* falls back to memory while down */ });
    instance = new RedisCache(r);
  } else instance = new MemoryCache();
  return instance;
}

export const cacheKeys = {
  host: (host: string) => `tenant:host:${host}`,
  site: (tenantId: string) => `site:published:${tenantId}`,
};
