import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const asyncHandler =
  <R extends Request = Request>(fn: (req: R, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as R, res, next)).catch(next);
  };

export const parse = <S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> => {
  const r = schema.safeParse(data);
  if (!r.success) {
    const message = r.error.issues.map((i) => `${i.path.join('.') || 'value'}: ${i.message}`).join('; ');
    throw new ApiError(400, message, r.error.issues);
  }
  return r.data;
};

/** Rejects any key starting with `$` or containing `.` anywhere in body/query (NoSQL operator injection). */
export const rejectMongoOperators: RequestHandler = (req, _res, next) => {
  const bad = (v: unknown, depth = 0): boolean => {
    if (depth > 12 || v === null || typeof v !== 'object') return false;
    if (Array.isArray(v)) return v.some((x) => bad(x, depth + 1));
    return Object.entries(v as Record<string, unknown>).some(([k, val]) => k.startsWith('$') || k.includes('.') || bad(val, depth + 1));
  };
  if (bad(req.body) || bad(req.query)) return next(new ApiError(400, 'Invalid characters in request'));
  next();
};

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  let status = err.status || 500;
  let message = err.message || 'Server error';
  if (err instanceof ZodError) {
    status = 400;
    message = err.issues.map((i) => i.message).join('; ');
  }
  if (err.name === 'CastError') { status = 400; message = 'Invalid identifier'; }
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {}).filter((k) => k !== 'tenantId')[0] || 'field';
    message = `That ${field} is already in use`;
  }
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors as Record<string, { message: string }>).map((e) => e.message).join(', ');
  }
  if (err.type === 'entity.too.large') { status = 413; message = 'Request too large'; }
  if (status >= 500) {
    console.error('[error]', err);
    if (process.env.NODE_ENV === 'production') message = 'Something went wrong. Please try again.';
  }
  res.status(status).json({ success: false, message });
};

export const pageParams = (q: Record<string, unknown>) => {
  const page = Math.max(parseInt(String(q.page ?? '1'), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(q.limit ?? '20'), 10) || 20, 1), 200);
  return { page, limit, skip: (page - 1) * limit };
};

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
